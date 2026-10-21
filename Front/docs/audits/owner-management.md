# Audit: Owner Management Screens (Propietario only)

- **Date:** 2026-10-20
- **Status:** Severity-3 batch applied (commit `9083787`, **not verified in a rendered build**). OM-01, OM-02, OM-05, OM-07, OM-08, OM-10 fixed; OM-03, OM-04, OM-11 partially fixed; OM-06 and OM-09 open pending a decision (copy made honest). A few severity-2 items were partly fixed as a side effect. Each touched finding carries its own **Status** line. New shared pieces: `src/components/ui/Switch.tsx`, `src/components/ui/DialogoDescartarCambios.tsx`, `src/hooks/useCambiosSinGuardar.tsx`, `src/utils/errores.ts`. Severity-2 batch (2026-10-21, commit `d4bde59`, not rendered): OM-13, OM-14, OM-16, OM-18, OM-19, OM-20, OM-22, OM-23, OM-25, OM-28, OM-30, OM-31 fixed; OM-17, OM-21, OM-24, OM-26, OM-29 only their non-decision parts; OM-15 and OM-27 open (decision). New shared pieces: `ErrorCarga`, `ProgresoSubida`, `TablaDatosOculta`, `EditorHorario`, `useSubirImagen`, `src/lib/{imagenes,horario,clasesCampo,heatmap,temaGraficas,opcionesIntake}.ts`, `src/utils/impresionQr.ts`; typed Excel cells. Severity-1 batch (2026-10-21, commit `f4261c0`, not rendered): OM-32 and OM-33 fixed. All remaining open parts are decisions (OM-06, OM-09, OM-15, OM-17, OM-21, OM-26, OM-27, OM-29) or backend gaps (OM-04 position PATCH, OM-11 file retention, OM-21 server filter, OM-24 coupon PUT, OM-26 access flag); OM-03 still lacks a router-level guard for programmatic `navigate()`.
- **Type:** Code-based audit. **Nothing was rendered.** No browser, screenshots, emulated viewports or assistive technology were used. Contrast ratios are calculated from the Tailwind/hex values in the source. Layout, touch and dark-mode behavior are inferred from class names and the token definitions in `src/index.css` / `tailwind.config.js`. Two behaviors were confirmed against the backend source (`Back/AppointVaAPI`), noted where used. Verify visual findings in a running build, in light and dark mode, before fixing them.
- **Companion audit:** `docs/audits/dashboard-core.md` (DC-xx). Shared root causes already reported there are referenced by ID, not re-reported. New locations of those issues are listed once in [New occurrences of Dashboard Core findings](#new-occurrences-of-dashboard-core-findings).

## Scope

All routes sit behind `RutaProtegida roles={["Propietario"]}` (`src/App.tsx:121-138`). Galería, Lista de espera and Descuentos are also plan-gated by `RutaConFeature`.

| Route | Entry file | Rendered components reviewed |
| --- | --- | --- |
| `/dashboard/empleados` | `src/pages/dashboard/EmpleadosPage.tsx` | Card grid, search, photo upload, create/edit modal, schedule modal, time-block modal, invite modal, delete modal, `DatePicker`/`TimePicker` |
| `/dashboard/servicios` | `src/pages/dashboard/ServiciosPage.tsx` | Services list grouped by category, Destacado/Activo toggles, image upload, service modal, Categorías tab, delete modals |
| `/dashboard/clientes` | `src/pages/dashboard/ClientesPage.tsx` | Directory table, Activity filter (Activos/Inactivos), WhatsApp reactivation, Excel export, detail modal (notes, history) |
| `/dashboard/perfil` | `src/pages/dashboard/PerfilPage.tsx` | Tabs Perfil/Citas/Anticipos/Horarios/Cuenta, images, brand colour, `SelectorFondoPortada`, cover-position overlay, social links, QR, sticky save bar, business hours, blocked days, account deletion |
| `/dashboard/galeria` | `src/pages/dashboard/GaleriaPage.tsx` | Drop zone, grid, lightbox, delete overlay |
| `/dashboard/espera` | `src/pages/dashboard/ListaEsperaPage.tsx` | KPIs, status filter, entry cards |
| `/dashboard/intake` | `src/pages/dashboard/IntakePage.tsx` | Question list, question modal |
| `/dashboard/descuentos` | `src/pages/dashboard/DescuentosPage.tsx` | Inline create panel, active/inactive lists |
| `/dashboard/reportes` | `src/pages/dashboard/ReportesPage.tsx` | Tabs Citas/Ingresos/Empleados/Horarios/Retención, filters, recharts bar charts, heatmap, Excel exports |
| `/dashboard/resenas` | `src/pages/dashboard/ResenasPage.tsx` | Average, reviews table |

Supporting code read: `src/components/ui/{Modal,DateTimePicker,filtros/FiltroBusqueda}.tsx`, `src/components/dashboard/SelectorFondoPortada.tsx`, `src/hooks/useUnsavedChanges.ts`, `src/store/toastStore.ts`, `src/utils/exportarExcel.ts`, `src/api/{listaEspera,descuentos,reportes}.ts`; backend `Controllers/V1/ListaEsperaController.cs`, `Controllers/V1/DescuentosController.cs`.

## Method

Same as `dashboard-core.md`: **ux-heuristics** (Nielsen + Krug, severity 0–4), **refactoring-ui** (8-row diagnostic), **impeccable `audit`** (A11y, Performance, Theming, Responsive, Integrity; surface mode **Operate**), **microinteractions** (trigger, feedback, undo), and the project rules in `CLAUDE.md`. Findings marked **DECISION NEEDED** need a product decision before a fix can be designed.

## Summary

| Severity | Count | IDs |
| --- | --- | --- |
| 4 Catastrophic | 0 | — |
| 3 Major | 11 | OM-01 … OM-11 |
| 2 Minor | 20 | OM-12 … OM-31 |
| 1 Cosmetic | 2 | OM-32 … OM-33 |
| **Total** | **33** | plus new occurrences of 13 DC findings (table below) |

| Framework | Score | Main reasons |
| --- | --- | --- |
| Nielsen / Krug (ux-heuristics) | **5 / 10** | No catastrophic blocker, but many major issues: silent data loss (employee schedule fallback, cover position, unguarded modals) (H3/H5), settings switches not operable by keyboard (H7, WCAG 2.1.1), a "Notificar" button that notifies nobody (H2), a price field that rejects real prices (H5/H9), errors shown as success toasts (H1/H9), four different list+form+delete patterns across ten screens (H4) |
| Refactoring UI diagnostic | **5 / 10** | 4 of 8 rows pass (spacing scale, type scale, depth, white space). Fails: hierarchy (five equal-weight coloured buttons per employee card), color (nine off-system hues; brand gold in charts), contrast (10–11px gray labels, amber/yellow/WhatsApp text at 1.9–2.9:1), systems over one-offs (four image-upload implementations, two schedule editors) |
| impeccable audit health | **10 / 20 (Acceptable, low end)** | A11y 1, Performance 3, Theming 2, Responsive 2, Integrity 2 |

**Implementation integrity verdict: fail, but closer than the core screens.** Every screen in scope adopted the shared header, primary button, filter bar, tabs and pagination, and `PerfilPage` shows careful, documented work (error-to-tab routing, colour input, sticky save bar). Below that shared shell, each screen re-invents the rest: three delete-confirmation mechanisms (Radix `Modal`, `window.confirm`, hand-rolled overlay), two form approaches (react-hook-form + zod vs `useState`), two schedule editors with different rules, four image-upload widgets, three loading styles, and toggle switches built from `div`s. The gaps are systemic and should be fixed once in shared primitives (see [Cross-screen patterns](#cross-screen-patterns)).

---

## Severity 4: Catastrophic

None found in code. The worst issues here lose data or block a subset of users (keyboard, touch) rather than blocking every owner.

---

## Severity 3: Major

### OM-01: Opening an employee's schedule can silently replace it with a default and overwrite it on save
- **Status:** Fixed (commit `9083787`) — the schedule modal opens at once and loads through `useQuery` (`horario-empleado`, `gcTime: 0`). While loading it shows skeletons; on error it shows "No se pudo cargar el horario" with "Reintentar", no days, and "Guardar horario" stays disabled. `HORARIO_BASE` is only used to fill days missing from a successful response (new employees). Save failures now use the error toast. Tests in `EmpleadosPage.test.tsx`.
- **Heuristic:** H5 Error prevention; H1 Visibility of system status; H9 Error recovery
- **Location:** `src/pages/dashboard/EmpleadosPage.tsx:206-219` (`abrirHorario`), `:38-42` (`HORARIO_BASE`), `:470-475` (Horarios button), `:255-259` (save)
- **Evidence:** `abrirHorario` awaits `empleadosApi.obtenerHorario` before opening the modal, with no pending state on the button. If the request fails, the `catch` loads `HORARIO_BASE` (Mon–Sat 09:00–19:00) and opens the modal as if it were the employee's real schedule. Nothing says the load failed.
- **User impact:** On a slow connection the button does nothing for seconds, inviting repeat clicks. On a failed load the owner sees a plausible schedule, adjusts one day and saves, overwriting the employee's real hours for every day. Online availability changes without anyone noticing.
- **Fix:** Open the modal immediately with a skeleton; fetch with `useQuery` keyed by employee. On error show "No se pudo cargar el horario" with "Reintentar" and keep the save button disabled. Never fall back to defaults for an existing employee.

### OM-02: Toggle switches are clickable `div`s: business, employee-day, auto-confirm and waitlist settings cannot be changed by keyboard or screen reader
- **Status:** Fixed (commit `9083787`) — new `src/components/ui/Switch.tsx` (`<button role="switch" aria-checked>`, Space/Enter/arrows, 44px hit area, focus ring, `aria-labelledby`/`aria-describedby`); Radix Switch is not installed. Replaces the four `div` switches (auto-confirm, waitlist, business day, employee day); the day name still toggles. Tests in `Switch.test.tsx`, `PerfilPage.test.tsx`, `EmpleadosPage.test.tsx`.
- **Heuristic:** WCAG 2.1.1 Keyboard, 4.1.2 Name/Role/Value; H7 Flexibility
- **Location:** `src/pages/dashboard/PerfilPage.tsx:980-989` (Confirmación automática), `:1000-1009` (Lista de espera), `:1201-1211` (business day on/off); `src/pages/dashboard/EmpleadosPage.tsx:586-596` (employee day on/off)
- **Evidence:** Each switch is a `div` with `onClick`: no `tabIndex`, no `role="switch"`, no `aria-checked`, no key handler. In the schedule editors the `div` sits inside a `<label>` that has no associated control, so clicking the day name does nothing either; only the 36×20px track responds. The auto-confirm and waitlist switches have no accessible name at all.
- **User impact:** Keyboard and screen-reader users cannot open or close a business day, toggle an employee's day, or change whether bookings are auto-confirmed. Mouse users must hit a 20px-tall target.
- **Fix:** Add one `Switch` primitive (Radix Switch or `<button role="switch" aria-checked>`) with a visible label wired via `htmlFor`/`aria-labelledby`, a 44px hit area, and focus ring; replace all four usages.

### OM-03: Unsaved changes are lost without warning in every modal form and on in-app navigation from Mi negocio
- **Status:** Partially fixed (commit `9083787`) — `useConfirmarDescarte` (`src/hooks/useCambiosSinGuardar.tsx`) asks "¿Descartar cambios?" before closing a dirty modal: Empleados (employee, schedule, time block, invite), Servicios (service, category), Clientes notes, Intake question, Descuentos inline panel. Perfil has one dirty flag (form + colour + cover preset + cover position + business hours) and `useProtegerNavegacion` (beforeunload + capture-phase guard on internal links, e.g. the sidebar); the ad-hoc `window.onbeforeunload` was removed. Uploads no longer wipe unsaved Perfil edits (reset with `keepDirtyValues`). Still open: programmatic navigation (`navigate()` from the user menu and notifications) is not intercepted, because the app uses `BrowserRouter` without `useBlocker`. Tests in `useCambiosSinGuardar.test.tsx`, `PerfilPage.test.tsx`.
- **Heuristic:** H3 User control and freedom; H5 Error prevention
- **Location:** `src/hooks/useUnsavedChanges.ts:3-13` (only `beforeunload`); `src/pages/dashboard/PerfilPage.tsx:166`, `:362-369` (Horarios uses a second, separate `window.onbeforeunload`), `:311-322` (colour, cover preset and cover position live outside `isDirty`); modals: `EmpleadosPage.tsx:520-522`, `:570-573` (schedule), `ServiciosPage.tsx:453-456`, `:596-600`, `ClientesPage.tsx:466-469` (notes), `IntakePage.tsx:141-144`, `DescuentosPage.tsx:126`
- **Evidence:** `Modal` closes on Escape, overlay click and the X with no dirty check. `useUnsavedChanges` warns only when the browser tab is closed or reloaded; clicking a sidebar link from `/dashboard/perfil` discards edits across three tabs silently. Business-hours edits and colour/cover edits are not covered by `isDirty`.
- **User impact:** An owner who spends minutes on a 7-day schedule, a client's allergy notes or the long business profile loses it with one stray Escape or one sidebar click.
- **Fix:** Add a `dirty` prop to `Modal` that asks "¿Descartar cambios?" before closing. For Perfil, include colour/preset/position/horarios in one dirty flag and block in-app navigation (React Router `useBlocker` if the app moves to a data router; otherwise intercept `DashboardLayout` nav links). Remove the ad-hoc `window.onbeforeunload` so there is one mechanism.

### OM-04: The cover position the owner just confirmed is not saved, and nothing says so
- **Status:** Partially fixed (commit `9083787`) — backend gap: `PUT /negocios/perfil` is a full update (requires `Nombre` and every field) and there is no endpoint to save `PortadaObjectPosition` alone, so "Confirmar" cannot persist it safely. The UI is now honest: a confirmed position shows "Posición sin guardar — se guardará con 'Guardar cambios'", counts as an unsaved change (OM-03) and survives the profile reload after a cover upload (that reload used to reset it to the saved value). A backend `PATCH` for the position is needed to fully fix it. Test in `PerfilPage.test.tsx`.
- **Heuristic:** H1 Visibility of system status; H4 Consistency
- **Location:** `src/pages/dashboard/PerfilPage.tsx:232-237` (`confirmarPortadaModal`), `:714-717` (Posicionar), `:269-275` (position only sent by "Guardar cambios"), `:834-838`, `:856-860` (unsaved hints exist for colour and preset only)
- **Evidence:** Choosing a new cover opens the positioning overlay; "Confirmar" uploads the photo immediately (toast "Portada actualizada") but only stores the position in local state. "Posicionar" on an existing photo also only changes local state. There is no "sin guardar" hint for position, and position is not part of `isDirty` (OM-03).
- **User impact:** The owner drags the photo into place, confirms, sees "Portada actualizada" and leaves. The public page keeps the old (or centred) crop. The same screen uses two save models side by side with no cue which applies.
- **Fix:** Persist position on "Confirmar" together with the upload (or immediately for "Posicionar"), or show the same amber "Posición sin guardar — se guardará con 'Guardar cambios'" hint and include it in the dirty state. Prefer the first: the overlay already has its own confirm.

### OM-05: The service price field rejects common prices, and numeric errors show no message
- **Status:** Fixed (commit `9083787`) — price uses `step="0.01"` + `inputMode="decimal"`; the form has `noValidate`; zod messages for duration (5–480, integer, matching the API range), buffer (0–120), price (≥0, at most two decimals) and order (≥1) render under each field with `aria-invalid`/`aria-describedby`; error borders now win in dark mode on these fields. Tests in `ServiciosPage.test.tsx`.
- **Heuristic:** H5 Error prevention; H9 Error recovery; WCAG 3.3.1
- **Location:** `src/pages/dashboard/ServiciosPage.tsx:511-516` (`step="0.5"`), `:486-506`, `:518-525` (duration, buffer, orden), `:458` (form without `noValidate`), schema `:22-30`
- **Evidence:** With `min="0" step="0.5"` the browser's constraint validation blocks submission of $149.90 or $99.99 with a native tooltip (in the browser's language). For duration and price, zod errors only turn the border red (`:493`, `:515`); `errors.*.message` is never rendered. Buffer and orden errors have no visual at all.
- **User impact:** An owner cannot enter a price ending in .90 or .99, and when something is wrong gets either an English browser bubble or a red outline with no explanation.
- **Fix:** Use `step="0.01"` (or `inputMode="decimal"` text with zod), add `noValidate` so zod owns validation, and render the message under every field through the shared field primitive (see DC-19).

### OM-06: "Notificar" in the waitlist notifies nobody — DECISION NEEDED
- **Status:** Open – DECISION NEEDED — no messages are sent (unchanged). Copy only: the button reads "Marcar como avisado" with a title saying it sends nothing; the state, filter and KPI read "Avisado(s)". Contact links on the card not added.
- **Heuristic:** H2 Match between system and real world; H1 Visibility
- **Location:** `src/pages/dashboard/ListaEsperaPage.tsx:214-221`; backend `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/ListaEsperaController.cs:85-89` (verified: sets `Estado` and `FechaNotificacion`, sends nothing)
- **Evidence:** The button reads "Notificar" with a bell icon; only its hover `title` says "Marcar como notificado". The entry shows phone and email as plain text, with no call, WhatsApp or email shortcut (the Clientes page has a WhatsApp action for the same need).
- **User impact:** The owner taps "Notificar", sees "Estado actualizado" and the entry moves to "Notificado". The client never hears about the free slot, and the KPI "Notificados" reports contacts that did not happen.
- **Fix:** **DECISION NEEDED** — should the button send a message (email via the existing `NotificarListaEsperaAsync` job, or WhatsApp deep link) or only record a manual contact? Then label it truthfully ("Avisar por WhatsApp" that opens the link and records the state, or "Marcar como avisado"), and add tel/WhatsApp/email links on the card.

### OM-07: Image actions depend on hover and on non-focusable `div`s
- **Status:** Fixed (commit `9083787`) — gallery delete is visible by default and hidden only where hover exists (`[@media(hover:hover)]`), visible on focus, 36px, `aria-label="Eliminar foto N"`; opening the lightbox is a labelled button; delete confirmation uses `ConfirmarAccion`. Employee photo and service image triggers are `<button aria-label="Cambiar foto de …">` with a permanent camera badge. The lightbox overlay itself is still custom (DC-18).
- **Heuristic:** impeccable Responsive (broken touch interaction); WCAG 2.1.1, 4.1.2; Krug "Does it work without hover?"
- **Location:** `src/pages/dashboard/GaleriaPage.tsx:135-141` (delete `opacity-0 group-hover:opacity-100`, `title` only), `:128-133` (open lightbox: `onClick` on `<img>`); `src/pages/dashboard/EmpleadosPage.tsx:435-450` (change photo: `div` with `onClick`, hover-only overlay); `src/pages/dashboard/ServiciosPage.tsx:279-296` (change image: same)
- **Evidence:** The gallery delete button has no `focus-visible:opacity-100`, so it is invisible on touch screens and when focused by keyboard. Photo/image upload on employee and service rows is a `div` that cannot be focused; the camera overlay appears only on hover.
- **User impact:** On a phone the owner cannot see how to delete a gallery photo (an invisible 28px button still sits in the corner, so taps there open a delete dialog unexpectedly). Keyboard users cannot change employee photos or service images at all, and nobody on touch learns that the thumbnail is the upload control.
- **Fix:** Show gallery actions persistently on touch (`@media (hover: none)`) and on `focus-within`; give them `aria-label`. Make thumbnails `<button aria-label="Cambiar foto de Ana López">` with a visible camera badge, or move upload into the edit modal. See the shared uploader in Cross-screen patterns.

### OM-08: Several owner surfaces are unreadable or flash light in dark mode
- **Status:** Fixed (commit `9083787`, not rendered) — tokens on every listed surface: time-block rows (`bg-muted` + pending-dot border), employee/category pills and waitlist states/actions/KPIs (`--status-*`), coupon value pill (`bg-muted text-foreground`), "Agotado" (cancelled tokens), Clientes avatar, category warning, Perfil danger zone (dark pairs) and blocked days (cancelled tokens). Heatmap cells scale `hsl(var(--foreground) / α)` over `bg-muted`; the label switches to `--background` above 50%. Verify in dark mode.
- **Heuristic:** Project rule (dashboard works in light AND dark); WCAG 1.4.3; same root cause as **DC-11** (blocks without `dark:` pairs instead of shadcn tokens)
- **Location:**
  - `EmpleadosPage.tsx:697` — time-block rows `bg-orange-50 border-orange-100` (no dark) under `dark:text-gray-300`: gray-300 on orange-50, about 1.4:1
  - `DescuentosPage.tsx:293` — the coupon value pill (`text-slate-700 bg-slate-700/10`, no dark): slate-700 on slate-800, about 1.4:1; `:296` "Agotado" light pill
  - `ReportesPage.tsx:686-688` — heatmap: empty cells hard-coded `#f1f5f9` (bright squares on a dark card), filled cells `rgba(51,65,85,α)` (slate-700) on a slate-800 card, so low and mid values are invisible
  - `ClientesPage.tsx:413-414` — avatar initial `text-slate-700` on `bg-slate-700/10`, about 1.4:1
  - Light pills/panels without dark pairs: `EmpleadosPage.tsx:454`; `ServiciosPage.tsx:399`, `:572`; `ListaEsperaPage.tsx:12-17`, `:218`, `:227`; `PerfilPage.tsx:1174-1185` (danger zone), `:1294-1301` (blocked days)
- **User impact:** In dark mode the owner cannot read an employee's absences, the discount each coupon gives, or the busiest hours of the week — the one piece of information on each of those surfaces.
- **Fix:** Fold into the DC-11 theming pass. Heatmap: scale on a token (`--primary` / `hsl(var(--foreground))` alpha) over `bg-muted` for zero, and pick label colour by computed contrast. Use the status tokens from DC-06 for waitlist states.

### OM-09: "Exportar Excel" in Clientes exports only the visible page (15 rows) — DECISION NEEDED
- **Status:** Open – DECISION NEEDED — still exports only the visible page. The disclosure is now readable (12px, amber-800 / amber-300) instead of 10px amber-500.
- **Heuristic:** H2 Match with the real world; H1 Visibility
- **Location:** `src/pages/dashboard/ClientesPage.tsx:153-165`, `:178-191` (warning `text-[10px] text-amber-500`, about 2.1:1 on white)
- **Evidence:** `exportarClientes` maps `clientes`, the current server page. The only disclosure is a 10px amber line and a hover `title`.
- **User impact:** An owner who exports "my clients" for a campaign or backup gets 15 of possibly hundreds and may not notice. Exporting the directory requires paging and exporting dozens of files.
- **Fix:** **DECISION NEEDED** — whether full client export is allowed (privacy/plan limits). If yes, add a server endpoint (or fetch all pages) and export the whole filtered directory, with a count in the button ("Exportar 482 clientes"). If not, say so plainly in readable text.

### OM-10: On phones, the only action of a client row sits off-screen
- **Status:** Fixed (commit `9083787`) — below `sm` clients render as stacked cards; each card is a button ("Ver detalle de …") that opens the detail. From `sm` the table rows are clickable and keep the "Ver detalle" button for keyboard users. One paginator serves both views. Tests in `ClientesPage.test.tsx`.
- **Heuristic:** impeccable Responsive; H6 Recognition
- **Location:** `src/pages/dashboard/ClientesPage.tsx:396-446` (`min-w-[560px]` table, "Ver detalle" in the last column, row not clickable)
- **Evidence:** At 375px the table scrolls horizontally and the "Ver detalle" button starts beyond the right edge. Rows have hover styling but no click handler.
- **User impact:** Notes and visit history — the reason to open Clientes from the chair — are behind an unannounced horizontal scroll.
- **Fix:** Below `sm`, render clients as stacked cards (name, phone, last visit) where the whole card opens the detail; keep the table from `sm` up. Make desktop rows clickable too, keeping the button for keyboard users.

### OM-11: Public assets and booking visibility change with one click, without confirmation or undo
- **Status:** Partially fixed (commit `9083787`) — confirmation (`ConfirmarAccion`, stating the public effect) before deleting the logo, cover photo or policies image, unblocking a day, deleting an employee time block, and hiding a service from booking ("Ocultar de reservas"; activating stays one click). Undo toasts are not implemented: they need DC-17 (toast action) and server-side retention of deleted files.
- **Heuristic:** H3 User control; H5 Error prevention; extends **DC-33** to higher-stakes actions
- **Location:** `src/pages/dashboard/PerfilPage.tsx:672-675` (delete logo), `:718-721` (delete cover photo), `:741-744` (delete policies image), `:1301` (unblock day); `src/pages/dashboard/ServiciosPage.tsx:320-331` (Activo/Inactivo hides the service from booking); `src/pages/dashboard/EmpleadosPage.tsx:704-709` (delete time block)
- **Evidence:** Each is a small text button that fires the mutation immediately. The cover "Eliminar" sits next to "Posicionar"; deleting a logo or cover removes the uploaded file from the public page with no way back except re-uploading the original file.
- **User impact:** A mis-tap removes the business's logo or cover from the booking page, reopens a holiday for bookings, or takes a service offline during business hours.
- **Fix:** Undo toast (needs DC-17's action field) for all of these; for asset deletion keep the file server-side until the undo window ends. Label the service toggle by action (see OM-30).

---

## Severity 2: Minor

### OM-12: Two error messages are shown as success toasts
- **Status:** Fixed (commit `9083787`) as a side effect — both toasts now pass `"error"`. `tipo` is still optional in `toast()`.
- **Heuristic:** H1 Visibility; H9 Error recovery
- **Location:** `src/pages/dashboard/EmpleadosPage.tsx:258` ("Error al guardar el horario…"), `src/pages/dashboard/GaleriaPage.tsx:31` (upload failure); default `tipo = "exito"` in `src/store/toastStore.ts:19`
- **User impact:** A failed schedule save or photo upload appears in the success style, so the owner reads "it worked".
- **Fix:** Pass `"error"`. Make `tipo` required in `toast()` so this cannot recur.

### OM-13: The Mi negocio save bar never shows progress and is always enabled
- **Status:** Fixed (commit `d4bde59`) — the button is driven by the save mutations (`isPending` of profile + colour), is disabled when nothing changed and reads "Guardando…" during the request, so a second PUT cannot be sent; the bar says "Cambios sin guardar" / "Guardado" (`role="status"`). The form has `noValidate`. Tests in `PerfilPage.test.tsx`.
- **Heuristic:** H1 Visibility; microinteractions (feedback, trigger states)
- **Location:** `src/pages/dashboard/PerfilPage.tsx:514-523`, `:267-281` (`onSubmit` calls `mutate` and returns synchronously), `:206-214`
- **Evidence:** `isSubmitting` is true only while the synchronous handler runs, so "Guardando..." never appears during the request and the button stays enabled, allowing duplicate PUTs. The button is equally prominent with or without changes, and there is no dirty cue in the bar. The colour save (`guardarColores`) runs in parallel with no shared pending state.
- **Fix:** Drive the button from `mutation.isPending` (or `mutateAsync` + await, including the colour request). Disable when nothing changed; show "Cambios sin guardar" in the bar when dirty, "Guardado" briefly after success.

### OM-14: Gallery uploads have no per-file progress and silently drop files over the limit
- **Status:** Fixed (commit `d4bde59`) — one placeholder tile per file with its own progress (axios `onUploadProgress`), "Subiendo N…" until the last one ends, files over the limit reported ("2 fotos no se agregaron: el límite es de 20 fotos."), drag-over highlight, `accept` and copy aligned to the backend formats (JPG, PNG, WebP o GIF · hasta 10 MB), load error with "Reintentar". Tests in `GaleriaPage.test.tsx`.
- **Heuristic:** H1 Visibility; microinteractions (loading states)
- **Location:** `src/pages/dashboard/GaleriaPage.tsx:46-60` (`slice(0, restantes)`, parallel `subir()` calls), `:80-83` (one `isPending` for N uploads), `:97-108` (drop zone with no drag-over state), `:106` ("JPG, PNG o WebP" vs `accept="image/*"` and `startsWith("image/")`)
- **User impact:** Dropping 8 photos with 5 slots left uploads 5 and says nothing about the other 3. With several uploads, "Subiendo..." ends when the last-started finishes, not when all do. HEIC/GIF pass the client check against the stated formats. The 10 MB limit is not stated before the error.
- **Fix:** Show placeholder tiles with progress (axios `onUploadProgress`) per file; report "3 fotos no se agregaron: límite de 20"; add a drag-over highlight; align `accept` and copy (state "hasta 10 MB").

### OM-15: Gallery and questionnaire promise an order the owner cannot change — DECISION NEEDED
- **Status:** Open – DECISION NEEDED (unchanged). For the decision: intake already has `PATCH /intake/campos/reordenar`; the gallery has no order endpoint.
- **Heuristic:** H3 User control; H2 Match
- **Location:** `src/pages/dashboard/GaleriaPage.tsx:158-160` ("se muestran … en el mismo orden"); `src/pages/dashboard/IntakePage.tsx:274-278` ("aparecen … en orden mostrado"); Servicios/Categorías use a numeric "Orden" field instead (`ServiciosPage.tsx:518-525`, `:615-623`)
- **User impact:** The owner cannot choose the first photo clients see or the order of booking questions.
- **Fix:** **DECISION NEEDED** — whether reordering is in scope (needs an order field/endpoint for gallery and intake). If yes, one sortable-list pattern with drag handles plus "Subir/Bajar" buttons for keyboard and touch, reused for services and categories.

### OM-16: Employee photo, service image, logo and policies uploads have no client-side checks or progress
- **Status:** Fixed (commit `d4bde59`) — one helper for all five uploaders: `src/lib/imagenes.ts` (formats from `BlobStorageService`, 10 MB client cap — the server cuts at 20 MB —, `configSubida` with progress), `src/hooks/useSubirImagen.ts` (validates before upload, resets the input, shows the server message, progress and the row being uploaded) and `src/components/ui/ProgresoSubida.tsx`. Used for employee photo, service image, logo, cover (validated before the positioning preview) and policies. Tests in `imagenes.test.ts`, `useSubirImagen.test.tsx` and the three page tests. Review follow-up (commit `0fcf188`): `useSubirImagen` keeps progress per destination, so two rows can upload at once and one finishing does not clear the other (`subiendoEn(id)`, `progresoDe(id)`), and a second upload to the same row is ignored. Progress without a known total is `null`, and `ProgresoSubida` then shows an indeterminate bar instead of 0 %. At 100 % it says "Procesando…" while the server finishes. The Mi perfil photo now uses the same hook (`validarImagen`, `ACCEPT_IMAGEN`, server message). Tests: `useSubirImagen.test.tsx`, `ProgresoSubida.test.tsx`, `imagenes.test.ts`, `MiPerfilPage.test.tsx`.
- **Heuristic:** H5 Error prevention; H1 Visibility
- **Location:** `EmpleadosPage.tsx:832-842`, `ServiciosPage.tsx:439-450`, `PerfilPage.tsx:664-665`, `:733-734` (also never reset `e.target.value`, so re-selecting the same file after a failure does nothing), `:694-700`
- **User impact:** A 25 MB phone photo uploads for a long time with no indicator on the row, then fails with a generic toast. Galería is the only uploader that checks type and size first.
- **Fix:** One `useSubirImagen` hook (type, size, progress, reset input, error message with the limit) used by all five uploaders.

### OM-17: Deleting an employee, a service or a coupon does not say what happens to related data — DECISION NEEDED
- **Status:** Partially fixed (commit `d4bde59`) — non-decision parts only: employee, service and category deletion use `ConfirmarAccion`; service deletion suggests turning off "Visible en reservas" as the reversible alternative; coupons use one verb ("Eliminar") in button, dialog and toast, and the dialog says they cannot be reactivated. Open – DECISION NEEDED: future appointments of deleted employees/services, coupon reactivation (the list endpoint returns only active coupons), a "Desactivar" alternative for employees (no endpoint).
- **Heuristic:** H5 Error prevention; H2 Match; H4 Consistency
- **Location:** `EmpleadosPage.tsx:810-812` ("no podrá recibir nuevas citas" — silent on existing future appointments); `ServiciosPage.tsx:542-545` (no mention of future appointments or that "Inactivo" is the reversible alternative); `DescuentosPage.tsx:234` ("¿Desactivar el cupón?") vs `:78` (toast "Cupón eliminado"); backend `DescuentosController.cs:94` (soft delete) and `:36` (list returns only active), so a "deactivated" coupon disappears with no way to reactivate
- **User impact:** An owner deleting an employee who has next week's appointments does not know whether those clients are cancelled, reassigned or orphaned. Coupon copy promises a reversible deactivation that the UI cannot reverse.
- **Fix:** **DECISION NEEDED** — behaviour for future appointments when an employee or service is removed, and whether coupons can be reactivated. Then state the count in the dialog ("Ana tiene 6 citas próximas: …"), offer "Desactivar" as the safe default for services and employees, and use one verb per action.

### OM-18: Report charts use brand gold, colour that encodes nothing, and light-theme axes in dark mode
- **Status:** Fixed (commit `d4bde59`, not rendered) — no gold in charts or Excel; one slate series (`hsl(var(--primary))`); axis, grid and tooltip from theme tokens (`src/lib/temaGraficas.ts`); `accessibilityLayer` plus a visually hidden data table (`TablaDatosOculta`) for the three bar charts; neutral employee initials; heatmap rows trimmed to business hours and widened to any hour with data (`src/lib/heatmap.ts`), every row labelled, cells with `aria-label`, 0–max legend. Not done: payment-method hex colours (DC-20).
- **Heuristic:** Project rule (gold `#C8A961` is logo-only); WCAG 1.4.1, 1.4.3, 1.1.1; refactoring-ui (color with purpose)
- **Location:** `src/pages/dashboard/ReportesPage.tsx:36` (`COLORES_GRAFICA` = gold shades), `:461-465`, `:581-585`, `:603` (bars), `:505-507` (initials in white on `#e8d4a0`, about 1.5:1, and on `#C8A961`, about 2.3:1), `:457-460`, `:577-580`, `:599-602` (recharts defaults: `#666` ticks on slate-800, about 2.5:1; light grid; white tooltip); `src/utils/exportarExcel.ts:3-5` (gold in the exported file)
- **Evidence:** Each bar gets the next gold shade by index, so adjacent bars differ in colour without meaning. "Ingresos por servicio" and "Ingresos por día" have no table or text alternative; the heatmap explains values only through `title` (`:683`) and always draws 24 rows even for a 09:00–19:00 business.
- **Fix:** One neutral chart palette token set (single slate series for single-measure bars; the categorical set proposed in DC-20 only where series differ), themed axis/grid/tooltip colours from tokens, `accessibilityLayer` on recharts plus a visually hidden data table. Trim heatmap rows to business hours and add a legend.

### OM-19: Excel exports show the wrong period and store numbers as text; failures are silent
- **Status:** Fixed (commit `d4bde59`) — `exportarExcel` writes typed cells (numbers, `{ moneda }` with a `$` number format, `{ porcentaje }`, `Date` keeping local time) and returns its promise; Reportes (3 exports), Clientes and Pagos show a toast on failure; the period uses `fechaLargaLocal` and the file name the local date. Tests in `exportarExcel.test.ts`, `fechas.test.ts`, `ReportesPage.test.tsx`.
- **Heuristic:** H1 Visibility; H9 Error recovery; data integrity
- **Location:** `src/pages/dashboard/ReportesPage.tsx:178-180`, `:213-215`, `:231-233` (`new Date("YYYY-MM-DD")` parses as UTC midnight, so in UTC-6 the subtitle reads one day earlier at both ends); `:192`, `:204`, `:224`, `:236` (`"$123.00"` strings); `src/utils/exportarExcel.ts:130`, `:166` (`cell.value = String(v)` for every cell), `:32` (`.catch(console.error)`)
- **User impact:** "Período: 30 de septiembre — 19 de octubre" for an October report. Accountants cannot sum prices or counts without converting columns. If generation fails, nothing happens and no message appears.
- **Fix:** Format the period with the local-date helpers in `src/utils/fechas.ts`. Write numbers as numbers with an Excel currency `numFmt`. Return the promise and show a toast on failure. Applies to the Clientes export too.

### OM-20: Report tabs hide load failures or give the wrong advice
- **Status:** Fixed (commit `d4bde59`) — shared `src/components/ui/ErrorCarga.tsx` with "Reintentar" on every Reportes tab (citas, ingresos, empleados, horarios, retención); the "Intenta cambiar el rango de fechas" advice is gone. The same component now covers Servicios, Galería, Descuentos, Intake, Lista de espera and Reseñas. Tests in `ReportesPage.test.tsx`.
- **Heuristic:** H9 Error recovery; extends **DC-32**
- **Location:** `src/pages/dashboard/ReportesPage.tsx:161-171` (heatmap and retención ignore `isError`), `:648-651`, `:712-715` (a failure reads "No hay citas en el rango"), `:370-372`, `:425-427`, `:564-566` ("Intenta cambiar el rango de fechas")
- **User impact:** A server error looks like an empty week, and the suggested fix (change dates) does not address it.
- **Fix:** Shared inline error with "Reintentar" wired to `refetch`, used in every tab.

### OM-21: Reseñas filters approval on the client, so counts, average and empty state contradict each other — DECISION NEEDED
- **Status:** Partially fixed (commit `d4bde59`) — stars are `role="img"` "N de 5 estrellas"; long comments expand in place ("Ver más"/"Ver menos", `aria-expanded`); a page with reviews but none approved says so instead of "Aún no tienes reseñas"; load error with "Reintentar". Open: approved filter and average on the server (backend gap: `/me/resenas` has neither) and the moderation DECISION. Tests in `ResenasPage.test.tsx`.
- **Heuristic:** H1 Visibility; H4 Consistency; WCAG 1.1.1
- **Location:** `src/pages/dashboard/ResenasPage.tsx:41` (`filter(r => r.aprobada)` after paging), `:61-65`, `:110` (server `total` includes unapproved), `:95-104` (empty state), `:45-51`, `:75-86` (average of the page), `:131-134` (comment cut at 100 chars, no expand), `:19-31` (stars with no text alternative)
- **User impact:** A page can show 9 rows, or "Aún no tienes reseñas" under a subtitle saying "(14 reseñas)". The headline rating changes when paging. Long reviews cannot be read in full. Screen readers get no rating.
- **Fix:** Ask the API for approved reviews and a server-side average/distribution. Expand comments in place. Add `aria-label="4 de 5 estrellas"`. **DECISION NEEDED** — what "aprobada" means and whether owners can approve, hide or reply to reviews from here.

### OM-22: The two schedule editors behave differently and their pickers have no useful names
- **Status:** Fixed (commit `d4bde59`) — shared `src/components/dashboard/EditorHorario.tsx` + `src/lib/horario.ts` for business and employee schedules: a new interval starts at the previous end and lasts 1 h, clamped to the business end / 23:30 (the button disables when nothing fits); errors name the interval; 44px named remove buttons; `TimePicker` names like "Lunes, inicio del intervalo 1"; 12px business-hours hint; "Aplicar a los demás días abiertos". Tests in `EditorHorario.test.tsx`, `horario.test.ts`. Review follow-up (commit `0fcf188`): in the employee editor, "Aplicar a los demás días abiertos" trims each copy to that day's business hours (`recortarAIntervalos`). Days where nothing fits, or where the business is closed, are left unchanged, and a status line names the copied, trimmed and skipped days (`avisoAplicar`). Second follow-up (commit `f4261c0`): when the source day has no intervals, the copy empties the other open days in both modes (as the business editor does) instead of reporting them as "fuera del horario del negocio". Test in `horario.test.ts`.
- **Heuristic:** H4 Consistency; WCAG 2.4.6, 4.1.2
- **Location:** `src/pages/dashboard/PerfilPage.tsx:415-426` (new interval starts and ends at the same time, so the day turns invalid immediately), `:1245-1247` (one generic error); `src/pages/dashboard/EmpleadosPage.tsx:342-351` (new interval = previous end + 1h; past 23:00 wraps to 00:xx and is invalid), `:655-657` (specific error), `:630-639` (20px remove button vs 28px in Perfil `:1237`), `:647-652` (business-hours hint in `text-[10px]` slate-400); `TimePicker` calls without `ariaLabel` (`EmpleadosPage.tsx:616-629`, `PerfilPage.tsx:1220-1231`) fall back to "Hora" (`src/components/ui/DateTimePicker.tsx:372`)
- **User impact:** The same task (add a break) produces an error in one screen and a valid row in the other. A screen reader announces fourteen identical "Hora" buttons with no day or start/end. There is no "copiar a todos los días", so a uniform week takes 7× the work.
- **Fix:** Extract one `EditorHorario` component (used by business and employee), with the +1h rule clamped to the allowed range, specific errors, 44px remove targets, `ariaLabel="Lunes, inicio del intervalo 1"`, and "Aplicar a todos los días laborales".

### OM-23: Error styling disappears in dark mode on several forms
- **Status:** Fixed (commit `d4bde59`) — shared `claseCampo` in `src/lib/clasesCampo.ts` (the red border wins in dark mode) used by Empleados (employee, invite, block reason), Servicios (service, category), Perfil (name, email), Descuentos and Intake; the Perfil email error message is now rendered; Empleados fields linked with `htmlFor`/`aria-describedby`. Tests in `clasesCampo.test.ts`, `EmpleadosPage.test.tsx`, `PerfilPage.test.tsx`.
- **Heuristic:** WCAG 1.4.1, 3.3.1; H9
- **Location:** `src/pages/dashboard/EmpleadosPage.tsx:538-540`, `:852-854`, `:862-866`; `src/pages/dashboard/ServiciosPage.tsx:461-465`, `:491-493`, `:513-515` — `dark:border-slate-600` is applied unconditionally, and `.dark .dark\:border-slate-600` outranks `border-red-400`. `PerfilPage.tsx:624-625` uses the correct pattern (dark border only in the non-error branch). `PerfilPage.tsx:635-637` never renders the email error message.
- **User impact:** In dark mode an invalid field looks normal; only the small red text below (when present) signals the problem.
- **Fix:** One input class helper with explicit error variants in both themes (part of the DC-19 `Campo` primitive).

### OM-24: The coupon form enforces nothing client-side and its expiry date is ambiguous
- **Status:** Partially fixed (commit `d4bde59`) — `Modal` + react-hook-form/zod (code without spaces, value > 0 with two decimals, ≤ 100% for percentages, integer usage ≥ 1, date not past), Enter submits, shared `DatePicker` labelled "Válido hasta (incluido)" and sent as 23:59:59 in the business time zone, as UTC (`finDelDiaEnZona`); amount via `formatPrecio`; expiry shown with `comoUtc` + `formatFecha`; named 44px row actions. Open: editing (backend gap: no PUT for coupons). Tests in `DescuentosPage.test.tsx`, `fechas.test.ts`.
- **Heuristic:** H5 Error prevention; H2 Match; H4 Consistency
- **Location:** `src/pages/dashboard/DescuentosPage.tsx:122-210` (inline panel, no `<form>`, so `min`/`max` at `:170-171`, `:183` never run; Enter does not submit), `:204` (only checks non-empty), `:187-195` (native `type="date"` instead of the shared `DatePicker`), `:36` (`$${valor}` instead of `formatPrecio`); backend `DescuentosController.cs:42` (`FechaExpiracion < DateTime.UtcNow`, so a date-only value expires at 00:00 UTC — 18:00 the previous evening in Mexico)
- **User impact:** A 150% or negative discount reaches the server; the owner learns of it only from a server message. A coupon set to "expire 31 Dec" stops working on the evening of 30 Dec. Coupons cannot be edited, only recreated.
- **Fix:** Move to the shared modal + react-hook-form/zod pattern; label the date "Válido hasta (incluido)" and send end-of-day in the business time zone; add edit.

### OM-25: Questionnaire options are a comma-separated string, and row actions are unlabeled
- **Status:** Fixed (commit `d4bde59`) — one input per option (add/remove), saved as a JSON array that `BookingPage` already reads (old comma-separated questions still load); inline error; named edit/delete buttons; neutral "Obligatoria" badge; live preview. Tests in `IntakePage.test.tsx`, `opcionesIntake.test.ts`.
- **Heuristic:** H5 Error prevention; H6 Recognition; WCAG 4.1.2
- **Location:** `src/pages/dashboard/IntakePage.tsx:171-186`, `:318-329` (edit/delete icons with no `aria-label` or `title`), `:302-306` ("Requerido" in red, the error colour)
- **User impact:** An option containing a comma ("Sí, pero leve") splits into two. Screen readers hear "button, button". There is no preview of what the client sees.
- **Fix:** An option list editor (one input per option, add/remove), labeled icon buttons, a neutral "Obligatoria" badge, and a small preview of the rendered question.

### OM-26: Giving an employee access means the owner invents and hands over their password — DECISION NEEDED
- **Status:** Partially fixed (commit `d4bde59`) — non-decision part: the password reveal toggle is focusable, named "Mostrar/Ocultar contraseña", `aria-pressed`, 44px; invite fields labelled. Open: "Con acceso / Sin acceso" needs the API to say whether an employee has a user (backend gap: `EmpleadoDto` has no such field), and the email-invitation DECISION.
- **Heuristic:** H2 Match; security-adjacent (see Out of scope)
- **Location:** `src/pages/dashboard/EmpleadosPage.tsx:53-56` (min 6 chars), `:845-890`, `:868-876` (reveal toggle `tabIndex={-1}`, no label), `:484-489` ("Invitar" shown even if the employee already has an account)
- **User impact:** The owner must communicate a password out of band and knows the employee's credentials. The card gives no signal of who already has access.
- **Fix:** **DECISION NEEDED** — move to an email invitation with a set-password link. Meanwhile show "Con acceso" / "Sin acceso" on the card and label the reveal toggle.

### OM-27: "Canal de notificaciones" shows a single control that does nothing — DECISION NEEDED
- **Status:** Open – DECISION NEEDED (unchanged).
- **Heuristic:** H2 Match; impeccable Integrity (decorative controls)
- **Location:** `src/pages/dashboard/PerfilPage.tsx:1012-1021`; schema still accepts `WhatsApp` and `Ambos` (`:85-86`)
- **User impact:** A pressed-looking "Correo" button with no alternative reads as a broken selector.
- **Fix:** **DECISION NEEDED** — is WhatsApp coming? If not, replace the button with plain text ("Las notificaciones se envían por correo"). If yes, a real segmented control.

### OM-28: "Imprimir" next to the QR prints the whole dashboard
- **Status:** Fixed (commit `d4bde59`) — "Imprimir" opens a sheet with only the QR, business name and booking URL (`src/utils/impresionQr.ts`, every value escaped, only a PNG data URL accepted); popup-blocked toast. Tests in `impresionQr.test.ts`, `PerfilPage.test.tsx`.
- **Heuristic:** H2 Match
- **Location:** `src/pages/dashboard/PerfilPage.tsx:912-915` (`window.print()`; no print styles in the page or layout)
- **Fix:** Print a dedicated sheet (QR, business name, booking URL) via a print-only container or a generated PDF/PNG.

### OM-29: Account deletion uses a hand-rolled dialog and does not say what happens to the business — DECISION NEEDED
- **Status:** Partially fixed (commit `d4bde59`) — the dialog is the shared `Modal` (dialog role, focus trap, Escape) with a labelled password field inside a form (Enter submits) and "Volver" / "Eliminar cuenta". Open – DECISION NEEDED: consequences, typing the business name, data export. Test in `PerfilPage.test.tsx`.
- **Heuristic:** H5 Error prevention; WCAG 2.1.2/2.4.3 (same root cause as **DC-18**)
- **Location:** `src/pages/dashboard/PerfilPage.tsx:1119-1153` (no `role="dialog"`, no Escape, no focus trap), `:1178-1180`
- **User impact:** The copy covers "datos personales" and anonymised history but not the public booking page, employees' accounts or clients with future appointments.
- **Fix:** Use `Modal`. **DECISION NEEDED** — exact consequences (are future appointments cancelled and clients notified? is there a grace period?). State them, require typing the business name, and offer data export first.

### OM-30: Service toggles read as status, not action, and one pending toggle freezes every row
- **Status:** Fixed (commit `d4bde59`) — a labelled `Switch` "Visible en reservas" per row (hiding still confirms, showing is one click); pending state per row for visibility and Destacado, so other rows stay usable; Destacado has `aria-pressed` + `aria-label`; neutral Editar; row actions named and 44px. Tests in `ServiciosPage.test.tsx`.
- **Heuristic:** H4 Consistency; H1 Visibility; WCAG 4.1.2
- **Location:** `src/pages/dashboard/ServiciosPage.tsx:307-331` (`disabled={togglendoActivo}` / `togglendoDestacado` are global), `:318` (Destacado is icon-only on mobile, `title` only), `:332-338` (Editar uses the same amber as an active Destacado)
- **User impact:** "Activo" looks like a badge; clicking it takes the service off the booking page. While one request is pending all other rows' toggles are disabled. On a phone the star has no name.
- **Fix:** A labeled `Switch` (OM-02) "Visible en reservas" with per-row pending state; `aria-pressed` and `aria-label` on Destacado; neutral styling for Editar.

### OM-31: Waitlist: "Expirado" is a one-way, unlabeled action, and the filtered empty state is wrong
- **Status:** Fixed (commit `d4bde59`) — labelled "Expirar" action; Esperando → Expirado shows "Deshacer" (PATCH back to Esperando restores the entry exactly); Notificado → Expirado asks for confirmation instead, because returning to Notificado rewrites `FechaNotificacion`; filtered empty state "Ningún registro con estado X"; sector-neutral icon; named delete; skeleton and "Reintentar". Tests in `ListaEsperaPage.test.tsx`.
- **Heuristic:** H3 User control; H6; H4
- **Location:** `src/pages/dashboard/ListaEsperaPage.tsx:232-240` (icon-only, no confirm; an expired entry offers no way back, only delete), `:241-247`, `:121` (title "No hay entradas en la lista de espera" even when a filter is active), `:134` (`window.confirm`), `:190` (scissors icon for any sector)
- **Fix:** Labeled actions, undo toast for Expirar, "Ningún registro con estado X" for filtered empties, sector-neutral icon.

---

## Severity 1: Cosmetic

### OM-32: Copy refinements
- **Status:** Fixed (commit `f4261c0`) — "Acceso creado"; "Guardado" (now `role="status"`, green-700); "Descanso tras la cita (min)"; the reactivation WhatsApp text is neutral, emoji-free and omits the link line when there is no slug; Reportes ranks by number instead of medals; "Válido hasta" already used `formatFecha` (OM-24). Kept on purpose: "Precio (MXN)", since the app formats every amount in MXN (`formatPrecio`); editable reactivation messages were not added (new feature).
- **Principle:** Krug "get rid of half the words"; project rule (neutral professional Spanish)
- **Location:** "Cuenta creada exitosamente" (`EmpleadosPage.tsx:264`) → "Acceso creado"; "¡Guardado!" (`ClientesPage.tsx:523`) → "Guardado"; "Buffer (min)" jargon (`ServiciosPage.tsx:498`) → "Descanso tras la cita (min)"; the WhatsApp reactivation template is fixed, informal and uses emoji (`ClientesPage.tsx:101-104`); "Precio (MXN)" hard-coded (`ServiciosPage.tsx:510`); medal emoji ranking (`ReportesPage.tsx:489`, see DC-35); "Expira:" uses `toLocaleDateString` instead of `formatFecha` (`DescuentosPage.tsx:303`)
- **Fix:** Apply with `impeccable clarify`; consider letting owners edit the reactivation message.

### OM-33: False affordances and motion on management lists
- **Status:** Fixed (commit `f4261c0`) — the hover lift is gone from the non-clickable employee cards; new `src/hooks/useEntradaAnimada.ts` animates the Empleados and Servicios lists only on their first appearance (paging/filtering shows items at once) and never under reduced motion. Test in `useEntradaAnimada.test.ts`.
- **Principle:** microinteractions (feedback matches significance); same root cause as **DC-26**
- **Location:** `EmpleadosPage.tsx:433` (`hover:-translate-y-0.5 hover:shadow-md` on a card that is not clickable), `:423-432`, `ServiciosPage.tsx:266-276` (stagger animation on every render and page change, no `useReducedMotion`)
- **Fix:** Remove the lift from non-interactive cards; animate only on first mount and respect reduced motion.

---

## Cross-screen patterns

The same job is done differently on each screen. Fix once in shared primitives, then migrate.

| Concern | What the ten screens do today | Fix once in |
| --- | --- | --- |
| Create/edit surface | Radix `Modal` (Empleados, Servicios, Intake), inline panel (Descuentos), always-on form (Perfil) | `Modal` + one `FormularioModal` pattern; Descuentos moves to it |
| Form state | react-hook-form + zod (Empleados, Servicios, Perfil) vs `useState` + manual checks (Intake, Descuentos, Clientes notes, Perfil blocked days) | react-hook-form + zod everywhere, with the DC-19 `Campo` primitive (label, hint, error, dark-mode error border — OM-23) |
| Delete confirmation | Radix `Modal` naming the item (Empleados, Servicios, Categorías), `window.confirm` (Lista de espera, Intake, Descuentos), hand-rolled overlay (Galería, Perfil account), none (Perfil images, blocked days, time blocks) | `ConfirmarEliminar` on `Modal` that states consequences, plus undo toast (DC-17) for reversible actions |
| Unsaved changes | Browser-close only, one page (Perfil); none elsewhere | `Modal dirty` prop + one route-level guard (OM-03) |
| Toggles | `div` switches (4), status-looking buttons (Servicios), bare checkbox (Perfil anticipo `:1037`) | One `Switch` primitive (OM-02) |
| Image upload | Five uploaders, only Galería validates; none show progress | `useSubirImagen` + `SubidorImagen` button (OM-07, OM-14, OM-16) |
| Schedule editing | Two editors with different interval rules and errors | `EditorHorario` (OM-22) |
| Loading | `SkeletonCards` (Empleados), skeleton rows (Clientes activity, Reseñas, Reportes Citas), plain "Cargando..." (Servicios, Clientes, Intake, Descuentos, Lista de espera, Empleados time blocks), spinner (Reportes tabs) | Skeletons matching the final layout, one per list type |
| Empty state | `EmptyState` (Empleados no-results, Clientes, Lista de espera) vs hand-built blocks (Empleados, Servicios, Intake, Descuentos, Reseñas) with different icons and spacing | `EmptyState` with an optional primary action |
| Error state | `isError` handled only in Lista de espera and part of Reportes; none elsewhere | Shared inline error with "Reintentar" (DC-32, OM-20) |
| Search | Empleados and Clientes only; Servicios has none | `FiltroBarra` search on every list over ~15 items |
| Status pills | Hand-rolled maps per screen (Lista de espera, Empleado Activo, Servicio Activo, Categoría count, Descuento Agotado), most without dark pairs | Status/semantic tokens (DC-06) |
| Row actions | Coloured bordered buttons (Empleados: five hues), tinted chips (Servicios, Clientes), bare icons with `title` (Intake, Descuentos, Lista de espera, Galería) | Neutral `BotonAccion` sizes; one overflow menu for secondary actions |
| Excel export | Page-only (Clientes), full dataset (Reportes), numbers as text in both | `exportarExcel` writes typed cells and reports failures (OM-19) |

## New occurrences of Dashboard Core findings

Not re-counted above; fix with the DC item.

| DC finding | New locations in owner screens |
| --- | --- |
| DC-04 UTC "today" | Fixed (commit `9083787`): `EmpleadosPage` time-block min hour and `PerfilPage` blocked-day `minDate` now use `hoy()` |
| DC-09 Icon buttons without names | `GaleriaPage.tsx:135-141`, `:170-175` (lightbox close); `IntakePage.tsx:318-329`; `DescuentosPage.tsx:126`, `:308-321`; `ListaEsperaPage.tsx:233-247`; `ServiciosPage.tsx:307-345` (labels hidden below `sm`) |
| DC-11 Dark mode gaps | See OM-08 |
| DC-17 Toasts not announced / no undo | Undo needed by OM-11, OM-31; Clientes "¡Guardado!" (`ClientesPage.tsx:522-524`) and Descuentos copy feedback (`:313`) are not announced |
| DC-18 Custom overlays | `GaleriaPage.tsx:165-183` (lightbox), `:186-207` (delete); `PerfilPage.tsx:1119-1153` (account), `:1316-1383` (cover positioning: no dialog role, no Escape, pointer-only drag with no `touch-action: none` or `onPointerCancel`, no keyboard alternative) |
| DC-19 Unlabeled fields | Every form in scope uses `<label>` without `htmlFor`; e.g. `EmpleadosPage.tsx:533`, `ServiciosPage.tsx:460-519`, `PerfilPage.tsx:622-958`, `IntakePage.tsx:149-190`, `DescuentosPage.tsx:133-188`; bare checkbox `PerfilPage.tsx:1037`; password toggle `EmpleadosPage.tsx:868-876` |
| DC-20 Off-system colours | Employee card buttons blue/violet/amber/emerald (`EmpleadosPage.tsx:464-489`); orange "Agregar bloqueo" with white text, about 2.8:1 (`:794`); indigo "Posicionar"/"Confirmar" (`PerfilPage.tsx:715`, `:1324`); emerald/sky retention bars (`ReportesPage.tsx:740`, `:749`); payment-method hex (`:321-323`) |
| DC-21 Micro text / low contrast | `text-[10px]`/`text-[11px]` at `EmpleadosPage.tsx:615`, `:622`, `:647`; `ClientesPage.tsx:187`, `:279`; `ResenasPage.tsx:81`; `PerfilPage.tsx:707`, `:1378`; amber-500 (2.1:1) `ClientesPage.tsx:187`, `:336`; WhatsApp `#25D366` on a 10% tint, about 1.9:1 (`:346`); yellow-600 KPI, about 2.9:1 (`ListaEsperaPage.tsx:81`); red-400 error text, about 2.8:1 (`ListaEsperaPage.tsx:116`, `ReportesPage.tsx:370`) |
| DC-22 Small targets | `text-xs px-2.5 py-1` row chips, about 26px (`ServiciosPage.tsx:311-341`, `ClientesPage.tsx:441`); `p-1.5` icons, about 27px (Intake, Descuentos, Lista de espera); 20px remove-interval (`EmpleadosPage.tsx:634`); text-link actions in Perfil images (`:666-744`) |
| DC-26 Motion | OM-33 |
| DC-32 Error states | All ten screens except Lista de espera and part of Reportes (OM-20) |
| DC-34 Sector terms ignored | "Crear empleado" (`EmpleadosPage.tsx:564`), "Crear servicio" (`ServiciosPage.tsx:533`), "Cargando clientes..." and "cliente(s)" (`ClientesPage.tsx:273`, `:374`, `:455`), Reportes filters/tab "Empleado", "Servicio", "Empleados" and "Reporte por Empleado" (`ReportesPage.tsx:109`, `:117`, `:226`, `:280`), Intake "Servicios" (`:190`, `:313`), Lista de espera subtitle "Clientes" (`:74`) |
| DC-36 gray/slate mix | Every file in scope mixes `gray-*` and `slate-*` within single components |

## What Works Well

- **Shared shell adopted everywhere:** all ten screens use `EncabezadoPagina`, `BotonAccion`, `Tabs`, `FiltroBarra` and `Pagination`, so headers, primary actions and paging are consistent and keep 44px targets.
- **Perfil error routing:** `onInvalid` jumps to the tab holding the first invalid field and names the problem in the toast (`PerfilPage.tsx:286-298`); the tab is kept in the URL (`:148-153`).
- **Careful colour input:** typing, pasting without `#` and partial values are handled without corrupting the saved brand colour, with an explicit unsaved hint (`PerfilPage.tsx:316-334`, `:834-838`).
- **Sticky save bar** publishes its height so toasts never cover it, and respects safe-area insets (`PerfilPage.tsx:540-572`).
- **Cover background picker** is a labeled radio group with a live preview that mirrors the real booking header, including measured contrast veils (`SelectorFondoPortada.tsx:107`, `PerfilPage.tsx:41-53`, `:780-833`).
- **Honest client activity data:** active/inactive grouping and counts are computed server-side over the whole directory, and "sin visitas" is explained rather than hidden (`ClientesPage.tsx:56-78`, `:271-285`).
- **Time-block form respects reality:** start/end pickers are limited to business hours, hide slots with existing appointments and enforce a 1-hour minimum (`EmpleadosPage.tsx:59-70`, `:129-175`).
- **Schedule validation blocks bad saves** with a specific message (Empleados) and the employee editor hides slots outside business hours (`EmpleadosPage.tsx:28-36`, `:331-340`).
- **Good destructive dialogs where they exist:** employee, service and category deletions name the item, and category deletion warns that its services become uncategorized (`ServiciosPage.tsx:571-575`).
- **Waitlist KPIs** count the full list regardless of filter (`ListaEsperaPage.tsx:35-42`); **Reportes** uses semantic tokens in its stat cards and the local-date helpers for presets (`ReportesPage.tsx:38-48`, `:96-101`).
- **Invite errors stay inside the modal** next to the fields instead of in a vanishing toast (`EmpleadosPage.tsx:882-884`).

## Decisions Needed From the Owner

1. **OM-06:** Does "Notificar" send a message (email job or WhatsApp link) or only record a manual contact?
2. **OM-09:** May owners export the full client directory?
3. **OM-15:** Is reordering gallery photos and intake questions in scope?
4. **OM-17:** What happens to future appointments when an employee or service is deleted; can coupons be reactivated?
5. **OM-21:** What "aprobada" means for reviews and whether owners can approve, hide or reply.
6. **OM-26:** Move employee access to an email invitation instead of an owner-chosen password?
7. **OM-27:** Is a WhatsApp notification channel planned?
8. **OM-29:** Exact consequences and safeguards of deleting the owner account.

## Recommended Order of Work

1. **OM-01, OM-04, OM-05, OM-12, OM-13, OM-19:** correctness bugs with small, contained fixes.
2. **OM-02, OM-03:** `Switch` primitive and dirty-state guard (modal prop + route guard).
3. **OM-08** with DC-11/DC-06: theming pass on the owner screens.
4. **OM-07, OM-14, OM-16:** shared image uploader; **OM-22:** shared schedule editor.
5. **OM-10, OM-11, OM-30, OM-31:** mobile client cards, undo toasts (after DC-17), labeled toggles.
6. Cross-screen migration: delete dialog, form/`Campo`, loading/empty/error states (OM-20, OM-23, OM-24, OM-25).
7. **OM-06, OM-09, OM-15, OM-17, OM-21, OM-26, OM-27, OM-29:** after the owner's decisions.
8. OM-18 chart palette and accessibility, cosmetic items, then `impeccable polish`. Verify in a rendered build at 375px and 1280px, light and dark, before closing.

## Out of Scope: Security

Not counted above; route to a `review-risk` pass.

- **No HTML-injection sinks in scope.** A search for `dangerouslySetInnerHTML`, `document.write`, `innerHTML` and `eval(` in the ten pages, `SelectorFondoPortada.tsx`, `DateTimePicker.tsx` and `exportarExcel.ts` found nothing. (The `document.write` print path in `PagosPage.tsx` is already noted in `dashboard-core.md`.)
- **Owner-chosen employee passwords** (`EmpleadosPage.tsx:53-56`, `:845-890`): the owner sets and knows the employee's initial password (6-character minimum on the client) and must share it out of band; there is no forced change on first login visible in the frontend. See OM-26.
- **Excel exports** write every value as a plain string (`exportarExcel.ts:130`, `:166`), so cell values are not interpreted as formulas by ExcelJS; formula injection looks low-risk, but confirm how Excel treats strings beginning with `=` when opening these files.
- **Client PII export** (`ClientesPage.tsx:153-165`, `ReportesPage.tsx:182-197`) includes phone, email and internal notes with no audit trail; relevant to the OM-09 decision.
- External links use `rel="noreferrer"` (`ClientesPage.tsx:344`); WhatsApp text is `encodeURIComponent`-escaped (`:105`).
