# Audit: Dashboard Core (shared Propietario / Empleado screens)

- **Date:** 2026-10-20
- **Status:** All severity-4 and severity-3 findings fixed in the working tree (pending commit, not yet verified in a rendered build), except the decision parts of DC-03 and DC-13. Several severity-2 items partially fixed as a side effect. Each finding carries its own **Status** line.
- **Type:** Code-based audit. **Nothing was rendered.** No browser, screenshots, emulated viewports or assistive technology were used. Contrast ratios are calculated from the Tailwind/hex values in the source. Layout, touch and dark-mode behavior are inferred from class names and the token definitions in `src/index.css` / `tailwind.config.js`. Verify visual findings in a running build, in light and dark mode, before fixing them.

## Scope

| Route | Entry file | Rendered components reviewed |
| --- | --- | --- |
| Shell (all `/dashboard*` except kiosk) | `src/layouts/DashboardLayout.tsx` | Sidebar (role menus, collapse, booking link), mobile header, desktop topbar, user menu, theme toggle, inactive-account banner, `NotificacionesBell`, `EncuestaSatisfaccionModal`, `useInactividadTimeout` |
| `/dashboard` | `src/pages/dashboard/InicioPage.tsx` | `VistaPropietario` (KPIs, trend chart, next appointment, today's agenda, onboarding wizard, welcome screen), `VistaEmpleado` (stats, weekly summary, agenda, client-history sheet), `NotificacionBanner`, `AnimatedCounter`, `EstadoBadge` |
| `/dashboard/citas` | `src/pages/dashboard/CitasPage.tsx` | List, `CalendarioCitas`, `GanttCitas`, `FiltroBarra`, `Pagination`, `Modal` (status, complete, reschedule, notes, new, repeat, edit client, receipt), drag-confirm overlay |
| `/dashboard/citas/:id` | `src/pages/dashboard/CitaDetallePage.tsx` | Detail card, calendar export |
| `/dashboard/pagos` | `src/pages/dashboard/PagosPage.tsx` | Cobro (KPIs, cards, payment modal), Historial, Corte del día, Cierre de caja, `TicketRecibo` |
| `/dashboard/seguridad` | `src/pages/dashboard/DosFactoresPage.tsx` | 2FA setup and disable |
| `/dashboard/mi-perfil` | `src/pages/dashboard/MiPerfilPage.tsx` | Photo, password form, push notifications, employee time blocks |
| `/dashboard/kiosk` | `src/pages/dashboard/KioskPage.tsx` | Full-screen reception board (outside `DashboardLayout`) |

Supporting code read: `src/App.tsx`, `src/index.css`, `tailwind.config.js`, `docs/design-system.css`, `src/lib/temaPorRuta.ts`, `src/hooks/useTheme.ts`, `src/hooks/useInactividadTimeout.ts`, `src/utils/fechas.ts`, `src/utils/formatters.ts`, `src/api/citas.ts`, `src/store/toastStore.ts`, and the shared primitives `ToastContainer`, `Modal`, `dialog`, `Tooltip`, `Tabs`, `Pagination`, `BotonAccion`, `EstadoBadge`, `AnimatedCounter`, `NotificacionBanner`.

Out of scope: Propietario-only pages (`Empleados`, `Servicios`, `Clientes`, `Perfil`, `Reportes`, …), `AdminLayout`, backend authorization rules.

### Role matrix (what differs in code)

| Surface | Propietario | Empleado |
| --- | --- | --- |
| Sidebar | 10–13 items, booking-link copy, notifications bell | 4 items (`Inicio`, `Mis citas`, `Pagos`, `Mi perfil`). **No `Seguridad`**, no bell |
| `/dashboard` | KPIs + chart + next appointment + agenda + top services + onboarding | Stats (incl. income) + weekly summary + next + agenda + upcoming; tapping a row opens client history |
| `/dashboard/citas` | Full toolset | **Identical** toolset: no role checks in `CitasPage.tsx` (professional filter, export, kiosk, deposit toggle, edit client across all appointments) |
| `/dashboard/pagos` | Full | **Identical** except the subtitle (`PagosPage.tsx:469`): revert payments, Corte del día, Cierre de caja |
| `/dashboard/kiosk` | Revenue in footer | Revenue hidden (`KioskPage.tsx:243`) |
| `GanttCitas` | All active employees | Own column, matched by email (`GanttCitas.tsx:109-111`) |

## Method

- **ux-heuristics:** Nielsen's 10 heuristics and Krug's principles. Severity 0–4 (4 = blocks the task, 3 = major, 2 = minor, 1 = cosmetic), weighing frequency, impact and persistence.
- **refactoring-ui:** hierarchy, spacing and type scale, color and contrast, depth, consistency.
- **impeccable `audit`:** accessibility, performance, theming, responsive design, implementation integrity. Surface mode is **Operate**: a daily working tool where precision and restraint matter more than expression.
- **microinteractions:** triggers, feedback, loading and transition states, undo.
- **Project rules** from `CLAUDE.md`: dashboard must work in light and dark mode; primary is slate; brand gold is logo-only; appointment status colors are semantic tokens; neutral professional Spanish copy.

Line numbers point to the current working tree. Findings marked **DECISION NEEDED** require a product decision from the owner before a fix can be designed.

## Summary

| Severity | Count | IDs |
| --- | --- | --- |
| 4 Catastrophic | 3 | DC-01 … DC-03 |
| 3 Major | 10 | DC-04 … DC-13 |
| 2 Minor | 20 | DC-14 … DC-33 |
| 1 Cosmetic | 3 | DC-34 … DC-36 |
| **Total** | **36** | |

| Framework | Score | Main reasons |
| --- | --- | --- |
| Nielsen / Krug (ux-heuristics) | **4 / 10** | Rescheduling impossible on phones (H7/H3), unreadable dark-mode home (H1), wrong "today" after 18:00 (H1), four conflicting status color systems (H4), silent payment failures (H9), one-click payment reversal without undo (H3/H5), unnamed icon actions (H6) |
| Refactoring UI diagnostic | **6 / 10** | 5 of 8 rows pass. Fails: hierarchy on the owner home (KPIs and chart above the work), grayscale (status carried by color that also disagrees between views), contrast (9–10px slate-400 labels, white on green/amber) |
| impeccable audit health | **9 / 20 (Poor)** | A11y 1, Performance 3, Theming 1, Responsive 2, Integrity 2 |

**Implementation integrity verdict: fail, with a strong base.** Recent work introduced real system pieces (`EncabezadoPagina`, `BotonAccion`, `Tabs`, `Pagination`, `FiltroBarra`, `fechas.ts`) with 44px targets, focus rings and documented reasoning. That system has not reached the core daily surfaces yet. The status tokens defined in `src/index.css:33-48` have **zero usages** in `src/` (verified by search); instead there are four hand-rolled status palettes that contradict each other. Dark mode is broken on the most-used screen. The mobile list hides the reschedule action entirely. These are systemic gaps, not one-offs.

---

## Severity 4: Catastrophic

### DC-01: On phones, an appointment cannot be rescheduled (or annotated, repeated, or have its deposit registered)
- **Status:** Fixed (pending commit) — shared `src/components/dashboard/AccionesCita.tsx` (`AccionesCita` row buttons + `HojaAccionesCita` sheet: confirm, complete, reschedule, no-show, cancel with reason, WhatsApp, extras, detail, client history). Used by list rows at every width, calendar, Gantt, InicioPage (owner agenda + next appointment, employee agenda + next appointment) and CitaDetallePage. Reschedule reuses `/publico/disponibilidad` + `citasApi.reagendar`. Drag-to-reschedule kept as a desktop shortcut.
  - **Follow-up (owner-management batch, pending commit):** "Registrar anticipo" from the sheet now uses `invalidarCitas` (list, calendar, Gantt, home and cobro refresh), shows "Registrando anticipo…" disabled while its request is pending (new `deshabilitada` field on `AccionExtraCita`) and ignores a second submit. The sheet and `CalendarioCitas` `puedeMover` use `citaAbierta()`.
- **Heuristic:** H7 Flexibility and efficiency; H3 User control and freedom; impeccable Responsive (broken touch interaction)
- **Location:** `src/pages/dashboard/CitasPage.tsx:649-677` (mobile actions), `:679-811` (desktop actions, `hidden sm:flex`), `:1254-1321` (status modal); `src/components/dashboard/CalendarioCitas.tsx:122-124`, `:264-283`; `src/pages/dashboard/CitaDetallePage.tsx:82-184`
- **Evidence:** Below 640px each row shows only WhatsApp, "Editar cliente" and the `MoreVertical` button. That button opens the status modal, whose options come from `TRANSICIONES` (Confirmar, Cancelar, Completar, Inasistencia): there is no Reagendar. Reagendar, Notas, Repetir, Anticipo, Comprobante and Reseña exist only in the `sm:flex` block. The calendar's reschedule is HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDrop`), which does not fire on touch. Calendar and Gantt clicks also open the same status modal. `CitaDetallePage` has no actions at all.
- **User impact:** An employee or owner working from a phone (the likely device at the chair or the counter) cannot move an appointment when a client calls. The only path is to cancel and re-create it, which loses notes, deposit and payment links and may notify the client of a cancellation.
- **Fix:** Make the row (or a single "Acciones" button) open one action sheet that lists every action valid for the status, including Reagendar, Notas and Anticipo. Reuse that sheet from the calendar, Gantt and the detail page. Keep drag-to-reschedule as a desktop shortcut only.

### DC-02: The home screen is unreadable in dark mode, worst for employees
- **Status:** Fixed (pending commit) — InicioPage blocks moved to shadcn/semantic tokens (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `--status-*`); history sheet is now a `Modal`; onboarding links got dark pairs. Not rendered: verify in dark mode.
- **Heuristic:** H1 Visibility of system status; WCAG 1.4.3 Contrast; project rule "dashboard must work in light AND dark mode"
- **Location:** `src/pages/dashboard/InicioPage.tsx` — Empleado: `:846-851` (rows `bg-slate-50` / `bg-gray-50` / `bg-emerald-50` with no `dark:` background) under `:867-868` (`dark:text-gray-200` / `dark:text-gray-400`); `:804-813` (next appointment: `text-slate-900`, `text-slate-700` with no `dark:` variant on a transparent `bg-slate-700/5`); `:781-799` (weekly summary, light-only); `:915-969` (history sheet, light-only). Propietario: `:540-555` (next appointment: `text-gray-900`, `text-slate-700`); `:119`, `:124` (onboarding links `text-slate-700` on `dark:bg-slate-800`).
- **Evidence:** In dark mode the employee agenda renders gray-200 text on a slate-50 row (about 1.1:1). The "Próxima cita" block renders slate-900 text over the slate-950 page (about 1.1:1). `temaPreferido()` (`src/lib/temaPorRuta.ts:22-31`) defaults to the OS preference, so every user with a dark OS gets this without choosing it.
- **User impact:** The employee's main daily screen shows their own clients' names and services as invisible text. The owner's next-appointment card and onboarding actions are also unreadable.
- **Fix:** Add dark variants (`dark:bg-slate-800`, `dark:bg-slate-700/40`, `dark:text-slate-100`, …) to every block listed, or better, move these blocks onto the shadcn tokens (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`) that already switch with the theme. Add one dark-mode render test per view.

### DC-03: For "salud" businesses, the sidebar and mobile header are hard-coded blue with slate text at about 1.2:1
- **Status:** Partially fixed — sector scheme KEPT (decision still open), but tokenized: `--sidebar-salud-*` in `src/index.css`, `tailwind.config.js`, `docs/design-system.css`, light and dark values at ≥5.6:1; nav text, icons, footer buttons, mobile header and logo now follow the tokens. Open – DECISION NEEDED: keep or remove the sector colour.
- **Heuristic:** WCAG 1.4.3 Contrast; H4 Consistency; project rules (primary is slate, dashboard works in both themes)
- **Location:** `src/layouts/DashboardLayout.tsx:355` (`backgroundColor: "#0F4C75"`), `:404-408` (active item `#1B6CA8`), `:511` (mobile header `#1B6CA8`); inactive items `:401` (`text-slate-600`), icons `:415` (`text-slate-500`), date `:37` (`text-slate-500`), close button `:379`
- **Evidence:** Inline `style` overrides the `bg-white` / `dark:bg-slate-900` classes while the text keeps its light-theme classes. slate-600 (#475569) on #0F4C75 is about 1.2:1; slate-500 icons about 1.8:1; the slate-500 date on #1B6CA8 is about 1.1:1. The light logo `Banner.png` (`:369`) also sits on the blue. This applies to owners only (`perfil` is fetched with `enabled: !esEmpleado`, `:204-209`).
- **User impact:** Every owner of a health-sector business sees navigation labels they cannot read, in the default light theme, on every page.
- **Fix:** **DECISION NEEDED** — keep a sector color or not. If yes, add it as a token pair (`--sidebar-bg`, `--sidebar-fg`, `--sidebar-active`) in `src/index.css` with light and dark values that meet 4.5:1, document it in `docs/design-system.css`, and drive the nav text from the token. If no, remove the inline styles.

---

## Severity 3: Major

### DC-04: "Today" is computed in UTC, so after 18:00 in Mexico the home screen and badges show tomorrow
- **Status:** Fixed (pending commit) — `hoy()`/`fechaLocal()`/`inicioSemana()`/`finSemana()` in DashboardLayout, InicioPage (both views), CitasPage, MiPerfilPage, CalendarioCitas, GanttCitas and the reschedule sheet; `no-restricted-syntax` rule in `eslint.config.js` for the audited files; TZ test (19:30 CDMX) in `InicioPage.test.tsx`. Follow-up (pending commit): `EmpleadosPage` time-block minimum and `PerfilPage` blocked-day `minDate` now use `hoy()`; TZ test in `PerfilPage.test.tsx`.
- **Heuristic:** H1 Visibility of system status; H2 Match with the real world
- **Location:** `src/layouts/DashboardLayout.tsx:232` (sidebar/header badge); `src/pages/dashboard/InicioPage.tsx:259` (owner "Agenda de hoy"), `:670-671`, `:678-679` (employee today, tomorrow, week range); `src/pages/dashboard/CitasPage.tsx:1037`, `:1190` (`minDate` of new/reschedule pickers); `src/pages/dashboard/MiPerfilPage.tsx:153`
- **Evidence:** All use `new Date().toISOString().slice(0, 10)` or `.split("T")[0]`. `src/utils/fechas.ts:6-8` documents exactly this bug and provides `hoy()` / `fechaLocal()`; `CitasPage` filters and `PagosPage` already use it.
- **User impact:** From 18:00 local time (UTC-6) until midnight, the owner's "Agenda de hoy" lists tomorrow under today's date heading; the employee's "Citas hoy", agenda and "Próxima cita" switch to tomorrow and the evening's remaining clients disappear; the sidebar count and pending chip are wrong; the reschedule picker blocks today. Evening hours are peak hours for many salons.
- **Fix:** Replace every occurrence with `hoy()`, `inicioSemana()`, `finSemana()` and `fechaLocal()` from `src/utils/fechas.ts`. Add a lint rule (`no-restricted-syntax` on `toISOString().slice`/`split("T")`) and a test that mocks 19:00 UTC-6.

### DC-05: The owner's home puts metrics above the work; today's agenda is passive
- **Status:** Fixed (pending commit) — owner home now leads with next appointment and "Agenda de hoy" (row actions + "Ver todas las citas"); the quick-action grid was removed; KPIs and the trend chart moved below the agenda. KPIs were not collapsed into a single strip.
- **Heuristic:** H8 Aesthetic and minimalist design; Krug "Is the main action obvious?"; Refactoring UI hierarchy
- **Location:** `src/pages/dashboard/InicioPage.tsx:350-377` (4-tile quick actions), `:425-457` (6 KPI tiles), `:460-523` (200px trend chart), `:563-612` (Agenda de hoy), `:578-608` (rows)
- **Evidence:** Before reaching "Agenda de hoy", the owner scrolls past a quick-action grid that duplicates the sidebar, six KPI tiles and a dual-axis chart. Agenda rows are plain `div`s: no link to the appointment, no confirm or complete action, only WhatsApp.
- **User impact:** The daily job (who is next, who still needs confirming, who just finished) takes scrolling and then a second trip to `Citas` to act. On a phone the agenda starts well below the fold.
- **Fix:** Lead with "Hoy": next appointment, pending confirmations (with inline Confirmar), and the agenda with row actions reusing the DC-01 action sheet. Collapse KPIs into one compact strip; move the trend chart below or to Reportes. Remove the quick-action grid (the sidebar already provides it), or replace it with "+ Nueva cita".

### DC-06: Appointment status colors disagree across four views, and the semantic status tokens are never used
- **Status:** Fixed (pending commit) — single map `src/lib/estadoCita.ts` (label, icon, badge/block/dot/text token classes) used by EstadoBadge, CitaDetallePage, CalendarioCitas (blocks + legend), GanttCitas (blocks + full legend), KioskPage chips, InicioPage history and employee agenda; CitasPage `TRANSICIONES` colours removed. Filled blocks use bg+fg tokens with a dot-coloured border (no white text). Token fixes: `--status-cancelled-fg` red-700, `--status-absent-fg` slate-600 (light) / slate-300 (dark). Badge pulse removed.
- **Heuristic:** H4 Consistency and standards; project rule "status colors are semantic tokens"; WCAG 1.4.1 Use of color, 1.4.3 Contrast
- **Location:** `src/components/ui/EstadoBadge.tsx:9-13`; `src/pages/dashboard/CitaDetallePage.tsx:8-14`; `src/components/dashboard/CalendarioCitas.tsx:16-22`; `src/components/dashboard/GanttCitas.tsx:16-41`; `src/pages/dashboard/CitasPage.tsx:36-46`; `src/pages/dashboard/KioskPage.tsx:192-200`; `src/pages/dashboard/InicioPage.tsx:954-958`; tokens defined in `src/index.css:33-48`, `:81-96`
- **Evidence:**

  | Status | EstadoBadge | CitaDetalle | Calendario | Gantt |
  | --- | --- | --- | --- | --- |
  | Confirmada | green | **blue** | green | emerald |
  | Completada | blue | **green** | blue | slate |
  | Cancelada | red | red | **gray** | red |
  | Inasistencia | gray | gray | **red** | **orange** |

  A search for `status-pending|confirmed|completed|cancelled|absent` finds only `src/index.css`. Contrast failures: EstadoBadge "Pendiente" amber-600 on white is about 3.2:1 at 12px; Gantt white text on amber-400 is about 1.7:1 and on emerald-500 about 2.5:1; selected transition buttons use white on green-500 (about 2.3:1), blue-500 (3.7:1) and red-500 (3.8:1). The Gantt legend omits Pendiente and Inasistencia (`:37-41`).
- **User impact:** "Green" means confirmed in the list and completed on the detail page; "red" means cancelled in the list and no-show on the calendar. Staff learn the colors and then misread a state, which leads to wrong follow-up (calling a client who already came, or not calling a no-show).
- **Fix:** Create one `estadoCita` map (label, icon, token classes `bg-status-*-bg text-status-*-fg`, dot) and use it in all seven places. Keep icon + text with every color. Validate the token pairs in both themes at 4.5:1 (adjust `--status-pending-fg` if needed) and use the `-dot` token for filled blocks with dark text instead of white.

### DC-07: Financial records change with one click and no confirmation or undo
- **Status:** Fixed (pending commit) — "Revertir pago" (cards and history) is a text button with 44px target on its own line and opens `ConfirmarAccion` stating amount, client and that the cash report changes; "Anular anticipo" also confirms with amount. Undo toast not implemented (needs DC-17).
  - **Follow-up (pending commit):** `mensajeError` moved to `src/utils/errores.ts` (used by PagosPage, DosFactoresPage, the cita mutations and the owner screens); `formatFechaMx` is a single export in `src/utils/formatters.ts` used by NegociosAdminPage and `comprobanteSuscripcion.ts`.
- **Heuristic:** H3 User control and freedom; H5 Error prevention; microinteractions (feedback scaled to significance)
- **Location:** `src/pages/dashboard/PagosPage.tsx:1280-1287` (card "Revertir pago"), `:1335-1342` (history row), `:398-408` (mutation); `src/pages/dashboard/CitasPage.tsx:751-765` (deposit register/annul toggle)
- **Evidence:** "Revertir pago" is a `p-1` button with a 13px icon (about 21px target), placed right next to the method chip, with only a `title`. It fires `pagosApi.registrar(id, { pagada: false })` immediately. The deposit button flips between "Registrar" and "Anular" on the same icon, again with no confirmation.
- **User impact:** A mis-tap on a phone or tablet un-pays an appointment. The amount, split method and tip that were captured are discarded, and the day's cash report changes without anyone noticing.
- **Fix:** Use a confirmation that states the consequence ("¿Revertir el pago de $450.00 de Ana López? El corte del día cambiará.") or, preferably, an undo toast with a 6–8 second window (requires DC-17). Give the control a text label ("Revertir") and a 44px target, and separate it from the status chip. Apply the same pattern to "Anular anticipo".

### DC-08: Payment registration, cash closing and 2FA setup fail silently
- **Status:** Fixed (pending commit) — payment modal shows the server error inline (`role="alert"`) plus toast and keeps the entered values; cash closing shows inline error or "Cierre guardado · hh:mm" (also from `cierreData.cerradoEn`), button reads "Actualizar cierre" once saved; 2FA setup shows inline error + toast.
  - **Follow-up (pending commit):** editing efectivo inicial, contado or retiros after saving replaces "Cierre guardado · hh:mm" with "Cambios sin guardar en el cierre." until the next save (test in `PagosPage.test.tsx`).
- **Heuristic:** H9 Help users recognize, diagnose and recover from errors; H1 Visibility of system status
- **Location:** `src/pages/dashboard/PagosPage.tsx:369-396` (`mutPagar`, no `onError`), `:410-418` (`mutCierre`, no `onError` and no success message), `:981-993` (Guardar cierre); `src/pages/dashboard/DosFactoresPage.tsx:26-35` (`configurar2FA`, no `onError`)
- **Evidence:** When `mutPagar` fails, the button goes from "Procesando…" back to "Confirmar pago" and nothing else happens. When `mutCierre` succeeds, the fields are rewritten but no confirmation appears; when it fails, nothing appears.
- **User impact:** The cashier cannot tell whether the client's payment was recorded and may charge twice or let the client leave unpaid. The owner cannot tell whether the cash closing was saved.
- **Fix:** Add `onError` with the server message (inline inside the modal, not only as a toast) and keep the entered values. Show "Cierre guardado" with a timestamp after saving, and show a saved state when `cierreData` already exists.

### DC-09: Icon-only row actions have no accessible names and depend on hover tooltips
- **Status:** Fixed (pending commit) — row actions reduced to WhatsApp + primary (Confirmar/Completar) + "Acciones" menu, all with `aria-label` including the client name; everything else moved into the sheet with text labels. Labels added to drawer close/menu/avatar buttons, MiPerfil camera, Pagos revert and retiro remove; 🧾 chip now has text.
- **Heuristic:** H6 Recognition rather than recall; WCAG 4.1.2 Name, Role, Value; Krug "Does it work without hover?"
- **Location:** `src/pages/dashboard/CitasPage.tsx:697-809` (Confirmar, Completar, Reagendar, Notas, Editar, Anticipo, Comprobante, Repetir, Más: buttons wrapped in `Tooltip` with no `aria-label`), `:661-676` (mobile, `title` only), `:638-641` (🧾 chip with no text); `src/layouts/DashboardLayout.tsx:379`, `:513`, `:538`, `:584` (close, menu, avatar buttons); `src/pages/dashboard/MiPerfilPage.tsx:215-221`; `PagosPage.tsx:1280`, `:1335`, `:914` (retiro remove)
- **Evidence:** `Tooltip` (`src/components/ui/Tooltip.tsx:26-33`) only renders Radix content on hover/focus; it does not name the trigger. Up to ten unlabeled 32px icons appear per row.
- **User impact:** Screen-reader users hear "button" ten times per row. Sighted users must hover each icon to learn what it does, which does not work on touch.
- **Fix:** Add `aria-label` to every icon button (including the client name: "Confirmar cita de Ana López"). Reduce the visible row actions to the one or two that fit the status (Confirmar for Pendiente, Completar for Confirmada) plus an "Acciones" menu (DC-01).

### DC-10: The mobile navigation drawer and the user menu are not keyboard or screen-reader operable
- **Status:** Fixed (pending commit) — closed drawer is `inert` below `xl`; open drawer moves focus to "Cerrar menú", traps Tab, closes on Escape and returns focus to the menu button (`aria-expanded`/`aria-controls`). User menu: disclosure pattern with `aria-expanded`, Escape (focus back to avatar), outside `pointerdown`/`focusin`. Built without Radix DropdownMenu/Sheet (not installed); keyboard behaviour needs browser verification.
- **Heuristic:** WCAG 2.1.2 No Keyboard Trap / 2.4.3 Focus Order / 4.1.2; H3 User control
- **Location:** `src/layouts/DashboardLayout.tsx:336-382` (overlay and drawer), `:347-354` (`-translate-x-full` only), `:513-518` (menu button), `:286-296` (outside click via `mousedown`), `:538-551`, `:584-597` (avatar menus)
- **Evidence:** Below `xl` the closed drawer is only translated off-screen: its links stay in the tab order. When open there is no focus move, no focus trap, no Escape handler and no `aria-expanded` / `aria-controls`. The user menu has no `role="menu"`, no Escape, and its outside-click handler listens to `mousedown` only. `cerrarSidebar` blurs the active element (`:281-284`), sending focus to `<body>`.
- **User impact:** Keyboard users tab through invisible links on every page below 1280px, and cannot close the drawer or menu with Escape.
- **Fix:** Build the drawer on Radix `Dialog` (or a Sheet primitive) and the user menu on Radix `DropdownMenu`, both already in the stack. Add `inert` to the closed drawer. Return focus to the trigger on close.

### DC-11: Dark mode is broken on several other dashboard surfaces
- **Status:** Fixed (pending commit) — dark pairs/tokens for DosFactoresPage status + success panels, CitasPage notes modal/textarea/paid chip/error inputs, MiPerfil error inputs and message, DashboardLayout badges + inactive banner, NotificacionBanner (both components), CitaDetallePage chip, InicioPage chart grid/tooltip, Pagos cierre/split/retiro inputs; `Modal` content defaults to `text-foreground`. No shared input primitive yet (see DC-19).
- **Heuristic:** Project rule (light and dark); impeccable Theming; WCAG 1.4.3
- **Location:**
  - `src/pages/dashboard/DosFactoresPage.tsx:100` (enabled state: `bg-green-50` with `dark:text-gray-100` text, about 1.1:1), `:182-185` (success panel)
  - `src/pages/dashboard/CitasPage.tsx:935-937` (notes summary, no dark), `:949` (textarea with no dark background or text color), `:614` (paid chip), `:639`, `:663`, `:671`, `:794`
  - `src/pages/dashboard/MiPerfilPage.tsx:263`, `:280`, `:297`, `:309`; `CitasPage.tsx:1131`, `:1405` (error state `bg-red-50` with `dark:text-gray-100`)
  - `src/layouts/DashboardLayout.tsx:373`, `:421-425` (sidebar badges), `:557-568` (inactive-account banner)
  - `src/components/ui/NotificacionBanner.tsx:22-56`; `src/pages/dashboard/CitaDetallePage.tsx:9-14`, `:141`
  - `src/pages/dashboard/InicioPage.tsx:502` (grid `#f3f4f6`), `:510` (tooltip with white background)
  - `src/pages/dashboard/PagosPage.tsx:874-905` (cierre inputs: `dark:bg-gray-800` with no text color)
- **User impact:** Users with 2FA enabled see an unreadable status card. Typing a note in dark mode produces light text in a white box. Field errors make the input unreadable at the moment the user needs to fix it. Light banners flash on a dark page.
- **Fix:** Run one theming pass (`impeccable colorize`): move these blocks to shadcn tokens or add explicit `dark:` pairs; give `Modal` children a default `text-foreground`; add a shared input class so every input gets the same dark background, text and error colors.

### DC-12: Overlapping appointments hide each other in the calendar; out-of-hours appointments are clipped
- **Status:** Fixed (pending commit) — `src/lib/carrilesCitas.ts`: overlapping appointments laid out in side-by-side lanes; visible hours widen to fit the earliest/latest appointment (calendar and Gantt). Business hours are not used as the base range (still 7–21).
  - **Follow-up (pending commit):** Cancelada and Inasistencia no longer take a lane or widen the visible hours (`ocupaAgenda`); the calendar draws them behind active appointments, full width at 60% opacity, and skips them when they fall outside the visible hours (the Gantt applies the same range rule; it had no lanes). Tests cover a cancelled appointment overlapping an active one.
- **Heuristic:** H1 Visibility of system status
- **Location:** `src/components/dashboard/CalendarioCitas.tsx:109-136` (`renderGridCita`, `totalCols` unused, every block `absolute inset-x-0.5`), `:302`, `:348`; `:8-9`, `:79-82` (`HORA_INICIO = 7`, `HORA_FIN = 21`, `Math.max(0, …)`)
- **Evidence:** Two appointments at the same time (two employees, no employee filter: the default for owners) render in the same box and only the top one can be clicked. An 06:30 appointment is drawn at 07:00; one at 21:30 falls below the grid.
- **User impact:** The owner's week view underreports the day. Clicking opens the wrong appointment.
- **Fix:** Lay out overlapping events in side-by-side lanes (compute columns per overlap group) or show "+2" in the slot. Derive the visible hours from business hours and the earliest/latest appointment.

### DC-13: Leaving kiosk mode opens the full dashboard with no re-authentication — DECISION NEEDED
- **Status:** Open – DECISION NEEDED — auth model intentionally unchanged; exit link still leads to the dashboard without re-authentication.
- **Heuristic:** H5 Error prevention; impeccable Integrity (security of an unattended screen)
- **Location:** `src/pages/dashboard/KioskPage.tsx:249-254`; `src/App.tsx:141-142` (kiosk outside `DashboardLayout`, so the 60-minute inactivity logout does not apply)
- **Evidence:** "← Salir del modo pantalla" is a plain `Link` to `/dashboard/citas`, in the session of whoever opened the kiosk (usually the owner).
- **User impact:** Anyone at the reception screen can tap the link and reach payments, cash closing, client data and settings.
- **Fix:** **DECISION NEEDED** — how kiosk mode is secured. Options: require the user's password or a short PIN to exit; or run the kiosk with a restricted read-only token or role. In either case, hide the exit link behind a long-press or corner gesture.

---

## Severity 2: Minor

### DC-14: Employees get the same Citas and Pagos toolset as owners — DECISION NEEDED
- **Status:** Open – DECISION NEEDED — employee permissions intentionally unchanged.
- **Heuristic:** H8 Minimalist design; H5 Error prevention
- **Location:** `src/pages/dashboard/CitasPage.tsx` (no `rol` checks: `:363-370` professional filter, `:482-497` Recepción/Exportar, `:751-765` deposit, `:880-882` edit client "en todas sus citas"); `src/pages/dashboard/PagosPage.tsx:70`, `:469` (role only changes the subtitle), `:473-482` (Corte, Historial), `:1280` (revert)
- **User impact:** Employees see a "Profesional" filter for a list that likely contains only their own appointments, and can revert payments, export data and record cash closings. Whether the backend blocks this is not visible from the frontend.
- **Fix:** **DECISION NEEDED** — the permission matrix for Empleado (export, revert payment, deposits, cash closing, edit client globally, create appointments for others). Then hide disallowed controls in the UI and verify the backend enforces the same rules.

### DC-15: On the employee home, tapping an appointment opens client history, not the appointment; finished but unclosed appointments fade out
- **Status:** Partially fixed — employee agenda rows now have an "Acciones" button next to the history button; closed appointments are no longer faded to 55%. "Por cerrar" label not added.
- **Heuristic:** H2 Match with the real world; H1 Visibility
- **Location:** `src/pages/dashboard/InicioPage.tsx:843-877` (row is a button that opens the history sheet, with a chevron suggesting detail), `:841`, `:850` (`opacity-55` when time has passed); owner `:580-588` (`opacity-40`)
- **User impact:** The employee cannot confirm, complete or mark a no-show from the home screen. Appointments that ended but are still Pendiente/Confirmada (work that is not finished) are faded at the moment they need attention, and the 40% opacity drops all text below 3:1.
- **Fix:** Make the row open the action sheet (DC-01), with "Ver historial" as one of its actions. Fade only Completada/Cancelada/Inasistencia; mark past-and-open appointments with a "Por cerrar" label and an inline Completar action.

### DC-16: The appointment detail page is a read-only dead end, and Citas filters are lost when returning
- **Status:** Partially fixed — detail page has the actions sheet; rows link to detail through "Ver detalle". Filters are still not in the URL.
- **Heuristic:** H3 User control; H4 Consistency
- **Location:** `src/pages/dashboard/CitaDetallePage.tsx:82-184` (no actions; primary button is "Guardar en calendario"), `:86-88` and `:55` (`navigate("/dashboard/citas")`), `:42-48` (spinner, not skeleton); `src/pages/dashboard/CitasPage.tsx:53-59` (view, dates, filters, page in `useState`)
- **Evidence:** The only way to reach the detail page is a notification (`src/components/dashboard/NotificacionesBell.tsx:101`). The list rows do not link to it.
- **User impact:** From a "Nueva cita" notification the owner lands on a page where they cannot confirm the booking. Going back always resets the list to today with no filters.
- **Fix:** Add the status actions (same sheet as DC-01) to the detail page and link list rows to it. Keep `vista`, `desde`, `hasta`, `empleadoId`, `estado`, `busqueda` and `pagina` in `useSearchParams`, and use `navigate(-1)` when there is history.

### DC-17: Toasts are not announced, disappear after 3.5s including errors, and cannot carry an Undo action
- **Status:** Open
- **Heuristic:** WCAG 4.1.3 Status Messages; H3 (undo); microinteractions feedback
- **Location:** `src/components/ui/ToastContainer.tsx:94-123` (no `role="status"` / `aria-live`, close button without `aria-label`), `src/store/toastStore.ts:19-25` (fixed 3500ms, no action field)
- **User impact:** Screen-reader users get no confirmation for any dashboard action. Long server error messages vanish before they can be read. Every undo pattern in this report is blocked by the store's shape.
- **Fix:** Add a polite live region (assertive for errors), keep errors until dismissed or 8s, pause on hover/focus, and extend the store with an optional `accion: { etiqueta, onClick }`.

### DC-18: Custom overlays bypass the accessible `Modal`
- **Status:** Partially fixed — employee history sheet and drag-reschedule confirmation now use `Modal`; NotificacionesBell unchanged.
- **Heuristic:** WCAG 2.1.2, 2.4.3, 4.1.2
- **Location:** `src/pages/dashboard/InicioPage.tsx:912-973` (employee client-history sheet, close button without label); `src/pages/dashboard/CitasPage.tsx:1324-1335` (drag-reschedule confirmation); `src/components/dashboard/NotificacionesBell.tsx:95-104` (`li` with `onClick`, not focusable), `:52-60` (no Escape)
- **User impact:** No `role="dialog"`, focus trap, initial focus or Escape. Keyboard users cannot open a notification.
- **Fix:** Use `Modal` (Radix Dialog) for the two dialogs, Radix `Popover` for the bell, and render notification items as buttons or links.

### DC-19: Form fields are not programmatically labeled and errors are not linked
- **Status:** Partially fixed — 2FA code field has `id`, `autoComplete="one-time-code"` and linked error; reschedule reason field labelled. No `Campo` primitive.
- **Heuristic:** WCAG 1.3.1, 3.3.1, 3.3.2; H9
- **Location:** `src/pages/dashboard/CitasPage.tsx:836-877`, `:1094-1150`, `:1303-1308`, `:1375-1423` (`<label>` without `htmlFor`, inputs without `id`); `src/pages/dashboard/MiPerfilPage.tsx:258-304` (also password toggles with `tabIndex={-1}` and no `aria-label`), `:406-411`; `src/pages/dashboard/DosFactoresPage.tsx:79-88` (no `autoComplete="one-time-code"`, not in a `<form>`, so Enter does nothing); `src/pages/dashboard/PagosPage.tsx:874-905`, `:1026`, `:1086-1149`
- **User impact:** Screen readers announce unnamed fields. Errors are not tied to inputs (`aria-invalid`, `aria-describedby`). Keyboard users cannot reveal passwords. 2FA codes cannot be autofilled from SMS/OS or submitted with Enter.
- **Fix:** Create one `Campo` primitive (label + input + hint + error with generated ids) and migrate these forms. Move the ad-hoc `useState` forms in `CitasPage` to react-hook-form + zod like `MiPerfilPage`.

### DC-20: Off-system colors for primary actions and row tools
- **Status:** Partially fixed — reschedule/complete CTAs and "Guardar cierre" are slate; row tools neutral. Chart/employee palettes unchanged.
- **Principle:** Project rule (primary is slate); Refactoring UI "systems over one-offs"; impeccable Theming
- **Location:** `src/pages/dashboard/CitasPage.tsx:1211`, `:1225`, `:1331` (violet reschedule CTA), `:922` (blue-600 complete), `:700-794` (green, blue, violet, slate, yellow, emerald, indigo, cyan and amber icon buttons in one row); `src/pages/dashboard/PagosPage.tsx:990` (blue-600 "Guardar cierre"), `:1162` (emerald "Confirmar pago"); `src/pages/dashboard/InicioPage.tsx:494-519` (violet/teal chart); `src/components/ui/NotificacionBanner.tsx:38`; `src/components/dashboard/GanttCitas.tsx:32-35`, `KioskPage.tsx:11-14` (employee hex palette), `KioskPage.tsx:87` (`#060C1A`, indigo)
- **User impact:** Nine hues in one toolbar compete with the status colors that should carry meaning (DC-06). Primary buttons change color per modal, so "the button that commits" is not recognizable.
- **Fix:** Use `BotonAccion` / slate primary for every commit button; reserve the destructive token for destructive actions only; render row tools neutral (slate) with the color carried by status only. Move chart and employee colors into a documented categorical palette token set.

### DC-21: Labels and metadata use micro sizes and low-contrast grays
- **Status:** Partially fixed — InicioPage section labels raised to 12px muted-foreground; KPI tile labels and kiosk text unchanged.
- **Principle:** Refactoring UI contrast; WCAG 1.4.3
- **Location:** `src/pages/dashboard/InicioPage.tsx:29` (`text-[9px] sm:text-[10px]` slate-400 KPI labels, about 2.6:1; `dark:text-gray-500` about 3.0:1), `:425`, `:442`, `:759-771`, `:858` (`text-slate-300`); `src/layouts/DashboardLayout.tsx:67`, `:110` (red-500 "Cerrar sesión", about 3.8:1); `src/pages/dashboard/CitasPage.tsx:584`, `:600`; `src/pages/dashboard/KioskPage.tsx:95`, `:139`, `:156`, `:209`, `:240-251` (white at 20–35% on `#060C1A`, about 1.9–2.6:1)
- **User impact:** KPI labels, phone numbers and the kiosk's secondary text are hard to read, especially on a wall-mounted reception screen seen from a distance.
- **Fix:** Set a 12px floor for text and use slate-500/`text-muted-foreground` as the lightest informative gray (4.5:1 on white). In the kiosk, use at least white/60 for information text.

### DC-22: Touch targets under 44px on core controls
- **Status:** Partially fixed — row actions, drawer/menu/avatar buttons, Pagos revert/Cobrar, MiPerfil camera, retiro remove at 44px. Calendar toggle and Gantt toolbar unchanged.
- **Heuristic:** impeccable Responsive; WCAG 2.5.8
- **Location:** `src/layouts/DashboardLayout.tsx:515`, `:540`, `:586` (32px menu and avatar); `src/pages/dashboard/CitasPage.tsx:656`, `:663`, `:671` (28px mobile row actions); `src/pages/dashboard/InicioPage.tsx:602` (28px WhatsApp); `src/pages/dashboard/PagosPage.tsx:1280`, `:1335` (about 21px revert); `src/pages/dashboard/MiPerfilPage.tsx:219` (28px camera); `src/components/dashboard/CalendarioCitas.tsx:186-207` (about 26px week/day toggle); `src/components/dashboard/GanttCitas.tsx:130-154`
- **Fix:** Apply the existing `min-h-[44px] lg:min-h-[36px]` convention used by `BotonAccion`, `Tabs` and `Pagination`, or extend the hit area with padding while keeping the icon size.

### DC-23: The calendar opens in week view on phones
- **Status:** Open
- **Heuristic:** impeccable Responsive
- **Location:** `src/components/dashboard/CalendarioCitas.tsx:45` (`useState("semana")`), `:220-306`
- **Evidence:** Seven day columns plus a 48px hour column at 375px leaves about 46px per day for truncated `text-xs` blocks.
- **Fix:** Default to "día" below `sm`, remember the choice per device, and use swipe or arrows to change day.

### DC-24: Money is formatted inconsistently, and Pagos KPIs overflow on phones
- **Status:** Open
- **Principle:** H4 Consistency; Refactoring UI
- **Location:** `src/pages/dashboard/PagosPage.tsx:489-509` (`grid-cols-3 gap-4` with `text-2xl` amounts), `:494`, `:500`, `:681`, `:810`, `:1266`, `:1321` (`$${n.toFixed(2)}`: no thousands separator); elsewhere `formatPrecio`, `toLocaleString`, `formatPrecioCorto` (`InicioPage.tsx:44-47`, duplicated at `:773-775`, `:795-797`)
- **User impact:** "$12345.00" on one screen and "$12,345" on another. At 375px three `text-2xl` amounts do not fit in roughly 100px columns.
- **Fix:** Use `formatPrecio` everywhere (with a compact variant for tiles), and stack Pagos KPIs (`grid-cols-1 sm:grid-cols-3`) or reduce them to `text-xl` on mobile.

### DC-25: The pending-confirmation signal appears only in the mobile header and cannot be clicked
- **Status:** Open
- **Heuristic:** H4 Consistency; H7 Efficiency
- **Location:** `src/layouts/DashboardLayout.tsx:531-537` (chip inside a Tooltip, `cursor-default`), `:580-598` (desktop topbar has no equivalent), `:421-427` (sidebar count is hidden when collapsed), `:248-254` (toast only counts increases of today's pending)
- **User impact:** On desktop the owner has no persistent "3 pendientes" cue. On mobile the cue does not lead to the list.
- **Fix:** Show the same chip in both headers and make it a link to `/dashboard/citas?estado=Pendiente` (needs DC-16). Show a dot on the collapsed sidebar icon.

### DC-26: Motion restarts and loops without reduced-motion support
- **Status:** Partially fixed — `animate-pulse` removed from EstadoBadge. AnimatedCounter unchanged.
- **Principle:** microinteractions (feedback matches significance); impeccable motion sensitivity
- **Location:** `src/components/ui/AnimatedCounter.tsx:13-25` (animates from 0 whenever `to` changes, which happens on the 30s polling of `InicioPage.tsx:261-266`; renders "0" first for screen readers); `src/components/ui/EstadoBadge.tsx:21` (`animate-pulse` on every Confirmada badge); `src/pages/dashboard/InicioPage.tsx:350-365`, `:426-456` (stagger on every visit)
- **User impact:** Numbers jump back to zero during a refresh; dozens of pulsing icons in a list pull attention to the calmest state.
- **Fix:** Animate from the previous value, skip animation under `useReducedMotion()`, and drop the pulse (or keep it only on "En curso").

### DC-27: The 60-minute inactivity logout is silent, and scrolling the content does not count as activity
- **Status:** Open
- **Heuristic:** H1 Visibility; H3 User control
- **Location:** `src/hooks/useInactividadTimeout.ts:3-19`; `src/layouts/DashboardLayout.tsx:279`, `:575-578`
- **Evidence:** `scroll` is listened to on `window`, but the dashboard scrolls inside `<main className="overflow-y-auto">`, whose scroll events do not bubble.
- **User impact:** A receptionist reading the agenda gets logged out mid-task with no warning, losing a half-filled payment or appointment form.
- **Fix:** Show a "Tu sesión se cerrará en 1 minuto · Seguir conectado" dialog before logging out. Listen for `scroll` with `capture: true` or on `main`.

### DC-28: The kiosk has no loading or error state, does not distinguish pending appointments, and shows full client names — DECISION NEEDED
- **Status:** Partially fixed — kiosk chips use the status map, so Pendiente and Confirmada differ. Loading/error states and client identity (DECISION NEEDED) open.
- **Heuristic:** H1 Visibility; privacy
- **Location:** `src/pages/dashboard/KioskPage.tsx:46-58` (no `isLoading`/`isError`), `:113-116`, `:154-157` (a failed fetch reads as "No hay empleados activos" / "Sin citas"), `:192-200` (Pendiente and Confirmada share the same white/35 chip), `:204-208` (full client name)
- **User impact:** On a network failure the reception board looks like an empty day. Staff cannot tell confirmed from unconfirmed. Waiting clients can read other clients' full names.
- **Fix:** Add loading and "Sin conexión · reintentando" states with the last-updated time; use the status tokens (DC-06). **DECISION NEEDED** — what client identity the kiosk may show (full name, first name + initial, or code only), and whether it stays read-only or supports check-in.

### DC-29: Employees have no way to reach 2FA, and 2FA offers no recovery codes — DECISION NEEDED
- **Status:** Open – DECISION NEEDED
- **Heuristic:** H6 Recognition; H3 User control
- **Location:** `src/layouts/DashboardLayout.tsx:120-125` (`NAV_EMPLEADO` has no `/dashboard/seguridad`; route allows Empleado at `src/App.tsx:118`); `src/pages/dashboard/MiPerfilPage.tsx` (no link); `src/pages/dashboard/DosFactoresPage.tsx:139-178` (setup ends without backup codes)
- **User impact:** Employees never discover 2FA. Anyone who enables it and loses their phone is locked out.
- **Fix:** Add a "Seguridad" card to Mi perfil (both roles). **DECISION NEEDED** — whether to issue recovery codes (needs backend support) and whether 2FA should be required for owners.

### DC-30: No bulk actions for daily confirmations — DECISION NEEDED
- **Status:** Open – DECISION NEEDED
- **Heuristic:** H7 Flexibility and efficiency of use
- **Location:** `src/pages/dashboard/CitasPage.tsx:582-816` (no row selection), `:331-348` (single-item mutation)
- **User impact:** Confirming the morning's ten pending bookings takes ten separate clicks on desktop and twenty taps on mobile (open modal, choose, confirm).
- **Fix:** **DECISION NEEDED** — which bulk actions to support (likely "Confirmar seleccionadas" and "Enviar recordatorio"). Then add selection checkboxes, a sticky bulk bar, and a backend batch endpoint.

### DC-31: "Cancelar" means two different things in the appointment modals
- **Status:** Partially fixed — the actions sheet labels status actions "Confirmar cita", "Cancelar cita", "Marcar inasistencia" and dismiss buttons "Volver". Other CitasPage modals still say "Cancelar".
- **Heuristic:** H4 Consistency; H5 Error prevention
- **Location:** `src/pages/dashboard/CitasPage.tsx:39`, `:44` (status option "Cancelar"), versus `:888`, `:914`, `:1330`, `:427` (dismiss buttons labeled "Cancelar")
- **User impact:** In the status modal "Cancelar" cancels the appointment; in every neighboring modal it closes the dialog. This invites the wrong action under time pressure.
- **Fix:** Label status actions with their object: "Cancelar cita", "Marcar inasistencia", "Confirmar cita". Label dismiss buttons "Cerrar" or "Volver" where the modal edits an appointment.

### DC-32: Error states ask the user to reload instead of offering a retry
- **Status:** Partially fixed — InicioPage error states have "Reintentar" wired to `refetch`. Gantt and Citas list still lack error states.
- **Heuristic:** H9 Error recovery
- **Location:** `src/pages/dashboard/InicioPage.tsx:382` (`window.location.reload()`), `:832`, `:892`, `:934` ("Recarga la página." with no button); `src/components/dashboard/GanttCitas.tsx:91-96`, `:170-177` (no error state); `src/pages/dashboard/CitasPage.tsx:119-134` (list query has no error state: a failure shows "No hay citas en este rango")
- **User impact:** A transient failure reads as "no appointments", the most misleading message possible for a scheduling tool.
- **Fix:** Show an inline error with a "Reintentar" button wired to the query's `refetch`, in every list and on the home screen.

### DC-33: Low-stakes deletions have no confirmation or undo
- **Status:** Open
- **Heuristic:** H3 User control
- **Location:** `src/pages/dashboard/MiPerfilPage.tsx:448-455` (delete time block, `title` only), `src/pages/dashboard/CitasPage.tsx:954-961` (delete note), `src/components/dashboard/NotificacionesBell.tsx:119-131`
- **User impact:** Deleting a time block reopens that period for online booking at once; a mis-tap can produce bookings during the employee's absence.
- **Fix:** An undo toast (DC-17) is enough for all three; add an accessible label to the icon buttons.

---

## Severity 1: Cosmetic

### DC-34: Copy and terminology refinements
- **Status:** Open
- **Principle:** Krug "get rid of half the words"; H4 Consistency; project rule (neutral professional Spanish)
- **Location:**
  - Hard-coded terms that ignore `useSectorTerms`: "Profesional" (`CitasPage.tsx:367`, `:587`, `:909`, `:1007`), quick actions "Citas/Servicios/Clientes" (`InicioPage.tsx:357-360`), "Mis citas" (`DashboardLayout.tsx:122`), "cita/citas" (`CalendarioCitas.tsx:322`, `GanttCitas.tsx:157`)
  - Gendered or informal wording: "otra clienta" (`CitasPage.tsx:256`), "de la cliente" (`:851`, `:881`), "¡disfruta el día!" (`InicioPage.tsx:834`)
  - English in the UI: `sr-only` "Close" (`src/components/ui/dialog.tsx:47`)
  - Typographic arrows as decoration: "Continuar →", "← Atrás", "Abrir imagen completa →"
- **Fix:** Apply the edits; run `impeccable clarify` across the dashboard once.

### DC-35: Emoji used as interface icons
- **Status:** Partially fixed — 🧾, ⚠ (CitasPage) and 📅 (InicioPage) replaced with lucide icons.
- **Principle:** impeccable craft floor
- **Location:** `CitasPage.tsx:488` (🖥), `:640` (🧾), `:878`, `:1136`, `:1410` (⚠); `InicioPage.tsx:543` (📅); `NotificacionesBell.tsx:106` (🗓 ❌); `KioskPage.tsx:200` (● ✓)
- **Fix:** Use lucide `Monitor`, `Receipt`, `AlertTriangle`, `CalendarDays`, `XCircle`, `Check` (already a dependency), with text where meaning matters.

### DC-36: Three color vocabularies mixed in the same screens
- **Status:** Open
- **Principle:** impeccable Implementation integrity
- **Location:** `PagosPage.tsx:490-509` (shadcn `bg-card`/`text-muted-foreground`) next to `:677-700` (`bg-slate-800`, `text-gray-500`, `text-teal-600`); `gray-*` and `slate-*` alternate inside single components (`InicioPage.tsx:615-656`, `CitasPage.tsx` modals, `PagosPage.tsx:874-905` `dark:bg-gray-800`)
- **Fix:** Standardize on shadcn tokens for surfaces and text and slate for the rest; gray should disappear from the dashboard. Fold this into the DC-11 theming pass.

---

## What Works Well

- **A real shared system is emerging:** `EncabezadoPagina`, `BotonAccion`/`EnlaceAccion`, `Tabs`, `Pagination` and `FiltroBarra` provide 44px mobile / 36px desktop targets, visible focus rings, dark variants and comments explaining each decision (`src/components/ui/BotonAccion.tsx:134-150`, `Tabs.tsx:17-36`, `Pagination.tsx:13-18`).
- **Filters behave correctly:** every filter change returns to page 1 (`CitasPage.tsx:361-397`), one `limpiarFiltros` handler serves both the bar and the empty state, and `EmptyState` distinguishes "sin resultados" from "vacío". Payment filtering and search run on the server rather than on one page (`PagosPage.tsx:128-145`).
- **Local date utilities exist and are documented** (`src/utils/fechas.ts`) and are already used by Citas and Pagos filters. DC-04 only needs them adopted everywhere.
- **Per-row pending state:** only the row being confirmed is disabled (`CitasPage.tsx:108-109`, `:698-699`), and drag-to-reschedule asks for confirmation with a human-readable date (`:544-550`, `:1324-1335`).
- **Cash handling is thoughtful:** split payments, change calculation, deposit pre-fill (`PagosPage.tsx:605-611`), receipt ticket with email, a transparent "Inicio + Cobrado − Retiros" closing formula, and KPIs computed for the whole period rather than the visible page.
- **Shell details:** collapsed sidebar is persisted and every collapsed item has a tooltip; safe-area insets are handled; route-scoped theming keeps public pages light (`src/lib/temaPorRuta.ts`); `--barra-accion` keeps toasts and scroll-padding clear of sticky bars.
- **Data freshness:** 30-second polling with `placeholderData` keeps lists current without flashing, and polling stops on Pagos tabs that do not need it.
- **Employee time blocks** respect business hours and existing appointments (`MiPerfilPage.tsx:117-160`), with zod validation of the minimum duration.
- **Sector vocabulary** (`useSectorTerms`) is already wired into most titles, toasts and empty states.

## Decisions Needed From the Owner

1. **DC-03:** Keep a distinct color scheme for the "salud" sector (then tokenize it) or remove it.
2. **DC-13:** How kiosk mode is secured (exit PIN/password, or a restricted kiosk role/token).
3. **DC-14:** The Empleado permission matrix for Citas and Pagos (export, revert payment, deposits, cash closing, global client edits).
4. **DC-28:** What client identity the kiosk may display, and whether the kiosk supports check-in.
5. **DC-29:** Recovery codes for 2FA (backend), and whether 2FA is required for owners.
6. **DC-30:** Which bulk actions to support in Citas.

## Recommended Order of Work

1. **DC-04, DC-08, DC-32:** correctness and feedback bugs with small, contained fixes.
2. **DC-01, DC-05, DC-15, DC-16, DC-31:** one appointment action sheet reused by list, calendar, Gantt, home and detail; filters in the URL. Do these together.
3. **DC-02, DC-11, DC-06, DC-36:** theming pass (`impeccable colorize`): dark mode on every surface, one status map on the semantic tokens.
4. **DC-07, DC-17, DC-33:** toast store with actions and live region, then undo for financial and destructive actions.
5. **DC-09, DC-10, DC-18, DC-19, DC-22:** accessibility pass (`impeccable harden`).
6. **DC-03, DC-13, DC-14, DC-28, DC-29, DC-30:** after the owner's decisions.
7. Remaining minor and cosmetic items, then `impeccable polish`. Verify in a rendered build at 375px and 1280px, in light and dark mode, as Propietario and as Empleado, before closing.

## Out-of-Scope Observation (security)

`src/pages/dashboard/PagosPage.tsx:283-332` builds the cash-closing print HTML by interpolating `negocio.nombre` and employee names without escaping and writes it with `document.write` into a same-origin `about:blank` window. A name containing markup would execute in the app's origin. This is not a UX finding and is not counted above; route it to a `review-risk` pass.

- **Status:** Fixed (pending commit). New `src/utils/html.ts` (`escapeHtml`). The cash-closing document is built by `src/utils/impresionCorte.ts` with every interpolated value escaped. The same pattern was found and fixed in `src/components/dashboard/TicketRecibo.tsx` (client name from public booking, business name/logo) and `src/pages/admin/NegociosAdminPage.tsx` (subscription receipt, now `src/utils/comprobanteSuscripcion.ts`). Tests in `html.test.ts`, `impresionCorte.test.ts`, `comprobanteSuscripcion.test.ts`, `TicketRecibo.test.tsx` prove `<img src=x onerror=alert(1)>` renders as text. No `innerHTML`/`dangerouslySetInnerHTML` sinks in `src/`.
