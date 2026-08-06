# AppointVa Health — Vertical de Salud — Design Spec

## Goal

Add a health sector vertical to AppointVa that supports small private consultories (dental, psychology, therapy) within the same codebase and domain. The SuperAdmin assigns the sector to each business; the platform adapts its terminology, dashboard theme, visible modules, and booking flow accordingly.

## Context

AppointVa currently serves beauty businesses (salons, barbershops, spas). The health sector shares the same core scheduling engine but requires different terminology, a clinical visual identity, no payments/gallery modules, and a "motivo de consulta" field on the booking page. All existing beauty businesses remain unaffected — default sector is `"belleza"`.

**Tech Stack:** ASP.NET Core 8 / EF Core 8 / SQL Server · React 19 / TypeScript / TanStack Query v5 / Tailwind CSS

---

## Global Constraints

- Two sectors only: `"belleza"` (default) | `"salud"`
- All existing negocios default to `"belleza"` — zero migration risk
- No new npm runtime dependencies
- TypeScript strict — no `any`
- SuperAdmin assigns sector; propietario cannot change it
- Sector drives UI conditionals only — no separate layouts, no forked routes

---

## Section 1: Data Model

### 1a. New field on `Negocio`

Add `Sector` (`string`, default `"belleza"`) to the `Negocio` entity.

**File:** `Back/AppointVaAPI/AppointVaAPI/Models/Negocio.cs`

```csharp
public string Sector { get; set; } = "belleza";
```

EF Core migration: `AddColumn<string>(name: "Sector", table: "Negocios", nullable: false, defaultValue: "belleza")`.

No changes needed to any existing negocio record — the default covers all.

### 1b. New PATCH endpoint

**Route:** `PATCH /api/admin/negocios/{id}/sector`

**Controller:** `SuscripcionAdminController` (follows the same pattern as the existing `modulo-pagos` and `empleados-extra` endpoints)

**Request body:**
```csharp
public record SetSectorDto(string Sector);
```

**Validation:** `Sector` must be `"belleza"` or `"salud"`. Return 400 otherwise.

**Response:** 200 OK (no body) on success, 404 if negocio not found.

**Auth:** `[Authorize(Roles = Roles.SuperAdmin)]`

### 1c. Expose sector in existing DTOs

`SuscripcionResumenDto` (used by the SuperAdmin panel) must include `Sector` so the UI can display and update it.

**File:** `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Admin/PagoSuscripcionDto.cs`

Add `public string Sector { get; set; } = "belleza";` to `SuscripcionResumenDto`.

Map it in `SuscripcionAdminController.ObtenerSuscripciones` `.Select()` projection: `Sector = n.Sector`.

### 1d. Expose sector to the propietario dashboard

The front needs `sector` in the negocio data returned to the propietario. Verify that the existing `GET /api/negocios/mi-negocio` (or equivalent) endpoint returns `Sector` and add it if missing.

**File:** `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Negocios/NegocioDto.cs` — add `public string Sector { get; set; } = "belleza";` and map it in the controller.

---

## Section 2: SuperAdmin Panel

### 2a. Sector control in NegociosAdminPage

In `Front/src/pages/admin/NegociosAdminPage.tsx`, add a sector toggle to each business card (or inside `ModalSuscripcion`). A simple two-option selector: `Belleza | Salud`. On change, calls `PATCH /api/admin/negocios/{id}/sector` and invalidates `["admin-suscripciones"]`.

Use the same inline-edit pattern already used for `empleadosExtra` in the Facturación tab — no new modal needed.

### 2b. Sector badge on business cards

Display a small pill badge on each card in the Negocios tab: `💆 Belleza` or `🏥 Salud`. Purely visual, sourced from `suscripcion.sector`.

---

## Section 3: Dashboard — Theme and Modules

### 3a. Sector in the propietario store/query

The propietario dashboard already fetches the negocio data. Add `sector: string` to the `NegocioDto` TypeScript interface in `Front/src/types/index.ts`. The dashboard reads this from the existing query — no new endpoint.

### 3b. Conditional module visibility

In `Front/src/layouts/DashboardLayout.tsx`, filter the `NAV_PROPIETARIO` array based on `negocio.sector`:

| Module | Belleza | Salud |
|--------|---------|-------|
| Citas | ✅ | ✅ |
| Pagos | ✅ | ❌ hidden |
| Clientes → Pacientes | ✅ | ✅ (renamed) |
| Empleados → Médicos | ✅ | ✅ (renamed) |
| Servicios → Tipos de consulta | ✅ | ✅ (renamed) |
| Descuentos | ✅ | ✅ |
| Reportes | ✅ | ✅ |
| Mi negocio | ✅ | ✅ |
| Galería | ✅ | ❌ hidden |
| Cuestionario | ✅ | ✅ |
| Seguridad | ✅ | ✅ |

Implementation: derive the nav array from a function `getNav(sector)` at the top of `DashboardLayout.tsx` that returns the filtered + relabeled items. No changes to the page components themselves.

Route guard: if a salud propietario navigates directly to `/dashboard/pagos` or `/dashboard/galeria`, redirect to `/dashboard`.

### 3c. Dashboard theme for salud

When `negocio.sector === "salud"`, the sidebar and top bar apply a clinical palette instead of the current dark theme.

**Color tokens for salud:**
- Sidebar background: `#0F4C75` (deep medical blue)
- Sidebar active item: `#1B6CA8`
- Sidebar text: `#E8F4FD`
- Top bar: `#1B6CA8`
- Accent/CTA: `#2196F3`

Implemented via conditional Tailwind classes on the layout wrapper — a `sectorClass` variable that switches based on `negocio.sector`. The existing dark-mode classes remain for `"belleza"`.

---

## Section 4: Booking Page — Public Facing

### 4a. Sector in NegocioPublicoDto

Add `public string Sector { get; set; } = "belleza";` to `NegocioPublicoDto` and map it in `PublicoController`. The booking page receives this field with the existing `GET /publico/negocios/{slug}` call — no new endpoint.

Add `sector: string` to the `NegocioPublico` TypeScript interface.

### 4b. Terminology in BookingPage

When `negocio.sector === "salud"`:
- Main CTA / heading: "Agenda tu consulta" instead of "Reserva tu cita"
- Step labels and confirmation text adapt accordingly

Implemented as a derived constant at the top of `BookingPage.tsx`:
```ts
const textos = negocio.sector === "salud"
  ? { cta: "Agenda tu consulta", cita: "consulta" }
  : { cta: "Reserva tu cita",    cita: "cita"     };
```

### 4c. Motivo de consulta field

`PasoDatosCliente` already renders a `notas` textarea. Add a `notasLabel?: string` prop to the component. When not provided, defaults to `"Notas adicionales"` (current behavior — no change for belleza).

In `BookingPage.tsx`, pass `notasLabel` to `PasoDatosCliente` only when `negocio.sector === "salud"`:

```tsx
<PasoDatosCliente
  ...
  notasLabel={negocio.sector === "salud" ? "Motivo de consulta" : undefined}
/>
```

No backend changes needed — `notas` field already exists on the `Cita` model.

### 4d. Hide descuento for salud (optional / follow-up)

The "¿Tienes un código de descuento?" button is shown regardless of sector. This can remain for now — a consultorio may still want to offer promo codes. Not in scope for this iteration.

---

## Section 5: TypeScript Changes

### 5a. Updated interfaces

```ts
// Front/src/types/index.ts

interface NegocioPublico {
  // ... existing fields
  sector: string;
}

interface NegocioDto {          // propietario dashboard
  // ... existing fields
  sector: string;
}
```

### 5b. Updated admin interface

```ts
// Front/src/api/admin.ts

interface SuscripcionResumenDto {
  // ... existing fields
  sector: string;
}

setSector: async (negocioId: string, sector: string): Promise<void>
// calls PATCH /api/admin/negocios/{negocioId}/sector
```

---

## Out of Scope

- Expediente clínico / patient medical history
- Prescription or follow-up scheduling
- Insurance / payment integration for health
- NOM-024 compliance (clinical records regulation) — applies only when storing clinical data, not booking metadata
- Self-registration sector selection by propietario
- A third sector beyond belleza/salud
