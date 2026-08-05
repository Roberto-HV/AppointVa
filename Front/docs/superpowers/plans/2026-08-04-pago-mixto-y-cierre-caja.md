# Pago Mixto y Cierre Formal de Caja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add split-payment support (two methods per appointment) and a persisted daily cash closeout record to the AppointVa Pagos module.

**Architecture:** Pago Mixto adds two nullable columns (`MetodoPago2`, `MontoPago2`) to the `Cita` entity; `MontoCobrado` remains the grand total and `MontoPago2` is the second-method slice. Cierre de Caja is a new persisted entity (`CierreCaja`) with a unique index on `(NegocioId, Fecha)`, storing retiros as a JSON column; a new `CierreCajaController` exposes GET + POST (upsert) endpoints restricted to `Propietario`.

**Tech Stack:** ASP.NET Core 8, EF Core 8 (SQL Server), xUnit + FluentAssertions + NSubstitute for tests; React 19 + TypeScript, TanStack Query v5, Tailwind CSS for the frontend.

## Global Constraints

- EF Core migrations: `dotnet ef migrations add <Name>` run from `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI`, then `dotnet ef database update`
- No new npm packages — Tailwind only for styles, lucide-react for icons already installed
- TypeScript strict — no `any` types
- `MontoCobrado` = grand total; `MontoPago2` = second-method amount; implied `MontoPago1 = MontoCobrado - MontoPago2`
- `CierreCaja` must be persisted — survives page reloads
- Retiros stored as JSON string column on `CierreCaja`
- Employees (`Roles.Empleado`) must NOT access cierre de caja endpoints — `Propietario` only
- Backend working dir: `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI`
- Frontend working dir: `c:\Cursos\AppointVa\Front\src`
- Controllers live in `Controllers/V1/`, Models in `Models/`, DTOs in `Models/Dtos/`
- Test project: `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI.Tests`
- Test helpers: `TestTokenHelper.Propietario()` / `TestTokenHelper.Empleado()` for JWT
- Integration tests use `CustomWebApplicationFactory` with InMemory EF + seeding inside `await using var scope = Factory.Services.CreateAsyncScope()`

---

## File Map

**Modified:**
- `Models/Cita.cs` — add `MetodoPago2`, `MontoPago2`
- `Models/Dtos/Citas/MarcarPagoDto.cs` — add `MetodoPago2`, `MontoPago2`
- `Models/Dtos/Citas/CitaDto.cs` — add `MetodoPago2`, `MontoPago2`
- `Controllers/V1/CitasController.cs` — map new fields in `MarcarPago()` and `MapearDto()`
- `Controllers/V1/ReportesController.cs` — fix efectivo/tarjeta totals to handle split payment
- `Data/ApplicationDbContext.cs` — add `DbSet<CierreCaja>` + model config
- `Front/src/types/index.ts` — extend `CitaDto`, add `RetiroItem`, `CierreCajaDto`, `GuardarCierreCajaDto`
- `Front/src/api/pagos.ts` — add `metodoPago2`, `montoPago2` to `RegistrarPagoPayload`
- `Front/src/pages/dashboard/PagosPage.tsx` — split-payment UI + cierre de caja section

**Created:**
- `Models/CierreCaja.cs`
- `Models/Dtos/Pagos/RetiroCajaDto.cs`
- `Models/Dtos/Pagos/GuardarCierreCajaDto.cs`
- `Models/Dtos/Pagos/CierreCajaDto.cs`
- `Controllers/V1/CierreCajaController.cs`
- `Front/src/api/cierreCaja.ts`
- `AppointVaAPI.Tests/Controllers/Integration/CierreCajaControllerTests.cs`
- `AppointVaAPI.Tests/Controllers/Integration/CitasPagoMixtoTests.cs`

---

### Task 1: Backend — Pago Mixto

**Files:**
- Modify: `Models/Cita.cs`
- Modify: `Models/Dtos/Citas/MarcarPagoDto.cs`
- Modify: `Models/Dtos/Citas/CitaDto.cs`
- Modify: `Controllers/V1/CitasController.cs`
- Modify: `Controllers/V1/ReportesController.cs`
- Create: EF Core migration (auto-generated)
- Create: `AppointVaAPI.Tests/Controllers/Integration/CitasPagoMixtoTests.cs`

**Interfaces:**
- Produces: `Cita.MetodoPago2 (string?)`, `Cita.MontoPago2 (decimal?)` persisted in DB
- Produces: `CitaDto.MetodoPago2`, `CitaDto.MontoPago2` returned from all GET endpoints
- Produces: `MarcarPagoDto.MetodoPago2`, `MarcarPagoDto.MontoPago2` accepted on PATCH `/api/citas/{id}/pago`
- Produces: corrected efectivo/tarjeta totals in `ReportesController` that use `MontoCobrado` and check both methods

- [ ] **Step 1: Write the failing integration test**

Create `AppointVaAPI.Tests/Controllers/Integration/CitasPagoMixtoTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Models.Dtos.Citas;
using FluentAssertions;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CitasPagoMixtoTests : IntegrationTestBase
{
    public CitasPagoMixtoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<Guid> SeedCitaAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppointVaAPI.Data.ApplicationDbContext>();

        var negocio = new AppointVaAPI.Models.Negocio
        {
            Id = Guid.NewGuid(), Nombre = "Test", Slug = "test-mixto",
            Email = "t@t.com", Telefono = "0000000000",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);

        var servicio = new AppointVaAPI.Models.Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id,
            Nombre = "Corte", Duracion = 30, Precio = 200m,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Servicios.Add(servicio);

        var empleado = new AppointVaAPI.Models.ApplicationUser
        {
            Id = Guid.NewGuid().ToString(), NegocioId = negocio.Id,
            UserName = "emp@test.com", Email = "emp@test.com",
            NormalizedEmail = "EMP@TEST.COM", NormalizedUserName = "EMP@TEST.COM"
        };
        db.Users.Add(empleado);

        var cliente = new AppointVaAPI.Models.Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id,
            Nombre = "Cliente", Telefono = "1111111111",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Clientes.Add(cliente);

        var cita = new AppointVaAPI.Models.Cita
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id,
            ServicioId = servicio.Id, EmpleadoId = empleado.Id, ClienteId = cliente.Id,
            Inicio = DateTime.UtcNow, Fin = DateTime.UtcNow.AddMinutes(30),
            Estado = "Completada", Precio = 200m,
            CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();

        SetToken(TestTokenHelper.Propietario(negocio.Id.ToString()));
        return cita.Id;
    }

    [Fact]
    public async Task MarcarPago_ConPagoMixto_PersistAmbosMetodos()
    {
        var citaId = await SeedCitaAsync();

        var dto = new MarcarPagoDto
        {
            Pagada = true,
            MetodoPago = "Efectivo",
            MontoCobrado = 200m,
            MontoRecibido = 200m,
            Cambio = 0m,
            MetodoPago2 = "Tarjeta",
            MontoPago2 = 80m
        };

        var response = await Client.PatchAsJsonAsync($"api/citas/{citaId}/pago", dto);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<CitaDto>();
        result!.MetodoPago.Should().Be("Efectivo");
        result.MontoPago2.Should().Be(80m);
        result.MetodoPago2.Should().Be("Tarjeta");
    }

    [Fact]
    public async Task MarcarPago_SinPago_LimpiaCamposMixtos()
    {
        var citaId = await SeedCitaAsync();

        // First mark as paid with split
        await Client.PatchAsJsonAsync($"api/citas/{citaId}/pago", new MarcarPagoDto
        {
            Pagada = true, MetodoPago = "Efectivo", MontoCobrado = 200m,
            MontoRecibido = 200m, Cambio = 0m, MetodoPago2 = "Tarjeta", MontoPago2 = 80m
        });

        // Then unmark
        var response = await Client.PatchAsJsonAsync($"api/citas/{citaId}/pago",
            new MarcarPagoDto { Pagada = false });
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<CitaDto>();
        result!.MetodoPago2.Should().BeNull();
        result.MontoPago2.Should().BeNull();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:\Cursos\AppointVa\Back\AppointVaAPI
dotnet test AppointVaAPI.Tests --filter "CitasPagoMixtoTests" -v minimal
```

Expected: FAIL — `MarcarPagoDto` has no `MetodoPago2`, `CitaDto` has no `MetodoPago2`.

- [ ] **Step 3: Add fields to `Models/Cita.cs`**

Open `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI\Models\Cita.cs`. After the `MetodoPago` property, add:

```csharp
[MaxLength(30)]
public string? MetodoPago2 { get; set; }

public decimal? MontoPago2 { get; set; }
```

- [ ] **Step 4: Add fields to `Models/Dtos/Citas/MarcarPagoDto.cs`**

Open the file and add after the existing `MetodoPago` property:

```csharp
[MaxLength(30)]
public string? MetodoPago2 { get; set; }

[Range(0, double.MaxValue)]
public decimal? MontoPago2 { get; set; }
```

- [ ] **Step 5: Add fields to `Models/Dtos/Citas/CitaDto.cs`**

After `MetodoPago` property add:

```csharp
public string? MetodoPago2 { get; set; }
public decimal? MontoPago2 { get; set; }
```

- [ ] **Step 6: Update `Controllers/V1/CitasController.cs` — `MarcarPago` method**

Find the block that sets `cita.Pagada ... cita.FechaActualizacion` and add two lines before `FechaActualizacion`:

```csharp
cita.MetodoPago2      = dto.Pagada ? dto.MetodoPago2      : null;
cita.MontoPago2       = dto.Pagada ? dto.MontoPago2       : null;
```

- [ ] **Step 7: Update `CitasController.cs` — `MapearDto` method**

Find `private static CitaDto MapearDto(Cita c)` and add inside the initializer:

```csharp
MetodoPago2  = c.MetodoPago2,
MontoPago2   = c.MontoPago2,
```

- [ ] **Step 8: Fix `Controllers/V1/ReportesController.cs` efectivo/tarjeta totals**

Find the lines:
```csharp
TotalIngresosEfectivo = completadas
    .Where(c => c.Pagada && c.MetodoPago?.ToLower() == "efectivo")
    .Sum(c => c.Precio),
TotalIngresosTarjeta = completadas
    .Where(c => c.Pagada && c.MetodoPago?.ToLower() == "tarjeta")
    .Sum(c => c.Precio),
```

Replace them with:

```csharp
TotalIngresosEfectivo = completadas
    .Where(c => c.Pagada && (
        string.Equals(c.MetodoPago, "Efectivo", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(c.MetodoPago2, "Efectivo", StringComparison.OrdinalIgnoreCase)))
    .Sum(c =>
    {
        decimal total = c.MontoCobrado ?? c.Precio;
        decimal m2 = c.MontoPago2 ?? 0m;
        decimal m1 = total - m2;
        decimal result = 0m;
        if (string.Equals(c.MetodoPago, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m1;
        if (string.Equals(c.MetodoPago2, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m2;
        return result;
    }),
TotalIngresosTarjeta = completadas
    .Where(c => c.Pagada && (
        string.Equals(c.MetodoPago, "Tarjeta", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(c.MetodoPago2, "Tarjeta", StringComparison.OrdinalIgnoreCase)))
    .Sum(c =>
    {
        decimal total = c.MontoCobrado ?? c.Precio;
        decimal m2 = c.MontoPago2 ?? 0m;
        decimal m1 = total - m2;
        decimal result = 0m;
        if (string.Equals(c.MetodoPago, "Tarjeta", StringComparison.OrdinalIgnoreCase)) result += m1;
        if (string.Equals(c.MetodoPago2, "Tarjeta", StringComparison.OrdinalIgnoreCase)) result += m2;
        return result;
    }),
```

- [ ] **Step 9: Generate and apply EF Core migration**

```powershell
cd c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI
dotnet ef migrations add AddPagoMixtoToCita
dotnet ef database update
```

Expected: migration file created, database updated.

- [ ] **Step 10: Run tests**

```powershell
cd c:\Cursos\AppointVa\Back\AppointVaAPI
dotnet test AppointVaAPI.Tests --filter "CitasPagoMixtoTests" -v minimal
```

Expected: 2 PASS.

- [ ] **Step 11: Commit**

```powershell
git add AppointVaAPI/Models/Cita.cs `
        AppointVaAPI/Models/Dtos/Citas/MarcarPagoDto.cs `
        AppointVaAPI/Models/Dtos/Citas/CitaDto.cs `
        AppointVaAPI/Controllers/V1/CitasController.cs `
        AppointVaAPI/Controllers/V1/ReportesController.cs `
        AppointVaAPI/Migrations/ `
        AppointVaAPI.Tests/Controllers/Integration/CitasPagoMixtoTests.cs
git commit -m "feat(pagos): add split-payment fields MetodoPago2/MontoPago2 to Cita"
```

---

### Task 2: Frontend — Pago Mixto

**Files:**
- Modify: `Front/src/types/index.ts`
- Modify: `Front/src/api/pagos.ts`
- Modify: `Front/src/pages/dashboard/PagosPage.tsx`

**Interfaces:**
- Consumes: `CitaDto.MetodoPago2`, `CitaDto.MontoPago2` from Task 1
- Produces: split-payment UI in checkout modal; updated payment badge and history display; updated corte/historial totals

- [ ] **Step 1: Extend types in `Front/src/types/index.ts`**

Find the `CitaDto` interface and add after `metodoPago`:

```typescript
metodoPago2?: string | null;
montoPago2?: number | null;
```

- [ ] **Step 2: Extend `RegistrarPagoPayload` in `Front/src/api/pagos.ts`**

Find the `RegistrarPagoPayload` type/interface and add:

```typescript
metodoPago2?: string;
montoPago2?: number;
```

- [ ] **Step 3: Read current `PagosPage.tsx` fully before editing**

Read `c:\Cursos\AppointVa\Front\src\pages\dashboard\PagosPage.tsx` — you need the exact line numbers before making changes. The file is ~1011 lines.

- [ ] **Step 4: Add split-payment state and computed values to `PagosPage.tsx`**

Inside the component, near the existing `metodoPago`/`montoCobradoInput` state declarations, add:

```typescript
const [isSplit, setIsSplit] = useState(false);
const [metodoPago2, setMetodoPago2] = useState<string>('Tarjeta');
const [montoPago2Input, setMontoPago2Input] = useState<string>('');
```

Add computed values near the existing `montoCobradoDec`, `cambio`, etc.:

```typescript
const montoPago2Dec = parseFloat(montoPago2Input) || 0;
const montoPago1Dec = isSplit ? Math.max(0, montoCobradoDec - montoPago2Dec) : montoCobradoDec;

const hayEfectivo =
  metodoPago === 'Efectivo' ||
  (isSplit && metodoPago2 === 'Efectivo');

const porcionEfectivo = (() => {
  if (!hayEfectivo) return 0;
  if (!isSplit) return montoCobradoDec;
  if (metodoPago === 'Efectivo') return montoPago1Dec;
  return montoPago2Dec;
})();

const cambio = hayEfectivo
  ? Math.max(0, montoRecibidoDec - porcionEfectivo)
  : 0;
```

Update `puedeConfirmar` to also validate split amounts:

```typescript
const puedeConfirmar =
  selectedCita !== null &&
  montoCobradoDec > 0 &&
  (!isSplit || (montoPago2Dec > 0 && montoPago2Dec < montoCobradoDec)) &&
  (!hayEfectivo || montoRecibidoDec >= porcionEfectivo);
```

- [ ] **Step 5: Update `mutPagar` payload to include split fields**

Find where `mutPagar` calls `pagosApi.registrarPago(...)` and add to the payload:

```typescript
...(isSplit && {
  metodoPago2,
  montoPago2: montoPago2Dec,
}),
```

Also update `cambio` in the payload to use the computed value from Step 4 instead of the previous inline formula.

- [ ] **Step 6: Add split-payment UI to the checkout modal**

Inside the payment confirmation modal, after the `MetodoPago` selector row and before the efectivo amount input, add a toggle button and conditional fields:

```tsx
{/* Split-payment toggle */}
<div className="flex items-center justify-between py-2">
  <span className="text-sm text-gray-600 dark:text-gray-400">Dividir pago</span>
  <button
    type="button"
    onClick={() => { setIsSplit(v => !v); setMontoPago2Input(''); }}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      isSplit ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
      isSplit ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
</div>

{isSplit && (
  <div className="space-y-3 border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Monto en {metodoPago}</label>
        <input
          readOnly
          value={montoPago1Dec.toFixed(2)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Segundo método</label>
        <select
          value={metodoPago2}
          onChange={e => setMetodoPago2(e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          {['Efectivo','Tarjeta','Transferencia'].filter(m => m !== metodoPago).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
    <div>
      <label className="block text-xs text-gray-500 mb-1">Monto en {metodoPago2}</label>
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={montoPago2Input}
        onChange={e => setMontoPago2Input(e.target.value)}
        placeholder="0.00"
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
      />
    </div>
  </div>
)}
```

The efectivo `MontoRecibido` field should only render when `hayEfectivo`:

```tsx
{hayEfectivo && (
  // existing MontoRecibido + cambio fields, using `porcionEfectivo` and updated `cambio`
)}
```

- [ ] **Step 7: Update payment badge display in `CitaCard`**

Where the payment method badge is displayed for paid citas, update to show both methods when split:

```tsx
{cita.pagada && (
  <span className="text-xs text-green-700 dark:text-green-400">
    {cita.metodoPago}
    {cita.metodoPago2 && ` + ${cita.metodoPago2}`}
  </span>
)}
```

- [ ] **Step 8: Update `HistorialRow` method display similarly**

Find where `metodoPago` is displayed in the history table/list and update the same way:

```tsx
{row.metodoPago}{row.metodoPago2 ? ` + ${row.metodoPago2}` : ''}
```

- [ ] **Step 9: Update corte desglose to use split-aware `montoParaMetodo` helper**

Add a helper function near the top of the component (outside JSX):

```typescript
function montoParaMetodo(cita: CitaDto, metodo: string): number {
  const total = cita.montoCobrado ?? cita.precio ?? 0;
  const m2 = cita.montoPago2 ?? 0;
  const m1 = total - m2;
  let result = 0;
  if (String(cita.metodoPago).toLowerCase() === metodo.toLowerCase()) result += m1;
  if (String(cita.metodoPago2).toLowerCase() === metodo.toLowerCase()) result += m2;
  return result;
}
```

Update all desglose accumulations in the corte tab to use `montoParaMetodo(cita, 'Efectivo')`, `montoParaMetodo(cita, 'Tarjeta')`, etc., instead of the previous flat `cita.montoCobrado` conditionals.

- [ ] **Step 10: Reset split state on modal close**

In the modal close/reset handler, add:

```typescript
setIsSplit(false);
setMetodoPago2('Tarjeta');
setMontoPago2Input('');
```

- [ ] **Step 11: Verify TypeScript compiles**

```powershell
cd c:\Cursos\AppointVa\Front
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 12: Commit**

```powershell
git add src/types/index.ts src/api/pagos.ts src/pages/dashboard/PagosPage.tsx
git commit -m "feat(pagos): split-payment UI and display in PagosPage"
```

---

### Task 3: Backend — Cierre Formal de Caja

**Files:**
- Create: `Models/CierreCaja.cs`
- Create: `Models/Dtos/Pagos/RetiroCajaDto.cs`
- Create: `Models/Dtos/Pagos/GuardarCierreCajaDto.cs`
- Create: `Models/Dtos/Pagos/CierreCajaDto.cs`
- Modify: `Data/ApplicationDbContext.cs`
- Create: `Controllers/V1/CierreCajaController.cs`
- Create: EF Core migration
- Create: `AppointVaAPI.Tests/Controllers/Integration/CierreCajaControllerTests.cs`

**Interfaces:**
- Produces: `GET /api/cierre-caja?fecha=YYYY-MM-DD` → `CierreCajaDto` (existing record or zero-value DTO with live `EfectivoCobrado`)
- Produces: `POST /api/cierre-caja` with `GuardarCierreCajaDto` body → upserts and returns `CierreCajaDto`
- Produces: formula: `EfectivoEsperado = EfectivoInicial + EfectivoCobrado - TotalRetiros`; `Diferencia = EfectivoContado - EfectivoEsperado`

- [ ] **Step 1: Write the failing integration tests**

Create `AppointVaAPI.Tests/Controllers/Integration/CierreCajaControllerTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Models.Dtos.Pagos;
using FluentAssertions;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CierreCajaControllerTests : IntegrationTestBase
{
    public CierreCajaControllerTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<(Guid negocioId, Guid citaId)> SeedAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppointVaAPI.Data.ApplicationDbContext>();

        var negocio = new AppointVaAPI.Models.Negocio
        {
            Id = Guid.NewGuid(), Nombre = "Test Caja", Slug = "test-caja",
            Email = "c@c.com", Telefono = "0000000000",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Negocios.Add(negocio);

        var servicio = new AppointVaAPI.Models.Servicio
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Corte",
            Duracion = 30, Precio = 300m,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Servicios.Add(servicio);

        var empleado = new AppointVaAPI.Models.ApplicationUser
        {
            Id = Guid.NewGuid().ToString(), NegocioId = negocio.Id,
            UserName = "e@c.com", Email = "e@c.com",
            NormalizedEmail = "E@C.COM", NormalizedUserName = "E@C.COM"
        };
        db.Users.Add(empleado);

        var cliente = new AppointVaAPI.Models.Cliente
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id, Nombre = "Cliente",
            Telefono = "1111111111",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Clientes.Add(cliente);

        var hoy = DateTime.UtcNow.Date;
        var cita = new AppointVaAPI.Models.Cita
        {
            Id = Guid.NewGuid(), NegocioId = negocio.Id,
            ServicioId = servicio.Id, EmpleadoId = empleado.Id, ClienteId = cliente.Id,
            Inicio = hoy.AddHours(10), Fin = hoy.AddHours(10).AddMinutes(30),
            Estado = "Completada", Precio = 300m,
            Pagada = true, MetodoPago = "Efectivo", MontoCobrado = 300m,
            FechaPago = hoy.AddHours(10).AddMinutes(30),
            CodigoConfirmacion = Guid.NewGuid().ToString("N")[..8].ToUpper(),
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        };
        db.Citas.Add(cita);
        await db.SaveChangesAsync();

        SetToken(TestTokenHelper.Propietario(negocio.Id.ToString()));
        return (negocio.Id, cita.Id);
    }

    [Fact]
    public async Task Get_SinCierreExistente_RetornaVacioConEfectivoCobrado()
    {
        var (_, _) = await SeedAsync();
        var fecha = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");

        var response = await Client.GetAsync($"api/cierre-caja?fecha={fecha}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<CierreCajaDto>();
        dto!.EfectivoCobrado.Should().Be(300m);
        dto.EfectivoInicial.Should().Be(0m);
        dto.EfectivoContado.Should().Be(0m);
    }

    [Fact]
    public async Task Post_GuardaCierre_YGetLoRetorna()
    {
        var (_, _) = await SeedAsync();
        var fecha = DateTime.UtcNow.Date.ToString("yyyy-MM-dd");

        var payload = new GuardarCierreCajaDto
        {
            Fecha = fecha,
            EfectivoInicial = 500m,
            EfectivoContado = 750m,
            Retiros = new List<RetiroCajaDto>
            {
                new() { Concepto = "Renta", Monto = 100m }
            }
        };

        var postResponse = await Client.PostAsJsonAsync("api/cierre-caja", payload);
        postResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var saved = await postResponse.Content.ReadFromJsonAsync<CierreCajaDto>();
        saved!.EfectivoInicial.Should().Be(500m);
        saved.EfectivoContado.Should().Be(750m);
        saved.TotalRetiros.Should().Be(100m);
        // EfectivoEsperado = 500 + 300 (cobrado) - 100 (retiro) = 700
        saved.EfectivoEsperado.Should().Be(700m);
        // Diferencia = 750 - 700 = 50
        saved.Diferencia.Should().Be(50m);

        // Verify persistence via GET
        var getResponse = await Client.GetAsync($"api/cierre-caja?fecha={fecha}");
        var retrieved = await getResponse.Content.ReadFromJsonAsync<CierreCajaDto>();
        retrieved!.EfectivoInicial.Should().Be(500m);
        retrieved.Retiros.Should().HaveCount(1);
    }

    [Fact]
    public async Task Post_Empleado_Retorna403()
    {
        var (negocioId, _) = await SeedAsync();
        SetToken(TestTokenHelper.Empleado(negocioId.ToString()));

        var payload = new GuardarCierreCajaDto
        {
            Fecha = DateTime.UtcNow.Date.ToString("yyyy-MM-dd"),
            EfectivoInicial = 0m, EfectivoContado = 0m
        };

        var response = await Client.PostAsJsonAsync("api/cierre-caja", payload);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
cd c:\Cursos\AppointVa\Back\AppointVaAPI
dotnet test AppointVaAPI.Tests --filter "CierreCajaControllerTests" -v minimal
```

Expected: FAIL — controller and entity don't exist yet.

- [ ] **Step 3: Create `Models/CierreCaja.cs`**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models;

public class CierreCaja
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public Guid NegocioId { get; set; }

    [ForeignKey("NegocioId")]
    public Negocio? Negocio { get; set; }

    [Required]
    public DateTime Fecha { get; set; }

    public decimal EfectivoInicial { get; set; }

    public decimal EfectivoContado { get; set; }

    public string RetirosJson { get; set; } = "[]";

    public DateTime? CerradoEn { get; set; }

    public Guid? CerradoPorId { get; set; }

    [ForeignKey("CerradoPorId")]
    public ApplicationUser? CerradoPor { get; set; }

    public DateTime FechaCreacion { get; set; }

    public DateTime FechaActualizacion { get; set; }
}
```

- [ ] **Step 4: Create `Models/Dtos/Pagos/RetiroCajaDto.cs`**

```csharp
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Pagos;

public class RetiroCajaDto
{
    [Required, MaxLength(100)]
    public string Concepto { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue)]
    public decimal Monto { get; set; }
}
```

- [ ] **Step 5: Create `Models/Dtos/Pagos/GuardarCierreCajaDto.cs`**

```csharp
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Pagos;

public class GuardarCierreCajaDto
{
    [Required]
    public string Fecha { get; set; } = string.Empty;

    [Range(0, double.MaxValue)]
    public decimal EfectivoInicial { get; set; }

    [Range(0, double.MaxValue)]
    public decimal EfectivoContado { get; set; }

    public List<RetiroCajaDto> Retiros { get; set; } = new();
}
```

- [ ] **Step 6: Create `Models/Dtos/Pagos/CierreCajaDto.cs`**

```csharp
namespace AppointVaAPI.Models.Dtos.Pagos;

public class CierreCajaDto
{
    public Guid Id { get; set; }
    public string Fecha { get; set; } = string.Empty;
    public decimal EfectivoInicial { get; set; }
    public decimal EfectivoContado { get; set; }
    public decimal EfectivoCobrado { get; set; }
    public decimal TotalRetiros { get; set; }
    public decimal EfectivoEsperado { get; set; }
    public decimal Diferencia { get; set; }
    public List<RetiroCajaDto> Retiros { get; set; } = new();
    public DateTime? CerradoEn { get; set; }
}
```

- [ ] **Step 7: Add `DbSet` and config to `Data/ApplicationDbContext.cs`**

Add DbSet alongside the existing ones:

```csharp
public DbSet<CierreCaja> CierresCaja { get; set; }
```

Inside `OnModelCreating`, add:

```csharp
modelBuilder.Entity<CierreCaja>(e =>
{
    e.HasOne(x => x.Negocio)
     .WithMany()
     .HasForeignKey(x => x.NegocioId)
     .OnDelete(DeleteBehavior.Cascade);

    e.HasOne(x => x.CerradoPor)
     .WithMany()
     .HasForeignKey(x => x.CerradoPorId)
     .OnDelete(DeleteBehavior.SetNull);

    e.HasIndex(x => new { x.NegocioId, x.Fecha }).IsUnique();

    e.Property(x => x.EfectivoInicial).HasPrecision(10, 2);
    e.Property(x => x.EfectivoContado).HasPrecision(10, 2);
});
```

- [ ] **Step 8: Create `Controllers/V1/CierreCajaController.cs`**

```csharp
using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Pagos;
using AppointVaAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1;

[ApiController]
[Route("api/cierre-caja")]
[Authorize(Roles = Roles.Propietario)]
public class CierreCajaController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IContextoNegocio _contexto;

    public CierreCajaController(ApplicationDbContext db, IContextoNegocio contexto)
    {
        _db = db;
        _contexto = contexto;
    }

    [HttpGet]
    public async Task<ActionResult<CierreCajaDto>> Get([FromQuery] string fecha)
    {
        if (!DateOnly.TryParse(fecha, out var fechaDate))
            return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");

        var fechaUtc = fechaDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var negocioId = _contexto.NegocioId;

        var cierre = await _db.CierresCaja
            .FirstOrDefaultAsync(c => c.NegocioId == negocioId && c.Fecha.Date == fechaUtc.Date);

        var efectivoCobrado = await ComputarEfectivoCobradoAsync(negocioId, fechaUtc);

        if (cierre is null)
        {
            return Ok(new CierreCajaDto
            {
                Fecha = fecha,
                EfectivoCobrado = efectivoCobrado
            });
        }

        return Ok(MapearDto(cierre, efectivoCobrado));
    }

    [HttpPost]
    public async Task<ActionResult<CierreCajaDto>> Guardar([FromBody] GuardarCierreCajaDto dto)
    {
        if (!DateOnly.TryParse(dto.Fecha, out var fechaDate))
            return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");

        var fechaUtc = fechaDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var negocioId = _contexto.NegocioId;

        var cierre = await _db.CierresCaja
            .FirstOrDefaultAsync(c => c.NegocioId == negocioId && c.Fecha.Date == fechaUtc.Date);

        var retirosJson = JsonSerializer.Serialize(dto.Retiros);

        if (cierre is null)
        {
            cierre = new CierreCaja
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId,
                Fecha = fechaUtc,
                EfectivoInicial = dto.EfectivoInicial,
                EfectivoContado = dto.EfectivoContado,
                RetirosJson = retirosJson,
                CerradoEn = DateTime.UtcNow,
                CerradoPorId = _contexto.UsuarioId,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };
            _db.CierresCaja.Add(cierre);
        }
        else
        {
            cierre.EfectivoInicial = dto.EfectivoInicial;
            cierre.EfectivoContado = dto.EfectivoContado;
            cierre.RetirosJson = retirosJson;
            cierre.CerradoEn = DateTime.UtcNow;
            cierre.CerradoPorId = _contexto.UsuarioId;
            cierre.FechaActualizacion = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        var efectivoCobrado = await ComputarEfectivoCobradoAsync(negocioId, fechaUtc);
        return Ok(MapearDto(cierre, efectivoCobrado));
    }

    private async Task<decimal> ComputarEfectivoCobradoAsync(Guid negocioId, DateTime fecha)
    {
        var citas = await _db.Citas
            .Where(c =>
                c.NegocioId == negocioId &&
                c.Pagada &&
                c.FechaPago.HasValue &&
                c.FechaPago.Value.Date == fecha.Date)
            .ToListAsync();

        return citas.Sum(c =>
        {
            var total = c.MontoCobrado ?? c.Precio;
            var m2 = c.MontoPago2 ?? 0m;
            var m1 = total - m2;
            decimal result = 0m;
            if (string.Equals(c.MetodoPago, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m1;
            if (string.Equals(c.MetodoPago2, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m2;
            return result;
        });
    }

    private static CierreCajaDto MapearDto(CierreCaja c, decimal efectivoCobrado)
    {
        var retiros = JsonSerializer.Deserialize<List<RetiroCajaDto>>(c.RetirosJson)
                      ?? new List<RetiroCajaDto>();
        var totalRetiros = retiros.Sum(r => r.Monto);
        var esperado = c.EfectivoInicial + efectivoCobrado - totalRetiros;
        var diferencia = c.EfectivoContado - esperado;

        return new CierreCajaDto
        {
            Id = c.Id,
            Fecha = c.Fecha.ToString("yyyy-MM-dd"),
            EfectivoInicial = c.EfectivoInicial,
            EfectivoContado = c.EfectivoContado,
            EfectivoCobrado = efectivoCobrado,
            TotalRetiros = totalRetiros,
            EfectivoEsperado = esperado,
            Diferencia = diferencia,
            Retiros = retiros,
            CerradoEn = c.CerradoEn
        };
    }
}
```

- [ ] **Step 9: Generate and apply migration**

```powershell
cd c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI
dotnet ef migrations add AddCierreCaja
dotnet ef database update
```

- [ ] **Step 10: Run tests**

```powershell
cd c:\Cursos\AppointVa\Back\AppointVaAPI
dotnet test AppointVaAPI.Tests --filter "CierreCajaControllerTests" -v minimal
```

Expected: 3 PASS.

- [ ] **Step 11: Commit**

```powershell
git add AppointVaAPI/Models/CierreCaja.cs `
        AppointVaAPI/Models/Dtos/Pagos/ `
        AppointVaAPI/Data/ApplicationDbContext.cs `
        AppointVaAPI/Controllers/V1/CierreCajaController.cs `
        AppointVaAPI/Migrations/ `
        AppointVaAPI.Tests/Controllers/Integration/CierreCajaControllerTests.cs
git commit -m "feat(caja): add CierreCaja entity and controller with GET/POST upsert"
```

---

### Task 4: Frontend — Cierre Formal de Caja

**Files:**
- Modify: `Front/src/types/index.ts`
- Create: `Front/src/api/cierreCaja.ts`
- Modify: `Front/src/pages/dashboard/PagosPage.tsx`

**Interfaces:**
- Consumes: `GET /api/cierre-caja?fecha=YYYY-MM-DD` and `POST /api/cierre-caja` from Task 3
- Produces: Cierre de caja section inside the Corte tab with: efectivo inicial input, retiros list, formula summary card, contado input, guardar button

- [ ] **Step 1: Add types to `Front/src/types/index.ts`**

Add these interfaces (after or near `CitaDto`):

```typescript
export interface RetiroItem {
  concepto: string;
  monto: number;
}

export interface CierreCajaDto {
  id?: string;
  fecha: string;
  efectivoInicial: number;
  efectivoContado: number;
  efectivoCobrado: number;
  totalRetiros: number;
  efectivoEsperado: number;
  diferencia: number;
  retiros: RetiroItem[];
  cerradoEn?: string | null;
}

export interface GuardarCierreCajaDto {
  fecha: string;
  efectivoInicial: number;
  efectivoContado: number;
  retiros: RetiroItem[];
}
```

- [ ] **Step 2: Create `Front/src/api/cierreCaja.ts`**

```typescript
import { api } from "./axios";
import type { CierreCajaDto, GuardarCierreCajaDto } from "../types";

export const cierreCajaApi = {
  obtener: async (fecha: string): Promise<CierreCajaDto> => {
    const { data } = await api.get("/cierre-caja", { params: { fecha } });
    return data;
  },
  guardar: async (payload: GuardarCierreCajaDto): Promise<CierreCajaDto> => {
    const { data } = await api.post("/cierre-caja", payload);
    return data;
  },
};
```

- [ ] **Step 3: Read `PagosPage.tsx` to find the Corte tab section**

Read `c:\Cursos\AppointVa\Front\src\pages\dashboard\PagosPage.tsx` paying attention to:
- How `corteDate` is declared (the selected date for the corte tab)
- Where the Corte tab content ends (find the closing JSX)
- The import list at the top (to add new imports)

- [ ] **Step 4: Add imports to `PagosPage.tsx`**

At the top, add `cierreCajaApi` import and `useMutation` if not already imported:

```typescript
import { cierreCajaApi } from "../../api/cierreCaja";
import type { CierreCajaDto, GuardarCierreCajaDto, RetiroItem } from "../../types";
```

Add `X` to the lucide-react icon imports if not present:

```typescript
import { ..., X } from "lucide-react";
```

- [ ] **Step 5: Add cierre state and query inside the component**

Near the corte-related state, add:

```typescript
const [cierreInicio, setCierreInicio] = useState<string>('');
const [cierreContado, setCierreContado] = useState<string>('');
const [retiros, setRetiros] = useState<RetiroItem[]>([]);
const [retiroConcepto, setRetiroConcepto] = useState('');
const [retiroMonto, setRetiroMonto] = useState('');
```

Add the query (below existing queries, using the same `corteDate` already declared):

```typescript
const { data: cierreData } = useQuery<CierreCajaDto>({
  queryKey: ['cierre-caja', corteDate],
  queryFn: () => cierreCajaApi.obtener(corteDate),
  enabled: activeTab === 'corte',
});
```

Add the mutation:

```typescript
const mutCierre = useMutation({
  mutationFn: (payload: GuardarCierreCajaDto) => cierreCajaApi.guardar(payload),
  onSuccess: (data) => {
    setCierreInicio(data.efectivoInicial.toFixed(2));
    setCierreContado(data.efectivoContado.toFixed(2));
    setRetiros(data.retiros);
    queryClient.invalidateQueries({ queryKey: ['cierre-caja', corteDate] });
  },
});
```

- [ ] **Step 6: Add useEffects for pre-population and reset**

```typescript
// Pre-populate from existing cierre when data loads
useEffect(() => {
  if (cierreData) {
    setCierreInicio(cierreData.efectivoInicial > 0 ? cierreData.efectivoInicial.toFixed(2) : '');
    setCierreContado(cierreData.efectivoContado > 0 ? cierreData.efectivoContado.toFixed(2) : '');
    setRetiros(cierreData.retiros ?? []);
  }
}, [cierreData]);

// Reset fields when date changes
useEffect(() => {
  setCierreInicio('');
  setCierreContado('');
  setRetiros([]);
}, [corteDate]);
```

- [ ] **Step 7: Add computed cierre values**

```typescript
const efectivoCobradoDia = cierreData?.efectivoCobrado ?? 0;
const inicioDec = parseFloat(cierreInicio) || 0;
const contadoDec = parseFloat(cierreContado) || 0;
const totalRetirosDec = retiros.reduce((s, r) => s + r.monto, 0);
const efectivoEsperado = inicioDec + efectivoCobradoDia - totalRetirosDec;
const diferencia = contadoDec - efectivoEsperado;
const cuadrado = Math.abs(diferencia) < 0.01;
```

- [ ] **Step 8: Add Cierre de Caja UI section inside the Corte tab**

After the existing Corte tab content (the desglose section), add:

```tsx
{/* Cierre formal de caja */}
<div className="mt-6 space-y-4">
  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
    Cierre formal de caja
  </h3>

  {/* 3-column grid: inicio / cobrado / contado */}
  <div className="grid grid-cols-3 gap-3">
    <div>
      <label className="block text-xs text-gray-500 mb-1">Efectivo inicial</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={cierreInicio}
        onChange={e => setCierreInicio(e.target.value)}
        placeholder="0.00"
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
      />
    </div>
    <div>
      <label className="block text-xs text-gray-500 mb-1">Cobrado en efectivo</label>
      <input
        readOnly
        value={efectivoCobradoDia.toFixed(2)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
      />
    </div>
    <div>
      <label className="block text-xs text-gray-500 mb-1">Efectivo contado</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={cierreContado}
        onChange={e => setCierreContado(e.target.value)}
        placeholder="0.00"
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
      />
    </div>
  </div>

  {/* Retiros */}
  <div>
    <p className="text-xs font-medium text-gray-500 mb-2">Retiros de caja</p>
    {retiros.map((r, i) => (
      <div key={i} className="flex items-center gap-2 mb-1">
        <span className="flex-1 text-sm">{r.concepto}</span>
        <span className="text-sm font-mono">${r.monto.toFixed(2)}</span>
        <button
          type="button"
          onClick={() => setRetiros(prev => prev.filter((_, j) => j !== i))}
          className="text-gray-400 hover:text-red-500"
        >
          <X size={14} />
        </button>
      </div>
    ))}
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={retiroConcepto}
        onChange={e => setRetiroConcepto(e.target.value)}
        placeholder="Concepto"
        className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
      />
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={retiroMonto}
        onChange={e => setRetiroMonto(e.target.value)}
        placeholder="Monto"
        className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => {
          const monto = parseFloat(retiroMonto);
          if (retiroConcepto.trim() && monto > 0) {
            setRetiros(prev => [...prev, { concepto: retiroConcepto.trim(), monto }]);
            setRetiroConcepto('');
            setRetiroMonto('');
          }
        }}
        className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
      >
        + Agregar
      </button>
    </div>
  </div>

  {/* Formula summary */}
  <div className={`rounded-xl p-4 border ${
    cuadrado
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
  }`}>
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">Inicio + Cobrado − Retiros</span>
        <span className="font-mono">${efectivoEsperado.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">Contado</span>
        <span className="font-mono">${contadoDec.toFixed(2)}</span>
      </div>
      <div className={`flex justify-between font-semibold border-t pt-1 mt-1 ${
        cuadrado ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
      }`}>
        <span>Diferencia</span>
        <span className="font-mono">{diferencia >= 0 ? '+' : ''}{diferencia.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <button
    type="button"
    disabled={mutCierre.isPending}
    onClick={() => mutCierre.mutate({
      fecha: corteDate,
      efectivoInicial: inicioDec,
      efectivoContado: contadoDec,
      retiros,
    })}
    className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
  >
    {mutCierre.isPending ? 'Guardando...' : 'Guardar cierre'}
  </button>
</div>
```

- [ ] **Step 9: Verify TypeScript compiles**

```powershell
cd c:\Cursos\AppointVa\Front
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```powershell
git add src/types/index.ts src/api/cierreCaja.ts src/pages/dashboard/PagosPage.tsx
git commit -m "feat(caja): cierre formal de caja UI in Corte tab with persist"
```

---

## Self-Review

**Spec coverage:**
- ✅ Pago Mixto: MetodoPago2 + MontoPago2 on Cita entity, DTO, controller, migration
- ✅ ReportesController totals corrected for split payments
- ✅ Frontend: split-payment toggle, second method selector, conditional efectivo field
- ✅ Frontend: updated badge/history display
- ✅ Cierre de Caja: new entity + migration + upsert controller
- ✅ Propietario-only on cierre endpoints (tested with Empleado 403 case)
- ✅ Retiros as JSON column
- ✅ Formula: EfectivoEsperado = inicio + cobrado - retiros
- ✅ Persisted — survives page reload (verified by GET after POST in test)
- ✅ No new npm packages

**Type consistency:**
- `RetiroItem` used in `types/index.ts`, `CierreCajaDto`, `GuardarCierreCajaDto`, and `cierreCaja.ts` — consistent
- `RetiroCajaDto` (backend C#) maps 1:1 to `RetiroItem` (frontend TS)
- `montoParaMetodo` in Task 2 Step 9 uses `CitaDto` fields added in Task 2 Step 1 — consistent

**Placeholder scan:** No TBDs or TODOs in plan steps.
