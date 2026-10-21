# UI/UX Improvement Roadmap

- **Date:** 2026-10-20
- **Branch:** `docs/front-claude-md`
- **Sources:** [`booking-flow.md`](booking-flow.md) (BF), [`dashboard-core.md`](dashboard-core.md) (DC), [`owner-management.md`](owner-management.md) (OM), [`auth-public-admin.md`](auth-public-admin.md) (AP)
- **Commits so far:** `1e21323` (BF sev-3), `26bbc55` (BF sev-2), `4de5ebd` (DC sev-4/3 and the three print-window XSS fixes). The OM sev-3 batch, plus some DC follow-ups, is implemented but **not committed**. Its review is still pending.
- **Caveat:** All four audits are code-based. Nothing has been checked in a rendered build yet. See [Manual verification](#7-manual-verification-checklist).

**Bottom line:** 124 findings. 40 are fixed (7 of those not yet merged), 19 are partly fixed, 46 are open, and 19 are blocked only by a product decision. No severity-4 item is still open. The next step is to merge the OM batch. After that: get answers to 20 product questions, build the toast-with-undo primitive, and close the 8 open AP severity-3 items.

---

## 1. Executive summary

### Status by report

| Report | Total | Fixed (committed) | Fixed (pending commit) | Partially fixed | Open | Decision needed |
| --- | --- | --- | --- | --- | --- | --- |
| Booking flow (BF) | 27 | 22 | 0 | 0 | 5 | 0 |
| Dashboard core (DC) | 36 | 11 | 0 | 13 | 8 | 4 |
| Owner management (OM) | 33 | 0 | 7 | 6 | 12 | 8 |
| Auth, public, admin (AP) | 28 | 0 | 0 | 0 | 21 | 7 |
| **Total** | **124** | **33** | **7** | **19** | **46** | **19** |

Notes on the counts:

- "Decision needed" counts only items that are open **and** blocked by a decision. DC-03 and DC-28 are partly fixed, and each still has a decision left. That brings the total number of decision items to **21**, consolidated in section 2.
- The BF severity-2 status lines in `booking-flow.md` still say "pending commit". They were committed in `26bbc55`.

### Status by severity

| Severity | Count | Fixed | Partial | Open | Decision |
| --- | --- | --- | --- | --- | --- |
| 4 Catastrophic | 3 | 2 | 1 (DC-03) | 0 | 0 |
| 3 Major | 38 | 24 | 3 | 5 | 6 |
| 2 Minor | 70 | 14 | 14 | 29 | 13 |
| 1 Cosmetic | 13 | 0 | 1 | 12 | 0 |

### Baseline scores (before fixes)

| Area | Nielsen / Krug | Refactoring UI | impeccable health |
| --- | --- | --- | --- |
| Booking flow | 6 / 10 | 6 / 10 | 12 / 20 |
| Dashboard core | 4 / 10 | 6 / 10 | 9 / 20 |
| Owner management | 5 / 10 | 5 / 10 | 10 / 20 |
| Auth | 5 / 10 | 6 / 10 | 11 / 20 (web-typography 5 / 10) |
| Public client pages | 5 / 10 | 5 / 10 | 10 / 20 |
| Landings | 6 / 10 | 6 / 10 | 11 / 20 (top-design 5 / 10) |
| Admin | 6 / 10 | 6 / 10 | 13 / 20 |

Scores have not been re-measured after the fixes. Re-score each area after its manual verification pass.

---

## 2. Decisions needed from the product owner

Ordered by impact. Duplicates across reports are merged into one row.

| # | IDs | Question | Options and tradeoffs | Recommended default | Blocks |
| --- | --- | --- | --- | --- | --- |
| 1 | AP-02 (+AP-07) | Is manual activation permanent, and who tells the owner when the page goes live? | Manual approval keeps quality control but adds a 24–48 h delay. Auto-activation onboards instantly but loses vetting. | Keep manual approval for now. Send an automatic email on activation. Show "24–48 h" on the success screen, the banner and the FAQ. | AP-02 copy, the priority of the AP-07 queue, the "5 minutos" claims |
| 2 | DC-14 | What may an Empleado do in Citas and Pagos? | Full parity is simple but risky. A restricted role is safer but needs backend enforcement. | Empleado cannot export, revert payments, close cash or edit clients globally. Empleado can charge and register deposits on their own appointments. | Hiding controls; backend rule audit |
| 3 | DC-13 | How is kiosk mode secured? | An exit password or PIN is cheap but depends on the owner's session. A restricted kiosk token or role is robust but needs backend work. | Require a password to exit now, and hide the exit behind a long-press. Add a restricted token later. | DC-13 |
| 4 | AP-04 | Can phone-only clients reschedule or cancel themselves? | A message only costs nothing, but clients still call the business. An OTP by SMS or WhatsApp gives self-service, but it costs money and needs backend work. | Show an explanatory message now. Add an OTP later, together with the Mis citas security fix (section 3). | AP-04 self-service |
| 5 | AP-08 | What is the Pro annual price, and is "Comenzar gratis" accurate? | Option 1: give Pro an annual price. Option 2: label it "Sin descuento anual". For the "gratis" claim: either remove it or add a trial. | Give Pro an annual price. Replace "gratis" unless a trial exists. | AP-08 pricing data and copy |
| 6 | OM-06 (+AP-19) | Does "Notificar" on the waitlist send a message? | An email via the existing `NotificarListaEsperaAsync` job is automatic but needs wiring. A WhatsApp deep link needs no backend but is manual. "Record only" is honest but adds no value. | Open a WhatsApp deep link and record the state. Turn on email later. | OM-06 label, AP-19 success copy |
| 7 | OM-17 | What happens to future appointments when an employee or service is deleted? Can coupons be reactivated? | Cancel and notify, reassign, or block deletion. | Make "Desactivar" the default. Block deletion while future appointments exist. Allow coupons to be reactivated. | OM-17 dialogs and coupon list |
| 8 | OM-26 (+AP admin overrides) | Should employee and owner access move to an email invitation? | Invitation is secure but needs a backend link flow. The current owner-chosen password ships today but is insecure. | Email invitation with a set-password link. Until then, force a password change on first login. | OM-26; security item S6 |
| 9 | DC-29 (+AP login) | Should 2FA issue recovery codes, and is it mandatory for owners? | Codes prevent lockouts but need backend work. Making 2FA mandatory improves security but adds onboarding friction. | Issue recovery codes. Keep 2FA optional and promoted to owners. | DC-29, the "usar código de recuperación" login option |
| 10 | OM-09 | May owners export the full client directory? | Full export is useful, but it is a personal-data risk. Page-only export is safe but misleading. | Allow full export with an audit-log entry. | OM-09; security item S7 |
| 11 | OM-29 | What exactly happens when an owner deletes their account? | Immediate deletion or a grace period; cancel future appointments with client notice. | A 30-day grace period. Cancel future appointments with notice. Offer a data export first. | OM-29 dialog copy |
| 12 | DC-28 | Which client identity may the kiosk show? Should it support check-in? | Full name, first name and initial, or code only. Read-only or check-in. | First name and initial. Read-only. | DC-28 remainder |
| 13 | AP-16 | Legal review of the privacy policy | Fix the facts only, or do a full legal review. | Fix the facts now (PBKDF2, `localStorage`, one contact address). Run the legal review afterwards. | AP-16 |
| 14 | DC-30 | Which bulk actions should Citas support? | None, "Confirmar seleccionadas", or both "Confirmar seleccionadas" and "Enviar recordatorio". | Both actions. Needs a batch endpoint. | DC-30 |
| 15 | OM-21 | What does "aprobada" mean for reviews? Can owners approve, hide or reply? | Show approved reviews only, or add moderation and replies. | Show approved reviews only, with a server-side average. Replies later. | OM-21 |
| 16 | OM-27 + AP-22 | Is a WhatsApp notification channel planned? Should "Negocios reales" stay on `/salud`? | Advertising WhatsApp before it works erodes trust. | Show plain text: "Las notificaciones se envían por correo". Do not advertise WhatsApp on `/salud`. Hide "Negocios reales" until there is a health customer. | OM-27, AP-22 |
| 17 | AP-10 | Load Inter, or adopt the system font stack? | Self-hosted Inter gives a consistent brand for about 30–50 KB. The system stack costs nothing but renders differently on each OS. | Self-host Inter as a variable WOFF2 file. | AP-10, typography tuning |
| 18 | AP-09 | Does the marketing site get an exception to "gold is logo-only"? | An exception keeps brand warmth but needs a darker gold token that passes contrast. No exception keeps one visual language. | No exception. Use slate accents. | AP-09 |
| 19 | DC-03 | Keep the "salud" sector colour scheme in the dashboard sidebar? | Keeping it differentiates the sector, and the tokens already exist. Removing it means less to maintain. | Keep it. It is tokenized at 5.6:1 or better. | Closing DC-03 |
| 20 | OM-15 | Is reordering gallery photos and intake questions in scope? | A sortable list with keyboard buttons, or no reordering at all. | Out of scope for now. Remove the "en el mismo orden" promise. | OM-15 |

---

## 3. Security follow-ups (not UX)

These were flagged during the audits but are outside the UX scope. Route them to a `review-risk` pass. The severity values are estimates.

| # | Item | Location | Severity (est.) | Recommended fix |
| --- | --- | --- | --- | --- |
| S1 | Stored XSS in three print windows: subscription receipt (anonymous source, SuperAdmin victim), cash closing, receipt ticket | `NegociosAdminPage.tsx`, `PagosPage.tsx`, `TicketRecibo.tsx` | High | **Fixed in `4de5ebd`.** `escapeHtml` is in `src/utils/html.ts`, and tests show that `<img onerror>` renders as text. |
| S2 | JWT in a URL query string ("Tareas programadas" / Hangfire link) | `src/layouts/AdminLayout.tsx:~107` | High | Use a short-lived one-time ticket, or a cookie-authenticated Hangfire dashboard. Never put the access token in the URL. |
| S3 | Session tokens in `localStorage` | `src/store/authStore.ts:25` | Medium–High | Move the refresh token to an `httpOnly` `SameSite` cookie and keep the access token in memory. Until then, the XSS hygiene from S1 is critical. |
| S4 | Mis citas: lookup by phone number with no verification. One global `localStorage` key across all businesses. Client email sent in query strings on `DELETE` and `PATCH`. | `MisCitasPage.tsx:13`, `:72-75`, `:134`, `:150`, `:168`; `CancelarCitaPage.tsx:54` | Medium | Require an OTP (decision 4) or a signed link. Key storage per business and add "Olvidar este dispositivo". Move the email into the request body or a signed token. |
| S5 | Account enumeration: registration answers "Ya existe una cuenta…", and lockout returns a distinct 429 only for accounts that exist | `PublicoController.cs:893-894`, `AutenticacionController.cs:53-54` | Low–Medium | Return a generic registration response and send the "you already have an account" message by email. Make the lockout response the same as the invalid-credentials response. Keep the rate limits. |
| S6 | Owner-chosen employee passwords (6-character minimum, no forced change). The SuperAdmin also sets owners' passwords. | `EmpleadosPage.tsx:53-56`, `:845-890`; `NegociosAdminPage.tsx:1669-1791` | Medium | Email invitation with a set-password link (decision 8). Force a change on first login. Raise the minimum to 8 or more characters. |
| S7 | Client data export (phone, email, internal notes) with no audit trail | `ClientesPage.tsx:153-165`, `ReportesPage.tsx:182-197` | Medium | Write an audit-log entry for every export (who, when, row count). Tie this to decision 10. |
| S8 | The admin "Confirmar correo" button bypasses email verification in one click | `NegociosAdminPage.tsx:889-895` | Low | Add a confirmation step and an audit-log entry. |
| S9 | Excel cells that start with `=` (possible formula injection) | `src/utils/exportarExcel.ts:130`, `:166` | Low | Confirm how Excel opens these cells. Prefix risky values with `'` if needed. |

---

## 4. Backend gaps that block UX fixes

| Gap | Needed by | Frontend status |
| --- | --- | --- |
| `tieneIntake` flag on `ServicioPublico` | BF-10 (stable step total) | Fixed except when intake questions are tied to specific services |
| `diasAnticipacionMinima` on `ConfirmacionCitaDto` (`/publico/citas/{codigo}`) | BF-19 and its new occurrence in `MisCitasPage.tsx:590-595` | The frontend passes it, but it has no effect until the backend sends it |
| Weekly availability endpoint to replace 7 per-day requests | BF-06 | Fixed through per-day prefetch, which costs 7 round trips per week |
| `PATCH` to save the cover position (`PortadaObjectPosition`) on its own | OM-04 | The UI is honest ("Posición sin guardar"), but the position is not persisted on "Confirmar" |
| Undo window: keep deleted assets on the server until the undo window ends | OM-11 (logo, cover, policies image) | Confirmations shipped; no undo |
| `fechaCreacion` and `emailConfirmado` in `NegocioMetricasDto` | AP-07 (pending-activation queue) | Open |
| Endpoint to correct the email after sign-up | AP-03 | Open |
| Align password rules (`RequireLowercase`) and return `errores` | AP-12 | Open |
| Batch endpoint for confirm and remind | DC-30 | Decision |
| 2FA recovery codes | DC-29 | Decision |
| Full client export endpoint plus audit log | OM-09, S7 | Decision |
| Approved-only review list with server-side average and distribution | OM-21 | Decision |
| Order field for gallery and intake | OM-15 | Decision (recommended: out of scope) |
| Coupon expiry at end of day in the business time zone; coupon reactivation | OM-24, OM-17 | Open / decision |
| Audit-log search by email | AP-24 | Open |
| Restricted kiosk token or role | DC-13 | Decision |
| Backend enforcement of the Empleado permission matrix | DC-14 | Decision |

---

## 5. Remaining open work by phase

Size: **S** is under half a day, **M** is 1–2 days, **L** is 3 days or more. Items marked "after decision N" wait on section 2.

### Phase 0: close the current batch

| ID | Work | Size |
| --- | --- | --- |
| OM sev-3 batch and DC follow-ups | Finish the pending review, then commit (OM-01…11, OM-12, and the follow-ups for DC-01, DC-04, DC-07, DC-08 and DC-12) | S |

### Phase 1: remaining severity-3 work and enablers

| ID | Description | Area | Size |
| --- | --- | --- | --- |
| DC-17 | Toast store: live region, errors that stay visible, and an `accion` (undo) field. This unblocks DC-07, DC-33, OM-11, OM-31 and AP-06. | Shared | M |
| AP-01 | Remove `?sector=belleza` from the main landing CTAs and keep the sector editable | Landing / auth | S |
| AP-21 | Replace `bg-white/96` with `bg-white/95` on both landings | Landing | S |
| AP-05 | Review stars as a radio group, the `rating` token, a labelled comment field, the server error message | Public | S |
| AP-06 | Confirm admin deactivation, set pending state per card, show a result toast | Admin | S |
| AP-03 | Add "Reenviar enlace" and a network retry on the verification error page. Email correction needs the backend. | Auth | M |
| AP-04 (decision-free part) | Explain why phone-only lookups cannot change appointments, and show a way to contact the business | Public | S |
| AP-08 (decision-free part) | Pass `?plan=` into registration and use `formatPrecio` on the cards | Landing | S |
| AP-07 | "Pendientes de activación" filter, registration date, email-verified badge (needs the backend DTO) | Admin | M |
| AP-02 | "Qué sigue" on the success screen, with the banner and FAQ aligned (after decision 1) | Auth / dashboard | S |
| AP-11 | Replace the 488 KB logo with an SVG or about 15 KB WebP, add `width`/`height`, use a tiny variant in the footer | Cross-app | S |
| OM-11 (rest) | Undo toasts for asset deletion and visibility changes (after DC-17 and the server retention gap) | Owner | M |
| OM-03 (rest) | Guard programmatic `navigate()`. This needs a data router (`useBlocker`) or a navigation wrapper. | Owner / shell | M |
| OM-04 (rest) | Persist the cover position on "Confirmar" once the `PATCH` endpoint exists | Owner | S |

AP-10 (Inter font loading) is handled through decision 17.

### Phase 2: severity-2 work by area

**Dashboard core**

| ID | Description | Size |
| --- | --- | --- |
| DC-16 (rest) | Keep the Citas filters in `useSearchParams`, and use `navigate(-1)` when there is history | M |
| DC-15 (rest) | "Por cerrar" label and inline Completar for past appointments that are still open | S |
| DC-18 (rest) | Notifications bell as a Radix Popover, with notification items as buttons | S |
| DC-19 (rest) | `Campo` primitive, and migrate the CitasPage, MiPerfil and Pagos forms | L |
| DC-20 / DC-21 / DC-22 (rest) | Categorical chart palette tokens, a 12px text floor for KPI and kiosk text, 44px calendar and Gantt toggles | M |
| DC-23 | Calendar opens in day view below `sm` | S |
| DC-24 | `formatPrecio` everywhere; Pagos KPIs stack on mobile | S |
| DC-25 | Clickable pending chip in both headers | S |
| DC-26 (rest) | AnimatedCounter animates from the previous value and respects reduced motion | S |
| DC-27 | Warning before inactivity logout; listen for scroll on `main` (the same fix applies to AdminLayout) | S |
| DC-31 (rest) | Dismiss buttons read "Volver" or "Cerrar" in the remaining CitasPage modals | S |
| DC-32 (rest) | Error states with "Reintentar" in the Gantt and the Citas list | S |
| DC-33 | Undo for deleted time blocks, notes and notifications (after DC-17) | S |
| DC-28 (rest) | Kiosk loading and "Sin conexión" states (identity after decision 12) | S |

**Owner management**

| ID | Description | Size |
| --- | --- | --- |
| OM-13 | Save bar driven by `isPending`, disabled when nothing has changed | S |
| OM-14 / OM-16 | Shared `useSubirImagen`: type and size checks, per-file progress, input reset | M |
| OM-18 | Chart palette tokens, themed axes, `accessibilityLayer`, heatmap trimmed to business hours | M |
| OM-19 | Local-date period, typed Excel cells, failure toast | S |
| OM-20 | Shared inline error with "Reintentar" in every Reportes tab | S |
| OM-22 | One `EditorHorario` for business and employee schedules, with "Aplicar a todos" | L |
| OM-23 (rest) | Error borders that stay visible in dark mode on the Empleados forms | S |
| OM-24 | Coupon form on react-hook-form and zod, a "Válido hasta (incluido)" label, an edit action | M |
| OM-25 | Option-list editor, labelled icon buttons, neutral "Obligatoria" badge | M |
| OM-28 | Dedicated QR print sheet | S |
| OM-30 (rest) | "Visible en reservas" switch with per-row pending state | S |
| OM-31 (rest) | Labelled waitlist actions, undo for Expirar, filtered empty state | S |

**Auth, public and admin**

| ID | Description | Size |
| --- | --- | --- |
| AP-12 | Live password checklist, client and server rules aligned, a better strength meter | M |
| AP-13 | Registration: stale errors cleared, sector as a radio group, autocomplete tokens | S |
| AP-14 | "Solicitar un nuevo enlace" on the reset-password error states | S |
| AP-15 | Legal pages: back button with a fallback, 16px body text, `max-w-prose` | S |
| AP-17 | `useTituloPagina` on every route | S |
| AP-18 | Cancel page: handle completed and past appointments, add a Reagendar link | S |
| AP-19 | Waitlist: `brandSolid` button, link back to the business, service name shown | S |
| AP-20 | Landing: reduced-motion support, ARIA states on the FAQ, menu and billing toggle | S |
| AP-23 | Admin billing validation and success/error toasts; confirm sector changes | M |
| AP-24 | Audit log: search by email, Spanish action labels, date range, expandable rows | M |
| AP-25 | Mis citas: network error with retry, one primary action per card, 44px buttons | S |

Decision-gated severity-2 items (DC-14, DC-29, DC-30, OM-15, OM-17, OM-21, OM-26, OM-27, OM-29, AP-09, AP-10, AP-16, AP-22) are scheduled once section 2 is answered.

### Phase 3: severity-1 polish

| ID | Description | Area | Size |
| --- | --- | --- | --- |
| BF-23 | One selectable-card primitive for staff; remove hex literals | Booking | M |
| BF-24 / DC-35 (rest) / AP-26 | Replace emoji with lucide icons; write "México" instead of the 🇲🇽 flag | All | S |
| BF-25 / DC-34 / OM-32 | Copy and sector-term pass (`impeccable clarify`) | All | M |
| BF-26 | "Mis citas" links use `Link` | Booking | S |
| BF-27 | Clipboard fallback | Booking | S |
| DC-36 | Sweep `gray-*` to `slate-*` and the shadcn tokens | Dashboard | M |
| OM-33 | Remove false hover lift; animate only on first mount | Owner | S |
| AP-27 | `AuthShell`, `<h1>` on every auth page, copy edits | Auth | M |
| AP-28 | Remove dead `dark:` classes in MisCitasPage | Public | S |

---

## 6. Cross-cutting design-system work

Build each of these once, then migrate the screens. "Closes" lists the findings each piece resolves or completes.

| Shared piece | Status | Closes |
| --- | --- | --- |
| Toast store with live region and `accion` (undo) | To build | DC-17, DC-07 (undo), DC-33, OM-11, OM-31, AP-06 |
| `Campo` primitive (label, hint, error, `aria-*`, dark-mode error border) | To build | DC-19, OM-23, OM-24, AP-13, plus the DC-19 occurrences in auth, Mis citas and admin |
| `CampoContrasena` (focusable toggle, live checklist, meter) | To build | AP-12, the DC-19 password-toggle occurrences, OM-26 interim |
| `AuthShell` | To build | AP-27, AP-11 (single logo asset) |
| `EnlaceCaducado` state (diagnosis, retry, new-link action) | To build | AP-03, AP-14, the BF-18 occurrences (cancel, review, waitlist, verify) |
| Inline error with "Reintentar" | Partly built (InicioPage) | DC-32, OM-20, AP-25, DC-28, the admin metrics occurrence |
| `ConfirmarAccion` that states consequences | Built; extend | OM-17, OM-29, AP-06, AP-23 (sector change), OM-31 |
| `Modal` dirty prop and route guard | Modal guard built; route guard partial | OM-03 (programmatic navigation) |
| `Switch` | Built | OM-30 (extend the pattern) |
| `useSubirImagen` / `SubidorImagen` | To build | OM-14, OM-16 (OM-07 already fixed) |
| `EditorHorario` | To build | OM-22 |
| Status map `estadoCita` on `--status-*` tokens | Built | Adopt in MisCitasPage (DC-06 occurrence) and the OM status pills |
| Chart and categorical palette tokens | To build | DC-20, OM-18 |
| `formatPrecio` everywhere (plus a compact variant) | Exists; adopt | DC-24, OM-24, AP-08 |
| Typed `exportarExcel` with failure toast | To build | OM-19, OM-09 |
| Sheet / Drawer primitive (Radix Dialog) | To build | DC-10 occurrence in AdminLayout, MisCitas reschedule sheet, DC-18 gallery and cover overlays |
| `components/landing/` module on tokens | To build | AP-08, AP-09, AP-20, AP-21, AP-22 |
| `useTituloPagina` | To build | AP-17 |
| Admin mutation pattern (pending per item, success and error toasts) | To build | AP-06, AP-23, OM-30 |
| Theme hygiene: 12px floor, slate-500 as the lightest informative gray, 44px targets, `brandSolid` on public pages | Convention exists; sweep | DC-21, DC-22, AP-19, the BF-09 occurrences, DC-36 |

---

## 7. Manual verification checklist

Nothing in the four audits was rendered. Check each item in a running build before closing it. Test both roles (Propietario and Empleado) where it applies.

**Viewports and theme**

- [ ] Booking, confirmation, Mis citas, waitlist, cancel and review pages at 375px: no horizontal scroll, the fixed action bar clears the safe area.
- [ ] Public, auth, landing, legal and 404 routes stay light when the OS is in dark mode (BF-07, `temaPorRuta`).
- [ ] Dashboard at 375px and 1280px, in light **and** dark mode: home for both roles (DC-02), Citas, Pagos, 2FA, Mi perfil (DC-11).
- [ ] "Salud" sidebar and mobile header contrast in both themes (DC-03).
- [ ] Status colours match across list, detail, calendar, Gantt and kiosk in both themes (DC-06).
- [ ] Owner screens in dark mode: time blocks, coupon pill, heatmap, client avatar, danger zone, blocked days (OM-08).
- [ ] Admin pages in light and dark mode.

**Touch**

- [ ] Phone action sheet: reschedule, notes, deposit and repeat on list, calendar, Gantt, home and detail (DC-01).
- [ ] Android back button and iOS edge swipe move back one wizard step without losing data (BF-01, BF-02).
- [ ] Gallery delete is visible on touch devices; no hidden tap targets (OM-07).
- [ ] Client cards open the detail view at 375px (OM-10).
- [ ] Cover positioning drag works on touch (DC-18 occurrence).
- [ ] 44px targets on row actions, the revert-payment button and drawer buttons (DC-22).

**Keyboard and screen reader**

- [ ] Wizard step change moves focus to the step heading and is announced (BF-03); errors are announced (BF-12).
- [ ] Booking labels and errors are linked; day and slot buttons announce their pressed state (BF-08, BF-22).
- [ ] Lightboxes trap focus, close on Escape and return focus (BF-20).
- [ ] Dashboard drawer: closed drawer is `inert`, focus is trapped while open, Escape closes it, focus returns to the trigger. User menu closes on Escape (DC-10).
- [ ] `Switch` responds to Space, Enter and the arrow keys and announces its state (OM-02).
- [ ] The "¿Descartar cambios?" dialog appears on Escape, overlay click and sidebar links (OM-03).
- [ ] Review page and auth forms with a screen reader (AP-05, the DC-19 occurrences).

**Behaviour**

- [ ] After 18:00 in UTC-6: "today" is correct on the booking page, dashboard home, badges and pickers (BF-05, DC-04).
- [ ] Overlapping appointments appear side by side; cancelled appointments sit behind active ones (DC-12).
- [ ] Payment, cash-closing and 2FA failures show an inline error (DC-08).
- [ ] The confirmation page headline matches the appointment's status and deposit (BF-04).
- [ ] The cover position shows "sin guardar" and survives an upload (OM-04).
- [ ] The landing navbar gets its background on scroll (AP-21); Inter or the chosen font renders on Windows, Android and iOS (AP-10).
