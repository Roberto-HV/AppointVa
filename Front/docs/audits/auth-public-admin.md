# Audit: Auth, Remaining Public Pages, Landings and Admin

- **Date:** 2026-10-20
- **Status:** Severity-3 batch applied (commit `0153a0a`, 2026-10-21): AP-01, AP-05, AP-06, AP-11, AP-12 fixed; AP-02, AP-03, AP-04, AP-07, AP-08 partially fixed (decision or backend gap, see each Status line); AP-10 open (decision needed). Severity-2 batch (commit `0fcf188`, 2026-10-21, not rendered): AP-13, AP-14, AP-15, AP-17, AP-18, AP-19, AP-20, AP-21, AP-23, AP-25 fixed; AP-09, AP-22, AP-24 only their non-decision or frontend parts; AP-16 open (decision, legal text untouched); AP-10 still open. AP-28 fixed as a side effect. Review follow-ups from 0153a0a (admin concurrent toggles, verification resend and temporary errors, password rules, activation copy, Premium billing note) are closed in the same batch. New shared pieces: `hooks/useTituloPagina.ts`, `components/VolverAtras.tsx`, `components/landing/useFadeInUp.ts`, `utils/errores.ts` (`esErrorTemporal`, `estadoHttp`), `lib/estadoCita.ts` (`CODIGO_ESTADO_CITA`), `utils/negociosAdmin.ts` (`validarEdicionPago`, `esColorHexValido`). Not yet verified in a rendered build. Severity-1 batch and review leftovers (2026-10-21, commit `f4261c0`, not rendered): AP-26 and AP-27 fixed, AP-23 finished (live slug check); resend cooldown is per address (AP-03), booking and confirmation titles use `useTituloPagina` (AP-17), CitaDetalle, 404 and `ErrorBoundary` share the `VolverAtras` rule (AP-15, `hooks/useVolverAtras.ts`), and `CODIGO_ESTADO_CITA` replaced the remaining numeric status checks (AP-18). New shared pieces: `hooks/useVolverAtras.ts`, `hooks/useDisponibilidadSlug.ts`, `lib/clasesAuth.ts`. Still open: decisions 1–7 and the backend gaps in AP-03, AP-04, AP-07, AP-08, AP-24.
- **Type:** Code-based audit. **Nothing was rendered.** No browser, screenshots, emulated viewports or assistive technology were used. Contrast ratios are calculated from the Tailwind/hex values in the source. Layout, touch and theme behavior are inferred from class names, `src/index.css`, `tailwind.config.js`, `index.html` and `src/lib/temaPorRuta.ts`. One CSS question was settled by running the project's own Tailwind 3.4 CLI against a test string (AP-21). Some behavior was confirmed against the backend source (`Back/AppointVaAPI`), noted where used. The impeccable detector was not run. Verify visual findings in a running build before fixing them.
- **Companion audits:** `booking-flow.md` (BF-xx), `dashboard-core.md` (DC-xx), `owner-management.md` (OM-xx). Shared root causes already reported there are referenced by ID, not re-reported. New locations of those issues are listed once in [New occurrences of earlier findings](#new-occurrences-of-earlier-findings).

## Scope

| Area | Route | Entry file | Also read |
| --- | --- | --- | --- |
| Auth | `/login` | `src/pages/auth/LoginPage.tsx` | 2FA step, unverified-email banner |
| Auth | `/registro` | `src/pages/auth/RegistroNegocioPage.tsx` | `PasswordStrengthBar.tsx`, success screen; evaluated as the owner's first-run experience |
| Auth | `/recuperar-contrasena`, `/restablecer-contrasena`, `/verificar-email` | `RecuperarContrasenaPage.tsx`, `RestablecerContrasenaPage.tsx`, `VerificarEmailPage.tsx` | |
| Public | `/b/:slug/mis-citas` | `src/pages/publico/MisCitasPage.tsx` | reschedule sheet (`PasoFechaHora`) |
| Public | `/b/:slug/espera` | `ListaEsperaPublicaPage.tsx` | |
| Public | `/resena/:token` | `ResenaPage.tsx` | |
| Public | `/cancelar/:codigo` | `CancelarCitaPage.tsx` | |
| Public | `/privacidad`, `/terminos`, `*` | `PrivacidadPage.tsx`, `TerminosPage.tsx`, `src/pages/NotFoundPage.tsx` | `PublicFooter.tsx` |
| Landing | `/`, `/landing` | `LandingPage.tsx` | |
| Landing | `/salud` | `LandingPageSalud.tsx` | |
| Admin | shell | `src/layouts/AdminLayout.tsx` | `useInactividadTimeout` |
| Admin | `/admin` | `src/pages/admin/NegociosAdminPage.tsx` | `api/admin.ts` DTOs, subscription modal, owner/colors/delete modals |
| Admin | `/admin/audit` | `AuditLogPage.tsx` | |

Supporting code: `src/App.tsx`, `index.html`, `src/main.tsx`, `package.json`, `src/index.css`, `tailwind.config.js`, `src/lib/colorUtils.ts`, `src/store/authStore.ts`, `src/api/auth.ts`; backend `Program.cs` (Identity options), `Controllers/V1/AutenticacionController.cs` (login), `Controllers/V1/PublicoController.cs` (registration, verification, resend, cancel), `Models/Dtos/Negocios/RegistroNegocioDto.cs`.

## Method

Same frameworks as the companion audits: **ux-heuristics** (Nielsen + Krug, severity 0–4), **refactoring-ui** (8-row diagnostic), **impeccable `audit`** (A11y, Performance, Theming, Responsive, Integrity), **web-typography** (10-row diagnostic) and, for the two landings, **top-design** (weighted rubric). Surface modes: auth, public client pages and admin are **Operate**; the landings are **Persuade**. Project rules from `CLAUDE.md`: public/auth/landing/legal/404 routes are light-only (enforced by `temaPorRuta.ts` and the `index.html` boot script); dashboard/admin are light and dark; primary is slate; gold `#C8A961` is logo-only; status and rating colors are tokens (`--status-*`, `--rating`); neutral professional Spanish. **DECISION NEEDED** marks findings that need a product decision before a fix can be designed.

Contrast references used below (on white unless stated): gold `#C8A961` 2.3:1, `gray-400` 2.5:1, `slate-400` 2.6:1, `red-400` 2.8:1, white on `red-500` 3.8:1, `sky-600` 4.1:1, `slate-600` on `#070E1A` about 2.5:1, `slate-500` on `#070E1A` about 4.0:1.

## Summary

| Severity | Count | IDs |
| --- | --- | --- |
| 4 Catastrophic | 0 | — |
| 3 Major | 8 | AP-01 … AP-08 |
| 2 Minor | 17 | AP-09 … AP-25 |
| 1 Cosmetic | 3 | AP-26 … AP-28 |
| **Total** | **28** | plus new occurrences of 17 earlier findings (table below) and one high-risk security note |

### Scores per area

| Area | Nielsen / Krug | Refactoring UI | impeccable audit | Other | Main reasons |
| --- | --- | --- | --- | --- | --- |
| Auth | **5 / 10** | **6 / 10** (fails contrast, labels vs values, systems over one-offs) | **11 / 20** (A11y 1, Perf 2, Theming 3, Responsive 3, Integrity 2) | web-typography **5 / 10** | No recovery from a mistyped email or an expired verification link (AP-03), activation expectation never set (AP-02), client/server password rules diverge (AP-12), 488 KB logo on the first screen (AP-11) |
| Public client pages | **5 / 10** | **5 / 10** (fails contrast, grayscale, consistency, white space in action rows) | **10 / 20** (A11y 1, Perf 3, Theming 2, Responsive 2, Integrity 2) | — | Phone-only clients cannot change appointments and are not told why (AP-04), review stars unusable by screen reader and gold (AP-05), cancel page offers impossible cancellations (AP-18) |
| Landing (`/`, `/salud`) | **6 / 10** | **6 / 10** (fails color system, contrast on eyebrows/headline accent) | **11 / 20** (A11y 2, Perf 3, Theming 1, Responsive 3, Integrity 2) | top-design **5 / 10** | Clear value proposition and CTA, but sign-ups are locked to the wrong sector (AP-01), annual pricing is misleading (AP-08), gold used as the accent system (AP-09), Inter never loads (AP-10) |
| Admin (SuperAdmin) | **6 / 10** | **6 / 10** (fails color system — seven-hue action grid, gold totals — and micro text) | **13 / 20** (A11y 2, Perf 3, Theming 2, Responsive 3, Integrity 3) | — | One-click business deactivation that freezes every card (AP-06), no queue for sign-ups awaiting activation (AP-07), silent or unvalidated billing edits (AP-23) |

**Implementation integrity verdict: pass for admin, fail for auth and landings.** The admin screens adopted the shared shell (`EncabezadoPagina`, `BotonAccion`, `Tabs`, `FiltroBarra`, `Pagination`, `EmptyState`, `Modal`), real `role="switch"` toggles and documented reasoning in comments. The auth pages and landings are islands: five auth screens use two different input, card and background styles and none uses the shared primitives; both landings re-implement the same components twice (`useFadeInUp`, `Navbar`, `PricingCard`, `NegocioCard` are copy-pasted between `LandingPage.tsx` and `LandingPageSalud.tsx`) with inline hex constants instead of tokens. Product truth is also split: the landing FAQ, the registration success screen and the dashboard banner tell three different stories about activation (AP-02).

---

## Severity 4: Catastrophic

None found in code. Every blocked path has a workaround (usually contacting support or the business), which is what keeps the worst items at severity 3.

---

## Severity 3: Major

### AP-01: Every sign-up from the main landing is locked into the "belleza" sector, including the clinics the page targets
- **Heuristic:** H5 Error prevention; H3 User control and freedom; H2 Match with the real world
- **Location:** `src/pages/publico/LandingPage.tsx:87`, `:112`, `:384`, `:452`, `:684`, `:714`, `:740` (every CTA is `/registro?sector=belleza`), `:502` ("Ideal para … Clínicas"); `src/pages/auth/RegistroNegocioPage.tsx:60-61` (`sectorBloqueado` when the param is present), `:267` (both sector buttons `disabled`), `:279-283` ("Sector pre-seleccionado desde la página de registro.")
- **Evidence:** The main landing lists "Clínicas" as an ideal customer, but every registration link carries `sector=belleza`, which disables the sector choice on the form. The backend applies sector-specific defaults at creation (`PublicoController.cs:908-914` turns off payments, deposits and waitlist only for `salud`). The only way to change the sector afterwards is the SuperAdmin selector (`NegociosAdminPage.tsx:426-446`).
- **User impact:** A clinic owner who arrives at `/` (the default entry) cannot register as "Salud". The business gets beauty vocabulary and modules, and the owner sees a locked control with copy that blames "la página de registro" without explaining how to change it.
- **Fix:** Remove `?sector=` from the main landing CTAs (keep it only on `/salud`), or preselect without locking. Keep the sector buttons editable and drop the explanatory line. Replace "Clínicas" on `/` with a link to `/salud` ("¿Tienes un consultorio?" already exists in the nav).
- **Status:** Fixed (commit `0153a0a`). Main landing CTAs go to `/registro`; `?sector=salud` only preselects. The sector is a keyboard-operable radio group that is always editable, with the hint "Clínicas y consultorios: elige Salud". The "Clínicas" chip on `/` was left as is. Tests: `RegistroNegocioPage.test.tsx`.

### AP-02: Registration never says the business needs manual activation, and three screens describe activation differently — DECISION NEEDED
- **Heuristic:** H1 Visibility of system status; H2 Match with the real world; Krug "each click should be confidence-building"
- **Location:** `RegistroNegocioPage.tsx:147-186` (success screen: only "¡Revisa tu correo!"); backend `PublicoController.cs:903` (`Activo = 0 // inactivo hasta que el SuperAdmin apruebe y asigne un plan`); `LandingPage.tsx:666-669` (FAQ: "nuestro equipo revisa tu información y activa tu negocio en 24-48 horas. Te notificamos por email"); `src/layouts/DashboardLayout.tsx:555-566` (banner: "Tu negocio está pendiente de activación. Escríbenos a hola@appointva.com para habilitarlo."); `LandingPage.tsx:483` ("5 min para configurar"), `:546` ("listo en 5 minutos"), `:682` ("Únete en 5 minutos")
- **User impact:** The owner verifies their email, logs in, configures services, shares the link, and only then discovers their booking page is offline. The landing says the team will notify them; the dashboard says they must write in. This is the first experience of the product and it breaks trust at the moment of highest motivation.
- **Fix:** On the success screen, add a short "Qué sigue" list: 1) verify your email, 2) set up services and hours, 3) we activate your page within 24–48 h and notify you. Make the dashboard banner match whichever process is real, and show the expected time. Align "5 minutos" claims with the activation delay. **DECISION NEEDED:** Is manual approval intended long-term? Who notifies the owner (automatic email on activation, or the owner must write in)?
- **Status:** Partially fixed (commit `0153a0a`). The activation model is unchanged. `src/lib/activacion.ts` holds one message, used by the success screen ("Qué sigue"), the landing FAQ and the dashboard banner (`AvisoActivacionPendiente`). The message describes what the backend does today: manual activation, no bookings until then, a 24-hour verification link. Activation sends no email (`NegociosController.Activar`), so the FAQ no longer says "Te notificamos por email" or "24-48 horas". Left for decision 1: the activation email, a promised time frame, and the "5 minutos" claims. Backend note: the welcome email sent after verification says clients can book "a partir de hoy", but the business is still inactive at that point. Tests: `lib/activacion.test.tsx`, `RegistroNegocioPage.test.tsx`. Review follow-up (commit `0fcf188`): the success screen no longer repeats the manual-activation sentence under the steps; step 3 now says the page takes no bookings until activation.

### AP-03: A mistyped email at sign-up or an expired verification link leaves the owner with no recovery path
- **Heuristic:** H9 Help users recognize, diagnose and recover from errors; H3 User control and freedom
- **Location:** `RegistroNegocioPage.tsx:159-160` (shows the email, no way to correct it); backend `PublicoController.cs:890-894` (re-registering returns 409 for the same slug and the same email); `src/pages/auth/VerificarEmailPage.tsx:67-83` (error state: "Enlace inválido" + "Ir a iniciar sesión", no resend), `:28-33` (any failure, including network, becomes "inválido o ha expirado"); `LoginPage.tsx:55-58`, `:123-141` (the only resend button appears after a correct-password login)
- **User impact:** If the owner typed the email wrong, the account is unreachable and the chosen slug is now taken, so they must invent a new business URL and start over. If the link expired, the page offers no resend; the owner has to guess that logging in reveals one. On a weak connection a valid link is reported as invalid.
- **Fix:** Success screen: add "¿Escribiste mal tu correo?" that lets the owner correct it (needs a backend endpoint) or at least explains how to contact support. Verification error: add an email field with "Reenviar enlace" (the resend endpoint is already enumeration-safe, `PublicoController.cs:1109-1112`), and distinguish network errors with "Reintentar".
- **Status:** Partially fixed (commit `0153a0a`). The verification error page has an email field with "Reenviar enlace", wired to the existing `POST /publico/reenviar-verificacion`. A missing server response shows "No pudimos comprobar el enlace" with "Reintentar", not "inválido". The success screen keeps its resend (errors now show on that screen) and gives honest guidance for a mistyped email: write to hola@appointva.com with the slug. Backend gap: there is no endpoint to correct the email after sign-up. Tests: `VerificarEmailPage.test.tsx`, `RegistroNegocioPage.test.tsx`. Review follow-up (commit `0fcf188`): after a resend the page offers "Reenviar de nuevo" (60 s client cooldown, shown as a countdown) and "Usar otro correo"; 5xx, 408 and 429 are treated like a missing response ("No pudimos comprobar el enlace" + "Reintentar"), not as an invalid link. Second follow-up (commit `f4261c0`): the cooldown is kept per address (trimmed, case-insensitive), so "Usar otro correo" can send to a different address at once while the same address still waits. Test in `VerificarEmailPage.test.tsx`.

### AP-04: In "Mis citas", clients who look up by phone (or booked without email) see no Reagendar/Cancelar and are not told why — DECISION NEEDED
- **Heuristic:** H1 Visibility of system status; H6 Recognition rather than recall; H3 User control
- **Location:** `src/pages/publico/MisCitasPage.tsx:322` (`tieneEmail`), `:343-359` (actions only when `tieneEmail`), `:360-362` ("Sin cambios permitidos" only covers the time-window case); backend `PublicoController.cs:648-657` (cancel requires the email; no-email appointments get "contacta directamente al negocio")
- **User impact:** The booking flow accepts phone-only bookings, and the lookup form invites phone-only access. Those clients see their appointment with "Repetir" and "Ver" but no way to change it and no message, so they assume the feature is missing or broken and call the business, or simply do not show up.
- **Fix:** When the lookup has no email, show a line under each modifiable appointment: "Para reagendar o cancelar, busca con el correo que usaste al reservar" or "Contacta a {negocio}" with the business phone/WhatsApp. **DECISION NEEDED:** Should phone-only clients be able to self-serve (for example with a one-time code by SMS/WhatsApp)?
- **Status:** Partially fixed (commit `0153a0a`). Explanation only, no new capabilities. A phone-only lookup now shows, on each modifiable appointment, that rescheduling or cancelling needs the email used at booking, or contacting the business, plus a "Buscar con mi correo" button. No business phone is shown because the Mis citas response does not include one. Phone-only self-service (OTP) is still open, decision 4. Tests: `MisCitasPage.test.tsx`.

### AP-05: Review stars cannot be used with a screen reader, and they use the brand gold instead of the rating token
- **Heuristic:** WCAG 4.1.2 Name, Role, Value; 1.3.1; project rule (gold is logo-only, `--rating` exists)
- **Location:** `src/pages/publico/ResenaPage.tsx:96-113` (five `<button>`s containing only an SVG: no accessible name, no checked state), `:107-108` (`fill`/`stroke` `#C8A961`), `:115-119` (rating label not announced), `:122-129` (textarea labelled only by placeholder), `:26` (submit error ignores the server message, e.g. "Este enlace ha expirado.")
- **Evidence:** `tailwind.config.js:60` and `src/index.css` define `rating` / `--rating: #F59E0B` with the comment "nunca el dorado de marca"; BF-16 migrated the booking page but explicitly left this page out.
- **User impact:** A screen-reader user hears "botón" five times and cannot know which star is which; since "Enviar reseña" stays disabled until a rating is chosen, the task cannot be completed. Sighted users see gold stars that differ from the rest of the app.
- **Fix:** Render the stars as a `role="radiogroup"` with `role="radio"`, `aria-checked`, `aria-label="3 de 5: Regular"` and arrow-key support (or five visually hidden radio inputs). Use `text-rating`/`fill-rating`. Add a visible or `sr-only` label to the comment field and a `maxLength` counter. Show the server message on submit errors.
- **Status:** Fixed (commit `0153a0a`). New `components/EstrellasCalificacion.tsx`: a `radiogroup` named by the question, five radios named like "3 de 5: Regular", `aria-checked`, roving tabindex, and arrow/Home/End keys. Stars use `text-rating fill-rating`. The comment field has a visible label and a 0/1000 counter, and submit errors show the server `mensaje`. Tests: `EstrellasCalificacion.test.tsx`.

### AP-06: Admin "Desactivar" takes a business offline in one click, and one pending toggle disables every card
- **Heuristic:** H5 Error prevention; H1 Visibility of system status; H3 User control (shared pending state has the same root cause as **OM-30**)
- **Location:** `src/pages/admin/NegociosAdminPage.tsx:871-882` (button), `:1385-1386` (direct mutation), `:1394` (`isToggling={activando || desactivando}` passed to every card), `:1088-1098` (no success toast)
- **User impact:** A mis-tap in a two-column grid of seven buttons stops a live business's public booking page for all of its clients, with no confirmation and no confirmation message after the fact. While the request runs, every card shows "Guardando…".
- **Fix:** Confirm deactivation in a `Modal` that states the consequence ("La página /b/{slug} dejará de aceptar reservas"). Track the pending id so only that card is disabled. Toast the result, with "Deshacer" once DC-17 adds actions to the toast store.
- **Status:** Fixed (commit `0153a0a`). "Desactivar" opens `ConfirmarAccion`, which names the business and the effect ("/b/{slug} dejará de aceptar reservas…; las citas ya agendadas no se cancelan"). Pending state comes from the mutation `variables`, so only the card whose status is changing shows "Guardando…". Activating and deactivating both show a success toast. "Deshacer" waits for DC-17. Tests: `NegociosAdminPage.test.tsx`. Review follow-up (commit `0fcf188`): pending state now comes from `useMutationState` over a shared mutation key, so every in-flight id stays disabled; one request finishing no longer re-enables another card, and a second click on a pending card sends nothing.

### AP-07: The admin has no way to find businesses waiting for activation
- **Heuristic:** H7 Flexibility and efficiency; H6 Recognition rather than recall
- **Location:** `src/api/admin.ts:38-58` (`NegocioMetricasDto` has no registration date and no email-verified flag), `NegociosAdminPage.tsx:1246` (sorted active-first, so new sign-ups sink to the end), `:1321-1347` ("Inactivos" mixes new sign-ups with deactivated businesses)
- **User impact:** Activation is the SuperAdmin's most time-sensitive task (the landing promises 24–48 h, AP-02), but new registrations are mixed with suspended accounts at the bottom of a paginated card grid, with no date to tell them apart and no way to see whether the owner verified their email.
- **Fix:** Add a "Pendientes de activación" filter or tab (inactive, never activated) sorted newest first, show "Registrado el …" and an email-verified badge on the card. Needs `fechaCreacion` and `emailConfirmado` in the DTO.
- **Status:** Partially fixed (commit `0153a0a`). Uses only what the current DTO provides. A business that is inactive and has no plan counts as "Pendiente de activación" (`utils/negociosAdmin.ts`): it gets an amber badge, sorts first (then active, then deactivated), and has its own filter option. Backend gap: `NegocioMetricasDto` still has no `fechaCreacion` or `emailConfirmado`, so the cards cannot show the registration date or a verified-email badge, and newest-first is not possible. Tests: `NegociosAdminPage.test.tsx`.

### AP-08: The annual-billing toggle promises −20% but leaves the highlighted Pro plan unchanged, and plan CTAs drop the chosen plan — DECISION NEEDED
- **Heuristic:** H1 Visibility; H2 Match with the real world; Krug (pricing must be self-evident); dark-patterns check (hidden cost)
- **Location:** `LandingPage.tsx:563-581` (toggle with "−20%"), `:589-593` (Pro has no `annualPrice`, so it keeps showing $449/mes), `:384` (every plan CTA goes to the same `/registro?sector=belleza`), `:356` (`toLocaleString()` with no locale, no "MXN" on the cards); same in `LandingPageSalud.tsx:389-432`, `:217`
- **User impact:** The visitor switches to "Anual", sees Básico drop to $199 and the "Más popular" plan stay the same, with no explanation. That reads as an error or a bait. Choosing "Empezar con Pro" carries no plan into registration.
- **Fix:** Give Pro an annual price, or label it "Sin descuento anual". Pass `?plan=` through registration (even if the SuperAdmin assigns it later, it records intent). Format with `formatPrecio` (es-MX, MXN). **DECISION NEEDED:** Pro annual price; and whether "Comenzar gratis" / "Crear mi agenda gratis" is accurate when the cheapest plan is $249/mes and no free tier or trial is shown.
- **Status:** Partially fixed (commit `0153a0a`). On both landings, `lib/precios.ts` (`precioVisible`) applies the toggle to every card. A plan without an annual price, including the highlighted Pro and Premium, now reads "Sin descuento anual · Se factura mes a mes" instead of silently keeping its price. Amounts use es-MX grouping. `?plan=` is not passed because registration does not accept a plan (`RegistroNegocioDto` has no such field). No prices were invented. The Pro annual price, the "gratis" copy and "MXN" labelling are still open, decision 5. Tests: `lib/precios.test.ts`. Review follow-up (commit `0fcf188`): a "Próximamente" plan (Premium) gets no billing note in Anual (`PrecioPlan.disponible`). Tests: `lib/precios.test.ts`, `LandingPage.test.tsx`.

---

## Severity 2: Minor

### AP-09: Brand gold is used as the accent system on both landings and in admin totals — DECISION NEEDED
- **Principle:** Project rule (gold `#C8A961` is logo-only); WCAG 1.4.3; refactoring-ui (color with purpose)
- **Location:** `LandingPage.tsx:4` (`GOLD` constant), `:441` (headline accent "Sin llamadas.", about 2.3:1 even at display size), `:516`, `:539`, `:557`, `:614`, `:648`, `:678` (12px gold eyebrows, about 2.3:1), `:227` (feature icons), `:347` ("Más popular"), `:360`, `:373` (check marks), `:384` (highlighted plan CTA background), `:686` (final CTA background), `:417` (`::selection`), `:127`, `:162`, `:171`, `:184`, `:196` (phone mockup selection states); same lines in `LandingPageSalud.tsx`; `NegociosAdminPage.tsx:149` (printed receipt amount), `:487`, `:1290`, `:1481`, `:1523` (money totals), `:1504` ("Ver suscripción" link, about 2.3:1)
- **User impact:** The gold reads as the brand's interactive color on the landing, then disappears in the product, so the visual language changes after sign-up. Every gold text on white fails contrast.
- **Fix:** On admin, use slate/`text-foreground` for totals and a normal link style. On the landings, use slate for accents and CTAs. **DECISION NEEDED:** If the owner wants gold on marketing pages (Persuade mode), record the exception in `CLAUDE.md`, add a darker gold text token that passes 4.5:1, and keep gold off text smaller than 24px.
- **Status:** Partially fixed (commit `0fcf188`). Admin only: the "Ingresos est." KPI, the modal "Total mensual", the billing table totals and footer use neutral text with dark variants, "Ver suscripción" is an underlined slate link, and the printed receipt amount is slate (`#0F172A`); gold stays on the receipt logo. The landings are unchanged, decision 4.

### AP-10: Inter is declared but never loaded, so every screen renders in the platform's system font — DECISION NEEDED
- **Principle:** Project rule ("Font: Inter"); web-typography (font loading, fallbacks); cross-screen
- **Location:** `tailwind.config.js:68` and `src/index.css:144` declare `Inter, system-ui, sans-serif`. There is no `@font-face`, `@import`, `<link>` to a font service, `@fontsource` package or font file (`index.html`, `src/main.tsx`, `package.json`, `public/`).
- **User impact:** Unless Inter is installed locally, Windows shows Segoe UI, Android Roboto and Apple devices SF. Widths, numerals and line breaks differ per platform (the landing headline and tight admin cards are tuned to one of them), and the documented brand font never appears.
- **Fix:** Self-host Inter as a variable WOFF2 subset (Latin + Latin-1), `font-display: swap`, preload it from `index.html`, and enable `font-feature-settings: "tnum"` where numbers align. **DECISION NEEDED:** Or adopt the system stack on purpose and update `CLAUDE.md`.
- **Status:** Open – DECISION NEEDED (decision 17). Fonts were left unchanged.

### AP-11: A 488 KB PNG logo loads on every auth and public page, including as a 24px faded footer mark
- **Principle:** impeccable Performance; top-design Pillar 6 (LCP)
- **Location:** `public/MasterLogo.png` (488,611 bytes; `BannerLogo.png` is the same size); `LoginPage.tsx:114` (eagerly bundled first route), `RegistroNegocioPage.tsx:151`, `:192`, `RecuperarContrasenaPage.tsx:37`, `RestablecerContrasenaPage.tsx:72`, `VerificarEmailPage.tsx:39`, `src/components/PublicFooter.tsx:6` (`h-6 opacity-25`), `PrivacidadPage.tsx:17`, `:187`, `TerminosPage.tsx` header and footer
- **User impact:** On mobile data, the login screen's largest element is half a megabyte, and booking-adjacent pages (Mis citas, Reseña, Cancelar) download it again just for a faded footer. No `width`/`height` attributes, so layout shifts when it arrives.
- **Fix:** Export the mark as SVG (or 2× WebP around 10–20 KB), add intrinsic `width`/`height`, and use a tiny variant in `PublicFooter`. Remove the redundant "AppointVa" caption under the logo (`RecuperarContrasenaPage.tsx:38`, `RestablecerContrasenaPage.tsx:73`).
- **Status:** Fixed (commit `0153a0a`). There is no SVG source in the repo, so two copies were generated from `MasterLogo.png` with the locally installed Pillow: `public/logo-appointva.png` (576×192, 9.8 KB) and `public/logo-appointva-sm.png` (144×48, 2.3 KB). Quantized PNG came out smaller than WebP. `components/LogoMarca.tsx` sets intrinsic `width`/`height`, `decoding="async"`, and eager plus `fetchPriority="high"` for logos above the fold, lazy otherwise. It replaces every `/MasterLogo.png` on login, registration, recovery, reset, verification, the legal pages and `PublicFooter`. The redundant captions were removed. Tests: `LogoMarca.test.tsx`. Admin shell: Fixed (pending commit). `AppLogo` was removed; the admin sidebar uses `LogoMarca` with the light copy, or in dark mode `public/logo-appointva-oscuro.png` (576×192, 9.8 KB, white wordmark generated from `MaterLogoOscuro.png`, readable on `slate-900`). `MasterLogo.png` is no longer referenced by the admin shell and was not deleted. Test: `AdminLayout.test.tsx`.

### AP-12: Password rules are hidden in a placeholder, the client accepts passwords the server rejects, and the strength meter overstates strength
- **Heuristic:** H5 Error prevention; H9; H6 Recognition rather than recall
- **Location:** `RegistroNegocioPage.tsx:21-25` (schema), `:333` (rules only in `placeholder`), `:127-130` (shows only `mensaje`); `RestablecerContrasenaPage.tsx:12-16`, `:116`; `src/components/PasswordStrengthBar.tsx:3-11`, `:32`; backend `Program.cs:69-79` (sets length, uppercase and digit, never sets `RequireLowercase = false`, so ASP.NET Identity's default lowercase requirement applies), `PublicoController.cs:935-941` (returns `"No se pudo crear la cuenta."` with the real reasons in `errores`)
- **User impact:** The rules vanish as soon as the owner starts typing, and zod reports one failed rule at a time. A password like `CLAVE123` passes every client check and fails on the server with a generic error, after the owner has filled in the whole form. "Password1" is rated "Fuerte". The meter is not announced to screen readers.
- **Fix:** Show a persistent checklist under the field that ticks rules as they pass (`aria-live="polite"`). Align client and server rules (add the lowercase rule or set `RequireLowercase = false`), and display `errores` when present. Base the meter on length and variety (or zxcvbn) rather than the minimum rules. Paste and show/hide already work; keep them.
- **Status:** Fixed (commit `0153a0a`), on the client side. `utils/contrasena.ts` mirrors Identity: 6 characters, an uppercase letter, a digit, and a lowercase letter (Identity's default `RequireLowercase`), with no symbol required. Registration, password reset and Mi perfil all use it. `ReglasContrasena` shows a persistent checklist (`aria-live="polite"`) that ticks rules as they pass, in place of the placeholder. The strength meter now scores length and symbols ("Password1" is "Regular") and is announced. Registration translates known Identity `errores` into Spanish and drops unknown English text. Backend note: Identity descriptions are English, so a localized `IdentityErrorDescriber` (or returning error codes) would remove the client-side mapping. Tests: `utils/contrasena.test.ts`, `RegistroNegocioPage.test.tsx`. Review follow-up (commit `0fcf188`): `REGLAS_CONTRASENA` is the single definition; the checklist, the zod schema (`superRefine`, one issue per failed rule) and the Identity translation all read from it. The unreachable "non alphanumeric" and "unique chars" translations were dropped (Program.cs requires neither), and "unique chars" no longer matches the length rule.

### AP-13: Registration form details: stale errors on the business name, sector buttons without state, and missing autocomplete
- **Heuristic:** H1; H4; WCAG 4.1.2, 1.3.5 Identify Input Purpose
- **Location:** `RegistroNegocioPage.tsx:209` (custom `onChange` replaces react-hook-form's, and `:101` calls `setValue` without `shouldValidate`, so a "Mínimo 2 caracteres" error stays visible while the user fixes it), `:263-277` (sector buttons without `aria-pressed` or radio semantics; when locked, the selected one also looks disabled), `:223` (hard-coded `appointva.com/b/` prefix), `:207`, `:292`, `:306`, `:316` (no `autoComplete="organization"`, `"tel"`, `"name"`, `"email"`), no legend for the `*` convention
- **Fix:** Call the registered `onChange` and pass `{ shouldValidate: formState.isSubmitted }` to `setValue`. Make the sector a radio group. Read the public origin from config. Add autocomplete tokens. Mark optional fields ("(opcional)" is already used for Teléfono) and drop the asterisks.
- **Status:** Fixed (commit `0fcf188`). The name and slug inputs chain react-hook-form's `onChange`, and the derived slug validates only after the first submit. Sector was already a radio group (AP-01). The link prefix uses `window.location.host`. Every field has a `<label htmlFor>` and `autoComplete` (`organization`, `tel`, `name`, `email`). The asterisks are gone, with one line explaining that every field is required except those marked "(opcional)". Tests: `RegistroNegocioPage.test.tsx`.

### AP-14: The password-reset page's error states do not offer a new link
- **Heuristic:** H9 Help users recover from errors
- **Location:** `RestablecerContrasenaPage.tsx:57-66` ("Enlace inválido o incompleto." + "Volver al inicio"), `:49-53` (server error "El enlace puede haber expirado" inside the form)
- **User impact:** Reset links expire. The page diagnoses the problem but sends the user back to login, where they must find "¿Olvidaste tu contraseña?" again.
- **Fix:** Add "Solicitar un nuevo enlace" pointing to `/recuperar-contrasena` (prefill the email from the query string) in both states.
- **Status:** Fixed (commit `0fcf188`). Both the incomplete-link state and the server error show "Solicitar un nuevo enlace". The email reaches `/recuperar-contrasena` through router state, not the URL, and prefills the field. The server error is in a `role="alert"` box with the server `mensaje`. Tests: `RestablecerContrasenaPage.test.tsx`.

### AP-15: Legal pages: the back control does nothing when opened from registration, and long-form text is set small and wide
- **Heuristic:** H3 ("back buttons must never break"); web-typography (16px body, 45–75 character measure)
- **Location:** `RegistroNegocioPage.tsx:390`, `:394` (`target="_blank"`); `PrivacidadPage.tsx:10-16` (`preventDefault` + `history.back()`), `TerminosPage.tsx:10-15` (`history.back()`), both icon-only with no `aria-label` and about 20px tall; body copy `text-sm` (14px) in `max-w-2xl` (about 95 characters per line), e.g. `PrivacidadPage.tsx:38`; `prose prose-slate prose-sm` (`:33`) is dead because `@tailwindcss/typography` is not installed (`tailwind.config.js:91`)
- **User impact:** From registration, the legal text opens in a new tab whose back arrow is inert. Reading a legal document at 14px across 95 characters is tiring on desktop.
- **Fix:** Fall back to `navigate("/")` when `history.length <= 1`, use a labelled 44px back button ("Volver"). Set body to `text-base leading-relaxed max-w-prose`. Remove the dead `prose` classes or install the plugin.
- **Status:** Fixed (commit `0fcf188`). New `components/VolverAtras.tsx`: a 44px "Volver" button that goes back when there is history and to `/` when the page opened in a new tab (react-router `location.key === "default"`). Both legal pages use it. Body copy is `text-base` inside `max-w-prose`, and the dead `prose` classes were removed. The legal text itself was not changed. Tests: `VolverAtras.test.tsx`. Review follow-up (commit `f4261c0`): the rule lives in `hooks/useVolverAtras.ts` (`useVolverAtras`, plus `hayHistorialEnPestana` for code outside the router) and is used by `VolverAtras`, `CitaDetallePage` (fallback `/dashboard/citas`), the 404 (hides "Volver" without history) and `ErrorBoundary` ("Ir al inicio" without history; going back now also clears the error so the previous page renders). Tests: `useVolverAtras.test.ts`, `NotFoundPage.test.tsx`, `ErrorBoundary.test.tsx`.

### AP-16: The privacy policy states facts the code contradicts — DECISION NEEDED
- **Principle:** H2 Match with the real world; trust and legal accuracy
- **Location:** `PrivacidadPage.tsx:107` ("contraseñas almacenadas con hash seguro (bcrypt)": the backend uses ASP.NET Identity's default hasher, PBKDF2; no BCrypt reference exists in `Back/`), `:129-131` ("cookies de sesión estrictamente necesarias": the session tokens persist in `localStorage` via `src/store/authStore.ts:25`, and Mis citas stores the client's email/phone in `localStorage`, `MisCitasPage.tsx:13`, `:134`), `:157`, `:178` (privacidad@ and soporte@, while the landing and dashboard use hola@)
- **Fix:** Correct the security and storage sections and use one contact address per purpose. **DECISION NEEDED:** legal review of the policy text (storage disclosure, data retention for clients of businesses).
- **Status:** Open – DECISION NEEDED (decision 6). Legal text left untouched on purpose: the bcrypt, cookies and contact-address statements still need legal review.

### AP-17: Most routes never set a page title
- **Heuristic:** WCAG 2.4.2 Page Titled; H1 (orientation in tabs and history)
- **Location:** Only `BookingPage.tsx:785`, `ConfirmacionPage.tsx:126` and `ResenaPage.tsx:36` set `document.title`. Login, registration, recovery, verification, Mis citas, waitlist, cancel, legal, 404, landing variants and admin all keep `index.html:49` ("AppointVa — Tu agenda online. Sin llamadas."). `ResenaPage.tsx:37-44` also writes `og:*` meta tags at runtime (crawlers do not run them) and leaves them behind after unmount.
- **Fix:** A small `useTituloPagina("Iniciar sesión")` hook per route ("Mis citas · {negocio}", "Registro de auditoría · Admin"). Drop the runtime OG tags or move them to server rendering.
- **Status:** Fixed (commit `0fcf188`) for the routes in this audit. `hooks/useTituloPagina.ts` sets "{título} · AppointVa" and restores the `index.html` title on unmount. Used by login, registration, recovery, reset, verification, Mis citas ("Mis citas · {negocio}" once loaded), waitlist ("Lista de espera · {negocio}"), cancel, review, legal pages, 404 and both admin pages. The review page no longer writes `og:*` tags. Dashboard routes were not in scope. Tests: `useTituloPagina.test.ts`. Review follow-up (commit `f4261c0`): booking ("Reservar en {negocio}") and confirmation ("Tu cita en {negocio}") now use `useTituloPagina` too, so every route restores the single default title; their `og:*` tags stay. Tests in `BookingPage.test.tsx`, `ConfirmacionPage.test.tsx`.

### AP-18: The cancel page offers to cancel completed or past appointments and has no reschedule alternative
- **Heuristic:** H5 Error prevention; H3 User control; H1
- **Location:** `src/pages/publico/CancelarCitaPage.tsx:116-125` (only `estado === 3` is handled), `:127-128` (window check only), backend `PublicoController.cs:664-665` (rejects Completada after the user has typed their email and confirmed twice); no link to `/cita/:codigo`, where rescheduling exists; `:200`, `:223` (white on `red-500`, about 3.8:1)
- **User impact:** A client opening an old reminder email can walk through both steps only to read "No se puede cancelar una cita completada". A client who only needs another time is pushed to cancel and rebook.
- **Fix:** Show "Esta cita ya se realizó" for completed and past appointments. Add "¿Prefieres cambiar el horario? Reagendar" linking to `/cita/:codigo` above the cancel button. Use `red-600` for the destructive button.
- **Status:** Fixed (commit `0fcf188`). Found while fixing: the page compared `estado === 3` as "cancelled", but in `Constants/EstadosCitas.cs` 3 is Completada and 4 is Cancelada, so completed appointments read "ya está cancelada" and cancelled ones were offered for cancellation. `lib/estadoCita.ts` now exports `CODIGO_ESTADO_CITA` (review follow-up: `codigoCitaAbierta` replaces the remaining `estado === 1 || estado === 2` checks in `MisCitasPage` and `DateTimePicker`; no numeric status comparison is left in `src`). Cancelled shows "Esta cita ya está cancelada"; completed, no-show or past shows "Esta cita ya se realizó", both before asking for the email, with "Reservar una nueva cita". A "Reagendar" link to `/cita/:codigo` sits above the cancel button. Destructive buttons are `red-600` and 44px. A network or 5xx failure shows "No pudimos cargar tu cita" with "Reintentar" instead of "Cita no encontrada" (BF-18 occurrence). Tests: `CancelarCitaPage.test.tsx`.

### AP-19: The waitlist page's CTA uses the raw brand color, has no way back to the business, and promises a notification that depends on OM-06
- **Heuristic:** WCAG 1.4.3; Krug Trunk Test; H2
- **Location:** `src/pages/publico/ListaEsperaPublicaPage.tsx:229` (`style={{ background: color }}` with white text), whereas `BookingPage.tsx:1032` uses `brandSolid(color)` to guarantee contrast; `:151-237` (no link back to `/b/:slug` in the form or success state); `:59` (`servicioId` is sent but the service is never shown); `:162` ("Te avisaremos cuando haya un lugar disponible") while **OM-06** found that "Notificar" notifies nobody
- **User impact:** A business with a light brand color (for example a pastel pink) gets an unreadable button. After joining, the client is stranded on a dead-end page and cannot confirm which service they are waiting for.
- **Fix:** Use `brandSolid(color)`. Add "Volver a {negocio}" and name the service ("Lista de espera para Corte de cabello"). Word the success copy to match the OM-06 decision ("{negocio} te contactará cuando haya un lugar").
- **Status:** Fixed (commit `0fcf188`). The submit button uses `brandSolid(color)`. The form and the success state have "Volver a {negocio}". With `servicioId`, the heading reads "Lista de espera para {servicio}" and the success state names it. Since OM-06 still sends nothing, the copy no longer says "Te avisaremos": it says "{negocio} se pondrá en contacto contigo". Errors use the server `mensaje` inside `role="alert"`. Tests: `ListaEsperaPublicaPage.test.tsx`.

### AP-20: Landing motion ignores reduced-motion, and the FAQ, menu and billing toggle hide their state from assistive technology
- **Principle:** impeccable motion sensitivity; WCAG 2.3.3 (AAA guidance), 4.1.2
- **Location:** `LandingPage.tsx:8-29` and `LandingPageSalud.tsx:8-29` (`useFadeInUp` starts every card and section at `opacity: 0` and slides it 24px, with no `useReducedMotion` check), `LandingPage.tsx:413-415` (the reduced-motion rule only covers `.av-float` and the sticky CTA), `:416` (`scroll-behavior: smooth` unconditionally); `:316` (FAQ buttons without `aria-expanded`/`aria-controls`), `:95-101` (mobile menu button without `aria-expanded`), `:565-579` (billing toggle without `aria-pressed`)
- **Fix:** Return the visible state immediately when `useReducedMotion()` is true and wrap `scroll-behavior` in `@media (prefers-reduced-motion: no-preference)`. Add the missing ARIA states. Extract the shared landing components into one module so both pages get the fix.
- **Status:** Fixed (commit `0fcf188`). `useFadeInUp` moved to `components/landing/useFadeInUp.ts` and is shared by both landings. With reduced motion, content is visible from the start with no transition. Smooth scrolling only applies with `prefers-reduced-motion: no-preference`, and `/salud` also stops `av-float`. FAQ buttons have `aria-expanded`/`aria-controls`, the mobile menu has `aria-expanded`/`aria-controls`, and the billing toggle has `aria-pressed`. `Navbar` and `PricingCard` are still duplicated between the two files. Tests: `useFadeInUp.test.ts`, `LandingPage.test.tsx`.

### AP-21: The landing navbar never gets its background on scroll because `bg-white/96` is not a Tailwind 3 class
- **Principle:** impeccable Implementation integrity
- **Location:** `LandingPage.tsx:63`, `LandingPageSalud.tsx:60`
- **Evidence:** Running the project's Tailwind 3.4.19 CLI on `bg-white/96 bg-white/95` emits only `.bg-white\/95`; the opacity scale has no 96 step, so the class is silently dropped.
- **User impact:** When scrolled, the fixed bar is transparent with only a blur and a faint shadow; slate-500 nav links sit over moving section content.
- **Fix:** Use `bg-white/95` (or `bg-white/[.96]`).
- **Status:** Fixed (commit `0fcf188`). Both navbars use `bg-white/95`.

### AP-22: The health landing uses beauty businesses as proof and is a thinner page than the main landing — DECISION NEEDED
- **Principle:** top-design (social proof, signature moment); Persuade mode; H2
- **Location:** `LandingPageSalud.tsx:347-378` ("Negocios reales" = a beauty salon and a lash studio, "reserva como lo haría tu paciente"), `:246-293` (text-only hero; the `av-float` keyframes at `:232-237` are defined but unused), no FAQ, no activation disclosure, no final CTA and no mobile sticky CTA (all present on `/`); `:453` ("sin WhatsApps") contradicts `:334` and `:424` ("recordatorios por … WhatsApp")
- **User impact:** A dentist or psychologist sees salon examples as the only evidence and has to scroll back to the top to act.
- **Fix:** Reuse the main landing's structure (mockup tuned to a consultation, FAQ with activation, final CTA, sticky CTA). **DECISION NEEDED:** Hide "Negocios reales" until there is a health customer, or reframe it as a demo. Confirm WhatsApp reminders are live for health businesses before advertising them (`WhatsAppService` exists in the backend; OM-27 is still open).
- **Status:** Partially fixed (commit `0fcf188`). `/salud` now states the manual activation under the pricing (`ACTIVACION_RESUMEN`, the same sentence as the main landing) and gets the AP-20/AP-21 fixes. Open, decision 7: the "Negocios reales" proof, the WhatsApp claims ("sin WhatsApps" against "recordatorios por WhatsApp"), and the missing FAQ, final CTA and sticky CTA.

### AP-23: Admin billing edits are unvalidated or silent
- **Heuristic:** H5 Error prevention; H1 Visibility
- **Location:** `NegociosAdminPage.tsx:629-637` (editing a payment saves `parseFloat(monto) || 0`, so a typo stores $0, and `periodoDesde` after `periodoHasta` is accepted), `:286-291`, `:477` ("Emp. extra" saves on blur with no success feedback and no `onError`), `:330-349`, `:409`, `:434` (plan and sector change on one click with no confirmation and no success message), `:1127-1130` (creating an owner closes the modal without a toast), `:1085` (creating a business ignores the server message, e.g. a taken slug, and there is no live slug check as in registration), `:1895-1900` (hex text field accepts invalid colors)
- **Fix:** Validate amount (> 0) and period order with zod, as the other admin forms do. Toast every successful save, and handle errors on the extra-employees mutation. Confirm sector changes (they change the business's modules and vocabulary). Reuse `verificarSlug` in "Nuevo negocio" and show the server's `mensaje`.
- **Status:** Fixed (commit `0fcf188`), except the live slug check. Editing a payment is validated by `validarEdicionPago` (amount > 0, full period, "desde" not after "hasta"): the error shows inline and "Guardar cambios" is disabled. "Emp. extra" saves only when the value changed and toasts success or the server error (modal and billing table). A sector change asks for an inline confirmation that names the effect, and sector and plan changes toast the result. Creating an owner toasts. Creating a business shows the server `mensaje` (for example a taken slug). The hex field is validated (`esColorHexValido`), marked `aria-invalid` with a message, and blocks saving. Severity-1 batch (commit `f4261c0`): "Nuevo negocio" now checks the slug live with `hooks/useDisponibilidadSlug.ts`, the same debounced check the public registration uses (now refactored onto it); "Ya está en uso" disables "Crear negocio". Tests: `NegociosAdminPage.test.tsx`, `utils/negociosAdmin.test.ts`, `useDisponibilidadSlug.test.ts`.

### AP-24: The audit log can only be searched by raw UUID, shows internal action names, and hides details behind hover
- **Heuristic:** H6 Recognition rather than recall; H2; "hover-only information"
- **Location:** `src/pages/admin/AuditLogPage.tsx:28`, `:94-101` (the only search is a full UUID), `:110` (options and badges show `LoginFallido`, `CambiarPassword`, `EliminarCuenta`), `:194` (details truncated to 200px, full text only in `title`), `:188` (users without email show an 8-character id), no date-range filter
- **User impact:** To investigate "someone is trying to get into my account", the admin must first find the user's UUID elsewhere; on touch devices the details cannot be read at all.
- **Fix:** Search by email (backend filter), map actions to Spanish labels ("Inicio de sesión fallido"), add a date range, and expand a row to show full details.
- **Status:** Partially fixed (commit `0fcf188`), frontend only. Actions show Spanish labels in the filter and the badges, while the filter still sends the internal value. Each row has "Ver detalle" (`aria-expanded`), which opens the full details, the full user id and the entity. From there, "Ver solo los eventos de este usuario" filters without copying a UUID. Users without an email read "Usuario sin correo" instead of an 8-character id. Backend gap: `GET /api/admin/audit` only accepts `accion` and `usuarioId`, so email search and a date range need new query parameters. Tests: `AuditLogPage.test.tsx`.

### AP-25: "Mis citas" errors blame the user's data, and each card packs five tiny text actions
- **Heuristic:** H9; WCAG 2.5.8; refactoring-ui (button hierarchy)
- **Location:** `MisCitasPage.tsx:277-282` (every failure says "Verifica tu información" and offers only "Corregir mis datos", no retry), `:342-397` (Reagendar, Cancelar, Repetir, Ver, Google Calendar, iCal as `text-xs` links about 16px tall in one row), `:354` ("Cancelar" `red-400`, about 2.8:1), `:367` ("Repetir" `sky-600`, off-system, about 4.1:1 at 12px), `:451-467` (dead branch: history items can never be upcoming)
- **Fix:** Distinguish network errors and add "Reintentar". Give each upcoming card one primary action ("Ver cita") and a secondary row of 44px buttons; move calendar links into the detail page, where they already exist. Use slate for "Repetir" and `red-600` for "Cancelar". Remove the dead branch.
- **Status:** Fixed (commit `0fcf188`). A network, 5xx, 408 or 429 failure (`esErrorTemporal`) shows "No pudimos cargar tus citas" with "Reintentar". Other errors show the server message with "Corregir mis datos". Upcoming cards have one primary "Ver cita" button and a row of 44px secondary buttons (Reagendar, Cancelar in `red-700`, Repetir in slate). Calendar links now live only on the detail page. The dead reschedule/cancel branch in the history list was removed. Tests: `MisCitasPage.test.tsx`.

---

## Severity 1: Cosmetic

### AP-26: Flag emoji render as "MX" letters on Windows; other emoji used as icons
- **Principle:** impeccable craft floor (root cause **DC-35** / **BF-24**; the Windows flag problem is new)
- **Location:** `LandingPage.tsx:433`, `:730`, `LandingPageSalud.tsx:254`, `:479` (🇲🇽: Windows has no flag glyphs, so owners on Windows desktops see the regional letters "MX"); mockup `LandingPage.tsx:130` (🔔), `:178` (✂), `:209` (✓); `ListaEsperaPublicaPage.tsx:45` (🏪); `ResenaPage.tsx:59` (😔), `:71` (⭐); `NegociosAdminPage.tsx:1855` (⚠️)
- **Fix:** Write "México" in text, and use lucide icons (`Bell`, `Scissors`, `Check`, `Store`, `Star`, `AlertTriangle`) or the business initial.
- **Status:** Fixed (commit `f4261c0`). Both landings say "México" without the flag; the landing mockup uses `Bell`, `Scissors`, `Check`; the waitlist header without a logo shows the business initial; the review page uses `AlertCircle` and a `text-rating` `Star`; the admin delete step uses `AlertTriangle`. The decorative "★★★★★" in the login side panel was left (text, not an icon).

### AP-27: The five auth screens use two visual systems, and some copy needs polish
- **Principle:** H4 Consistency; Krug; project rule (neutral professional Spanish)
- **Location:** backgrounds `bg-white` (`LoginPage.tsx:104`, `RegistroNegocioPage.tsx:189`) vs `bg-gray-50` (`RecuperarContrasenaPage.tsx:34`, `RestablecerContrasenaPage.tsx:69`, `VerificarEmailPage.tsx:37`); inputs `py-3 rounded-xl border-gray-200` (Login, Registro) vs `py-2.5 rounded-lg border-gray-300` (Recuperar, Restablecer); headings `text-2xl font-bold` vs `text-xl font-semibold`; "Agiliza Tu Negocio" in title case (`RegistroNegocioPage.tsx:182`, `:408`, `VerificarEmailPage.tsx:86`); gendered "Bienvenido de nuevo" (`LoginPage.tsx:191`, suggest "Inicia sesión"); off-system blue decorative circles on mobile (`LoginPage.tsx:106-108`); no `<h1>` on any auth page; 404 "← Volver" is a no-op when the 404 is the first page in the tab (`NotFoundPage.tsx:24`)
- **Fix:** One `AuthShell` (logo, card, footer) and the DC-19 `Campo` primitive for every auth form. Apply the copy edits. Promote each page heading to `<h1>`. Hide "Volver" on the 404 when there is no history.
- **Status:** Fixed (commit `f4261c0`), with shared classes instead of an `AuthShell` component. `lib/clasesAuth.ts` (`FONDO_AUTH`, `TARJETA_AUTH`, `TITULO_AUTH`, `campoAuth`, `BOTON_PRIMARIO_AUTH`, `BOTON_SECUNDARIO_AUTH`) is used by recovery, reset, verification and the registration screens: `bg-slate-50` page, one card, `py-3 rounded-xl border-slate-200` fields, 44px buttons, `text-2xl font-bold` headings. Every auth screen has an `<h1>` (login and 2FA promoted). Copy: "Agiliza tu negocio", "Inicia sesión"; the blue circles on mobile login are slate. The reset page also gained labelled fields and focusable, named 44px show/hide buttons. The 404 hides "Volver" without history. Not done: login and registration keep their own (already matching) field markup rather than `campoAuth`.

### AP-28: Dead `dark:` classes on a light-only public route
- **Principle:** `CLAUDE.md` theme scope (public routes never carry `.dark`)
- **Location:** `MisCitasPage.tsx:280`, `:400`, `:401`, `:404`, `:490`, `:491`, `:494`, `:586`. No other in-scope public, auth, legal or 404 file has `dark:` classes (verified by search).
- **Fix:** Remove them so nobody mistakes them for a supported dark theme.
- **Status:** Fixed (commit `0fcf188`), as a side effect of AP-25: `MisCitasPage.tsx` no longer has any `dark:` class.

---

## New occurrences of earlier findings

Not re-counted above; fix with the original item.

| Earlier finding | New locations in this scope |
| --- | --- |
| BF-09 Low-contrast informative text | `slate-400`/`gray-400` subtitles and metadata: `LoginPage.tsx:192`, `:182`; `RegistroNegocioPage.tsx:161`, `:198`, `:220`, `:280`; `MisCitasPage.tsx:197`, `:328`, `:339`; `ListaEsperaPublicaPage.tsx:177`; `CancelarCitaPage.tsx:71`, `:86`, `:140`; `ResenaPage.tsx:91`; landing trust strips `LandingPage.tsx:465`, `LandingPageSalud.tsx:286`; `red-500` errors on every auth form; landing footer headings `slate-600` on `#070E1A`, about 2.5:1 (`LandingPage.tsx:709`, `:720`, `:730`) |
| BF-12 Errors not announced | No `role="alert"` on any auth error box (`LoginPage.tsx:167`, `:238`; `RegistroNegocioPage.tsx:374`; `RecuperarContrasenaPage.tsx:83`; `RestablecerContrasenaPage.tsx:164`), nor in `ListaEsperaPublicaPage.tsx:219`, `CancelarCitaPage.tsx:189`, `:210`, `ResenaPage.tsx:131`, `MisCitasPage.tsx:277`, `:408`, `:597` |
| BF-18 Every error shown as "not found" | `CancelarCitaPage.tsx:76-90`, `ResenaPage.tsx:55-65`, `ListaEsperaPublicaPage.tsx:117-129`, `VerificarEmailPage.tsx:28-33` (no retry in any) |
| BF-19 Reschedule ignores minimum notice | `MisCitasPage.tsx:590-595` |
| BF-23 Hard-coded hex | `ListaEsperaPublicaPage.tsx:17` (`#0C0C0F`); both landings use inline hex for every surface (`SLATE_700`, `DARK`, `#FEF9EC`, `#070E1A`) |
| DC-06 Status colors not tokenized | `MisCitasPage.tsx:38-44` (own status map; `--status-*` tokens exist) |
| DC-09 Icon buttons without names | `MisCitasPage.tsx:511-517`, `:543-549` (pagination arrows), `:573-578` (close reschedule sheet); `PrivacidadPage.tsx:10-16`, `TerminosPage.tsx:10-15` (back) |
| DC-10 Drawer not keyboard operable | `AdminLayout.tsx:70-128` (labelled buttons, but no Escape, focus trap or focus return). **Fixed (pending commit):** below `md` the closed drawer is `inert`; open, it is `role="dialog"` + `aria-modal`, focus moves to "Cerrar el menú", Tab is trapped, Escape closes it and focus returns to the menu button (same code path as DashboardLayout). Tests: `AdminLayout.test.tsx` |
| DC-18 Custom overlays | `MisCitasPage.tsx:560-615` (reschedule sheet: no `role="dialog"`, Escape or focus trap). **Fixed (pending commit):** the sheet is a Radix Dialog (labelled by "Reagendar cita", focus trap, Escape, scroll lock) with focus returned to the "Reagendar" button that opened it; the close button is named "Cerrar". Tests: `MisCitasPage.test.tsx` |
| DC-19 Unlabeled fields, password toggles | `<label>` without `htmlFor` on every auth form (`LoginPage.tsx:196`, `:211`; `RegistroNegocioPage.tsx:205-352`; `RecuperarContrasenaPage.tsx:66`; `RestablecerContrasenaPage.tsx:105`, `:136`), `MisCitasPage.tsx:230-251`, `ListaEsperaPublicaPage.tsx:182-217`, admin modals `NegociosAdminPage.tsx:531`, `:544`, `:587-618`, `:1565-1625`, `:1674-1696`, `:1741-1770`; 2FA code input labelled only by placeholder (`LoginPage.tsx:156-166`); password toggles with `tabIndex={-1}` and no `aria-label` (`LoginPage.tsx:226-233`, which also only reacts to `onMouseDown`; `RegistroNegocioPage.tsx:336-344`, `:361-369`; `RestablecerContrasenaPage.tsx:118-126`, `:149-157`) |
| DC-20 Off-system colours | Admin card: seven tinted hues (amber, red/emerald, blue, sky, violet, slate, destructive) in one action grid (`NegociosAdminPage.tsx:865-920`); amber active nav and yellow "Admin" pill (`AdminLayout.tsx:13`, `:55`, `:137`); `bg-gray-900` primary on the review page (`ResenaPage.tsx:137`) |
| DC-21 Micro text | `text-[10px]`/`text-[11px]` badges and labels: `NegociosAdminPage.tsx:195`, `:206`, `:217`, `:540`, `:587-618`, `:658-686`, `:793`, `:805`; `PublicFooter.tsx:7-22`; legal footers; landing mockup `text-[9px]` (decorative) |
| DC-22 Small targets | `MisCitasPage.tsx:342-397` (see AP-25), `:511-549` (36px pagination); admin payment-history icons `p-1.5`, about 26px (`NegociosAdminPage.tsx:692-722`), inline confirm links `text-[11px]` (`:675-687`); "Emp. extra" inputs about 26px tall (`:478`, `:1478`) |
| DC-27 Inactivity logout | `AdminLayout.tsx:35`, `:131` (`main` is the scroll container, so scrolling the admin does not count as activity). **Fixed (pending commit):** the shared hook already listens in capture phase; AdminLayout now renders its "¿Sigues ahí?" warning through the shared `components/AvisoInactividad.tsx` (also used by DashboardLayout). Tests: `AdminLayout.test.tsx` |
| DC-29 2FA recovery | `LoginPage.tsx:143-187` (no "usar código de recuperación" option) |
| DC-32 Errors read as empty | `NegociosAdminPage.tsx:1016-1026` (no `isError` on metrics or subscriptions: a failure shows "No hay negocios registrados · Crea el primero"); `MisCitasPage.tsx:277-282`. **Admin part fixed (pending commit):** a failure of either query replaces the KPI strip with `ErrorCarga` ("Reintentar" refetches the failed query), hides the count subtitle and suppresses the empty states. Tests: `NegociosAdminPage.test.tsx` |
| DC-36 gray/slate mix | Every auth file and both admin pages mix `gray-*` and `slate-*` within components |
| OM-06 Waitlist "Notificar" | Public promise at `ListaEsperaPublicaPage.tsx:162` (AP-19) |
| OM-26 Admin/owner-chosen passwords | SuperAdmin sets the owner's initial and reset passwords (`NegociosAdminPage.tsx:1669-1729`, `:1770-1791`) |
| OM-30 One pending toggle freezes every row | `NegociosAdminPage.tsx:1394` (AP-06) |

## Cross-screen patterns

| Concern | What these screens do today | Fix once in |
| --- | --- | --- |
| Auth shell | Five pages, two backgrounds, two input styles, two heading styles, logo + caption duplicated | `AuthShell` + DC-19 `Campo` (label, hint, error, `aria-describedby`, `role="alert"`) |
| Password fields | Four copies of the show/hide button, all unreachable by keyboard; rules in placeholders; meter based on minimum rules | One `CampoContrasena` with a focusable toggle, live rule checklist and better meter (AP-12) |
| Email-link pages (verify, reset, cancel, review) | Each treats every error as "invalid link" and offers no next step | One `EnlaceCaducado` state: diagnosis, "Reintentar" for network errors, and the matching "pedir un nuevo enlace" action (AP-03, AP-14, BF-18) |
| Brand color on public pages | `brandSolid` in booking, raw color in waitlist, slate elsewhere | Always `brandSolid`/`brandAccent` (AP-19) |
| Rating and status colors | Gold stars (review), own status map (Mis citas) | `rating` and `status-*` tokens, which already exist (AP-05, DC-06) |
| Landing components | `Navbar`, `PricingCard`, `NegocioCard`, `FeatureCard`, `useFadeInUp` copy-pasted between two files with inline hex | One `components/landing/` module on tokens; fixes AP-08, AP-09, AP-20, AP-21 in one place |
| Product truth | Activation (FAQ vs success screen vs banner), "gratis" vs paid plans, "5 minutos" vs 24–48 h, privacy facts | One source for these claims, reviewed by the owner (AP-02, AP-08, AP-16, AP-22) |
| Page titles | Three routes set `document.title` | `useTituloPagina` on every route (AP-17) |
| Admin feedback | Some mutations toast success, others close silently or fail silently | Every admin mutation: pending on the item, success toast, error toast with server message (AP-06, AP-23) |

## What Works Well

- **No account enumeration where it matters most:** password recovery always answers "Si el correo está registrado…" (`RecuperarContrasenaPage.tsx:51`), resend verification is generic on the server (`PublicoController.cs:1109-1112`), and login returns the same "Credenciales inválidas" for unknown and wrong passwords; "correo no verificado" is revealed only after a correct password (`AutenticacionController.cs:49-66`).
- **Password basics are right:** paste is never blocked, every password field has show/hide, and `autoComplete` is set to `current-password` / `new-password` / `one-time-code`; the 2FA field is numeric, strips non-digits and autofocuses (`LoginPage.tsx:156-166`).
- **Thoughtful slug field:** it derives from the business name with accents stripped, stops following once edited, and checks availability with a 500 ms debounce whose cleanup discards stale responses (`RegistroNegocioPage.tsx:36-106`). Submit is blocked only while checking or when the slug is taken, and the reason is shown inline.
- **Theme scoping is correct and documented:** `temaPorRuta.ts`, `TemaPorRuta.tsx` and the `index.html` boot script agree; public routes also force `color-scheme: light`. Only `MisCitasPage` carries leftover `dark:` classes (AP-28).
- **Admin craft:** real `role="switch"` toggles with the label inside the hit area (`NegociosAdminPage.tsx:944-987`), `aria-pressed` on plan/sector/period pills, 44/36px targets, deleting a business requires typing its name plus a second step, "de por vida" instead of "37160 d", testers excluded consistently from every revenue figure (with the reasoning in comments).
- **Audit log resilience:** a half-typed UUID no longer blanks the table; the query is not sent and the field explains why (`AuditLogPage.tsx:27-50`, `:116-120`); error with "Reintentar"; distinct empty states with distinct accessible names.
- **Landing hierarchy:** a short, concrete headline ("Tu agenda online. Sin llamadas."), one primary CTA plus a secondary "Ver precios", an honest trust strip (the comment explains why no rating is shown), clickable real businesses, an FAQ that discloses activation, a mobile sticky CTA that hides when the final CTA is visible, and a CSS-only hero (no image weight on the landing's LCP).
- **Cancel page safeguards:** labelled email field, cancellation window shown before acting, two-step confirmation with a neutral "Volver", and an "already cancelled" state (`CancelarCitaPage.tsx:116-229`).
- **Mis citas basics:** layout-shaped skeleton, inline cancel confirmation, "Sin cambios permitidos" when the policy window has passed, and a "Repetir" deep link that preselects service and professional.

## Decisions Needed From the Owner

1. **AP-02:** Is manual activation intended long-term, and who tells the owner when the page goes live (automatic email or the owner writes in)?
2. **AP-04:** Should clients who book with only a phone be able to reschedule or cancel themselves (for example with a one-time code)?
3. **AP-08:** The Pro annual price, and whether "Comenzar gratis" is accurate without a free plan or trial.
4. **AP-09:** Does the marketing site get an exception to "gold is logo-only"? If yes, which gold text token passes contrast.
5. **AP-10:** Load Inter as documented, or adopt the system font stack and update `CLAUDE.md`.
6. **AP-16:** Legal review of the privacy policy (storage, hashing, contact addresses).
7. **AP-22:** Hide or reframe "Negocios reales" on `/salud` until there is a health customer; confirm WhatsApp reminders are live before advertising them.

## Recommended Order of Work

1. **AP-01, AP-21, AP-08 (price data), AP-12 (rule alignment), AP-23 (validation):** small, contained correctness fixes.
2. **AP-02, AP-03, AP-14, AP-07:** the owner's first-run path end to end (success screen, verification recovery, reset recovery, admin activation queue). AP-02 and AP-07 need the owner's decision and two backend fields.
3. **AP-05, AP-04, AP-18, AP-19, AP-25:** client self-service pages (`impeccable harden`, `clarify`).
4. **AP-06** with OM-30, then the admin feedback pass (AP-23, AP-24).
5. **AP-10, AP-11, AP-17:** cross-app platform fixes (font, logo asset, page titles); `impeccable optimize` / `typeset`.
6. **AP-09, AP-20, AP-22** after the owner's decisions; extract the shared landing module first. Then `impeccable polish`, and AP-26 … AP-28.
7. Verify in a rendered build at 375px and 1280px (admin in light and dark), with a screen reader on the review and auth pages, before closing.

## Out of Scope: Security

Not counted above; route to a `review-risk` pass.

- **High — stored XSS reaching the SuperAdmin through the subscription receipt.** `NegociosAdminPage.tsx:133-166` builds the receipt HTML by interpolating `pago.negocioNombre`, `pago.notas` and `pago.registradoPorEmail` without escaping, and `:168-175` writes it with `document.write` into `window.open("")`, which is same-origin with the app. `negocioNombre` comes from **anonymous public registration** (`RegistroNegocioDto.cs` only limits length; no sanitization found in the backend). Printing a receipt for a business named with markup runs that script in the SuperAdmin's origin, where the session tokens live in `localStorage`. This is the same sink as the `PagosPage` note in `dashboard-core.md`, but with an unauthenticated source and the highest-privilege victim.
- **JWT in a URL:** the "Tareas programadas" link puts the access token in a query string (`AdminLayout.tsx:107`), where it lands in browser history, server logs and any proxy.
- **Tokens in `localStorage`:** `authStore.ts:25` persists access and refresh tokens, so any XSS (above) can exfiltrate them. The privacy page claims cookies (AP-16).
- **Enumeration:** registration answers "Ya existe una cuenta con este correo." (`PublicoController.cs:893-894`), and login returns a distinct 429 "Cuenta bloqueada" only for existing accounts (`AutenticacionController.cs:53-54`). Both are rate-limited; decide whether that trade-off is acceptable.
- **Password policy:** 6 characters minimum with uppercase and digit (`Program.cs:71-75`); lockout after 5 failures for 15 minutes is in place.
- **Client self-service identity:** Mis citas lists a client's appointments (services, staff, dates, confirmation codes) to anyone who knows their phone number, with no verification; the lookup is stored in `localStorage` under one global key across all businesses (`MisCitasPage.tsx:13`, `:72-75`, `:134`), so a shared device reopens it. The client's email travels as a query parameter on `DELETE`/`PATCH` (`MisCitasPage.tsx:150`, `:168`; `CancelarCitaPage.tsx:54`), which ends up in access logs.
- **Admin overrides:** "Confirmar correo" bypasses verification in one click (`NegociosAdminPage.tsx:889-895`), and the SuperAdmin sets owners' passwords (OM-26).
