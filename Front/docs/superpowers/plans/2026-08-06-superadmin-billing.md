# SuperAdmin Billing Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-business employee-extra billing to the SuperAdmin panel: `EmpleadosExtra` on each business, an updated `ModalSuscripcion` that calculates totals dynamically, and a new Facturación tab on `NegociosAdminPage` showing all billing at a glance.

**Architecture:** Backend migration adds `EmpleadosExtra` (int, default 0) to `Negocio` and a `PATCH /api/admin/negocios/{id}/empleados-extra` endpoint; `SuscripcionResumenDto` gains five billing fields populated by projecting the `Plan` nav property; the frontend API client is extended; `ModalSuscripcion` replaces three hardcoded price constants with calculated values derived from the DTO; `NegociosAdminPage` gains a two-tab layout with a billing summary table in the second tab.

**Tech Stack:** ASP.NET Core 8 / EF Core 8 / SQL Server · React 19 / TypeScript / TanStack Query v5 / Tailwind CSS / Vitest

## Global Constraints

- Extra employee price: **$49 MXN** — hard-coded in calculation only, never stored in DB
- Plan DB values after migration: Básico `PrecioMensual = 249, MaxEmpleados = 2`; Pro `PrecioMensual = 449, MaxEmpleados = 3`
- `EmpleadosExtra` default: **0**, minimum: **0** (backend returns 400 for negatives)
- Billing total formula: `plan.PrecioMensual + (negocio.EmpleadosExtra × 49)` — real-time only
- No new npm runtime dependencies
- TypeScript strict — no `any`
- All new backend endpoints inherit `[Authorize(Roles = Roles.SuperAdmin)]` from the controller class attribute
- Branch: `develop`
- Backend solution root: `c:/Cursos/AppointVa/Back/AppointVaAPI/`
- Frontend root: `c:/Cursos/AppointVa/Front/`

---

### Task 1: Backend — EF migration (EmpleadosExtra + Plan data update)

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs`
- Create: `Back/AppointVaAPI/AppointVaAPI/Migrations/<timestamp>_AddEmpleadosExtraToNegocio.cs` (auto-generated, then hand-edited)

**Interfaces:**
- Consumes: nothing
- Produces: `Negocio.EmpleadosExtra` (int, default 0) — used in Tasks 2 and 4

- [ ] **Step 1: Add `EmpleadosExtra` property to `Negocio.cs`**

Open `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs`. Find the `ModuloPagosHabilitado` property and add the new field right after it:

```csharp
public bool ModuloPagosHabilitado { get; set; } = false;
public int EmpleadosExtra { get; set; } = 0;
```

- [ ] **Step 2: Generate the EF Core migration**

```powershell
cd c:/Cursos/AppointVa/Back/AppointVaAPI/AppointVaAPI
dotnet ef migrations add AddEmpleadosExtraToNegocio
```

Expected: a new file `Migrations/<timestamp>_AddEmpleadosExtraToNegocio.cs` is created.

- [ ] **Step 3: Add Plan data SQL to the migration's `Up()` method**

Open the generated migration file. After the `migrationBuilder.AddColumn<int>(...)` call, append the two SQL statements:

```csharp
migrationBuilder.AddColumn<int>(
    name: "EmpleadosExtra",
    table: "Negocios",
    type: "int",
    nullable: false,
    defaultValue: 0);

migrationBuilder.Sql(
    "UPDATE Planes SET PrecioMensual = 249, MaxEmpleados = 2 WHERE Nombre = 'Básico'");
migrationBuilder.Sql(
    "UPDATE Planes SET PrecioMensual = 449, MaxEmpleados = 3 WHERE Nombre = 'Pro'");
```

In `Down()`, revert both:

```csharp
migrationBuilder.DropColumn(name: "EmpleadosExtra", table: "Negocios");
// Plan prices are not reverted — they are data corrections, not schema
```

- [ ] **Step 4: Apply the migration**

```powershell
dotnet ef database update
```

Expected: "Done." with no errors. The `Negocios` table now has an `EmpleadosExtra` column.

- [ ] **Step 5: Verify**

```powershell
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 6: Commit**

```powershell
git add Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs
git add "Back/AppointVaAPI/AppointVaAPI/Migrations/"
git commit -m "feat(billing): add EmpleadosExtra to Negocio + update Plan prices"
```

---

### Task 2: Backend — DTO extension + PATCH endpoint + integration tests

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI.Tests/Controllers/Integration/SuscripcionAdminControllerIntegrationTests.cs`

**Interfaces:**
- Consumes: `Negocio.EmpleadosExtra` from Task 1
- Produces:
  - `SuscripcionResumenDto` with new fields: `PlanNombre`, `PrecioBase`, `MaxEmpleadosBase`, `EmpleadosExtra`, `TotalMensual`
  - `PATCH /api/admin/negocios/{id}/empleados-extra` endpoint

- [ ] **Step 1: Extend `SuscripcionResumenDto`**

Open `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs`. Find the end of `SuscripcionResumenDto` class and add five new properties:

```csharp
public class SuscripcionResumenDto
{
    // ... existing properties unchanged ...
    public string? NegocioId { get; set; }
    public string? NegocioNombre { get; set; }
    public string? NegocioSlug { get; set; }
    public DateTime? FechaVencimiento { get; set; }
    public string Estado { get; set; } = string.Empty;
    public int? DiasRestantes { get; set; }
    public int TotalPagos { get; set; }
    public PagoSuscripcionDto? UltimoPago { get; set; }

    // Billing fields
    public string? PlanNombre { get; set; }
    public decimal PrecioBase { get; set; }
    public int MaxEmpleadosBase { get; set; }
    public int EmpleadosExtra { get; set; }
    public decimal TotalMensual { get; set; }
}
```

- [ ] **Step 2: Update the `ObtenerSuscripciones` projection to include Plan data**

Open `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs`. Find the `ObtenerSuscripciones` method. The existing query projects an anonymous type with only `Id`, `Nombre`, `Slug`, `FechaVencimiento`. Replace it with:

```csharp
var negocios = await _db.Negocios
    .Where(n => n.Activo == 1)
    .OrderBy(n => n.Nombre)
    .Select(n => new
    {
        n.Id,
        n.Nombre,
        n.Slug,
        n.FechaVencimiento,
        n.EmpleadosExtra,
        PlanNombre = n.Plan != null ? n.Plan.Nombre : null,
        PrecioBase = n.Plan != null ? n.Plan.PrecioMensual : 0m,
        MaxEmpleadosBase = n.Plan != null ? n.Plan.MaxEmpleados : 0
    })
    .ToListAsync();
```

EF Core automatically generates a LEFT JOIN on `Planes` from this projection — no `.Include()` needed.

- [ ] **Step 3: Add billing fields to the DTO mapping in `ObtenerSuscripciones`**

In the same method, find the `SuscripcionResumenDto` instantiation (inside the loop). Add the five new fields:

```csharp
var resumen = new SuscripcionResumenDto
{
    // ... existing field assignments unchanged ...
    PlanNombre = neg.PlanNombre,
    PrecioBase = neg.PrecioBase,
    MaxEmpleadosBase = neg.MaxEmpleadosBase,
    EmpleadosExtra = neg.EmpleadosExtra,
    TotalMensual = neg.PrecioBase + (neg.EmpleadosExtra * 49m)
};
```

- [ ] **Step 4: Add `SetEmpleadosExtraDto` record**

Add the DTO as a `record` at the bottom of `PagoSuscripcionDto.cs` (same file as Step 1):

```csharp
public record SetEmpleadosExtraDto(int EmpleadosExtra);
```

- [ ] **Step 5: Add `SetEmpleadosExtra` action to `SuscripcionAdminController`**

Add the new endpoint after the existing `ToggleModuloPagos` action:

```csharp
[HttpPatch("negocios/{id:guid}/empleados-extra")]
public async Task<IActionResult> SetEmpleadosExtra(Guid id, [FromBody] SetEmpleadosExtraDto dto)
{
    if (dto.EmpleadosExtra < 0)
        return BadRequest("EmpleadosExtra no puede ser negativo.");

    var negocio = await _db.Negocios
        .FirstOrDefaultAsync(n => n.Id == id && n.Activo == 1);

    if (negocio == null) return NotFound();

    negocio.EmpleadosExtra = dto.EmpleadosExtra;
    negocio.FechaActualizacion = DateTime.UtcNow;
    await _db.SaveChangesAsync();

    return Ok();
}
```

- [ ] **Step 6: Write the integration tests (add to existing class)**

Open `Back/AppointVaAPI/AppointVaAPI.Tests/Controllers/Integration/SuscripcionAdminControllerIntegrationTests.cs`. Add these four test methods at the end of the existing class, following the exact same auth-gate pattern already in the file:

```csharp
[Fact]
public async Task SetEmpleadosExtra_SinToken_Returns401()
{
    ClearToken();
    var response = await Client.PatchAsJsonAsync(
        $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
        new { EmpleadosExtra = 2 });
    response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
}

[Fact]
public async Task SetEmpleadosExtra_ConTokenPropietario_Returns403()
{
    SetToken(TestTokenHelper.Propietario());
    var response = await Client.PatchAsJsonAsync(
        $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
        new { EmpleadosExtra = 2 });
    response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
}

[Fact]
public async Task SetEmpleadosExtra_ConTokenSuperAdmin_IdInexistente_Returns404()
{
    SetToken(TestTokenHelper.SuperAdmin());
    var response = await Client.PatchAsJsonAsync(
        $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
        new { EmpleadosExtra = 2 });
    response.StatusCode.Should().Be(HttpStatusCode.NotFound);
}

[Fact]
public async Task SetEmpleadosExtra_ConTokenSuperAdmin_ValorNegativo_Returns400()
{
    SetToken(TestTokenHelper.SuperAdmin());
    var response = await Client.PatchAsJsonAsync(
        $"/api/admin/negocios/{Guid.NewGuid()}/empleados-extra",
        new { EmpleadosExtra = -1 });
    response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
}
```

- [ ] **Step 7: Run backend tests**

```powershell
cd c:/Cursos/AppointVa/Back/AppointVaAPI
dotnet test AppointVaAPI.Tests --verbosity minimal
```

Expected: all tests pass, including the 4 new ones.

- [ ] **Step 8: Commit**

```powershell
git add Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs
git add Back/AppointVaAPI/AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs
git add Back/AppointVaAPI/AppointVaAPI.Tests/Controllers/Integration/SuscripcionAdminControllerIntegrationTests.cs
git commit -m "feat(billing): PATCH empleados-extra endpoint + extend SuscripcionResumenDto"
```

---

### Task 3: Frontend — TypeScript API layer

**Files:**
- Modify: `Front/src/api/admin.ts`

**Interfaces:**
- Consumes: `PATCH /api/admin/negocios/{id}/empleados-extra` from Task 2
- Produces: extended `SuscripcionResumenDto` TS interface + `adminApi.setEmpleadosExtra` function — used in Tasks 4 and 5

- [ ] **Step 1: Write the failing test**

Create `Front/src/api/admin.test.ts` (or add to existing file if it exists). Check first with `ls Front/src/api/`. If `admin.test.ts` doesn't exist, create it:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { adminApi } from './admin';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('adminApi.setEmpleadosExtra', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls PATCH /api/admin/negocios/{id}/empleados-extra with correct body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await adminApi.setEmpleadosExtra('negocio-1', 3);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/negocios/negocio-1/empleados-extra',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ empleadosExtra: 3 }),
      })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
cd c:/Cursos/AppointVa/Front
npx vitest run src/api/admin.test.ts
```

Expected: FAIL — `adminApi.setEmpleadosExtra is not a function`.

- [ ] **Step 3: Extend `SuscripcionResumenDto` in `admin.ts`**

Open `Front/src/api/admin.ts`. Find the `SuscripcionResumenDto` interface and add the five billing fields:

```ts
export interface SuscripcionResumenDto {
  negocioId: string;
  negocioNombre: string;
  negocioSlug: string;
  fechaVencimiento: string | null;
  estado: 'Activa' | 'PorVencer' | 'Vencida' | 'SinSuscripcion';
  diasRestantes: number | null;
  totalPagos: number;
  ultimoPago: PagoSuscripcionDto | null;
  // Billing fields
  planNombre: string | null;
  precioBase: number;
  maxEmpleadosBase: number;
  empleadosExtra: number;
  totalMensual: number;
}
```

- [ ] **Step 4: Add `setEmpleadosExtra` to `adminApi`**

In the `adminApi` object, add the new function (alongside `toggleModuloPagos`, which follows the same PATCH pattern):

```ts
setEmpleadosExtra: async (negocioId: string, empleadosExtra: number): Promise<void> => {
  const response = await fetch(`/api/admin/negocios/${negocioId}/empleados-extra`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empleadosExtra }),
  });
  if (!response.ok) throw new Error('Error al actualizar empleados extra');
},
```

Note: look at the existing `toggleModuloPagos` function in the same file and follow the same `fetch` / error-throw pattern (the project may use a shared `apiFetch` helper instead of raw `fetch`). Use whatever pattern the neighboring functions use.

- [ ] **Step 5: Run the test to verify it passes**

```powershell
npx vitest run src/api/admin.test.ts
```

Expected: PASS — 1 test passed.

- [ ] **Step 6: Run the full suite to check for regressions**

```powershell
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add Front/src/api/admin.ts Front/src/api/admin.test.ts
git commit -m "feat(billing): extend SuscripcionResumenDto + setEmpleadosExtra API function"
```

---

### Task 4: Frontend — ModalSuscripcion billing header + dynamic pricing

**Files:**
- Modify: `Front/src/pages/admin/NegociosAdminPage.tsx`
- Create or modify: `Front/src/pages/admin/NegociosAdminPage.test.tsx`

**Interfaces:**
- Consumes:
  - `SuscripcionResumenDto.planNombre`, `.precioBase`, `.maxEmpleadosBase`, `.empleadosExtra`, `.totalMensual` from Task 3
  - `adminApi.setEmpleadosExtra` from Task 3
- Produces: updated `ModalSuscripcion` component used by Task 5

- [ ] **Step 1: Write the failing tests**

Create `Front/src/pages/admin/NegociosAdminPage.test.tsx` (check if it already exists first — if so, append):

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NegociosAdminPage from './NegociosAdminPage';
import * as adminModule from '../../api/admin';

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    setEmpleadosExtra: vi.fn(),
  },
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const mockNegocio = {
  id: 'neg-1',
  nombre: 'Peluquería Test',
  slug: 'peluqueria-test',
  activo: 1,
  maxCitasMes: 100,
  maxEmpleados: 3,
  citasMes: 10,
  empleadosActivos: 2,
  emailsMes: 5,
  planNombre: 'Pro',
  planId: 'plan-pro',
  moduloPagosHabilitado: true,
};

const mockSuscripcion = {
  negocioId: 'neg-1',
  negocioNombre: 'Peluquería Test',
  negocioSlug: 'peluqueria-test',
  fechaVencimiento: '2026-12-31T00:00:00Z',
  estado: 'Activa' as const,
  diasRestantes: 147,
  totalPagos: 3,
  ultimoPago: null,
  planNombre: 'Pro',
  precioBase: 449,
  maxEmpleadosBase: 3,
  empleadosExtra: 0,
  totalMensual: 449,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NegociosAdminPage />
    </QueryClientProvider>
  );
}

describe('ModalSuscripcion billing header', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.setEmpleadosExtra).mockResolvedValue(undefined);
  });

  it('shows plan name and base price in billing header', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText(/\$449/)).toBeInTheDocument();
    });
  });

  it('updates total mensual display when empleados extra changes', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    await waitFor(() => screen.getByRole('spinbutton'));

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2' } });

    // 449 + 2*49 = 547
    expect(screen.getByText(/\$547/)).toBeInTheDocument();
  });

  it('pre-fills monto with totalMensual when 1-month button clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    await waitFor(() => screen.getByText(/1 mes/i));

    fireEvent.click(screen.getByText(/1 mes/i));

    const montoInput = screen.getByDisplayValue('449');
    expect(montoInput).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npx vitest run src/pages/admin/NegociosAdminPage.test.tsx
```

Expected: FAIL — billing header and spinbutton not found.

- [ ] **Step 3: Remove hardcoded pricing constants in `ModalSuscripcion`**

In `NegociosAdminPage.tsx`, find the `ModalSuscripcion` function component. Remove these three constants:

```ts
// DELETE these:
const PRECIO_MES = 249;
const PRECIO_ANUAL = 2490;
const LIFETIME = 1200;
```

Replace them with:

```ts
const PRECIO_EXTRA_EMP = 49;
const LIFETIME_SENTINEL = 1200;
```

- [ ] **Step 4: Add `empleadosExtra` state and `totalMensual` computed value**

In `ModalSuscripcion`, add state for empleadosExtra and derive `totalMensual`. Keep `useMutation` and `useQueryClient` (they are already imported at the top of the file — verify and add them to the import if missing):

```tsx
const queryClient = useQueryClient();

const [empleadosExtra, setEmpleadosExtra] = useState(suscripcion?.empleadosExtra ?? 0);
const precioBase = suscripcion?.precioBase ?? 0;
const totalMensual = precioBase + empleadosExtra * PRECIO_EXTRA_EMP;

const [meses, setMeses] = useState(1);
const [monto, setMonto] = useState(() => String(precioBase + (suscripcion?.empleadosExtra ?? 0) * PRECIO_EXTRA_EMP));
const [notas, setNotas] = useState('');

const mutarEmpleadosExtra = useMutation({
  mutationFn: (val: number) => adminApi.setEmpleadosExtra(negocio.id, val),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin-suscripciones'] });
  },
});
```

- [ ] **Step 5: Update `handleMesesChange` to use `totalMensual`**

Replace the existing `handleMesesChange` function:

```tsx
const handleMesesChange = (val: number) => {
  setMeses(val);
  if (val === LIFETIME_SENTINEL) {
    setMonto('');
  } else {
    setMonto(String(totalMensual * val));
  }
};
```

Also update the "De por vida" button's `onClick` to use `LIFETIME_SENTINEL` instead of `LIFETIME`.

- [ ] **Step 6: Add billing summary header JSX above the payment form**

Inside `ModalSuscripcion`'s return, add this block immediately above the month-selector buttons:

```tsx
{/* Billing summary */}
<div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4 space-y-2 text-sm">
  <div className="flex justify-between">
    <span className="text-gray-500 dark:text-gray-400">Plan</span>
    <span className="font-medium text-gray-800 dark:text-gray-200">
      {suscripcion?.planNombre ?? '—'} · {formatPrecio(precioBase)}/mes
    </span>
  </div>
  <div className="flex justify-between">
    <span className="text-gray-500 dark:text-gray-400">Emp. base</span>
    <span className="font-medium text-gray-800 dark:text-gray-200">
      {suscripcion?.maxEmpleadosBase ?? 0}
    </span>
  </div>
  <div className="flex justify-between items-center">
    <span className="text-gray-500 dark:text-gray-400">Emp. extra</span>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={empleadosExtra}
        onChange={e => {
          const val = Math.max(0, Number(e.target.value));
          setEmpleadosExtra(val);
          setMonto(String(precioBase + val * PRECIO_EXTRA_EMP));
        }}
        onBlur={e => mutarEmpleadosExtra.mutate(Math.max(0, Number(e.target.value)))}
        className="w-16 text-right rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
      />
      {empleadosExtra > 0 && (
        <span className="text-xs text-gray-400">+{formatPrecio(empleadosExtra * PRECIO_EXTRA_EMP)}/mes</span>
      )}
    </div>
  </div>
  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between font-semibold">
    <span className="text-gray-700 dark:text-gray-300">Total mensual</span>
    <span className="text-[#C8A961]">{formatPrecio(totalMensual)}/mes</span>
  </div>
</div>
```

- [ ] **Step 7: Run tests to verify they pass**

```powershell
npx vitest run src/pages/admin/NegociosAdminPage.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 8: Run full suite**

```powershell
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 9: Commit**

```powershell
git add Front/src/pages/admin/NegociosAdminPage.tsx
git add Front/src/pages/admin/NegociosAdminPage.test.tsx
git commit -m "feat(billing): ModalSuscripcion billing header + dynamic total"
```

---

### Task 5: Frontend — Facturación tab on NegociosAdminPage

**Files:**
- Modify: `Front/src/pages/admin/NegociosAdminPage.tsx`
- Modify: `Front/src/pages/admin/NegociosAdminPage.test.tsx`

**Interfaces:**
- Consumes:
  - `SuscripcionResumenDto` with billing fields from Task 3
  - `ModalSuscripcion` updated in Task 4 (specifically, the `abrirSuscripcion` function is reused)
- Produces: two-tab layout (`negocios` | `facturacion`) on the page

- [ ] **Step 1: Write the failing tests**

Add to `Front/src/pages/admin/NegociosAdminPage.test.tsx` (append to the file, same mocks as Task 4):

```tsx
describe('Facturación tab', () => {
  const mockSuscripcionVencida = {
    ...mockSuscripcion,
    negocioId: 'neg-2',
    negocioNombre: 'Barbería Vencida',
    estado: 'Vencida' as const,
    diasRestantes: 0,
    totalMensual: 249,
    precioBase: 249,
    planNombre: 'Básico',
  };

  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      mockSuscripcion,
      mockSuscripcionVencida,
    ]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  });

  it('renders Facturación tab when clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Negocios'));

    fireEvent.click(screen.getByText('Facturación'));

    await waitFor(() => {
      expect(screen.getByText('Peluquería Test')).toBeInTheDocument();
    });
  });

  it('shows Vencida rows before Activa in the billing table', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Negocios'));

    fireEvent.click(screen.getByText('Facturación'));

    await waitFor(() => screen.getByText('Barbería Vencida'));

    const rows = screen.getAllByRole('row');
    const names = rows.map(r => r.textContent ?? '');
    const vencidaIdx = names.findIndex(t => t.includes('Barbería Vencida'));
    const activaIdx = names.findIndex(t => t.includes('Peluquería Test'));
    expect(vencidaIdx).toBeLessThan(activaIdx);
  });

  it('shows estimated monthly total in the summary footer', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Facturación'));

    await waitFor(() => {
      // 449 + 249 = 698
      expect(screen.getByText(/\$698/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
npx vitest run src/pages/admin/NegociosAdminPage.test.tsx
```

Expected: FAIL — "Facturación" text not found.

- [ ] **Step 3: Add tab state and sort/total helpers**

In `NegociosAdminPage`, add tab state and the billing table helpers near the top of the component function (after the existing `useState` calls). Also add `useQueryClient()` here — it is called inside `ModalSuscripcion` already, but the billing table's inline edit also needs it at the page level:

```tsx
const queryClient = useQueryClient(); // add at NegociosAdminPage level (already imported)
const [tab, setTab] = useState<'negocios' | 'facturacion'>('negocios');

const ESTADO_ORDER: Record<string, number> = {
  Vencida: 0, PorVencer: 1, Activa: 2, SinSuscripcion: 3
};

const sortedSuscripciones = [...(suscripciones ?? [])].sort(
  (a, b) => (ESTADO_ORDER[a.estado] ?? 4) - (ESTADO_ORDER[b.estado] ?? 4)
);

const totalEstimado = (suscripciones ?? [])
  .filter(s => s.estado !== 'SinSuscripcion')
  .reduce((sum, s) => sum + s.totalMensual, 0);

const negociosConPlan = (suscripciones ?? []).filter(s => s.estado !== 'SinSuscripcion').length;

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  Activa: { label: 'Activa', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  PorVencer: { label: 'Por vencer', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  Vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SinSuscripcion: { label: 'Sin suscripción', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};
```

- [ ] **Step 4: Add tab buttons above the existing content**

In the JSX return, find the outer wrapper `<div>` that wraps the page. Add the tab bar immediately before the page's main content section:

```tsx
{/* Tab bar */}
<div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1 gap-1 mb-6">
  <button
    onClick={() => setTab('negocios')}
    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
      tab === 'negocios'
        ? 'bg-white text-gray-800 shadow-sm dark:bg-slate-800 dark:text-gray-200'
        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
    }`}
  >
    Negocios
  </button>
  <button
    onClick={() => setTab('facturacion')}
    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
      tab === 'facturacion'
        ? 'bg-white text-gray-800 shadow-sm dark:bg-slate-800 dark:text-gray-200'
        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
    }`}
  >
    Facturación
  </button>
</div>
```

- [ ] **Step 5: Wrap the existing card grid in `{tab === 'negocios' && (...)}`**

The current page body (search input + card grid) should only render when the Negocios tab is active. Wrap it:

```tsx
{tab === 'negocios' && (
  <>
    {/* existing search input */}
    {/* existing card grid */}
  </>
)}
```

- [ ] **Step 6: Add `{tab === 'facturacion' && (...)}` with the billing table**

Add this block right after the Negocios conditional:

```tsx
{tab === 'facturacion' && (
  <div>
    {sortedSuscripciones.length === 0 ? (
      <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-12">
        Ningún negocio tiene un plan activo todavía.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Negocio</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-center">Emp. base</th>
              <th className="px-4 py-3 text-center">Emp. extra</th>
              <th className="px-4 py-3 text-right">Total/mes</th>
              <th className="px-4 py-3 text-center">Vence</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {sortedSuscripciones.map(s => {
              const badge = ESTADO_BADGE[s.estado] ?? ESTADO_BADGE.SinSuscripcion;
              return (
                <tr key={s.negocioId} className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{s.negocioNombre}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.planNombre ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{s.maxEmpleadosBase}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={0}
                      defaultValue={s.empleadosExtra}
                      onBlur={e => {
                        const val = Math.max(0, Number(e.target.value));
                        adminApi.setEmpleadosExtra(s.negocioId, val).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['admin-suscripciones'] });
                        });
                      }}
                      className="w-14 text-center rounded-lg border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#C8A961]">
                    {formatPrecio(s.totalMensual)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                    {s.fechaVencimiento
                      ? new Date(s.fechaVencimiento).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        const neg = metricas?.find(m => m.id === s.negocioId);
                        if (neg) abrirSuscripcion(neg);
                      }}
                      className="text-xs text-[#C8A961] hover:underline whitespace-nowrap"
                    >
                      Ver suscripción
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-slate-800 font-semibold text-gray-700 dark:text-gray-300">
              <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-gray-400">
                Total estimado ({negociosConPlan} negocio{negociosConPlan !== 1 ? 's' : ''})
              </td>
              <td className="px-4 py-3 text-right text-[#C8A961]">{formatPrecio(totalEstimado)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    )}
  </div>
)}
```

Note: `metricas` is the variable holding the result of `useQuery(['admin-metricas'])` (already in the component). `abrirSuscripcion` is the existing function that opens `ModalSuscripcion`. Confirm those names by reading the component before writing.

- [ ] **Step 7: Run tests to verify they pass**

```powershell
npx vitest run src/pages/admin/NegociosAdminPage.test.tsx
```

Expected: all tests pass (3 from Task 4 + 3 from Task 5 = 6 total).

- [ ] **Step 8: Run full suite**

```powershell
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```powershell
git add Front/src/pages/admin/NegociosAdminPage.tsx
git add Front/src/pages/admin/NegociosAdminPage.test.tsx
git commit -m "feat(billing): Facturación tab con tabla de facturación consolidada"
```
