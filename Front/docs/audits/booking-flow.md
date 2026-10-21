# Audit: Public Booking Flow

- **Date:** 2026-10-20
- **Status:** Findings only. No code has been changed. Fixes wait for approval (see `CLAUDE.md` > Screen Audits).
- **Type:** Code-based audit. **Nothing was rendered.** No browser, screenshots, emulated viewports or assistive technology were used. Contrast ratios are calculated from the Tailwind/hex values in the source. Layout and touch behavior are inferred from class names. Verify visual findings in a running build before fixing them.

## Scope

| Route | Entry file | Rendered components reviewed |
| --- | --- | --- |
| `/b/:slug` | `src/pages/publico/BookingPage.tsx` | `IndicadorPasos`, `PasoServicio`, `FilaSeleccion`, `PasoEmpleado`, `PasoFechaHora`, `PasoDatosCliente`, inline `IntakeCampoInput`, `HojaClienteExistente`, `GaleriaSection`, `GaleriaDesktop`, `GaleriaViewer`, `ResenasSection`, coupon block |
| `/b/:slug/confirmacion/:codigo`, `/cita/:codigo` | `src/pages/publico/ConfirmacionPage.tsx` | Receipt, "¿Qué sigue?" timeline, deposit panel, calendar/share actions, reschedule (`PasoFechaHora` reused), cancel |

Supporting code read: `src/App.tsx` (routes), `index.html` (theme bootstrap), `src/index.css`, `tailwind.config.js`, `docs/design-system.css`, `src/lib/colorUtils.ts` (`brandAccent`/`brandSolid`), `src/utils/formatters.ts`, `src/utils/fechas.ts`.

Out of scope: `PublicFooter`, `MisCitasPage`, `CancelarCitaPage`, `ListaEsperaPublicaPage`, backend behavior.

## Method

- **ux-heuristics:** Nielsen's 10 heuristics and Krug's principles. Each issue gets a severity from 0 to 4 (4 = blocks the task, 3 = major, 2 = minor, 1 = cosmetic). Frequency, impact and persistence are weighed.
- **refactoring-ui:** hierarchy, spacing and type scale, color and contrast, depth, consistency.
- **impeccable `audit`:** technical checks on accessibility, theming, responsive design and implementation integrity. The surface mode is **Operate**: the visitor is trying to finish a task.
- **microinteractions:** loading, feedback and transition states.
- **Project rules** from `CLAUDE.md`: primary is slate, gold `#C8A961` is for the logo only, status colors must be semantic tokens, every screen works in light and dark mode, and public pages are mobile-first.

Line numbers point to the current working tree.

## Summary

| Severity | Count | IDs |
| --- | --- | --- |
| 4 Catastrophic | 0 | — |
| 3 Major | 9 | BF-01 … BF-09 |
| 2 Minor | 13 | BF-10 … BF-22 |
| 1 Cosmetic | 5 | BF-23 … BF-27 |
| **Total** | **27** | |

| Framework | Score | Main reasons |
| --- | --- | --- |
| Nielsen / Krug (ux-heuristics) | **6 / 10** | Back navigation (H3), confirmation status shown wrongly (H1/H2), no availability shown per day (H6/H7), errors not announced (H9) |
| Refactoring UI diagnostic | **6 / 10** | Contrast fails on informative text, mixed px values (`text-[9px]`, `text-[10px]`), selection patterns differ between steps |
| impeccable audit health | **12 / 20 (Acceptable)** | A11y 2, Performance 3, Theming 1, Responsive 3, Integrity 3 |

**Implementation integrity verdict: pass, with gaps.** The flow has a real point of view. It derives brand colors with contrast guarantees, reuses one fixed action bar for every step, recognizes returning clients and recovers when a slot is taken. These are deliberate product decisions, not template output. The gaps are systemic rather than one-off: no dark mode, labels not linked to inputs, hard-coded hex values, and low-contrast "secondary" grays used for information the user actually needs.

---

## Severity 3: Major

### BF-01: The browser or OS back gesture leaves the wizard and loses all progress
- **Heuristic:** H3 User control and freedom ("back buttons must never break")
- **Location:** `src/pages/publico/BookingPage.tsx:570`, `:694-720`
- **Evidence:** The step is local state (`const [paso, setPaso] = useState(1)`). `irSiguiente` and `irAtras` only call `setPaso` and never add a history entry or a URL param.
- **User impact:** On mobile, the Android back button or iOS edge swipe is the default way to go back. Using it on step 3 or 4 leaves `/b/:slug` and throws away the service, staff member, slot and form data.
- **Fix:** Put the step in the URL (`?paso=3`, or `useSearchParams` with `push`), so browser Back matches the on-screen "Atrás". When the visitor lands directly on a later step, check the prerequisites (service, staff member, slot) and fall back to the first incomplete step.

### BF-02: Going back discards data the user already entered
- **Heuristic:** H3 User control and freedom; H5 Error prevention
- **Location:** `BookingPage.tsx:712` (`setRespuestasIntake({})` when leaving intake), `:718` (`setSlot(null)` when leaving step 3), `:719` (clears staff member and intake when leaving step 2). `PasoDatosCliente` keeps its fields in `useForm` (`src/components/booking/PasoDatosCliente.tsx:49`), and that state is lost when the step unmounts.
- **User impact:** A visitor who goes back from step 4 to check the time loses name, phone, email and notes. A visitor who goes back from intake loses every answer. Each "Atrás" costs them their work, so they learn not to use it.
- **Fix:** Move the step-4 form values and intake answers into `BookingPage` state (or a small Zustand store) and pass them in as `defaultValues`. Only clear choices that later steps depend on, and only when the user actually changes the earlier choice (for example, a new service invalidates the staff member). Moving between steps should not clear anything.

### BF-03: Focus and scroll position are not managed between steps
- **Heuristic:** H1 Visibility of system status; WCAG 2.4.3 Focus Order, 4.1.3 Status Messages
- **Location:** `BookingPage.tsx:695` and `:708` (`(document.activeElement as HTMLElement)?.blur()`), `:1164-1176` (animated step container). The booking flow never calls `scrollTo` or `focus()` on a heading.
- **User impact:** After "Continuar", keyboard focus drops to `<body>` and screen readers say nothing about the new step. On mobile the window keeps its scroll position, so a visitor who picked a service far down a long list lands below the heading of step 2.
- **Fix:** After each step change, scroll the step container to the top and move focus to the step's `<h2>` (`tabIndex={-1}`). Pair this with a visually hidden `aria-live="polite"` region that announces "Paso 2 de 4: ¿Con quién?". Respect `useReducedMotion` for the scroll.

### BF-04: The confirmation page says "¡Cita confirmada!" when the appointment is still pending
- **Heuristic:** H1 Visibility of system status; H2 Match with the real world
- **Location:** `src/pages/publico/ConfirmacionPage.tsx:218` (fixed `¡Cita confirmada!`), `:356` (timeline step 1 always says "Cita confirmada"), conflicting with `:289` ("⏳ Pendiente confirmación") and `:409` ("Para confirmar tu cita, realiza un pago…"). `:370` always promises "Te avisamos 24h antes por WhatsApp o correo", even when no email was given (`:227`).
- **User impact:** The page contradicts itself. When the business does not auto-confirm, or a deposit is required, the visitor may think the booking is final, skip the payment, and lose the slot.
- **Fix:** Choose the headline, icon and timeline step 1 from `cita.estadoTexto` and `requiereAnticipo`. Example: "¡Cita agendada!" with "Pendiente de confirmación del negocio", or "Falta tu anticipo". Make the reminder line depend on the channels that actually exist, for example "Te avisaremos por correo" only when an email was provided.

### BF-05: The date picker builds `YYYY-MM-DD` with `toISOString()`, which converts to UTC and can shift the day
- **Heuristic:** H5 Error prevention; H1 Visibility of system status
- **Location:** `src/components/booking/PasoFechaHora.tsx:28-30` (`d.toISOString().slice(0, 10)`), used for the slots query key (`:87`, `:92`) and for the "today" marker (`:141`, `fechaISO(new Date())`).
- **Evidence:** `src/utils/fechas.ts:6-8` already documents this exact bug and provides `fechaLocal()`. The picker does not use it.
- **User impact:** In Mexico (UTC-6) after 18:00, `fechaISO(new Date())` returns tomorrow, so the "today" ring appears on the wrong day. For any visitor in a timezone ahead of UTC, local midnight converts to the previous UTC day, so tapping a day fetches the previous day's availability.
- **Fix:** Replace `fechaISO` with `fechaLocal` from `src/utils/fechas.ts`. Add a test that mocks the system time at 19:00 UTC-6.

### BF-06: Visitors must tap each day blindly to find availability, and the empty state is a dead end
- **Heuristic:** H6 Recognition rather than recall; H7 Flexibility and efficiency; Krug: "each click should be confidence-building"
- **Location:** `PasoFechaHora.tsx:137-177` (day cards show no availability signal), `:197-206` (empty state: "Sin disponibilidad / Prueba con otro día de la semana"). The waitlist link is buried in `BookingPage.tsx:1281-1290` as `text-xs text-slate-400` and is shown whether or not slots exist.
- **User impact:** For a busy business, a visitor may tap 5 to 10 days, each one a network round trip with a spinner, before finding a slot. The empty state does not offer the next available date or the waitlist.
- **Fix:** Add a week-level availability endpoint, or prefetch the visible week, and mark days as unavailable (dimmed, not disabled) or show a dot for available days. Auto-select the first available day when the step opens. In the empty state, offer "Próximo disponible: jueves 23" as a button, plus the waitlist link. Remove the always-visible link at `:1281`.

### BF-07: Public pages have no dark mode, but `index.html` turns on `.dark` from the OS setting
- **Principle:** `CLAUDE.md` "Every UI change must work in light AND dark mode"; impeccable Theming
- **Location:** `index.html:7-9` adds `dark` to `<html>` on every route when the OS prefers dark. `src/index.css` paints `html, body, #root` with `hsl(var(--background))`, which is dark under `.dark`. `BookingPage.tsx` and every `Paso*.tsx` contain **0** `dark:` classes. `ConfirmacionPage.tsx` has 3, only at `:255-256` and `:445`.
- **User impact:** Visitors with a dark OS get a light page inside a dark document background (overscroll, safe-area and keyboard edges), and a few components on the confirmation page switch to dark styles inside light cards. The rule in `CLAUDE.md` is not met for the most-visited public surface.
- **Fix:** Pick one deliberately. Either (a) implement dark mode for the booking surface using the existing shadcn HSL tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) instead of literal `slate-*`/`white`/hex values, or (b) if public pages are intentionally light-only, scope them with a wrapper that resets the tokens and sets `color-scheme: light`, and record that exception in `CLAUDE.md`. Option (a) matches the current rule.

### BF-08: Form labels are not linked to their inputs, and errors are not linked to fields
- **Heuristic:** H9 Help users recognize errors; WCAG 1.3.1, 3.3.1, 4.1.2
- **Location:** `PasoDatosCliente.tsx:136`, `:198`, `:214`, `:239` (`<label>` without `htmlFor`, inputs without `id`); error text at `:151-153`, `:208-210`, `:228-229` has no `aria-describedby` and fields have no `aria-invalid`. `BookingPage.tsx:484-489` (`IntakeCampoInput` label without a link to its `select`/`textarea`/`input`), `:1385-1393` (coupon input labelled only by its `placeholder="PROMO20"`).
- **User impact:** Screen readers announce unnamed "edit text" fields. Tapping a label does not focus its field. Errors are signalled mainly through a red border.
- **Fix:** Use `useId()` per field, add `htmlFor`/`id`, add `aria-invalid={!!errors.x}` and `aria-describedby` that points to the error `<p>`, and set `aria-required` on required fields. Give the coupon input a visible or `sr-only` label "Código de descuento". Consider the shadcn `Form`/`Label` primitives in `src/components/ui`, per the "reuse primitives" rule.

### BF-09: Information users need is shown in text that fails WCAG contrast
- **Principle:** Refactoring UI color/contrast; WCAG 1.4.3 (4.5:1) and 1.4.11 (3:1)
- **Location and approximate ratios:**
  - `BookingPage.tsx:1327`: "pendiente de confirmación" notice, `text-xs text-slate-400` on slate-50 (about 2.4:1)
  - `FilaSeleccion.tsx:70`: service descriptions, `text-slate-400` on white (2.6:1)
  - `PasoFechaHora.tsx:166`: weekday labels, `text-[9px] text-slate-400` (2.6:1, and 9px is below any readable size)
  - `ConfirmacionPage.tsx:370`, `:382`: timeline text `text-slate-300`, **including the appointment date** (1.5:1)
  - `ConfirmacionPage.tsx:543`: "Cancelar cita" `text-red-400` (2.8:1); `:556` restriction notice `text-red-400`
  - `ConfirmacionPage.tsx:272`: "Código de confirmación" label `rgba(255,255,255,0.35)` on `#0C0C0F` (about 3.2:1)
  - `IndicadorPasos.tsx:35`: "N de M" counter `rgba(255,255,255,0.35)` on `#18181B` (about 3.2:1)
  - `PasoDatosCliente.tsx:231`: no-email warning `text-amber-600` (3.2:1); error text `text-red-500` (3.8:1) at `:152`, `:209`, `:229`
- **User impact:** On a phone outdoors or at low brightness, users cannot read the date, the pending status, the cancel option or validation errors.
- **Fix:** Use `slate-500` as the lowest tone for secondary text on white, and `slate-600` for anything the user must act on or remember. Use `red-600`/`amber-700` for messages. Use at least `rgba(255,255,255,0.7)` on the dark bands. Use `text-xs` (12px) as the smallest size. Timeline "future" steps can be signalled with a hollow icon instead of faded text.

---

## Severity 2: Minor

### BF-10: The progress indicator has no step names, is invisible with the default brand color, and its total changes mid-flow
- **Heuristic:** H1 Visibility; Krug "Step 2 of 4: Shipping details"
- **Location:** `src/components/booking/IndicadorPasos.tsx:16-38`: the `pasos` labels are passed in but never rendered, and bars use the raw brand `color` on `#18181B`. `BookingPage.tsx:887-892`: the intake query only runs after a service is chosen (`:638`), so the total changes from "1 de 4" to "1 de 5".
- **User impact:** With the default `#334155`, the active bars reach about 1.7:1 against the strip, so the progress is nearly invisible. Users cannot see what comes next, and the moving total looks like a glitch.
- **Fix:** Render the current step label ("Paso 2 de 4 · Profesional"). Use a light accent (for example `white/80`, or `brandAccent` calculated against dark) for the bars. Expose `aria-label="Paso 2 de 4: …"` or a `<ol>` with `aria-current="step"`. Decide whether intake exists from the service data, so the total is stable from step 1.

### BF-11: The summary's "Total a pagar" ignores an applied discount, and prices use two formats
- **Heuristic:** H4 Consistency; H1 Visibility
- **Location:** `PasoDatosCliente.tsx:326-329` always shows `formatPrecio(servicio.precio)`. The coupon block renders below it (`BookingPage.tsx:1350-1371`) and builds its own string: `` `$${descuentoAplicado.valor}` `` and `(…).toFixed(2)`, where everything else uses `formatPrecio` (es-MX, MXN).
- **User impact:** After applying a code, the dark summary card still shows the full price right above the green "precio final". This creates doubt at the moment of commitment.
- **Fix:** Pass the discount into `PasoDatosCliente`, show the original price struck through plus the final total in the summary, and format every amount with `formatPrecio`. Move the coupon trigger above the summary.

### BF-12: Submission errors are not announced and may appear off-screen
- **Heuristic:** H9 Recognize and recover from errors; WCAG 4.1.3
- **Location:** `PasoDatosCliente.tsx:250-260` (error box inside the form, above the policies and summary, with no `role="alert"`). The submit button is in the fixed bar (`BookingPage.tsx:986-1000`). The slot-taken banner at `BookingPage.tsx:1239-1246` also has no live region.
- **User impact:** The user taps "Confirmar cita" at the bottom of the screen, the button returns to its normal state, and nothing visible changes near it. Screen reader users hear nothing.
- **Fix:** Add `role="alert"` to both error boxes, and scroll the error into view or move focus to it on failure. A short inline status in the action bar ("No se pudo agendar · ver detalle") is also an option.

### BF-13: The "slot no longer available" banner is never cleared
- **Heuristic:** H1 Visibility (stale status)
- **Location:** `BookingPage.tsx:603`, `:784`. `setErrorSlotTomado` is only ever called with a message, never with `""`.
- **User impact:** After picking a new slot, and even after going forward and coming back, the red banner keeps saying the slot is gone.
- **Fix:** Clear it in the `onSeleccionar` handler passed to `PasoFechaHora` (`:1250`) and when the user leaves step 3.

### BF-14: "Confirmar cita" is disabled without saying why
- **Heuristic:** H1 Visibility; H5 Error prevention (explain constraints)
- **Location:** `BookingPage.tsx:993` (`disabled={enviando || (!!negocio.politicasUrl && !politicasAceptadas)}`). The checkbox is at `PasoDatosCliente.tsx:281-291`, inside the scrolling form.
- **User impact:** On mobile, the checkbox can be off-screen while the faded CTA (`disabled:opacity-40`) is always visible. Users tap a button that does nothing.
- **Fix:** Keep the button enabled. On submit without acceptance, show an inline error on the checkbox and scroll to it. Alternatively, show a one-line hint in the action bar while the button is disabled ("Acepta las políticas para continuar").

### BF-15: Validation copy has gaps: English default messages, an inaccurate phone rule, and intake errors with no text
- **Heuristic:** H9; project convention "UI copy is Spanish"
- **Location:** `PasoDatosCliente.tsx:13`: `.max(15)` has no message, so zod v4 shows its English default. `:15` has the same problem with `notas .max(300)`. `:13`: `.min(10, "Ingresa un teléfono válido de 10 dígitos")` counts characters, not digits, so "12 34 56 7" (7 digits) passes. `:14` "Correo inválido" does not say how to fix it. `BookingPage.tsx:527`, `:546`, `:559`: required intake `select`/`textarea`/`input` only turn the border red, while the checkbox variant (`:506-508`) shows text.
- **Fix:** Add Spanish messages to every rule ("Máximo 15 caracteres", "Máximo 300 caracteres"). Validate digits with `.refine(v => soloDigitos(v).length === 10, …)`. Use "Revisa el formato del correo (ej. nombre@correo.com)". Show "Este campo es obligatorio" under every required intake field. A `maxLength` counter on notes would also help.

### BF-16: Design-token violations: gold review stars and hard-coded status colors
- **Principle:** `CLAUDE.md` design system: gold is for the logo only, status colors are semantic tokens
- **Location:** `BookingPage.tsx:447`, `:460` (`fill="#C8A961" stroke="#C8A961"` on review stars), `:1091` (`#F59E0B` star in the header). `ConfirmacionPage.tsx:283-287` (status badge uses ad hoc `bg-emerald-50 text-emerald-600` / `bg-amber-50 text-amber-600`).
- **Evidence:** The `--status-*` tokens exist only in `docs/design-system.css:50-69`, `:141-155`. They are not defined in `src/index.css` or `tailwind.config.js`, so there is no class to use.
- **Fix:** Use a neutral or `amber-500` rating color, defined as a `--rating` token. Add the `--status-*` tokens to `src/index.css`/`tailwind.config.js` (for example `bg-status-pending-bg text-status-pending-fg`) and use them in the badge. Status text also gains contrast (`yellow-700` instead of `amber-600`).

### BF-17: The confirmation page's action order puts the wrong thing first
- **Heuristic:** H8 Aesthetic and minimalist design (one primary CTA); Refactoring UI button hierarchy; WCAG 2.5.5
- **Location:** `ConfirmacionPage.tsx:455-469` (full-width WhatsApp share is the primary action, white text on `#25D366` at about 2:1). `:474-481` ("Agregar al calendario" is collapsed behind a toggle with no `aria-expanded`). `:528-548` ("Reagendar" and "Cancelar cita" are bare `text-sm` links well under 44px tall).
- **User impact:** The most useful next step, saving the appointment to a calendar, takes two taps and looks secondary. Changing or cancelling is hard to tap. The WhatsApp button text is hard to read.
- **Fix:** Make "Agregar al calendario" the primary action, with Google and Apple shown inline. Make WhatsApp a secondary button (use a darker WhatsApp green such as `#128C7E` or dark text for contrast). Give Reagendar and Cancelar real button styles with `min-h-[44px]`. Add `aria-expanded`/`aria-controls` if the toggle stays.

### BF-18: The confirmation page's error and loading states give no way forward
- **Heuristic:** H9; H1
- **Location:** `ConfirmacionPage.tsx:115-129`: every failure, including network errors, shows "Cita no encontrada". There is no retry, and on `/cita/:codigo` (no `slug`) there is no action at all. `:107-113`: the spinner has no `role="status"` or text.
- **User impact:** A visitor on a weak connection right after booking is told the appointment does not exist and may book again.
- **Fix:** Tell 404 apart from other errors, as `BookingPage` does at `:829-865`. Offer "Reintentar" and "Ver mis citas". Fall back to `cita.negocioSlug` when it is available. Add `role="status"` and visually hidden "Cargando tu cita…".

### BF-19: The reschedule picker ignores the minimum-notice rule
- **Heuristic:** H5 Error prevention; H4 Consistency
- **Location:** `ConfirmacionPage.tsx:568-575` renders `PasoFechaHora` without `diasAnticipacionMinima`, whereas `BookingPage.tsx:1254` passes it.
- **User impact:** Days the business does not accept appear selectable when rescheduling. The visitor learns this only from a server error (`:581-585`), if the backend enforces it.
- **Fix:** Expose `diasAnticipacionMinima` in the appointment payload and pass it through. Show the same cancellation policy line used in step 3.

### BF-20: Controls are unlabeled or too small in the gallery, lightboxes and coupon
- **Heuristic:** WCAG 2.5.5 / 4.1.2; ux-heuristics "tiny tap targets"
- **Location:**
  - `BookingPage.tsx:229-239`: gallery dots are 6px with no `aria-label`
  - `:270`, `:277`: carousel arrows are 32px
  - `:296`, `:408`: lightbox close buttons have no `aria-label`
  - `:291-301`, `:403-437`: lightboxes have no `role="dialog"`, no focus trap and no focus return
  - `:1375-1380`: the coupon "remove" `X` has no label and is about 15px
  - `:1404-1409`: the coupon "Cancelar" is `text-xs`
  - `PasoDatosCliente.tsx:171`, `:179`: suggestion buttons are `min-h-[40px]`
- **Fix:** Use `min-w-11 min-h-11` (44px) for all icon buttons, and add `aria-label` ("Cerrar", "Quitar código", "Ir a la imagen 3"). Reuse the shadcn `Dialog` for the lightboxes so they get focus trap, Escape and focus return.

### BF-21: The selected slot can be active but hidden
- **Heuristic:** H1 Visibility; H6 Recognition
- **Location:** `PasoFechaHora.tsx:50` (`fechaSel` is local and starts as `null`), `:70-83` (changing week clears `fechaSel` but not the parent's slot). `BookingPage.tsx:716-718`: returning from step 4 to step 3 keeps `slot` but `PasoFechaHora` remounts with no date selected.
- **User impact:** "Continuar" is enabled but no day or time is highlighted. The user cannot tell what is selected without reaching step 4.
- **Fix:** Start `fechaSel` and `semanaRef` from `seleccionado?.inicio` when present. Either call `onLimpiarSlot` when changing week, or keep the selected slot's day visible. Show the current selection in the step-3 breadcrumb (`BookingPage.tsx:1147-1161`) as well.

### BF-22: Day and time buttons don't expose their selected state or full date to screen readers
- **Heuristic:** WCAG 4.1.2, 1.4.1 (selection shown only by color)
- **Location:** `PasoFechaHora.tsx:145-174` (day buttons are read as "Lu 12" with no month and no `aria-pressed`), `:219-228` (slot buttons have no `aria-pressed`; selection is shown only by background color).
- **Fix:** Add `aria-pressed={seleccionada}` and `aria-label="lunes 12 de octubre"` (plus ", hoy" when it applies). Wrap the times in `role="group"` with `aria-label` "Mañana"/"Tarde"/"Noche". `FilaSeleccion` already does this well (`aria-pressed`, `FilaSeleccion.tsx:55`).

---

## Severity 1: Cosmetic

### BF-23: Selection patterns differ between steps, and colors are hard-coded hex
- **Principle:** H4 Consistency; Refactoring UI "systems over one-offs"
- **Location:** Step 1 uses `FilaSeleccion` rows (inset ring and check mark). Step 2 uses a different two-column card with `border-2` and no check mark (`PasoEmpleado.tsx:88-124`), and its "Sin preferencia" card is a third variant (`:46-77`). Hex literals: `PasoEmpleado.tsx:50`, `:54`, `:58`, `:65`, `:95`, `:118`; `PasoFechaHora.tsx:225`; `FilaSeleccion.tsx:62`; `IndicadorPasos.tsx:12`; `ConfirmacionPage.tsx:193`, `:209`, `:270`; `BookingPage.tsx:236`.
- **Fix:** Reuse `FilaSeleccion` (with the avatar in `inicio`) for staff, or extract one selectable-card primitive. Replace hex values with tokens. This is also a prerequisite for BF-07.

### BF-24: Emoji used as interface icons
- **Principle:** impeccable craft floor (no generic or emoji iconography in product UI)
- **Location:** `BookingPage.tsx:1074` (🏪 fallback logo), `:1112` (📍 address); `ConfirmacionPage.tsx:256` (✓), `:288-289` (✓, ⏳ inside the status badge).
- **Fix:** Use lucide `Store`, `MapPin`, `Check` and `Clock` (already a dependency). For the fallback logo, use the business initial, consistent with staff avatars.

### BF-25: Copy and wording refinements
- **Principle:** Krug "get rid of half the words"; H4 Consistency
- **Location:**
  - `BookingPage.tsx:1181`: the eyebrow "Reserva tu cita" in slate-400 repeats the `<h2>` right below it
  - `:1298-1301`: "Antes de continuar… / Por favor responde estas preguntas adicionales para tu cita." Suggested: "Unas preguntas rápidas"
  - `:1091-1095`: the header shows a star icon next to "Sin reseñas", which signals a negative; hide the pill when there are no reviews
  - `ConfirmacionPage.tsx:296`: hard-coded "Profesional" where the booking flow uses `getSectorTerms(...).empleado`
  - `PasoEmpleado.tsx:81`: the empty message hard-codes "servicio" instead of `terms.servicio`
- **Fix:** Apply the edits above. Run `impeccable clarify` on the full flow once.

### BF-26: "Mis citas" links reload the whole app
- **Location:** `IndicadorPasos.tsx:43-51`, `ConfirmacionPage.tsx:244-249` use `<a href>` instead of `Link`.
- **Fix:** Use `Link` from `react-router-dom` to avoid a full reload and refetch.

### BF-27: Clipboard failures are silent
- **Heuristic:** H1 Visibility
- **Location:** `ConfirmacionPage.tsx:94`, `:102` (`catch {}`)
- **User impact:** Low on its own, but visitors without an email depend on this link (`:227-235`).
- **Fix:** On failure, show the link in a selectable field, or use `navigator.share` on mobile.

---

## What Works Well

- **One fixed action bar** for the whole wizard, with `env(safe-area-inset-bottom)`, 48px CTAs and a running summary on step 1 (`BookingPage.tsx:45-53`, `:916-1004`). It is placed outside the transformed container on purpose so `position: fixed` still works.
- **Brand color with a contrast guarantee:** `brandAccent`/`brandSolid` (`src/lib/colorUtils.ts:107-126`) keep white CTA text readable whatever color the business picks.
- **Returning-client recognition** (`PasoDatosCliente.tsx:84-121`): the phone field comes first, stale responses are discarded, failures degrade without blocking, and results are announced in an `aria-live` region.
- **Conflict sheet** (`BookingPage.tsx:55-140`): `role="dialog"`, focus trap, Escape, initial focus, reduced-motion variant, and a clear choice between two options.
- **Slot-taken recovery** returns the user to step 3 with an explanation instead of failing (`:778-788`). The 402 limit is handled with its own message.
- **Business error states** distinguish "inactive" (404) from network failure, with retry (`:829-865`). The loading state uses a layout-shaped skeleton.
- **Touch basics:** week arrows `w-11 h-11` and slot buttons `min-h-[44px]`. Inputs are forced to 16px on mobile to prevent iOS zoom (`src/index.css`).
- **Thoughtful details:** services grouped with featured items not duplicated (`PasoServicio.tsx:30-61`), fixed `line-clamp` so rows don't shift on selection, times grouped into Mañana/Tarde/Noche, and the cancellation policy shown next to the slot.
- **Confirmation receipt:** a large monospace code, a print-only receipt layout, deposit upload with a size check, and an inline cancel confirmation with a humane "Mantenerla" option.

## Recommended Order of Work

1. **BF-04, BF-05, BF-13:** correctness bugs with small, contained fixes.
2. **BF-01, BF-02, BF-03, BF-21:** navigation state model (URL step, persistent form state, focus and scroll). Do these together.
3. **BF-08, BF-09, BF-12, BF-20, BF-22:** accessibility pass (`impeccable harden`).
4. **BF-07, BF-16, BF-23:** token migration and dark mode (`impeccable colorize` / `extract`). Needs a decision on option (a) or (b) in BF-07.
5. **BF-06, BF-10, BF-11, BF-14, BF-17:** flow and hierarchy improvements (`impeccable layout` / `clarify`). BF-06 may need a backend endpoint.
6. The remaining minor and cosmetic items, then `impeccable polish`. Verify everything in a rendered build at 375px, in light and dark mode, before closing.
