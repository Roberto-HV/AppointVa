# Anticipos / Depósitos + Reestructuración Mi Negocio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable deposit/anticipo system and reorganize the Mi Negocio settings page from 3 disorganized tabs into 5 semantic ones.

**Architecture:** Three lifecycle moments: (1) Propietario configures anticipo percentage in Mi Negocio → Anticipos tab; (2) any employee confirms receipt of the deposit via CitasPage badge/button; (3) PagosPage checkout auto-credits the confirmed deposit with a green banner and pre-filled total. Mi Negocio restructures from Perfil/Configuracion/Horarios to Perfil/Citas/Anticipos/Horarios/Cuenta.

**Tech Stack:** ASP.NET Core 8 / EF Core (SQL Server) / React 19 + TypeScript / TanStack Query v5 / Tailwind CSS / react-hook-form + Zod

## Global Constraints

- Backend project dir: `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI`
- Frontend src dir: `c:\Cursos\AppointVa\Front\src`
- EF Core migrations: run from `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI` with `dotnet ef migrations add <Name>` then `dotnet ef database update`
- Test project: `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI.Tests`
- Run all tests: `dotnet test` from `c:\Cursos\AppointVa\Back\AppointVaAPI`
- No new npm packages
- Tailwind only for styles; no inline styles
- TypeScript strict — no `any` types
- C# monetary fields: `[Column(TypeName = "decimal(10,2)")]`
- `PorcentajeAnticipo` range: 0–80 (int) — 0 means "no anticipo configured"
- `HorasCancelacionConReembolso` default: 24
- Roles: `Roles.Propietario`, `Roles.Empleado` from `AppointVaAPI/Constants/Roles.cs`
- Controller-level auth on CitasController: `[Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]` — PATCH anticipo needs no per-method override
- `Cita.MontoAnticipo` is a snapshot set at booking time — NOT the same as `Negocio.MontoAnticipo` (deprecated fixed-amount field, kept for DB backwards compat)

---

### Task 1: Backend — Negocio anticipo percentage fields

**Files:**
- Modify: `AppointVaAPI/Models/Negocio.cs`
- Modify: `AppointVaAPI/Models/Dtos/Negocios/NegocioDto.cs`
- Modify: `AppointVaAPI/Models/Dtos/Negocios/ActualizarNegocioDto.cs`
- Modify: `AppointVaAPI/Controllers/V1/NegociosController.cs`
- Modify: `AppointVaAPI/Models/Dtos/Publico/ConfirmacionCitaDto.cs`
- Modify: `AppointVaAPI/Controllers/V1/PublicoController.cs`
- Create: migration `AddAnticipoFieldsToNegocio`
- Test: `AppointVaAPI.Tests/Controllers/Integration/NegocioAnticipoTests.cs`

**Interfaces:**
- Produces: `negocio.PorcentajeAnticipo (int)`, `negocio.HorasCancelacionConReembolso (int)`, `negocio.PoliticaCancelacionAnticipo (string)` — consumed by Task 2 (Cita snapshot computation) and Task 6 (frontend Anticipos tab)

- [ ] **Step 1: Add 3 fields to `Negocio.cs`**

After the existing `InstruccionesAnticipo` property:

```csharp
public int PorcentajeAnticipo { get; set; } = 0;
public int HorasCancelacionConReembolso { get; set; } = 24;
[MaxLength(500)]
public string PoliticaCancelacionAnticipo { get; set; } = string.Empty;
```

- [ ] **Step 2: Add same fields to `NegocioDto.cs`**

```csharp
public int PorcentajeAnticipo { get; set; }
public int HorasCancelacionConReembolso { get; set; }
public string PoliticaCancelacionAnticipo { get; set; } = string.Empty;
```

- [ ] **Step 3: Add same fields to `ActualizarNegocioDto.cs`**

```csharp
[Range(0, 80)]
public int? PorcentajeAnticipo { get; set; }
[Range(0, 720)]
public int? HorasCancelacionConReembolso { get; set; }
[MaxLength(500)]
public string? PoliticaCancelacionAnticipo { get; set; }
```

- [ ] **Step 4: Update `NegociosController.cs` — `ActualizarPerfil` mutation mapping**

In `ActualizarPerfil` (`[HttpPut("perfil")]`), after the existing `negocio.InstruccionesAnticipo = dto.InstruccionesAnticipo;` line, add:

```csharp
if (dto.PorcentajeAnticipo.HasValue)
    negocio.PorcentajeAnticipo = dto.PorcentajeAnticipo.Value;
if (dto.HorasCancelacionConReembolso.HasValue)
    negocio.HorasCancelacionConReembolso = dto.HorasCancelacionConReembolso.Value;
if (dto.PoliticaCancelacionAnticipo is not null)
    negocio.PoliticaCancelacionAnticipo = dto.PoliticaCancelacionAnticipo;
```

- [ ] **Step 5: Update `NegociosController.cs` — `MapearDto` static method**

In `private static NegocioDto MapearDto(Negocio n)`, after `InstruccionesAnticipo = n.InstruccionesAnticipo,`, add:

```csharp
PorcentajeAnticipo = n.PorcentajeAnticipo,
HorasCancelacionConReembolso = n.HorasCancelacionConReembolso,
PoliticaCancelacionAnticipo = n.PoliticaCancelacionAnticipo,
```

- [ ] **Step 6: Add 2 fields to `ConfirmacionCitaDto.cs`**

After the existing `InstruccionesAnticipo` property:

```csharp
public int PorcentajeAnticipo { get; set; }
public string PoliticaCancelacionAnticipo { get; set; } = string.Empty;
```

- [ ] **Step 7: Update `PublicoController.cs` — populate new fields in all `ConfirmacionCitaDto` usages**

Search for every place `ConfirmacionCitaDto` is constructed (there are typically 2: POST /publico/citas response and GET /publico/citas/{codigo} response). In each, after `InstruccionesAnticipo = negocio.InstruccionesAnticipo,`, add:

```csharp
PorcentajeAnticipo = negocio.PorcentajeAnticipo,
PoliticaCancelacionAnticipo = negocio.PoliticaCancelacionAnticipo,
```

- [ ] **Step 8: Write integration test**

Create `AppointVaAPI.Tests/Controllers/Integration/NegocioAnticipoTests.cs`:

```csharp
using System.Net.Http.Json;
using AppointVaAPI.Models.Dtos.Negocios;
using AppointVaAPI.Tests.Helpers;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class NegocioAnticipoTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public NegocioAnticipoTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ActualizarPerfil_NuevosCamposAnticipo_GuardaYDevuelveCorrectamente()
    {
        // Arrange
        var negocioId = Guid.NewGuid();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(negocioId));
        await _factory.SeedNegocioAsync(negocioId);

        var dto = new
        {
            Nombre = "Salon Test",
            PorcentajeAnticipo = 30,
            HorasCancelacionConReembolso = 48,
            PoliticaCancelacionAnticipo = "Sin reembolso después de 48 horas."
        };

        // Act
        var response = await client.PutAsJsonAsync("/api/negocios/perfil", dto);

        // Assert
        response.EnsureSuccessStatusCode();
        var negocio = await response.Content.ReadFromJsonAsync<NegocioDto>();
        Assert.NotNull(negocio);
        Assert.Equal(30, negocio!.PorcentajeAnticipo);
        Assert.Equal(48, negocio.HorasCancelacionConReembolso);
        Assert.Equal("Sin reembolso después de 48 horas.", negocio.PoliticaCancelacionAnticipo);
    }

    [Fact]
    public async Task ActualizarPerfil_PorcentajeFueraDe80_DevuelveBadRequest()
    {
        // Arrange
        var negocioId = Guid.NewGuid();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(negocioId));
        await _factory.SeedNegocioAsync(negocioId);

        var dto = new { Nombre = "Salon Test", PorcentajeAnticipo = 90 };

        // Act
        var response = await client.PutAsJsonAsync("/api/negocios/perfil", dto);

        // Assert
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

> **Note:** `SeedNegocioAsync` seeds a Negocio with the given Id. Follow the same seeding pattern used in `CierreCajaControllerTests.cs`.

- [ ] **Step 9: Run tests**

```
dotnet test AppointVaAPI.Tests --filter "NegocioAnticipoTests"
```

Expected: 2 passing.

- [ ] **Step 10: Create EF Core migration**

```
dotnet ef migrations add AddAnticipoFieldsToNegocio
dotnet ef database update
```

Run from: `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI`

- [ ] **Step 11: Commit**

```
git add -A
git commit -m "feat(anticipos): agregar campos de porcentaje y política a Negocio"
```

---

### Task 2: Backend — Cita anticipo fields + PATCH endpoint

**Files:**
- Modify: `AppointVaAPI/Models/Cita.cs`
- Modify: `AppointVaAPI/Models/Dtos/Citas/CitaDto.cs`
- Create: `AppointVaAPI/Models/Dtos/Citas/MarcarAnticipoDto.cs`
- Modify: `AppointVaAPI/Controllers/V1/CitasController.cs`
- Modify: `AppointVaAPI/Controllers/V1/PublicoController.cs`
- Create: migration `AddAnticipoFieldsToCita`
- Test: `AppointVaAPI.Tests/Controllers/Integration/CitasAnticipoTests.cs`

**Interfaces:**
- Consumes: `Negocio.PorcentajeAnticipo` from Task 1
- Produces: `PATCH api/citas/{id}/anticipo`, `CitaDto.AnticipoRecibido`, `CitaDto.MontoAnticipo` — consumed by Tasks 3, 4, 5

- [ ] **Step 1: Add 6 fields to `Cita.cs`**

After the existing `FechaPago` property:

```csharp
public bool AnticipoRequerido { get; set; } = false;
[Column(TypeName = "decimal(10,2)")]
public decimal? MontoAnticipo { get; set; }
public bool AnticipoRecibido { get; set; } = false;
public Guid? AnticipoRecibidoPorId { get; set; }
[MaxLength(100)]
public string? AnticipoRecibidoPorNombre { get; set; }
public DateTime? AnticipoRecibidoEn { get; set; }
```

> **Note:** `MontoAnticipo` here is the SNAPSHOT set at booking time (different from `Negocio.MontoAnticipo` which is the deprecated fixed-amount field).

- [ ] **Step 2: Add 5 fields to `CitaDto.cs` (C#)**

After the existing `FechaPago` property:

```csharp
public bool AnticipoRequerido { get; set; }
public decimal? MontoAnticipo { get; set; }
public bool AnticipoRecibido { get; set; }
public string? AnticipoRecibidoPorNombre { get; set; }
public DateTime? AnticipoRecibidoEn { get; set; }
```

- [ ] **Step 3: Create `MarcarAnticipoDto.cs`**

Create `AppointVaAPI/Models/Dtos/Citas/MarcarAnticipoDto.cs`:

```csharp
namespace AppointVaAPI.Models.Dtos.Citas;

public class MarcarAnticipoDto
{
    public bool Recibido { get; set; }
}
```

- [ ] **Step 4: Update `CitasController.cs` — `MapearDto` static method**

In `private static CitaDto MapearDto(Cita c)`, after the existing `FechaPago = c.FechaPago,` line, add:

```csharp
AnticipoRequerido = c.AnticipoRequerido,
MontoAnticipo = c.MontoAnticipo,
AnticipoRecibido = c.AnticipoRecibido,
AnticipoRecibidoPorNombre = c.AnticipoRecibidoPorNombre,
AnticipoRecibidoEn = c.AnticipoRecibidoEn,
```

- [ ] **Step 5: Add PATCH endpoint to `CitasController.cs`**

Add after the existing `MarcarPago` method:

```csharp
// PATCH api/citas/{id}/anticipo
[HttpPatch("{id:guid}/anticipo")]
public async Task<IActionResult> MarcarAnticipo(Guid id, [FromBody] MarcarAnticipoDto dto)
{
    if (_contexto.NegocioId is null) return Unauthorized();

    var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
    if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

    if (dto.Recibido)
    {
        cita.AnticipoRecibido = true;
        cita.AnticipoRecibidoPorId = _contexto.UsuarioId;
        if (_contexto.UsuarioId.HasValue)
        {
            var userId = _contexto.UsuarioId.Value.ToString();
            cita.AnticipoRecibidoPorNombre = await _db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.UserName ?? u.Email)
                .FirstOrDefaultAsync();
        }
        cita.AnticipoRecibidoEn = DateTime.UtcNow;
    }
    else
    {
        cita.AnticipoRecibido = false;
        cita.AnticipoRecibidoPorId = null;
        cita.AnticipoRecibidoPorNombre = null;
        cita.AnticipoRecibidoEn = null;
    }
    cita.FechaActualizacion = DateTime.UtcNow;

    await _citaRepo.ActualizarAsync(cita);
    return Ok(MapearDto(cita));
}
```

- [ ] **Step 6: Update `CitasController.Crear` — snapshot anticipo at booking time**

In the `Crear` method, after `var servicio = await _servicioRepo.ObtenerPorIdAsync(...)`, add a negocio query:

```csharp
var negocioAnticipo = await _db.Negocios
    .Where(n => n.Id == negocioId)
    .Select(n => new { n.RequiereAnticipo, n.PorcentajeAnticipo })
    .FirstOrDefaultAsync();
```

Then in the `cita = new Cita { ... }` object initializer (after `Precio = servicio.Precio,`), add:

```csharp
AnticipoRequerido = negocioAnticipo?.RequiereAnticipo ?? false,
MontoAnticipo = (negocioAnticipo?.RequiereAnticipo == true && negocioAnticipo.PorcentajeAnticipo > 0)
    ? Math.Round(servicio.Precio * negocioAnticipo.PorcentajeAnticipo / 100m, 2)
    : (decimal?)null,
```

- [ ] **Step 7: Update `PublicoController.CrearCita` — snapshot anticipo at public booking**

The negocio object is already loaded in `CrearCita`. In the `cita = new Cita { ... }` object initializer (after `Precio = precioFinal,`), add:

```csharp
AnticipoRequerido = negocio.RequiereAnticipo,
MontoAnticipo = (negocio.RequiereAnticipo && negocio.PorcentajeAnticipo > 0)
    ? Math.Round(precioFinal * negocio.PorcentajeAnticipo / 100m, 2)
    : (decimal?)null,
```

- [ ] **Step 8: Write integration tests**

Create `AppointVaAPI.Tests/Controllers/Integration/CitasAnticipoTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class CitasAnticipoTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public CitasAnticipoTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task<(Guid negocioId, Guid citaId)> SeedCitaConAnticipoAsync()
    {
        var negocioId = Guid.NewGuid();
        var citaId = Guid.NewGuid();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppointVaAPI.Data.ApplicationDbContext>();

        await _factory.SeedNegocioAsync(negocioId);

        var empleadoId = Guid.NewGuid();
        var clienteId = Guid.NewGuid();
        var servicioId = Guid.NewGuid();

        db.Empleados.Add(new AppointVaAPI.Models.Empleado
        {
            Id = empleadoId, NegocioId = negocioId, Nombre = "Test Empleado",
            Email = "emp@test.com", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        db.Clientes.Add(new AppointVaAPI.Models.Cliente
        {
            Id = clienteId, NegocioId = negocioId, NombreCompleto = "Cliente Test",
            Telefono = "5551234567", FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        db.Servicios.Add(new AppointVaAPI.Models.Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte", Precio = 200m,
            DuracionMinutos = 30, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        db.Citas.Add(new Cita
        {
            Id = citaId, NegocioId = negocioId, CodigoConfirmacion = "TST001",
            ClienteId = clienteId, EmpleadoId = empleadoId, ServicioId = servicioId,
            InicioEn = DateTime.UtcNow.AddDays(1), FinEn = DateTime.UtcNow.AddDays(1).AddMinutes(30),
            Estado = 2, Precio = 200m,
            AnticipoRequerido = true, MontoAnticipo = 50m,
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        return (negocioId, citaId);
    }

    [Fact]
    public async Task MarcarAnticipo_Recibido_True_SetsCamposCorrectamente()
    {
        // Arrange
        var (negocioId, citaId) = await SeedCitaConAnticipoAsync();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(negocioId));

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/citas/{citaId}/anticipo",
            new { Recibido = true });

        // Assert
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<CitaDto>();
        Assert.NotNull(dto);
        Assert.True(dto!.AnticipoRecibido);
        Assert.NotNull(dto.AnticipoRecibidoEn);
    }

    [Fact]
    public async Task MarcarAnticipo_Recibido_False_LimpiaLasCampos()
    {
        // Arrange
        var (negocioId, citaId) = await SeedCitaConAnticipoAsync();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Propietario(negocioId));
        await client.PatchAsJsonAsync($"/api/citas/{citaId}/anticipo", new { Recibido = true });

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/citas/{citaId}/anticipo",
            new { Recibido = false });

        // Assert
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<CitaDto>();
        Assert.NotNull(dto);
        Assert.False(dto!.AnticipoRecibido);
        Assert.Null(dto.AnticipoRecibidoEn);
    }

    [Fact]
    public async Task MarcarAnticipo_ComoEmpleado_Devuelve200()
    {
        // Arrange
        var (negocioId, citaId) = await SeedCitaConAnticipoAsync();
        var client = _factory.CreateAuthenticatedClient(TestTokenHelper.Empleado(negocioId));

        // Act
        var response = await client.PatchAsJsonAsync(
            $"/api/citas/{citaId}/anticipo",
            new { Recibido = true });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

- [ ] **Step 9: Run tests**

```
dotnet test AppointVaAPI.Tests --filter "CitasAnticipoTests"
```

Expected: 3 passing.

- [ ] **Step 10: Run full test suite**

```
dotnet test AppointVaAPI.Tests
```

Expected: all existing tests still pass.

- [ ] **Step 11: Create EF Core migration**

```
dotnet ef migrations add AddAnticipoFieldsToCita
dotnet ef database update
```

- [ ] **Step 12: Commit**

```
git add -A
git commit -m "feat(anticipos): agregar campos de anticipo a Cita y endpoint PATCH"
```

---

### Task 3: Frontend — TypeScript types + API function

**Files:**
- Modify: `Front/src/types/index.ts`
- Modify: `Front/src/api/citas.ts`

**Interfaces:**
- Produces: `citasApi.registrarAnticipo(id, recibido)` — consumed by Tasks 4 and 5

- [ ] **Step 1: Add anticipo fields to `CitaDto` interface in `types/index.ts`**

Find the `CitaDto` interface. After the existing `fechaPago?: string | null;` line, add:

```typescript
anticipoRequerido?: boolean;
montoAnticipo?: number | null;
anticipoRecibido?: boolean;
anticipoRecibidoPorNombre?: string | null;
anticipoRecibidoEn?: string | null;
```

- [ ] **Step 2: Add anticipo percentage fields to `NegocioDto` interface in `types/index.ts`**

Find the `NegocioDto` interface. After the existing `instruccionesAnticipo?: string;` line, add:

```typescript
porcentajeAnticipo?: number;
horasCancelacionConReembolso?: number;
politicaCancelacionAnticipo?: string;
```

- [ ] **Step 3: Add `registrarAnticipo` function to `api/citas.ts`**

After the existing `actualizarNotas` function, add:

```typescript
registrarAnticipo: async (id: string, recibido: boolean): Promise<CitaDto> => {
  const { data } = await api.patch<CitaDto>(`/citas/${id}/anticipo`, { recibido });
  return data;
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```
cd c:\Cursos\AppointVa\Front && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```
git add Front/src/types/index.ts Front/src/api/citas.ts
git commit -m "feat(anticipos): tipos TypeScript y función API para anticipo"
```

---

### Task 4: Frontend — CitasPage anticipo badge + button

**Files:**
- Modify: `Front/src/pages/dashboard/CitasPage.tsx`

**Interfaces:**
- Consumes: `citasApi.registrarAnticipo` from Task 3, `CitaDto.anticipoRequerido`, `CitaDto.anticipoRecibido`, `CitaDto.montoAnticipo`

- [ ] **Step 1: Add `useMutation` for anticipo in `CitasPage.tsx`**

Find where other `useMutation` hooks are declared (near the top of the component, after `useQueryClient()`). Add:

```typescript
const mutAnticipo = useMutation({
  mutationFn: ({ id, recibido }: { id: string; recibido: boolean }) =>
    citasApi.registrarAnticipo(id, recibido),
  onSuccess: (_, { recibido }) => {
    queryClient.invalidateQueries({ queryKey: ['citas'] });
    toast.success(recibido ? 'Anticipo registrado' : 'Anticipo anulado');
  },
  onError: () => toast.error('No se pudo actualizar el anticipo'),
});
```

> Use the same `toast` import already used in the file.

- [ ] **Step 2: Add anticipo badge to each cita row**

Find the Estado cell in the cita table row. In the section that renders cita status chips/badges, add the anticipo badge alongside existing badges. The badge shows only when `c.anticipoRequerido`:

```tsx
{c.anticipoRequerido && (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
    c.anticipoRecibido
      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
      : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500'
  }`}>
    {c.anticipoRecibido ? '✓ Anticipo' : '⏳ Anticipo'}
  </span>
)}
```

- [ ] **Step 3: Add anticipo button to the desktop actions cell**

Find the desktop actions `<div className="flex justify-end items-center gap-2">`. After the comprobante button (the `🧾` button near line 740), add:

```tsx
{c.anticipoRequerido && !c.pagada && (
  <Tooltip text={c.anticipoRecibido ? 'Anular anticipo' : `Registrar anticipo $${(c.montoAnticipo ?? 0).toFixed(2)}`}>
    <button
      onClick={() => mutAnticipo.mutate({ id: c.id, recibido: !c.anticipoRecibido })}
      disabled={mutAnticipo.isPending && mutAnticipo.variables?.id === c.id}
      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition disabled:opacity-50 ${
        c.anticipoRecibido
          ? 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
          : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
      }`}
    >
      {c.anticipoRecibido ? '↩ Anticipo' : '$ Anticipo'}
    </button>
  </Tooltip>
)}
```

- [ ] **Step 4: Verify in browser**

1. Start the dev server (already running on port 3000)
2. Navigate to Citas
3. Verify: for a cita without `anticipoRequerido`, no badge or button appears
4. To test with a real cita, temporarily set `RequiereAnticipo=true` and `PorcentajeAnticipo=20` on a negocio via the API or DB, create a new cita, and verify the amber badge and `$ Anticipo` button appear

- [ ] **Step 5: Verify TypeScript compiles**

```
cd c:\Cursos\AppointVa\Front && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```
git add Front/src/pages/dashboard/CitasPage.tsx
git commit -m "feat(anticipos): badge y botón de anticipo en CitasPage"
```

---

### Task 5: Frontend — PagosPage checkout banner + pre-fill

**Files:**
- Modify: `Front/src/pages/dashboard/PagosPage.tsx`

**Interfaces:**
- Consumes: `CitaDto.anticipoRecibido`, `CitaDto.montoAnticipo` from Task 3

- [ ] **Step 1: Add `montoCobradoInput` state in `PagosPage.tsx`**

Find the existing cobro modal state declarations (around line 81). Add:

```typescript
const [montoCobradoInput, setMontoCobradoInput] = useState<string>('');
```

- [ ] **Step 2: Update `montoCobradoDec` derived value**

Find the line `const montoCobradoDec = citaSel?.precio ?? 0;`. Replace it with:

```typescript
const montoCobradoDec = montoCobradoInput !== ''
  ? (parseFloat(montoCobradoInput) || 0)
  : (citaSel?.precio ?? 0);
```

- [ ] **Step 3: Pre-fill `montoCobradoInput` in `onCobrar` handler**

Find the `onCobrar={() => { setCitaSel(cita); ... }}` handler inside the `CitaCard` render loop. Add these lines inside the handler:

```typescript
if (cita.anticipoRecibido && cita.montoAnticipo) {
  setMontoCobradoInput(
    String(Math.max(0, cita.precio - cita.montoAnticipo))
  );
} else {
  setMontoCobradoInput('');
}
```

- [ ] **Step 4: Reset `montoCobradoInput` on modal close**

Find the `onCerrar` handler of the cobro `<Modal>` (where `setCitaSel(null)` is called). Add:

```typescript
setMontoCobradoInput('');
```

- [ ] **Step 5: Add anticipo banner to the cobro modal**

Inside the cobro `<Modal>`, find the summary card that shows `citaSel.nombreCliente` and `citaSel.precio`. After that card, add:

```tsx
{citaSel?.anticipoRecibido && citaSel.montoAnticipo && (
  <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
    <div className="text-sm text-emerald-800 dark:text-emerald-300">
      <span className="font-semibold">Anticipo registrado: ${citaSel.montoAnticipo.toFixed(2)}</span>
      <br />
      <span className="text-xs">Total a cobrar ajustado automáticamente. Puedes modificarlo abajo.</span>
    </div>
  </div>
)}
```

> `CheckCircle2` is already imported in `PagosPage.tsx`.

- [ ] **Step 6: Add editable total input when anticipo is active**

In the cobro modal, after the anticipo banner (Step 5), add an editable input for the override. This only shows when `anticipoRecibido`:

```tsx
{citaSel?.anticipoRecibido && citaSel.montoAnticipo && (
  <div>
    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
      Total a cobrar
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={montoCobradoInput}
        onChange={e => setMontoCobradoInput(e.target.value)}
        className="w-full pl-7 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
    </div>
    <p className="text-xs text-gray-400 mt-1">
      Precio original: ${citaSel.precio.toFixed(2)} — Anticipo: −${citaSel.montoAnticipo.toFixed(2)}
    </p>
  </div>
)}
```

- [ ] **Step 7: Verify in browser**

1. In the DB or via API, create a cita with `AnticipoRecibido=true`, `MontoAnticipo=50`, `Precio=200`
2. Open Pagos → click Cobrar on that cita
3. Verify: green banner appears, "Total a cobrar" input is pre-filled with 150.00
4. Verify: changing the input updates the cambio calculation correctly

- [ ] **Step 8: Verify TypeScript compiles**

```
cd c:\Cursos\AppointVa\Front && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```
git add Front/src/pages/dashboard/PagosPage.tsx
git commit -m "feat(anticipos): banner de anticipo y pre-fill en checkout de PagosPage"
```

---

### Task 6: Frontend — Mi Negocio restructuring + Anticipos tab

**Files:**
- Modify: `Front/src/pages/dashboard/PerfilPage.tsx`

**Interfaces:**
- Consumes: `NegocioDto.porcentajeAnticipo`, `NegocioDto.horasCancelacionConReembolso`, `NegocioDto.politicaCancelacionAnticipo` from Task 3

- [ ] **Step 1: Update `Tab` type and initial state**

Find the `type Tab = "perfil" | "configuracion" | "horarios";` declaration. Replace with:

```typescript
type Tab = "perfil" | "citas" | "anticipos" | "horarios" | "cuenta";
```

Find the `useState<Tab>` call that reads from `searchParams.get("tab")`. Replace the validation array with the new set of tabs:

```typescript
const [tab, setTab] = useState<Tab>(
  tabParam && ["perfil", "citas", "anticipos", "horarios", "cuenta"].includes(tabParam)
    ? tabParam as Tab
    : "perfil"
);
```

- [ ] **Step 2: Update Zod schema — add 3 new fields**

Find the Zod schema declaration for the form (it includes fields like `requiereAnticipo`, `montoAnticipo`). Add:

```typescript
porcentajeAnticipo: z.number().int().min(0).max(80).default(0),
horasCancelacionConReembolso: z.number().int().min(0).default(24),
politicaCancelacionAnticipo: z.string().max(500).default(''),
```

- [ ] **Step 3: Update form `reset` call with new default values**

Find the `useEffect` that calls `reset({ ... })` when the negocio data loads. Add the three new fields:

```typescript
porcentajeAnticipo: negocio.porcentajeAnticipo ?? 0,
horasCancelacionConReembolso: negocio.horasCancelacionConReembolso ?? 24,
politicaCancelacionAnticipo: negocio.politicaCancelacionAnticipo ?? '',
```

- [ ] **Step 4: Update form `onSubmit` — add new fields to PUT payload**

Find the `onSubmit` function that calls `PUT /api/negocios/perfil`. Add the three new fields to the payload:

```typescript
porcentajeAnticipo: data.porcentajeAnticipo,
horasCancelacionConReembolso: data.horasCancelacionConReembolso,
politicaCancelacionAnticipo: data.politicaCancelacionAnticipo,
```

- [ ] **Step 5: Replace the 3-tab switcher with the 5-tab switcher**

Find the `<div className="flex gap-1 bg-gray-100 ...">` that contains the tab buttons. Replace the entire block with:

```tsx
<div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6 overflow-x-auto">
  {([
    { id: "perfil", label: "Perfil" },
    { id: "citas", label: "Citas" },
    { id: "anticipos", label: "Anticipos" },
    { id: "horarios", label: "Horarios" },
    { id: "cuenta", label: "Cuenta" },
  ] as { id: Tab; label: string }[]).map((t) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setTab(t.id)}
      className={`flex-1 whitespace-nowrap py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-lg transition ${
        tab === t.id
          ? "bg-white dark:bg-slate-800 shadow-sm text-gray-900 dark:text-gray-100"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {t.label}
    </button>
  ))}
</div>
```

- [ ] **Step 6: Restructure tab content — Perfil tab**

The Perfil tab currently has: QR + Images + Color + Social + Info básica.

Find the `<div className={tab !== "perfil" ? "hidden" : ...}>` wrapper. Keep inside it: QR de reservas, Imagenes (logo/portada), Color de tu página de reservas, Redes sociales, Información del negocio. No changes needed to the content itself — only the wrapper condition changes from `tab !== "perfil"` to stay as `tab !== "perfil"` (unchanged).

- [ ] **Step 7: Create Citas tab — move appointment settings from Configuracion**

Find the section inside `<div className={tab !== "configuracion" ? "hidden" : ...}>` that contains "Ajustes de citas" (zona horaria, recordatorio, política cancelación, confirmación automática, lista espera, canal notificaciones). 

Cut that entire section and paste it into a new `{tab === "citas" && (...)}` conditional block, keeping the same JSX content. Add a "Guardar cambios" button at the bottom of this block (same as the one in the Perfil tab).

The Citas tab wrapper:

```tsx
{tab === "citas" && (
  <div className="space-y-6">
    {/* paste the "Ajustes de citas" section here */}
    {btnGuardar}
  </div>
)}
```

- [ ] **Step 8: Create Anticipos tab — new content**

Add a new `{tab === "anticipos" && (...)}` block. Move the existing anticipo section from the old Configuracion tab AND add the 3 new fields:

```tsx
{tab === "anticipos" && (
  <div className="space-y-6">
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Anticipo al reservar</h3>

      {/* Toggle RequiereAnticipo */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Requerir anticipo al reservar</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">El cliente deberá pagar un anticipo antes de confirmar su cita</p>
        </div>
        <input type="checkbox" {...register("requiereAnticipo")} className="w-4 h-4 rounded" />
      </div>

      {/* Fields revealed when RequiereAnticipo is true */}
      {watch("requiereAnticipo") && (
        <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-slate-700">

          {/* Porcentaje */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Porcentaje del anticipo
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                {...register("porcentajeAnticipo", { valueAsNumber: true })}
                className="flex-1 accent-slate-700"
              />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-12 text-right">
                {watch("porcentajeAnticipo")}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Entre 10% y 80% del costo del servicio</p>
          </div>

          {/* Horas para reembolso */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Horas mínimas de anticipación para reembolso
            </label>
            <input
              type="number"
              min={0}
              {...register("horasCancelacionConReembolso", { valueAsNumber: true })}
              className="w-32 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="text-xs text-gray-400 mt-1">0 = sin reembolso en ningún caso</p>
          </div>

          {/* Política de cancelación */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Política de cancelación <span className="text-gray-400">(visible para el cliente)</span>
            </label>
            <textarea
              maxLength={500}
              rows={3}
              placeholder="Ej: El anticipo es reembolsable si cancelas con al menos 24 horas de anticipación..."
              {...register("politicaCancelacionAnticipo")}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {(watch("politicaCancelacionAnticipo") ?? '').length}/500 caracteres
            </p>
          </div>

          {/* Instrucciones de pago — existing field, move here from old Configuracion tab */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Instrucciones de pago del anticipo <span className="text-gray-400">(visible para el cliente)</span>
            </label>
            <textarea
              maxLength={500}
              rows={3}
              placeholder="Ej: Transferir a la cuenta CLABE 012345678901234567 a nombre de..."
              {...register("instruccionesAnticipo")}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
          </div>
        </div>
      )}
    </div>

    {btnGuardar}
  </div>
)}
```

> Copy the exact className from the existing "Guardar cambios" button.

- [ ] **Step 9: Update Horarios tab condition**

Find the existing `{tab === "horarios" && (...)}` block. No content changes needed — this tab stays identical.

- [ ] **Step 10: Create Cuenta tab — move subscription + danger zone**

Add a `{tab === "cuenta" && (...)}` block. Move into it: the "Tu suscripción" section and the "Zona de peligro" section from the old Configuracion tab.

```tsx
{tab === "cuenta" && (
  <div className="space-y-6">
    {/* paste "Tu suscripción" section here */}
    {/* paste "Zona de peligro" section here */}
  </div>
)}
```

- [ ] **Step 11: Remove the old Configuracion tab wrapper**

The old `<div className={tab !== "configuracion" ? "hidden" : ...}>` block should now be empty (all its content moved to Citas, Anticipos, and Cuenta tabs). Delete it entirely.

- [ ] **Step 12: Verify in browser**

1. Navigate to Mi Negocio
2. Verify 5 tabs appear: Perfil | Citas | Anticipos | Horarios | Cuenta
3. Perfil tab: shows info básica, logo, portada, QR, redes sociales, color
4. Citas tab: shows zona horaria, recordatorio, política cancelación, confirmación automática, lista espera
5. Anticipos tab: toggle → reveals porcentaje slider + horas + política + instrucciones
6. Horarios tab: shows working hours and blocked days
7. Cuenta tab: shows subscription + delete account
8. Save works from Perfil, Citas, and Anticipos tabs
9. Toggle RequiereAnticipo off → anticipo fields hidden

- [ ] **Step 13: Verify TypeScript compiles**

```
cd c:\Cursos\AppointVa\Front && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 14: Commit**

```
git add Front/src/pages/dashboard/PerfilPage.tsx
git commit -m "feat(mi-negocio): reestructurar a 5 tabs y agregar tab de Anticipos"
```

---

## Post-Implementation Checklist

After all 6 tasks are complete, run:

```
dotnet test AppointVaAPI.Tests
cd c:\Cursos\AppointVa\Front && npx tsc --noEmit
```

Both should pass with 0 errors.

End-to-end smoke test:
1. Mi Negocio → Anticipos → enable toggle → set 25% → save
2. Book a new cita (public flow or admin flow)
3. Verify in Citas: amber "⏳ Anticipo" badge appears, `$ Anticipo` button visible
4. Click `$ Anticipo` → badge turns green "✓ Anticipo"
5. Go to Pagos → Cobrar that cita → green banner appears, total pre-filled with `precio × 0.75`
6. Complete payment — verify it works normally
