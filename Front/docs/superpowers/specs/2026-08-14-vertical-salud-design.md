# Vertical de Salud — Design Spec

## Goal

Extend AppointVa to serve health professionals (dentists, psychologists, therapists, nutritionists, optometrists) using the same codebase and domain, adapted through a `sector` field on `Negocio`. Health businesses get the same core feature set as beauty, minus payments, gallery, waitlist, and discounts.

## Architecture

The `sector` field (`"belleza"` | `"salud"`) already exists on the `Negocio` model with a default of `"belleza"`. No new migration is required. All adaptation branches from this single field through two mechanisms:

1. **Terminology** — a `useSectorTerms()` hook maps domain nouns to sector-appropriate labels.
2. **Feature gating** — a `useSectorFeatures()` hook exposes boolean flags that control which routes and nav items are visible.

The backend enforces sector constraints at registration time. The frontend reads sector from the auth context (dashboard) or from the loaded negocio object (public booking).

---

## Section 1: Backend changes

**File:** `AppointVaAPI/Controllers/V1/AutenticacionController.cs`

- Validate that the `sector` field in the registration DTO is either `"belleza"` or `"salud"`. Reject any other value with 400.
- When `sector == "salud"`, set on the new `Negocio`:
  - `ModuloPagosHabilitado = false`
  - `RequiereAnticipo = false`
  - `ListaEsperaActiva = false`

No migration needed. No new models. No new endpoints.

---

## Section 2: Terminology system

**New file:** `Front/src/hooks/useSectorTerms.ts`

Returns singular and plural forms for all sector-sensitive nouns. The hook reads `negocio.sector` from the auth context.

```ts
interface SectorTerms {
  cita: string;       citas: string;
  cliente: string;    clientes: string;
  empleado: string;   empleados: string;
  servicio: string;   servicios: string;
}

// belleza
{ cita: "Cita", citas: "Citas", cliente: "Cliente", clientes: "Clientes",
  empleado: "Empleado", empleados: "Empleados", servicio: "Servicio", servicios: "Servicios" }

// salud
{ cita: "Consulta", citas: "Consultas", cliente: "Paciente", clientes: "Pacientes",
  empleado: "Profesional", empleados: "Profesionales",
  servicio: "Tipo de consulta", servicios: "Tipos de consulta" }
```

**Usage:** every dashboard page, sidebar, and form that displays these nouns imports `useSectorTerms()` and reads from the returned object. No hardcoded strings for these terms remain in any component.

**Public booking context:** the booking pages (`/b/:slug`) already load the full `Negocio` object from the API. A standalone helper `getSectorTerms(sector: string): SectorTerms` (same logic, no hook) is used in those pages since they don't have auth context.

---

## Section 3: Feature gating

**New file:** `Front/src/hooks/useSectorFeatures.ts`

```ts
interface SectorFeatures {
  pagos: boolean;
  galeria: boolean;
  listaEspera: boolean;
  descuentos: boolean;
}

// belleza → reads from negocio feature flags (ModuloPagosHabilitado, etc.)
// salud   → all false, regardless of negocio flags
```

**Sidebar / DashboardLayout:** renders nav links for Pagos, Galería, Lista de espera, and Descuentos only when the corresponding feature flag is `true`.

**Route protection:** if a health-sector user navigates directly to `/dashboard/pagos`, `/dashboard/galeria`, `/dashboard/espera`, or `/dashboard/descuentos`, they are redirected to `/dashboard`.

---

## Section 4: Registration flow

**File:** `Front/src/pages/auth/RegistroNegocioPage.tsx`

- Add a sector selector to the form: two options — "Salón / Barbería / Spa" (belleza) and "Consultorio de salud" (salud).
- On mount, read `?sector` from the URL query string:
  - If `sector=salud` → pre-select "Consultorio de salud" and lock the selector (read-only). The user came from the health CTA intentionally.
  - If `sector=belleza` or no param → pre-select "Salón / Barbería / Spa" but leave the selector editable.
- The selected sector is included in the registration payload sent to the backend.

---

## Section 5: Landing pages

### Existing landing (`/`) — beauty

Add a subtle nav link: **"¿Tienes un consultorio?"** → `/salud`

Update the registration CTA to include `?sector=belleza` explicitly so the registration page is always pre-configured correctly when coming from a landing.

### New landing (`/salud`) — health

**New file:** `Front/src/pages/publico/LandingPageSalud.tsx`

Same component structure as `LandingPage.tsx`. Content tailored to health:

- **Hero:** "La agenda más simple para tu consultorio"
- **Subtitle:** "Recordatorios automáticos, booking online 24/7 y control total de tus pacientes. Sin complicaciones."
- **CTA primary:** "Empieza gratis" → `/registro?sector=salud`
- **Ideal para:** Dentistas, Psicólogos, Terapeutas, Nutriólogos, Optometristas
- **Features section:** booking online, recordatorios por email/WhatsApp, historial de pacientes, vista de agenda, sin módulo de pagos (simplicidad como ventaja)
- **Testimonials:** 3 testimonials from health professionals (fabricated initially, replaced with real ones via the survey system)
- **Pricing section:** same plans as beauty (reuse existing component)
- **Nav link:** "¿Tienes un salón o barbería?" → `/`

**Route:** registered in `App.tsx` as `/salud`, lazy-loaded.

---

## Section 6: Booking flow (`/b/:slug`)

No new pages. The existing booking components (`PasoServicio`, `PasoEmpleado`, `PasoFecha`, etc.) receive terminology from `getSectorTerms(negocio.sector)`.

Adapted labels:
- "Selecciona un servicio" → "Selecciona un tipo de consulta"
- "Selecciona un empleado" → "Selecciona un profesional"
- "Tu cita" → "Tu consulta"
- Confirmation emails use the sector-appropriate terms

The public negocio page (`BookingPage`) already loads the full negocio — sector is available immediately.

---

## Out of scope

- Waitlist for health sector (deferred — needs separate discovery)
- Payments/deposits for health (not planned)
- Gallery for health (not planned)
- Discounts for health (not planned)
- Any health-specific intake fields beyond what the existing Intake module supports

---

## Impacted files (summary)

| Area | Files |
|------|-------|
| Backend | `AutenticacionController.cs` |
| New hooks | `useSectorTerms.ts`, `useSectorFeatures.ts` |
| Dashboard layout | `DashboardLayout.tsx` |
| Dashboard pages (terms) | `EmpleadosPage`, `ServiciosPage`, `CitasPage`, `CitaDetallePage`, `ClientesPage`, `ReportesPage`, `KioskPage`, `IntakePage`, `DashboardInicioPage`, `PerfilPage`, `MiPerfilPage` |
| Route protection | `App.tsx` |
| Registration | `RegistroNegocioPage.tsx` |
| Booking public | `BookingPage.tsx`, `PasoServicio.tsx`, `PasoEmpleado.tsx`, confirmation/email copy |
| New landing | `LandingPageSalud.tsx` |
| Existing landing | `LandingPage.tsx` (nav link + CTA update) |
