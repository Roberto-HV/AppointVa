# AppointVa Health Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Sector` field (`"belleza"` | `"salud"`) to `Negocio` so the platform adapts terminology, dashboard theme, visible modules, and booking copy for health consultories — without touching existing beauty businesses.

**Architecture:** A single `Sector` string column (default `"belleza"`) on the `Negocio` entity propagates through all relevant DTOs; the frontend reads it from existing queries and uses conditional rendering — no new routes, no new layouts. SuperAdmin assigns sector via a new PATCH endpoint; the dashboard filters its nav array through a pure `getNav(sector)` function and applies a clinical blue palette via inline styles.

**Tech Stack:** ASP.NET Core 8 / EF Core 8 / SQL Server · React 19 / TypeScript / TanStack Query v5 / Tailwind CSS / Vitest / React Testing Library

## Global Constraints

- Two sectors only: `"belleza"` (default) | `"salud"` — any other value on the PATCH endpoint returns HTTP 400
- All existing `Negocio` rows default to `"belleza"` via EF Core migration `defaultValue: "belleza"` — zero data risk
- No new npm runtime dependencies
- TypeScript strict — no `any`
- SuperAdmin assigns sector; propietario cannot change it
- Sector drives UI conditionals only — no separate layouts, no forked routes
- `notasLabel` prop defaults to `"Notas adicionales"` — belleza booking is unchanged
- Backend root: `Back/AppointVaAPI/`  Frontend root: `Front/`

---

## File Map

**Backend — modified:**
- `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs` — add `Sector` field
- `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs` — add `Sector` to `SuscripcionResumenDto`; add `SetSectorDto` record
- `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Negocios/NegocioDto.cs` — add `Sector` field
- `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Publico/NegocioPublicoDto.cs` — add `Sector` field
- `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs` — map `Sector` in projection; add `SetSector` action
- `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NegociosController.cs` — map `Sector` in the `NegocioDto` projection
- `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/PublicoController.cs` — map `Sector` in the `NegocioPublicoDto` projection
- `Back/AppointVaAPI/AppointVaAPI/Migrations/` — new migration file (auto-generated)

**Frontend — modified:**
- `Front/src/types/index.ts` — add `sector: string` to `NegocioPublico` and `NegocioDto`
- `Front/src/api/admin.ts` — add `sector: string` to `SuscripcionResumenDto`; add `setSector` function
- `Front/src/components/booking/PasoDatosCliente.tsx` — add `notasLabel?: string` prop
- `Front/src/pages/publico/BookingPage.tsx` — add `textos` constant; pass `notasLabel`
- `Front/src/layouts/DashboardLayout.tsx` — `getNav(sector)` + clinical blue theme + route guard
- `Front/src/pages/admin/NegociosAdminPage.tsx` — sector badge on cards; sector toggle in modal

**Frontend — tests created:**
- `Front/src/api/admin.test.ts` — `setSector` sends correct request
- `Front/src/components/booking/PasoDatosCliente.test.tsx` — `notasLabel` prop
- `Front/src/layouts/DashboardLayout.test.tsx` — `getNav` filtering and renaming

---

### Task 1: Backend — Sector field on Negocio + EF Core migration

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs`
- Auto-generated: `Back/AppointVaAPI/AppointVaAPI/Migrations/*_AddSectorToNegocio.cs`

**Interfaces:**
- Produces: `Negocio.Sector` property (string, default `"belleza"`) — consumed by Tasks 2 and 3

- [ ] **Step 1: Add the Sector property**

Open `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs`. After the `TiktokUrl` property, add:

```csharp
[MaxLength(20)]
public string Sector { get; set; } = "belleza";
```

The surrounding block should look like:

```csharp
[MaxLength(200)]
public string? TiktokUrl { get; set; }
[MaxLength(20)]
public string Sector { get; set; } = "belleza";
public Guid? PlanId { get; set; }
```

- [ ] **Step 2: Generate the migration**

From `Back/AppointVaAPI/`:

```bash
dotnet ef migrations add AddSectorToNegocio --project AppointVaAPI --startup-project AppointVaAPI
```

Expected: a new file `*_AddSectorToNegocio.cs` appears in `AppointVaAPI/Migrations/`.

Open it and confirm the `Up` method contains:

```csharp
migrationBuilder.AddColumn<string>(
    name: "Sector",
    table: "Negocios",
    type: "nvarchar(20)",
    maxLength: 20,
    nullable: false,
    defaultValue: "belleza");
```

The `defaultValue: "belleza"` is critical — it ensures existing rows are not null.

- [ ] **Step 3: Apply the migration**

```bash
dotnet ef database update --project AppointVaAPI --startup-project AppointVaAPI
```

Expected: `Done.` with no errors.

- [ ] **Step 4: Verify in the database**

Connect to local SQL Server and run:

```sql
SELECT TOP 3 Id, Nombre, Sector FROM Negocios;
```

Expected: `Sector` column present; all existing rows show `belleza`.

- [ ] **Step 5: Build to confirm no compilation errors**

```bash
dotnet build AppointVaAPI
```

Expected: `Build succeeded. 0 Error(s)`.

- [ ] **Step 6: Commit**

```bash
git add AppointVaAPI/Models/Negocio.cs AppointVaAPI/Migrations/
git commit -m "feat(negocio): add Sector field with belleza default and EF migration"
```

---

### Task 2: Backend — Expose Sector in all DTOs + controller mappings

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Negocios/NegocioDto.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Publico/NegocioPublicoDto.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NegociosController.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/PublicoController.cs`

**Interfaces:**
- Consumes: `Negocio.Sector` (Task 1)
- Produces: `SuscripcionResumenDto.Sector`, `NegocioDto.Sector`, `NegocioPublicoDto.Sector` — consumed by Tasks 3 and 4

- [ ] **Step 1: Add Sector to SuscripcionResumenDto**

In `PagoSuscripcionDto.cs`, add to `SuscripcionResumenDto` after `TotalMensual`:

```csharp
public decimal TotalMensual { get; set; }
public string Sector { get; set; } = "belleza";
```

- [ ] **Step 2: Add Sector to NegocioDto**

In `NegocioDto.cs`, add after `PlanNombre`:

```csharp
public string? PlanNombre { get; set; }
public string Sector { get; set; } = "belleza";
```

- [ ] **Step 3: Add Sector to NegocioPublicoDto**

In `NegocioPublicoDto.cs`, add after `Direccion`:

```csharp
public string? Direccion { get; set; }
public string Sector { get; set; } = "belleza";
```

- [ ] **Step 4: Map Sector in SuscripcionAdminController**

Open `SuscripcionAdminController.cs` and find the `ObtenerSuscripciones` method. It contains a `.Select()` projection that builds `SuscripcionResumenDto`. Add `Sector = n.Sector,` to the projection alongside `EmpleadosExtra`:

```csharp
EmpleadosExtra = n.EmpleadosExtra,
TotalMensual = precioBase + (n.EmpleadosExtra * PRECIO_EXTRA_EMP),
Sector = n.Sector,
```

- [ ] **Step 5: Map Sector in NegociosController**

Find the file that constructs `NegocioDto`:

```bash
grep -rl "new NegocioDto" Back/AppointVaAPI/AppointVaAPI/Controllers/
```

Open the result (likely `NegociosController.cs`). Find the `new NegocioDto { ... }` object initializer and add:

```csharp
PlanNombre = negocio.Plan?.Nombre,
Sector = negocio.Sector,
```

If the controller has multiple projections, add it to every one that builds `NegocioDto`.

- [ ] **Step 6: Map Sector in PublicoController**

Open `PublicoController.cs`. Find the `NegocioPublicoDto` object initializer (the one that already has `Direccion = negocio.Direccion,` added in a prior session). Add immediately after:

```csharp
Direccion = negocio.Direccion,
Sector = negocio.Sector,
```

- [ ] **Step 7: Build**

```bash
dotnet build AppointVaAPI
```

Expected: `Build succeeded.`

- [ ] **Step 8: Smoke test the public endpoint**

With the backend running, call (replace `your-slug` with a real slug):

```bash
curl -s http://localhost:5048/api/publico/negocios/your-slug | grep -i sector
```

Expected: `"sector": "belleza"` appears in the JSON.

- [ ] **Step 9: Commit**

```bash
git add AppointVaAPI/Models/Dtos/ AppointVaAPI/Controllers/V1/
git commit -m "feat(dtos): expose Sector in SuscripcionResumenDto, NegocioDto, NegocioPublicoDto"
```

---

### Task 3: Backend — PATCH /api/admin/negocios/{id}/sector

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs`

**Interfaces:**
- Consumes: `Negocio.Sector` (Task 1), `SuscripcionAdminController` auth pattern
- Produces: `PATCH /api/admin/negocios/{id}/sector` — consumed by Task 8 (admin UI)

- [ ] **Step 1: Add SetSectorDto record**

In `PagoSuscripcionDto.cs`, add at the bottom alongside the existing `SetEmpleadosExtraDto`:

```csharp
public record SetEmpleadosExtraDto(int EmpleadosExtra);
public record SetSectorDto(string Sector);
```

- [ ] **Step 2: Add SetSector action to SuscripcionAdminController**

In `SuscripcionAdminController.cs`, add this action after `SetEmpleadosExtra`:

```csharp
[HttpPatch("negocios/{id}/sector")]
public async Task<IActionResult> SetSector(Guid id, [FromBody] SetSectorDto dto)
{
    string[] sectoresValidos = ["belleza", "salud"];
    if (!sectoresValidos.Contains(dto.Sector))
        return BadRequest("Sector inválido. Valores permitidos: belleza, salud.");

    var negocio = await _context.Negocios.FindAsync(id);
    if (negocio == null) return NotFound();

    negocio.Sector = dto.Sector;
    negocio.FechaActualizacion = DateTime.UtcNow;
    await _context.SaveChangesAsync();
    return Ok();
}
```

The `[Authorize(Roles = Roles.SuperAdmin)]` attribute on the controller class already applies — no need to repeat it on this action.

- [ ] **Step 3: Build**

```bash
dotnet build AppointVaAPI
```

Expected: `Build succeeded.`

- [ ] **Step 4: Test the endpoint — happy path**

With the backend running, obtain a SuperAdmin JWT and a valid negocio `{id}`, then:

```bash
curl -s -X PATCH http://localhost:5048/api/admin/negocios/{id}/sector \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sector":"salud"}'
```

Expected: HTTP 200 (empty body).

Verify in SQL:

```sql
SELECT Id, Nombre, Sector FROM Negocios WHERE Id = '{id}';
```

Expected: `Sector = salud`.

- [ ] **Step 5: Test the endpoint — invalid sector**

```bash
curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  http://localhost:5048/api/admin/negocios/{id}/sector \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sector":"otro"}'
```

Expected: `400`.

- [ ] **Step 6: Commit**

```bash
git add AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs \
        AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs
git commit -m "feat(admin): add PATCH /admin/negocios/{id}/sector endpoint"
```

---

### Task 4: Frontend — TypeScript types + setSector API function

**Files:**
- Modify: `Front/src/types/index.ts`
- Modify: `Front/src/api/admin.ts`
- Create: `Front/src/api/admin.test.ts`

**Interfaces:**
- Consumes: `PATCH /api/admin/negocios/{id}/sector` (Task 3)
- Produces:
  - `NegocioPublico.sector: string` — consumed by Tasks 6 and 7
  - `NegocioDto.sector: string` — consumed by Task 7
  - `SuscripcionResumenDto.sector: string` — consumed by Task 8
  - `adminApi.setSector(negocioId: string, sector: string): Promise<void>` — consumed by Task 8

- [ ] **Step 1: Write the failing test**

Create `Front/src/api/admin.test.ts`. First, look at how existing tests in the `Front/src/` tree mock `fetch` or the API layer — match that pattern. If no tests exist, use this pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('adminApi.setSector', () => {
  it('calls PATCH /admin/negocios/{id}/sector with the given sector', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const { adminApi } = await import('./admin');
    await adminApi.setSector('abc-123', 'salud');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/negocios/abc-123/sector'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ sector: 'salud' }),
      })
    );
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd Front
npx vitest run src/api/admin.test.ts
```

Expected: FAIL — `adminApi.setSector is not a function`.

- [ ] **Step 3: Add sector to NegocioPublico and NegocioDto in types/index.ts**

Open `Front/src/types/index.ts`.

In `NegocioPublico` (around line 35), add `sector: string;` after `direccion?: string;`:

```typescript
direccion?: string;
sector: string;
```

In `NegocioDto` (around line 314), add `sector: string;` after `moduloPagosHabilitado?: boolean;`:

```typescript
moduloPagosHabilitado?: boolean;
sector: string;
```

- [ ] **Step 4: Add sector to SuscripcionResumenDto in admin.ts**

Open `Front/src/api/admin.ts`. Find the `SuscripcionResumenDto` interface and add `sector: string;` after `totalMensual`:

```typescript
totalMensual: number;
sector: string;
```

- [ ] **Step 5: Add setSector to adminApi**

In `Front/src/api/admin.ts`, add `setSector` to the `adminApi` object. Look at the `setEmpleadosExtra` function for the exact pattern (same `API_URL` base, same `getToken()` call, same `fetch` call structure):

```typescript
setSector: async (negocioId: string, sector: string): Promise<void> => {
  const res = await fetch(`${API_URL}/admin/negocios/${negocioId}/sector`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ sector }),
  });
  if (!res.ok) throw new Error('Error al actualizar el sector');
},
```

Replace `API_URL` and `getToken()` with whatever the file actually uses (copy from `setEmpleadosExtra`).

- [ ] **Step 6: Run the test to confirm it passes**

```bash
npx vitest run src/api/admin.test.ts
```

Expected: PASS — 1 test passed.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If existing code that constructs `NegocioDto` or `NegocioPublico` mocks in tests is missing `sector`, add `sector: 'belleza'` to those objects.

- [ ] **Step 8: Commit**

```bash
git add Front/src/types/index.ts Front/src/api/admin.ts Front/src/api/admin.test.ts
git commit -m "feat(types): add sector to NegocioPublico, NegocioDto, SuscripcionResumenDto + setSector API"
```

---

### Task 5: Frontend — PasoDatosCliente notasLabel prop

**Files:**
- Modify: `Front/src/components/booking/PasoDatosCliente.tsx`
- Create: `Front/src/components/booking/PasoDatosCliente.test.tsx`

**Interfaces:**
- Produces: `notasLabel?: string` prop (defaults to `"Notas adicionales"`) — consumed by Task 6

- [ ] **Step 1: Write the failing test**

Create `Front/src/components/booking/PasoDatosCliente.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasoDatosCliente } from './PasoDatosCliente';

const baseProps = {
  servicio: {
    id: 's1', nombre: 'Consulta', duracionMinutos: 30,
    bufferMinutos: 0, precio: 200, orden: 1,
  },
  empleado: {
    id: 'e1', nombre: 'Dr. García', servicioIds: ['s1'],
    promedioResenas: 0, totalResenas: 0,
  },
  slot: {
    inicio: '2026-08-06T10:00:00',
    fin: '2026-08-06T10:30:00',
    horaTexto: '10:00',
  },
  enviando: false,
  onEnviar: () => {},
};

describe('PasoDatosCliente', () => {
  it('shows "Notas adicionales" label by default', () => {
    render(<PasoDatosCliente {...baseProps} />);
    expect(screen.getByText('Notas adicionales')).toBeInTheDocument();
  });

  it('shows the notasLabel prop when provided', () => {
    render(<PasoDatosCliente {...baseProps} notasLabel="Motivo de consulta" />);
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument();
    expect(screen.queryByText('Notas adicionales')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd Front
npx vitest run src/components/booking/PasoDatosCliente.test.tsx
```

Expected: FAIL — second test fails because `notasLabel` prop does not exist and label is hardcoded.

- [ ] **Step 3: Add notasLabel prop**

Open `Front/src/components/booking/PasoDatosCliente.tsx`.

**Update the Props interface** — add `notasLabel?: string;` after `color?`:

```typescript
interface Props {
  servicio: ServicioPublico;
  empleado: EmpleadoPublico;
  slot: SlotDisponible;
  enviando: boolean;
  datosIniciales?: Partial<DatosClienteForm>;
  onEnviar: (datos: DatosClienteForm) => void;
  color?: string;
  notasLabel?: string;
}
```

**Update the function signature** to destructure and default the new prop:

```typescript
export function PasoDatosCliente({
  servicio,
  empleado,
  slot,
  enviando,
  datosIniciales,
  onEnviar,
  color,
  notasLabel = 'Notas adicionales',
}: Props) {
```

**Update the JSX label.** Find the `<label>` above the `notas` textarea. It currently shows the hardcoded string. Replace it with:

```tsx
<label className="block text-xs font-medium text-gray-600 mb-1">
  {notasLabel}
</label>
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/components/booking/PasoDatosCliente.test.tsx
```

Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add Front/src/components/booking/PasoDatosCliente.tsx \
        Front/src/components/booking/PasoDatosCliente.test.tsx
git commit -m "feat(booking): add notasLabel prop to PasoDatosCliente"
```

---

### Task 6: Frontend — BookingPage sector-aware copy

**Files:**
- Modify: `Front/src/pages/publico/BookingPage.tsx`

**Interfaces:**
- Consumes: `NegocioPublico.sector` (Task 4), `notasLabel` prop (Task 5)
- Produces: sector-aware copy in the public booking UI

- [ ] **Step 1: Add the textos constant**

Open `Front/src/pages/publico/BookingPage.tsx`. Find the guard that returns early when `negocio` is null/undefined. Directly after the last guard (once `negocio` is confirmed), add:

```typescript
const textos = negocio.sector === 'salud'
  ? { cta: 'Agenda tu consulta', cita: 'consulta' }
  : { cta: 'Reserva tu cita',    cita: 'cita'     };
```

- [ ] **Step 2: Apply textos.cta to the main heading**

Search the file for the string `"Reserva tu cita"`. Replace each user-facing occurrence with `{textos.cta}`. Example:

Before:
```tsx
<h1 className="text-xl font-bold">Reserva tu cita</h1>
```

After:
```tsx
<h1 className="text-xl font-bold">{textos.cta}</h1>
```

Also update the page `<title>` if it hardcodes the phrase. Do NOT change variable names, query keys, or route strings — only user-visible copy.

Where the word `"cita"` appears in a confirmation or success message (e.g., `"Tu cita ha sido confirmada"`), replace it: `` `Tu ${textos.cita} ha sido confirmada` ``. Apply judgment — only strings visible to the end user.

- [ ] **Step 3: Pass notasLabel to PasoDatosCliente**

Find the `<PasoDatosCliente` usage in `BookingPage.tsx`. Add the `notasLabel` prop:

```tsx
<PasoDatosCliente
  servicio={servicio}
  empleado={empleado}
  slot={slot}
  enviando={enviando}
  datosIniciales={datosIniciales}
  onEnviar={handleEnviar}
  color={negocio.colorPrimario}
  notasLabel={negocio.sector === 'salud' ? 'Motivo de consulta' : undefined}
/>
```

- [ ] **Step 4: Smoke test in the browser**

1. Start the frontend: `npm run dev` in `Front/`
2. Open the booking page for a negocio with `sector = "belleza"` — confirm it shows "Reserva tu cita" and notas label is "Notas adicionales"
3. Set a test negocio's sector to `"salud"` via the PATCH endpoint (Task 3)
4. Reload the booking page — confirm it shows "Agenda tu consulta" and notas label is "Motivo de consulta"

- [ ] **Step 5: Commit**

```bash
git add Front/src/pages/publico/BookingPage.tsx
git commit -m "feat(booking): sector-aware copy and motivo de consulta for salud"
```

---

### Task 7: Frontend — DashboardLayout nav filtering, clinical blue theme, route guard

**Files:**
- Modify: `Front/src/layouts/DashboardLayout.tsx`
- Create: `Front/src/layouts/DashboardLayout.test.tsx`

**Interfaces:**
- Consumes: `NegocioDto.sector` (Task 4) via the `perfil` query already present in the component
- Produces:
  - `export function getNav(sector: string): NavItem[]` — consumed by the test and the component itself
  - Filtered + renamed nav for salud
  - Clinical blue sidebar + topbar for salud
  - Redirect to `/dashboard` when a salud propietario hits `/dashboard/pagos` or `/dashboard/galeria`

- [ ] **Step 1: Write the failing test**

Create `Front/src/layouts/DashboardLayout.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { getNav } from './DashboardLayout';

describe('getNav', () => {
  it('includes Pagos and Galería for belleza', () => {
    const nav = getNav('belleza');
    expect(nav.some(n => n.to === '/dashboard/pagos')).toBe(true);
    expect(nav.some(n => n.to === '/dashboard/galeria')).toBe(true);
  });

  it('excludes Pagos and Galería for salud', () => {
    const nav = getNav('salud');
    expect(nav.some(n => n.to === '/dashboard/pagos')).toBe(false);
    expect(nav.some(n => n.to === '/dashboard/galeria')).toBe(false);
  });

  it('renames Empleados to Médicos for salud', () => {
    const emp = getNav('salud').find(n => n.to === '/dashboard/empleados');
    expect(emp?.label).toBe('Médicos');
  });

  it('renames Servicios to Tipos de consulta for salud', () => {
    const svc = getNav('salud').find(n => n.to === '/dashboard/servicios');
    expect(svc?.label).toBe('Tipos de consulta');
  });

  it('renames Clientes to Pacientes for salud', () => {
    const cli = getNav('salud').find(n => n.to === '/dashboard/clientes');
    expect(cli?.label).toBe('Pacientes');
  });

  it('keeps original labels for belleza', () => {
    const nav = getNav('belleza');
    expect(nav.find(n => n.to === '/dashboard/empleados')?.label).toBe('Empleados');
    expect(nav.find(n => n.to === '/dashboard/servicios')?.label).toBe('Servicios');
    expect(nav.find(n => n.to === '/dashboard/clientes')?.label).toBe('Clientes');
  });
});
```

**Note on `n.to`:** The test assumes each nav item has a `to` property. Look at the actual `NAV_PROPIETARIO` array in `DashboardLayout.tsx` — if the property is named `href` or `path` instead of `to`, update both the test and the implementation to match the existing field name.

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd Front
npx vitest run src/layouts/DashboardLayout.test.tsx
```

Expected: FAIL — `getNav is not exported from DashboardLayout`.

- [ ] **Step 3: Implement and export getNav**

Open `Front/src/layouts/DashboardLayout.tsx`. Above the component function (near `NAV_PROPIETARIO`), add:

```typescript
// The shape of NAV_PROPIETARIO items — match whatever type they already use in the file
interface NavItem {
  label: string;
  to: string; // use the actual property name (href / path / to) from NAV_PROPIETARIO
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const HIDDEN_IN_SALUD = new Set(['/dashboard/pagos', '/dashboard/galeria']);

const SALUD_LABELS: Record<string, string> = {
  '/dashboard/empleados': 'Médicos',
  '/dashboard/servicios': 'Tipos de consulta',
  '/dashboard/clientes': 'Pacientes',
};

export function getNav(sector: string): NavItem[] {
  return (NAV_PROPIETARIO as NavItem[])
    .filter(item => sector !== 'salud' || !HIDDEN_IN_SALUD.has(item.to))
    .map(item => ({
      ...item,
      label:
        sector === 'salud' && SALUD_LABELS[item.to]
          ? SALUD_LABELS[item.to]
          : item.label,
    }));
}
```

**Use getNav in the render.** Find where `NAV_PROPIETARIO.map(...)` is called to render sidebar nav links. Replace it with:

```typescript
getNav(perfil?.sector ?? 'belleza').map(item => ...)
```

Where `perfil` is however the component already accesses the negocio profile data (look for the existing `useQuery` that calls `negociosApi.obtenerPerfil` — it's already in the component).

- [ ] **Step 4: Add the route guard**

Near the top of the `DashboardLayout` component function body, after `perfil` data is accessible, add:

```typescript
const location = useLocation();
const navigate = useNavigate();

useEffect(() => {
  if (
    perfil?.sector === 'salud' &&
    (location.pathname.startsWith('/dashboard/pagos') ||
      location.pathname.startsWith('/dashboard/galeria'))
  ) {
    navigate('/dashboard', { replace: true });
  }
}, [perfil?.sector, location.pathname, navigate]);
```

Add `useLocation` and `useNavigate` to the React Router import if they are not already imported.

- [ ] **Step 5: Add the clinical blue theme**

Find the sidebar container element in the JSX (the `<div>` or `<nav>` with a dark background class like `bg-gray-900` or `bg-slate-900`). Add a conditional `style` prop:

```tsx
<div
  className="... existing classes ..."
  style={perfil?.sector === 'salud' ? { backgroundColor: '#0F4C75' } : undefined}
>
```

Find the top bar element (usually a `<header>` or top `<div>`) and add:

```tsx
style={perfil?.sector === 'salud' ? { backgroundColor: '#1B6CA8' } : undefined}
```

Find the active nav item highlight element (the element with a class like `bg-white/10` or similar that marks the active link). Add:

```tsx
style={perfil?.sector === 'salud' ? { backgroundColor: '#1B6CA8' } : undefined}
```

The existing Tailwind classes handle `"belleza"` — the `style` attribute overrides only when sector is `"salud"`.

- [ ] **Step 6: Run the test to confirm it passes**

```bash
npx vitest run src/layouts/DashboardLayout.test.tsx
```

Expected: PASS — 6 tests passed.

- [ ] **Step 7: Smoke test in the browser**

1. Set a test negocio to `sector = "salud"` via the PATCH endpoint
2. Log in as that negocio's propietario
3. Confirm: sidebar shows deep blue (`#0F4C75`), Pagos and Galería are absent, Empleados = "Médicos", Servicios = "Tipos de consulta", Clientes = "Pacientes"
4. Navigate directly to `/dashboard/pagos` — confirm redirect to `/dashboard`
5. Log in as a belleza propietario — confirm sidebar is unchanged (original dark theme, all nav items present with original labels)

- [ ] **Step 8: Commit**

```bash
git add Front/src/layouts/DashboardLayout.tsx Front/src/layouts/DashboardLayout.test.tsx
git commit -m "feat(dashboard): sector-aware nav, clinical blue theme, route guard for salud"
```

---

### Task 8: Frontend — SuperAdmin NegociosAdminPage sector UI

**Files:**
- Modify: `Front/src/pages/admin/NegociosAdminPage.tsx`

**Interfaces:**
- Consumes: `SuscripcionResumenDto.sector` (Task 4), `adminApi.setSector` (Task 4)

- [ ] **Step 1: Add sector badge to TarjetaNegocio**

In `NegociosAdminPage.tsx`, find the `TarjetaNegocio` component (around line 382). It receives a `SuscripcionResumenDto` (now with `sector`). Add a sector badge pill inside the card header, alongside the existing status badges:

```tsx
<span
  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
    suscripcion.sector === 'salud'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-pink-100 text-pink-800'
  }`}
>
  {suscripcion.sector === 'salud' ? '🏥 Salud' : '💆 Belleza'}
</span>
```

Replace `suscripcion` with whatever prop name the `TarjetaNegocio` component uses for the business data.

- [ ] **Step 2: Add handleSetSector handler in ModalSuscripcion**

In `ModalSuscripcion`, look at how `handleSetEmpleadosExtra` is implemented — it calls `adminApi.setEmpleadosExtra` and then invalidates the `["admin-suscripciones"]` query. Add a parallel handler:

```typescript
const handleSetSector = async (sector: string) => {
  try {
    await adminApi.setSector(suscripcion.negocioId.toString(), sector);
    await queryClient.invalidateQueries({ queryKey: ['admin-suscripciones'] });
  } catch (err) {
    console.error('Error al cambiar sector:', err);
  }
};
```

Replace `suscripcion.negocioId` with whatever prop holds the negocio ID in `ModalSuscripcion`.

- [ ] **Step 3: Add sector toggle to ModalSuscripcion JSX**

In the `ModalSuscripcion` JSX, after the `EmpleadosExtra` inline-edit section, add:

```tsx
{/* Sector */}
<div className="mt-4">
  <p className="text-xs font-medium text-gray-700 mb-1">Sector</p>
  <div className="flex gap-2">
    {(['belleza', 'salud'] as const).map(s => (
      <button
        key={s}
        type="button"
        onClick={() => handleSetSector(s)}
        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
          suscripcion.sector === s
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
        }`}
      >
        {s === 'salud' ? '🏥 Salud' : '💆 Belleza'}
      </button>
    ))}
  </div>
</div>
```

Replace `suscripcion.sector` with the actual prop/state variable holding the current sector.

- [ ] **Step 4: TypeScript check**

```bash
cd Front
npx tsc --noEmit
```

Expected: 0 errors. If the `suscripcion` object inside `ModalSuscripcion` comes from local state (derived from the `SuscripcionResumenDto` prop), TypeScript will already know `sector: string` is present from Task 4.

- [ ] **Step 5: Smoke test in the browser**

1. Log in as SuperAdmin
2. Open the Negocios tab — confirm each card shows a sector badge (💆 Belleza or 🏥 Salud)
3. Open a business modal — confirm the sector toggle (Belleza | Salud) appears
4. Switch a negocio from Belleza to Salud — confirm the badge updates on modal close
5. Log in as that negocio's propietario — confirm the clinical blue theme and filtered nav

- [ ] **Step 6: Commit**

```bash
git add Front/src/pages/admin/NegociosAdminPage.tsx
git commit -m "feat(admin): sector badge on business cards and sector toggle in modal"
```

---

## Self-Review

**Spec coverage:**
- ✅ §1a `Negocio.Sector` field — Task 1
- ✅ §1b `PATCH /api/admin/negocios/{id}/sector` — Task 3
- ✅ §1c `SuscripcionResumenDto.Sector` — Task 2
- ✅ §1d `NegocioDto.Sector` (propietario dashboard) — Task 2
- ✅ §2a Sector toggle in `ModalSuscripcion` — Task 8
- ✅ §2b Sector badge on business cards — Task 8
- ✅ §3a `sector` in propietario store/query — Task 4
- ✅ §3b Conditional module visibility via `getNav(sector)` — Task 7
- ✅ §3c Clinical blue theme for salud — Task 7
- ✅ §3c Route guard for `/dashboard/pagos` and `/dashboard/galeria` — Task 7
- ✅ §4a `Sector` in `NegocioPublicoDto` + TS type — Tasks 2, 4
- ✅ §4b `textos` constant in `BookingPage` — Task 6
- ✅ §4c `notasLabel` prop on `PasoDatosCliente` — Tasks 5, 6
- ✅ §5a Updated TS interfaces — Task 4
- ✅ §5b `setSector` API function — Task 4

**Type consistency:**
- `getNav(sector: string): NavItem[]` — defined and exported in Task 7, tested in Task 7 — consistent
- `notasLabel?: string` — defined in Task 5 Props interface, consumed in Task 6 as `notasLabel={...}` — consistent
- `adminApi.setSector(negocioId: string, sector: string): Promise<void>` — defined in Task 4, consumed in Task 8 — consistent
- `NegocioPublico.sector: string` — added Task 4, accessed as `negocio.sector === 'salud'` in Tasks 6 and 7 — consistent
- `SuscripcionResumenDto.sector: string` — added Task 4, accessed as `suscripcion.sector` in Task 8 — consistent
