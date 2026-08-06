# SuperAdmin Billing Management — Design Spec

## Goal

Give the SuperAdmin the ability to track and adjust per-business employee counts that affect monthly pricing, and to see consolidated billing data across all businesses from a single tab.

## Context

AppointVa charges a flat plan fee plus $49 MXN per extra employee beyond the plan's included base. Today the `ModalSuscripcion` component hardcodes $249 MXN as the suggested payment amount regardless of the business's plan or headcount. There is also no single view showing all billing at a glance — the admin must open each business card individually.

**Tech Stack:** ASP.NET Core 8 / EF Core / SQL Server · React 19 / TypeScript / TanStack Query v5 / Tailwind CSS

---

## Global Constraints

- Extra employee price: **$49 MXN** (constant, not stored — applied in calculation only)
- Plan DB records to match new pricing: Básico `PrecioMensual = 249, MaxEmpleados = 2`; Pro `PrecioMensual = 449, MaxEmpleados = 3`
- `EmpleadosExtra` default: **0** (int, non-negative)
- Billing total is always calculated real-time: `plan.PrecioMensual + (negocio.EmpleadosExtra × 49)`; never stored
- No new npm runtime dependencies
- TypeScript strict — no `any`
- All new API endpoints require `[Authorize(Roles = Roles.SuperAdmin)]`

---

## Section 1: Data Model

### 1a. New field on `Negocio`

Add `EmpleadosExtra` (`int`, default `0`) to the `Negocio` entity. This represents employees added beyond the plan's `MaxEmpleados` base, billed at $49/month each.

**File:** `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs`

```csharp
public int EmpleadosExtra { get; set; } = 0;
```

EF Core migration: `AddColumn<int>(name: "EmpleadosExtra", table: "Negocios", nullable: false, defaultValue: 0)`.

### 1b. Update Plan seed data

Two existing Plan rows need updated values. These are data-only changes — no schema change required.

| Plan | PrecioMensual | MaxEmpleados |
|------|--------------|--------------|
| Básico | 249 | 2 |
| Pro | 449 | 3 |

Apply via a targeted SQL migration (no model change needed for `Plan`).

### 1c. New PATCH endpoint

**Route:** `PATCH /api/admin/negocios/{id}/empleados-extra`

**Controller:** `SuscripcionAdminController`

**Request body:**
```csharp
public record SetEmpleadosExtraDto(int EmpleadosExtra);
```

**Validation:** `EmpleadosExtra >= 0`.

**Response:** Updated `SuscripcionResumenDto` extended with billing fields (see Section 2).

**Why PATCH, not PUT:** We're updating a single field, not replacing the full subscription record. Consistent with the existing `PATCH /api/admin/negocios/{id}/modulo-pagos` endpoint.

### 1d. Extended DTO

Extend `SuscripcionResumenDto` (or create a parallel `BillingResumenDto` — see decision below) to include:

```csharp
public string? PlanNombre { get; set; }
public decimal PrecioBase { get; set; }
public int MaxEmpleadosBase { get; set; }
public int EmpleadosExtra { get; set; }
public decimal TotalMensual { get; set; }   // PrecioBase + (EmpleadosExtra × 49)
```

**Decision:** Extend `SuscripcionResumenDto` in-place. The existing `ObtenerSuscripciones` endpoint already queries `Negocio → Plan`; adding billing fields there avoids a second endpoint and keeps the frontend's cache key structure simple. The fields default to zero/null for businesses with no plan, so existing callers are not broken.

---

## Section 2: ModalSuscripcion Updates

### 2a. Remove hardcoded pricing

Delete the constants `PRECIO_MES = 249`, `PRECIO_ANUAL = 2490`, `LIFETIME = 1200`.

Replace with derived values computed from `suscripcion.PrecioBase`, `negocio.maxEmpleados`, and `negocio.empleadosExtra` (sourced from the extended `SuscripcionResumenDto`).

### 2b. Billing summary header

Above the payment form, add a read-only summary block:

```
Plan: Pro                           $449/mes
Empleados base:                     3
Empleados extra:      [ 2  ↑ ↓ ]   +$98/mes
─────────────────────────────────────────────
Total mensual:                      $547/mes
```

- Plan name and base price come from `suscripcion.PlanNombre` / `suscripcion.PrecioBase`
- "Empleados extra" is an editable number input (min 0, step 1) that triggers the `PATCH /api/admin/negocios/{id}/empleados-extra` endpoint on change
- "Total mensual" updates live as the input changes (optimistic calculation: `precioBase + empleadosExtra × 49`)
- The mutation invalidates `["admin-suscripciones"]` on success, so the billing tab (Section 3) reflects the update

### 2c. Pre-fill payment amount

When the user clicks a month-count button, pre-fill the `monto` input with `totalMensual × meses` instead of the hardcoded formula. The field remains free-edit so the admin can override.

**Lifecycle example:** Admin opens modal for a Pro business with 2 extra employees. Total = $449 + $98 = $547. Clicks "3 months" → monto pre-fills to $1,641.

### 2d. Lifetime button

Keep the "De por vida" option. Pre-fill `monto` with `""` (empty — admin enters a custom amount) rather than the hardcoded `1200`.

---

## Section 3: Facturación Tab

### 3a. Tab structure on NegociosAdminPage

Add a two-tab layout to `NegociosAdminPage`:

- **Tab "Negocios"** — the current card grid (unchanged)
- **Tab "Facturación"** — new billing summary table

Use the same `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` components already used on `CitasPage` and `ServiciosPage`. Default active tab: "Negocios" (preserves current behavior on load).

### 3b. Billing table

One row per business. Columns:

| Column | Source |
|--------|--------|
| Negocio | `negocioNombre` |
| Plan | `planNombre` |
| Emp. base | `maxEmpleadosBase` |
| Emp. extra | `empleadosExtra` — editable number input; on blur calls `PATCH /api/admin/negocios/{id}/empleados-extra` and invalidates `["admin-suscripciones"]` |
| Total/mes | `totalMensual` (calculated) |
| Vence | `fechaVencimiento` formatted as `DD/MM/YYYY`, or "—" |
| Estado | pill badge: `Activa` (green) / `PorVencer` (amber) / `Vencida` (red) / `SinSuscripcion` (gray) |
| Acción | "Ver suscripción" button → opens `ModalSuscripcion` for that row |

### 3c. Summary footer row

Below the table, a summary row:

```
Total facturación estimada:    $X,XXX MXN/mes    (N negocios activos)
```

Calculation: sum of `totalMensual` for all businesses where `estado !== "SinSuscripcion"`.

### 3d. Sort order

Default sort: `estado` order (Vencida first, then PorVencer, then Activa, then SinSuscripcion) so problems surface at the top.

### 3e. Empty state

If no businesses have a plan assigned: "Ningún negocio tiene un plan activo todavía."

---

## Section 4: TypeScript Changes

### 4a. Extended interface

```ts
// Extend existing SuscripcionResumenDto in admin.ts
interface SuscripcionResumenDto {
  // ... existing fields
  planNombre: string | null;
  precioBase: number;
  maxEmpleadosBase: number;
  empleadosExtra: number;
  totalMensual: number;
}
```

### 4b. New API function

```ts
setEmpleadosExtra: async (negocioId: string, empleadosExtra: number): Promise<SuscripcionResumenDto>
```

Calls `PATCH /api/admin/negocios/{negocioId}/empleados-extra` with body `{ empleadosExtra }`.

---

## Out of Scope

- Automatic billing (invoicing, Stripe, payment gateway) — billing remains manual
- Per-employee pricing history or audit log
- Plan creation/editing from the UI
- Changing a business's plan from the admin UI (done directly in DB for now)
- Email notifications for billing changes
