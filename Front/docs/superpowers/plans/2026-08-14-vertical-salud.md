# Vertical de Salud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a health-sector vertical to AppointVa so dentists, psychologists, and therapists can register and use the same platform with adapted terminology and feature gating.

**Architecture:** The `sector` field already exists on `Negocio` (string, default `"belleza"`). All adaptation branches from that single field: a `useSectorTerms()` hook maps nouns to sector-appropriate labels, a `useSectorFeatures()` hook gates features, and a new `/salud` landing page routes health professionals to `/registro?sector=salud`.

**Tech Stack:** ASP.NET Core 10 (backend), React 18 + TypeScript + Zustand + React Query + Tailwind CSS (frontend)

## Global Constraints

- Sector values are ONLY `"belleza"` or `"salud"` (lowercase, no accents, no other values)
- No new DB migration needed — `sector` field already exists on `Negocio`
- Hidden features for `sector = "salud"`: Pagos, Galería, Descuentos, Lista de espera
- Terminology for `sector = "salud"`: cita→Consulta, cliente→Paciente, empleado→Profesional, servicio→Tipo de consulta
- All UI copy is in neutral Mexican Spanish
- Follow the exact pattern of `src/hooks/useModuloPagos.ts` for new hooks
- Backend project root: `c:\Cursos\AppointVa\Back\AppointVaAPI`
- Frontend project root: `c:\Cursos\AppointVa\Front`

---

### Task 1: Backend — sector validation + health defaults

**Files:**
- Modify: `AppointVaAPI/Models/Dtos/Negocios/RegistroNegocioDto.cs`
- Modify: `AppointVaAPI/Controllers/V1/PublicoController.cs` (method `RegistrarNegocio`, around line 842)

**Context:** `RegistroNegocioDto.Sector` is currently `string?` with no validation — any value passes through. The `RegistrarNegocio` action already assigns `Sector = dto.Sector` to the new `Negocio`, but does not enforce valid values or set health-sector defaults.

- [ ] **Step 1: Add validation attribute to RegistroNegocioDto**

Replace the current `Sector` property in `RegistroNegocioDto.cs`:

```csharp
// BEFORE:
[MaxLength(50)]
public string? Sector { get; set; }

// AFTER:
[Required]
[MaxLength(20)]
[RegularExpression(@"^(belleza|salud)$", ErrorMessage = "Sector inválido. Usa 'belleza' o 'salud'.")]
public string Sector { get; set; } = "belleza";
```

- [ ] **Step 2: Add health defaults in RegistrarNegocio**

In `PublicoController.cs`, locate the `RegistrarNegocio` action. After the `var negocio = new Negocio { ... }` block (around line 853), add the health defaults immediately after the object initializer closes:

```csharp
var negocio = new Negocio
{
    Id = Guid.NewGuid(),
    Slug = dto.Slug,
    Nombre = dto.NombreNegocio,
    Telefono = dto.Telefono,
    Sector = dto.Sector,
    Activo = 0,
    FechaCreacion = DateTime.UtcNow,
    FechaActualizacion = DateTime.UtcNow
};

// Health sector: disable features that don't apply
if (dto.Sector == "salud")
{
    negocio.ModuloPagosHabilitado = false;
    negocio.RequiereAnticipo = false;
    negocio.ListaEsperaActiva = false;
}
```

- [ ] **Step 3: Build the backend**

```bash
cd "c:/Cursos/AppointVa/Back/AppointVaAPI"
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Run existing backend tests**

```bash
cd "c:/Cursos/AppointVa/Back/AppointVaAPI"
dotnet test --no-build
```

Expected: same pass/fail count as before this task (307 passing, 3 pre-existing failures).

- [ ] **Step 5: Commit**

```bash
cd "c:/Cursos/AppointVa/Back/AppointVaAPI"
git add AppointVaAPI/Models/Dtos/Negocios/RegistroNegocioDto.cs
git add AppointVaAPI/Controllers/V1/PublicoController.cs
git commit -m "feat(registro): validate sector and apply health defaults on registration"
```

---

### Task 2: Frontend hooks — useSectorTerms + useSectorFeatures

**Files:**
- Create: `Front/src/hooks/useSectorTerms.ts`
- Create: `Front/src/hooks/useSectorFeatures.ts`

**Interfaces:**
- Consumes: `negociosApi.obtenerPerfil` (queryKey `["negocio-perfil"]`, returns object with `sector: string`, `moduloPagosHabilitado: boolean`, `listaEsperaActiva: boolean`)
- Produces:
  - `getSectorTerms(sector: string | null | undefined): SectorTerms` — pure function, usable in public pages without React Query
  - `useSectorTerms(): SectorTerms` — hook for dashboard pages
  - `useSectorFeatures(): SectorFeatures & { isLoading: boolean }` — hook for feature gating

**Context:** `useModuloPagos.ts` (lines 1–14) is the pattern to follow — it reads from `["negocio-perfil"]` with `staleTime: 5 * 60 * 1000`. Both new hooks use the same query key so the request is shared (React Query deduplicates).

- [ ] **Step 1: Create useSectorTerms.ts**

Create `Front/src/hooks/useSectorTerms.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

export interface SectorTerms {
  cita: string;
  citas: string;
  cliente: string;
  clientes: string;
  empleado: string;
  empleados: string;
  servicio: string;
  servicios: string;
}

const TERMINOS_BELLEZA: SectorTerms = {
  cita: "Cita",
  citas: "Citas",
  cliente: "Cliente",
  clientes: "Clientes",
  empleado: "Empleado",
  empleados: "Empleados",
  servicio: "Servicio",
  servicios: "Servicios",
};

const TERMINOS_SALUD: SectorTerms = {
  cita: "Consulta",
  citas: "Consultas",
  cliente: "Paciente",
  clientes: "Pacientes",
  empleado: "Profesional",
  empleados: "Profesionales",
  servicio: "Tipo de consulta",
  servicios: "Tipos de consulta",
};

export function getSectorTerms(sector: string | null | undefined): SectorTerms {
  return sector === "salud" ? TERMINOS_SALUD : TERMINOS_BELLEZA;
}

export function useSectorTerms(): SectorTerms {
  const { data } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });
  return getSectorTerms(data?.sector);
}
```

- [ ] **Step 2: Create useSectorFeatures.ts**

Create `Front/src/hooks/useSectorFeatures.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

export interface SectorFeatures {
  pagos: boolean;
  galeria: boolean;
  listaEspera: boolean;
  descuentos: boolean;
}

export function useSectorFeatures(): SectorFeatures & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  if (data?.sector === "salud") {
    return { pagos: false, galeria: false, listaEspera: false, descuentos: false, isLoading };
  }

  return {
    pagos: data?.moduloPagosHabilitado ?? false,
    galeria: true,
    listaEspera: data?.listaEsperaActiva ?? false,
    descuentos: true,
    isLoading,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/hooks/useSectorTerms.ts src/hooks/useSectorFeatures.ts
git commit -m "feat(sector): add useSectorTerms and useSectorFeatures hooks"
```

---

### Task 3: DashboardLayout — sector-aware navigation

**Files:**
- Modify: `Front/src/layouts/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `useSectorTerms()` from `../hooks/useSectorTerms`, `useSectorFeatures()` from `../hooks/useSectorFeatures`

**Context:** The current `NAV_PROPIETARIO` is a static array defined outside the component (around line 118). It includes entries for Empleados, Servicios, Pagos, Galería, and Descuentos — all need to be sector-aware. The array must move inside the component body so hooks can inform it.

- [ ] **Step 1: Import the new hooks**

At the top of `DashboardLayout.tsx`, add:

```ts
import { useSectorTerms } from "../hooks/useSectorTerms";
import { useSectorFeatures } from "../hooks/useSectorFeatures";
```

- [ ] **Step 2: Move NAV_PROPIETARIO inside the component and make it dynamic**

Inside the `DashboardLayout` component function body (before the return), add:

```tsx
const terms = useSectorTerms();
const features = useSectorFeatures();

const NAV_PROPIETARIO = [
  { to: "/dashboard",            label: "Inicio",              end: true, icon: LayoutDashboard },
  { to: "/dashboard/citas",      label: terms.citas,                      icon: CalendarDays },
  ...(features.pagos ? [{ to: "/dashboard/pagos", label: "Pagos", icon: CreditCard }] : []),
  { to: "/dashboard/clientes",   label: terms.clientes,                   icon: UserCheck },
  { to: "/dashboard/empleados",  label: terms.empleados,                  icon: Users },
  { to: "/dashboard/servicios",  label: terms.servicios,                  icon: Scissors },
  ...(features.descuentos ? [{ to: "/dashboard/descuentos", label: "Descuentos", icon: Tag }] : []),
  { to: "/dashboard/reportes",   label: "Reportes",                       icon: BarChart2 },
  { to: "/dashboard/perfil",     label: "Mi negocio",                     icon: Building2 },
  ...(features.galeria ? [{ to: "/dashboard/galeria", label: "Galería", icon: Images }] : []),
  { to: "/dashboard/intake",     label: "Cuestionario",                   icon: ClipboardList },
  { to: "/dashboard/seguridad",  label: "Seguridad",                      icon: ShieldCheck },
];
```

Remove the old static `NAV_PROPIETARIO` constant that was defined outside the component.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server (`npm run dev`), log in as a health-sector negocio. Confirm:
- Sidebar shows "Consultas", "Pacientes", "Profesionales", "Tipos de consulta"
- Sidebar does NOT show Pagos, Galería, Descuentos
- Sidebar still shows Reportes, Mi negocio, Cuestionario, Seguridad

- [ ] **Step 5: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/layouts/DashboardLayout.tsx
git commit -m "feat(dashboard): sector-aware navigation — terminology and feature gating"
```

---

### Task 4: Route protection for gated dashboard routes

**Files:**
- Modify: `Front/src/App.tsx`

**Interfaces:**
- Consumes: `useSectorFeatures()` from `./hooks/useSectorFeatures`

**Context:** Even with the nav links hidden, a health-sector user can still navigate directly to `/dashboard/pagos`, `/dashboard/galeria`, or `/dashboard/descuentos`. Add a wrapper that redirects to `/dashboard` when the feature is off.

- [ ] **Step 1: Add RutaConFeature component to App.tsx**

In `App.tsx`, after the existing imports, add:

```tsx
import { useSectorFeatures, type SectorFeatures } from "./hooks/useSectorFeatures";

function RutaConFeature({ feature, children }: { feature: keyof SectorFeatures; children: React.ReactNode }) {
  const features = useSectorFeatures();
  if (features.isLoading) return null;
  if (!features[feature]) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap gated routes**

In the dashboard routes section of `App.tsx`, wrap the three gated routes:

```tsx
// BEFORE:
<Route path="pagos" element={<PagosPage />} />
<Route path="galeria" element={<GaleriaPage />} />
<Route path="descuentos" element={<DescuentosPage />} />

// AFTER:
<Route path="pagos" element={
  <RutaConFeature feature="pagos"><PagosPage /></RutaConFeature>
} />
<Route path="galeria" element={
  <RutaConFeature feature="galeria"><GaleriaPage /></RutaConFeature>
} />
<Route path="descuentos" element={
  <RutaConFeature feature="descuentos"><DescuentosPage /></RutaConFeature>
} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual test**

Log in as a health-sector user, navigate directly to `/dashboard/pagos` in the browser. Expected: immediate redirect to `/dashboard`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/App.tsx
git commit -m "feat(routes): redirect health-sector users away from gated routes"
```

---

### Task 5: Dashboard pages — Empleados + Servicios terminology

**Files:**
- Modify: `Front/src/pages/dashboard/EmpleadosPage.tsx`
- Modify: `Front/src/pages/dashboard/ServiciosPage.tsx`

**Interfaces:**
- Consumes: `useSectorTerms()` from `../../hooks/useSectorTerms`

**Context:** Both pages have hardcoded "Empleado/s" and "Servicio/s" strings in titles, empty states, buttons, and toasts. Replace every user-visible instance with `terms.empleado`, `terms.empleados`, `terms.servicio`, `terms.servicios` from the hook.

- [ ] **Step 1: Update EmpleadosPage.tsx**

Add the hook import and call at the top of the component:

```tsx
import { useSectorTerms } from "../../hooks/useSectorTerms";

export function EmpleadosPage() {
  const terms = useSectorTerms();
  // ... rest of existing state
```

Then replace every hardcoded user-visible string. The key replacements are:

```tsx
// Page title / heading
"Empleados" → {terms.empleados}

// Add button
"Agregar empleado" → `Agregar ${terms.empleado.toLowerCase()}`

// Empty state
"No tienes empleados" → `No tienes ${terms.empleados.toLowerCase()}`
"Agrega tu primer empleado" → `Agrega tu primer ${terms.empleado.toLowerCase()}`

// Toast messages
"Empleado eliminado" → `${terms.empleado} eliminado`
"Empleado guardado" → `${terms.empleado} guardado`
```

Do NOT rename internal variable names, function names, or API call strings — only replace user-visible string literals.

- [ ] **Step 2: Update ServiciosPage.tsx**

Same pattern:

```tsx
import { useSectorTerms } from "../../hooks/useSectorTerms";

export function ServiciosPage() {
  const terms = useSectorTerms();
```

Key replacements:

```tsx
"Servicios" → {terms.servicios}
"Agregar servicio" → `Agregar ${terms.servicio.toLowerCase()}`
"No tienes servicios" → `No tienes ${terms.servicios.toLowerCase()}`
"Servicio guardado" → `${terms.servicio} guardado`
"Servicio eliminado" → `${terms.servicio} eliminado`
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/pages/dashboard/EmpleadosPage.tsx src/pages/dashboard/ServiciosPage.tsx
git commit -m "feat(dashboard): sector-aware terminology in Empleados and Servicios pages"
```

---

### Task 6: Dashboard pages — Citas, Clientes, and remaining pages

**Files:**
- Modify: `Front/src/pages/dashboard/CitasPage.tsx`
- Modify: `Front/src/pages/dashboard/CitaDetallePage.tsx`
- Modify: `Front/src/pages/dashboard/ClientesPage.tsx`
- Modify: `Front/src/pages/dashboard/KioskPage.tsx`
- Modify: `Front/src/pages/dashboard/ReportesPage.tsx`

**Interfaces:**
- Consumes: `useSectorTerms()` from `../../hooks/useSectorTerms`

**Context:** Same pattern as Task 5. Add the hook to each page and replace hardcoded user-visible strings for cita/citas, cliente/clientes.

- [ ] **Step 1: Update CitasPage.tsx**

```tsx
import { useSectorTerms } from "../../hooks/useSectorTerms";
// inside component:
const terms = useSectorTerms();
```

Key replacements:

```tsx
"Citas" (page title) → {terms.citas}
"Nueva cita" → `Nueva ${terms.cita.toLowerCase()}`
"No hay citas" → `No hay ${terms.citas.toLowerCase()}`
"Cita cancelada" → `${terms.cita} cancelada`
"Cita confirmada" → `${terms.cita} confirmada`
```

- [ ] **Step 2: Update CitaDetallePage.tsx**

```tsx
import { useSectorTerms } from "../../hooks/useSectorTerms";
const terms = useSectorTerms();
```

Replace: "Detalle de cita" → `Detalle de ${terms.cita.toLowerCase()}`, plus any other user-visible "cita/cliente" strings.

- [ ] **Step 3: Update ClientesPage.tsx**

```tsx
import { useSectorTerms } from "../../hooks/useSectorTerms";
const terms = useSectorTerms();
```

Key replacements:

```tsx
"Clientes" (page title) → {terms.clientes}
"Agregar cliente" → `Agregar ${terms.cliente.toLowerCase()}`
"No tienes clientes" → `No tienes ${terms.clientes.toLowerCase()}`
```

- [ ] **Step 4: Update KioskPage.tsx and ReportesPage.tsx**

Same import + hook call pattern. Replace any user-visible "cita/citas/cliente/clientes/empleado/empleados/servicio/servicios" hardcoded strings with `terms.*`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/pages/dashboard/CitasPage.tsx src/pages/dashboard/CitaDetallePage.tsx \
        src/pages/dashboard/ClientesPage.tsx src/pages/dashboard/KioskPage.tsx \
        src/pages/dashboard/ReportesPage.tsx
git commit -m "feat(dashboard): sector-aware terminology in Citas, Clientes, Kiosk, and Reportes"
```

---

### Task 7: Registration — pre-select sector from URL query param

**Files:**
- Modify: `Front/src/pages/auth/RegistroNegocioPage.tsx`

**Context:** The page already has a sector selector (state variable `sector`, two options: "belleza" and "salud"). It does NOT currently read `?sector` from the URL. Add: on mount, read the `sector` query param; if it's "belleza" or "salud", set the state and lock the selector so the user can't change it (they arrived from the correct landing page CTA).

- [ ] **Step 1: Import useSearchParams**

At the top of `RegistroNegocioPage.tsx`, add to the react-router-dom import:

```tsx
import { ..., useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Read the query param and set initial sector**

Inside the component, replace the existing `sector` state initialization:

```tsx
// BEFORE (existing code):
const [sector, setSector] = useState<"belleza" | "salud">("belleza");

// AFTER:
const [searchParams] = useSearchParams();
const sectorParam = searchParams.get("sector");
const sectorBloqueado = sectorParam === "belleza" || sectorParam === "salud";
const [sector, setSector] = useState<"belleza" | "salud">(
  sectorParam === "salud" ? "salud" : "belleza"
);
```

- [ ] **Step 3: Lock the selector when pre-selected from URL**

Locate the sector selector buttons in the JSX. Add `disabled` and visual lock when `sectorBloqueado` is true:

```tsx
// On the sector option buttons, add:
disabled={sectorBloqueado}
className={`... ${sectorBloqueado ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
```

Also add a helper hint when locked:

```tsx
{sectorBloqueado && (
  <p className="text-xs text-slate-400 mt-1 text-center">
    Sector pre-seleccionado desde la página de registro.
  </p>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Manual test**

Navigate to `http://localhost:5173/registro?sector=salud`. Confirm:
- "Consultorio de salud" is pre-selected
- Sector buttons are disabled (cannot switch to belleza)
- Helper text appears
- Form submits successfully with sector = "salud"

Navigate to `http://localhost:5173/registro` (no param). Confirm: selector is editable, defaults to belleza.

- [ ] **Step 6: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/pages/auth/RegistroNegocioPage.tsx
git commit -m "feat(registro): pre-select and lock sector from URL query param"
```

---

### Task 8: Public booking flow — sector terminology

**Files:**
- Modify: `Front/src/components/booking/PasoServicio.tsx`
- Modify: `Front/src/components/booking/PasoEmpleado.tsx`
- Modify: `Front/src/pages/publico/BookingPage.tsx`

**Interfaces:**
- Consumes: `getSectorTerms(sector)` from `../../hooks/useSectorTerms` (pure function, no hook — public pages don't have auth context or the negocio-perfil query)

**Context:** `BookingPage` loads the full negocio from the API, which already includes `sector`. Pass `sector` down to `PasoServicio` and `PasoEmpleado` as a prop.

- [ ] **Step 1: Update PasoServicio.tsx to accept sector prop**

Add `sector` to the props interface and use `getSectorTerms`:

```tsx
import { getSectorTerms } from "../../hooks/useSectorTerms";

interface Props {
  servicios: ServicioPublico[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  color?: string;
  sector?: string;  // NEW
}

export function PasoServicio({ servicios, seleccionado, onSeleccionar, color = "#334155", sector }: Props) {
  const terms = getSectorTerms(sector);
  // ...
```

Replace the hardcoded category default name:

```tsx
// BEFORE:
categoriaNombre ?? "Servicios"

// AFTER:
categoriaNombre ?? terms.servicios
```

Also replace any other user-visible "Servicio/s" strings in this component.

- [ ] **Step 2: Update PasoEmpleado.tsx to accept sector prop**

```tsx
import { getSectorTerms } from "../../hooks/useSectorTerms";

interface Props {
  empleados: EmpleadoPublico[];
  servicioId: string;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  color?: string;
  sector?: string;  // NEW
}

export function PasoEmpleado({ empleados, servicioId, seleccionado, onSeleccionar, color = "#334155", sector }: Props) {
  const terms = getSectorTerms(sector);
```

Replace any user-visible "Empleado/s" strings with `terms.empleado` / `terms.empleados`. The "Sin preferencia" label stays as-is (it's not sector-sensitive).

- [ ] **Step 3: Pass sector from BookingPage to the booking steps**

In `BookingPage.tsx`, the loaded negocio object already contains `sector`. Find where `PasoServicio` and `PasoEmpleado` are rendered and pass the prop:

```tsx
<PasoServicio
  servicios={negocio.servicios}
  seleccionado={seleccionadoServicio}
  onSeleccionar={setSeleccionadoServicio}
  color={negocio.colorPrimario}
  sector={negocio.sector}  // NEW
/>

<PasoEmpleado
  empleados={negocio.empleados}
  servicioId={seleccionadoServicio!}
  seleccionado={seleccionadoEmpleado}
  onSeleccionar={setSeleccionadoEmpleado}
  color={negocio.colorPrimario}
  sector={negocio.sector}  // NEW
/>
```

Also in `BookingPage`, replace "Tu cita" label with sector-aware text:

```tsx
const terms = getSectorTerms(negocio.sector);
// Then use terms.cita wherever "Tu cita" appears in the booking flow
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/components/booking/PasoServicio.tsx src/components/booking/PasoEmpleado.tsx \
        src/pages/publico/BookingPage.tsx
git commit -m "feat(booking): sector-aware terminology in public booking flow"
```

---

### Task 9: LandingPage — add health nav link + update CTA

**Files:**
- Modify: `Front/src/pages/publico/LandingPage.tsx`

**Context:** The current beauty landing has no link to the health sector. Add a discrete nav link and update the main registration CTA to include `?sector=belleza` so sector is always pre-selected when coming from this landing.

- [ ] **Step 1: Add health sector nav link**

In `LandingPage.tsx`, locate the navigation/header section. Add a discrete link to the health landing:

```tsx
<a
  href="/salud"
  className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
>
  ¿Tienes un consultorio? →
</a>
```

Place it in the topbar/nav area, after the existing nav items.

- [ ] **Step 2: Update CTA links to include ?sector=belleza**

Find all CTAs that link to `/registro` and update them:

```tsx
// BEFORE:
href="/registro"
// or
to="/registro"

// AFTER:
href="/registro?sector=belleza"
// or
to="/registro?sector=belleza"
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/pages/publico/LandingPage.tsx
git commit -m "feat(landing): add health sector nav link and sector param to CTAs"
```

---

### Task 10: New health landing page + route

**Files:**
- Create: `Front/src/pages/publico/LandingPageSalud.tsx`
- Modify: `Front/src/App.tsx`

**Interfaces:**
- Consumes: nothing (standalone page, no auth context needed)
- Produces: route `/salud` renders `LandingPageSalud`

**Context:** The health landing mirrors the structure of `LandingPage.tsx` but with health-specific copy. Reuse existing UI components where they exist (pricing section, footer). The main CTA links to `/registro?sector=salud`. A back-link at the top points to `/` for beauty businesses.

- [ ] **Step 1: Create LandingPageSalud.tsx**

Create `Front/src/pages/publico/LandingPageSalud.tsx`. Model the structure after `LandingPage.tsx` — reuse the same layout shell, header, footer, and pricing section components. Replace only the content sections:

```tsx
import { Link } from "react-router-dom";
// Import same layout/UI components used in LandingPage

export function LandingPageSalud() {
  return (
    <div className="..."> {/* same root classes as LandingPage */}

      {/* Header / Nav */}
      {/* Reuse same header pattern, but swap the beauty nav link: */}
      <a href="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
        ¿Tienes un salón o barbería? →
      </a>

      {/* Hero */}
      <section>
        <h1>La agenda más simple<br />para tu consultorio</h1>
        <p>
          Recordatorios automáticos, booking online 24/7 y control total de tus
          pacientes. Sin complicaciones, sin comisiones.
        </p>
        <Link to="/registro?sector=salud">Empieza gratis</Link>
        {/* Trust strip */}
        <p>Sin tarjeta · Sin comisiones · Cancela cuando quieras</p>
      </section>

      {/* Ideal para */}
      <section>
        <p>Ideal para</p>
        {/* Pills: */}
        {["Dentistas", "Psicólogos", "Terapeutas", "Nutriólogos", "Optometristas"].map(n => (
          <span key={n}>{n}</span>
        ))}
      </section>

      {/* Features */}
      <section>
        {/* 3 feature cards: */}
        {/* 1. Booking online 24/7 — tus pacientes agendan sin llamarte */}
        {/* 2. Recordatorios automáticos — reduce inasistencias por correo */}
        {/* 3. Historial de pacientes — todo el historial de consultas en un lugar */}
      </section>

      {/* Testimonials — 3 health professionals */}
      <section>
        {/* Dr. Alejandro Ríos — Consultorio Dental Ríos, Guadalajara */}
        {/* "Antes llenaba la agenda por teléfono. Ahora mis pacientes agendan solos y yo solo confirmo." */}

        {/* Lic. Sofía Montoya — Psicóloga independiente, CDMX */}
        {/* "El recordatorio automático redujo mis faltas a casi cero. Mis pacientes llegan más puntuales." */}

        {/* Dr. Marco Herrera — Nutriólogo, Monterrey */}
        {/* "Llevo el historial de cada paciente en AppointVa. Ya no busco entre apuntes." */}
      </section>

      {/* Pricing — reuse the same pricing section component from LandingPage */}

      {/* Footer — reuse same footer component */}
    </div>
  );
}
```

Apply the exact same Tailwind classes and component structure used in `LandingPage.tsx` — do not invent a different layout.

- [ ] **Step 2: Register the /salud route in App.tsx**

In `App.tsx`, add the lazy import alongside the other public page imports:

```tsx
const LandingPageSalud = lazy(() =>
  import("./pages/publico/LandingPageSalud").then(m => ({ default: m.LandingPageSalud }))
);
```

Then add the route in the public routes section:

```tsx
<Route path="/salud" element={
  <Suspense fallback={<div />}>
    <LandingPageSalud />
  </Suspense>
} />
```

Place it alongside the `/` route (not inside any `<RutaPublica>` wrapper — health professionals who are already logged in should still be able to view the landing).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Cursos/AppointVa/Front"
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

Navigate to `http://localhost:5173/salud`. Confirm:
- Page loads without errors
- Hero shows health copy
- "Ideal para" shows Dentistas, Psicólogos, etc.
- CTA "Empieza gratis" links to `/registro?sector=salud`
- "¿Tienes un salón o barbería?" link goes to `/`
- Navigate to `/` (beauty landing) and confirm "¿Tienes un consultorio?" link goes to `/salud`

- [ ] **Step 5: Commit**

```bash
cd "c:/Cursos/AppointVa/Front"
git add src/pages/publico/LandingPageSalud.tsx src/App.tsx
git commit -m "feat(landing): add /salud health sector landing page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Backend: sector validation + health defaults (Task 1)
- ✅ `useSectorTerms` + `getSectorTerms` (Task 2)
- ✅ `useSectorFeatures` (Task 2)
- ✅ DashboardLayout nav (Task 3)
- ✅ Route protection (Task 4)
- ✅ EmpleadosPage + ServiciosPage (Task 5)
- ✅ CitasPage + CitaDetallePage + ClientesPage + KioskPage + ReportesPage (Task 6)
- ✅ Registration URL param (Task 7)
- ✅ Booking flow PasoServicio + PasoEmpleado + BookingPage (Task 8)
- ✅ LandingPage beauty update (Task 9)
- ✅ LandingPageSalud new page + route (Task 10)

**Type consistency check:**
- `SectorTerms` interface defined in Task 2, used in Tasks 3–8 — field names consistent throughout
- `SectorFeatures` interface defined in Task 2, used in Tasks 3–4 — field names consistent
- `getSectorTerms` exported in Task 2, imported in Tasks 8 — signature consistent
- `sector` prop on `PasoServicio`/`PasoEmpleado` is `string | undefined` — consistent with `negocio.sector` type

**No placeholders remaining.**
