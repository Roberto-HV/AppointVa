# UI/UX Roadmap: Final State

- **Updated:** 2026-10-21
- **Branch:** `docs/front-claude-md` (6 commits pushed, 5 local; the five admin and Mis citas items in section 5 are fixed in the working tree, pending commit)
- **Sources:** [`booking-flow.md`](booking-flow.md) (BF), [`dashboard-core.md`](dashboard-core.md) (DC), [`owner-management.md`](owner-management.md) (OM), [`auth-public-admin.md`](auth-public-admin.md) (AP)
- **Caveat:** The audits are code-based. Only the checks marked as verified in [section 6](#6-manual-verification-checklist) were done in a browser.

**Bottom line:** 124 findings. 96 are fixed, 19 are partly fixed, and 9 are open pending a product decision. No finding is open only because of the backend. All of the frontend work is committed except the five items listed at the end of section 5, which are fixed in the working tree. What remains is **20 product decisions**, **26 backend changes**, 9 security items (7 still open) and a short list of frontend tasks. Every Status line in the four reports now names the commit that landed it; only the five items fixed in this change still say "Fixed (pending commit)".

---

## 1. Executive summary

### Status by report (recounted from every Status line)

| Report | Total | Fixed | Partially fixed | Open: decision | Open: backend |
| --- | --- | --- | --- | --- | --- |
| Booking flow (BF) | 27 | 27 | 0 | 0 | 0 |
| Dashboard core (DC) | 36 | 30 | 3 | 3 | 0 |
| Owner management (OM) | 33 | 21 | 8 | 4 | 0 |
| Auth, public, admin (AP) | 28 | 18 | 8 | 2 | 0 |
| **Total** | **124** | **96** | **19** | **9** | **0** |

- **Open, waiting on a decision (9):** DC-13, DC-14, DC-30, OM-06, OM-09, OM-15, OM-27, AP-10, AP-16.
- **Partly fixed (19), grouped by what blocks the rest:**
  - A decision (12): DC-03, DC-28, DC-29, OM-17, OM-21, OM-26, OM-29, AP-02, AP-04, AP-08, AP-09, AP-22.
  - The backend (6): OM-04, OM-11, OM-24, AP-03, AP-07, AP-24.
  - Frontend work (1): OM-03.
- **Fixed, but one part only takes effect once the backend changes:** BF-10 (stable step total), BF-19 (minimum notice when rescheduling), DC-07 (a true undo for payment reversal).
- **Open or partial items by severity:** severity 4: 1 (DC-03, already tokenized and readable). Severity 3: 11. Severity 2: 16. Severity 1: 0.

### Commits on `docs/front-claude-md` (`511ebfb..HEAD`)

| Commit | State | What it contains |
| --- | --- | --- |
| `1e21323` | pushed | BF severity 3: step kept in the URL, form state kept across steps, focus handling, honest confirmation status, local dates, availability per day, light-only public pages, labelled fields, contrast |
| `26bbc55` | pushed | BF severity 2, plus fixes for the review warnings |
| `4de5ebd` | pushed | DC severity 4 and 3: action sheet, one status map, local "today", dark mode on Inicio, confirmation before payment reversal, calendar lanes. Also the print-window XSS fixes, and it adds the AP audit report |
| `9083787` | pushed | OM severity 3: schedule modal never saves defaults, `Switch`, unsaved-changes guard, prices with cents, dark-mode contrast, client cards on phones. Adds this roadmap |
| `165386e` | pushed | Citas cards on phones, Spanish sentence-case dates, Inicio agenda shown first, booking step label fits at 375px. Raises the Vitest timeout |
| `a05c9ed` | pushed | The actions sheet stays open across the 640px breakpoint (rotation or resize). Date formatters capitalize the first letter |
| `0153a0a` | local | AP severity 3: editable sector, one activation message, verification resend, phone-only explanation, accessible stars, admin deactivation confirm, annual pricing, 9.8 KB logo, password rules |
| `fa0d25f` | local | DC severity 2: toasts with actions and undo, Citas filters in the URL, inactivity warning, kiosk offline states, Pagos on phones, Seguridad link |
| `d4bde59` | local | OM severity 2: one image uploader, one schedule editor, charts on tokens, typed Excel cells, retry states, intake options editor, QR print sheet |
| `0fcf188` | local | AP severity 2: correct cancel status codes, page titles, legal back button, new-link flows, admin billing validation, audit-log detail |
| `f4261c0` | local | Severity 1 in all four reports (BF-23…27, DC-34…36, OM-32…33, AP-26…27), `gray-*` replaced with `slate-*`, categorical palette, live slug check, review leftovers |

---

## 2. Decisions needed from the product owner

There are 21 decision items. Merging duplicates leaves 20 decisions, ordered by impact. "Done so far" describes what is already shipped while each one waits.

| # | IDs | Question | Options and tradeoffs | Recommended default | Unblocks |
| --- | --- | --- | --- | --- | --- |
| 1 | AP-02 | Is manual activation permanent, and who tells the owner when the page goes live? | Manual approval keeps vetting but delays the start. Auto-activation is instant but drops vetting. | Keep manual approval. Send an automatic email on activation and state a time frame. | Activation email (B21); "5 minutos" claims; priority of the AP-07 queue. Done so far: one honest message on three screens |
| 2 | DC-14 | What may an Empleado do in Citas and Pagos? | Full parity is simple but lets employees export, revert payments and close cash. A restricted role is safer but needs the backend to enforce it. | No export, no payment reversal, no cash closing, no global client edits. Employees may charge and record deposits on their own appointments. | Hiding controls; backend enforcement (B10). The backend already limits status, payment, deposit and notes to the employee's own appointments |
| 3 | DC-13 | How is kiosk mode secured? | A password or PIN to exit is cheap but still runs in the owner's session. A restricted kiosk token is robust but needs backend work. | A password to exit now, with the exit hidden behind a long press. A restricted token later (B9). | DC-13 |
| 4 | AP-04 (+S4) | Can clients who book with only a phone reschedule or cancel themselves? | A message only is free, but those clients still call the business. A one-time code by SMS or WhatsApp gives self-service but costs money and backend work. | Keep the message. Add a one-time code together with the Mis citas security fix (S4). | AP-04; S4. Done so far: explanation and a "Buscar con mi correo" button |
| 5 | AP-08 | What is the Pro annual price? Is "Comenzar gratis" accurate? | Give Pro an annual price, or keep "Sin descuento anual". Remove "gratis", or add a trial. | Give Pro an annual price. Remove "gratis" unless a trial exists. Add "MXN". | AP-08 copy and data; `?plan=` once B20 exists |
| 6 | OM-06 | Should "Marcar como avisado" (waitlist) send a message? | Email through the existing `NotificarListaEsperaAsync` job is automatic but needs wiring. A WhatsApp deep link needs no backend but is manual. | Open a WhatsApp deep link and record the state. Turn on email later. | OM-06; AP-19 success copy |
| 7 | OM-17 | What happens to future appointments when an employee or service is deleted? Can coupons be reactivated? | Cancel and notify, reassign, or block the deletion. | Make "Desactivar" the default. Block deletion while future appointments exist. Allow coupon reactivation. | OM-17 dialogs (B13, B14) |
| 8 | OM-26 (+S6) | Should employee and owner access use an email invitation instead of a password the owner picks? | An invitation is secure but needs a set-password flow. Today's approach works now but the owner knows the employee's password. | Email invitation with a set-password link. Until then, force a password change on first login. | OM-26 (B16, B17); S6 |
| 9 | DC-29 | Should 2FA issue recovery codes? Is 2FA mandatory for owners? | Recovery codes prevent lockouts but need backend work. Mandatory 2FA is safer but adds friction at onboarding. | Issue recovery codes. Keep 2FA optional and promote it to owners. | DC-29 and the login "usar código de recuperación" option (B8) |
| 10 | OM-09 (+S7) | May owners export the whole client directory? | A full export is useful but exposes personal data. Exporting one page is safe but misleading. | Allow the full export and write an audit-log entry for each one. | OM-09 (B18); S7 |
| 11 | OM-29 | What exactly happens when an owner deletes their account? | Delete at once, or after a grace period. Cancel future appointments and notify clients. | A 30-day grace period, future appointments cancelled with notice, and a data export offered first. | OM-29 dialog copy |
| 12 | DC-28 | Which client identity may the kiosk show? Should it support check-in? | Full name, first name and initial, or a code only. Read-only, or check-in. | First name and initial, read-only. | DC-28 remainder |
| 13 | AP-16 | Legal review of the privacy policy | Correct the facts only, or run a full legal review. | Correct the facts now (PBKDF2, `localStorage`, one contact address), then run the legal review. | AP-16 |
| 14 | DC-30 | Which bulk actions should Citas support? | None, "Confirmar seleccionadas", or that plus "Enviar recordatorio". | Both actions. | DC-30 (B7) |
| 15 | OM-21 | What does "aprobada" mean for reviews? Can owners approve, hide or reply to them? | Show approved reviews only, or add moderation and replies. | Approved reviews only, with the average computed on the server. Replies later. | OM-21 (B15) |
| 16 | OM-27 + AP-22 | Is a WhatsApp channel planned? Should "Negocios reales" stay on `/salud`? | Advertising WhatsApp before it works erodes trust. | Plain text: "Las notificaciones se envían por correo". Do not advertise WhatsApp. Hide "Negocios reales" until there is a health customer. Add the FAQ and the final CTA to `/salud`. | OM-27; AP-22 |
| 17 | AP-10 | Load Inter, or adopt the system font stack? | Self-hosted Inter gives one brand look for about 30–50 KB. The system stack costs nothing but looks different on each OS. | Self-host Inter as a variable WOFF2 subset. | AP-10 |
| 18 | AP-09 | Do the landings get an exception to "gold is logo-only"? | An exception keeps brand warmth but needs a darker gold token that passes contrast. No exception keeps one visual language. | No exception: use slate accents. (The admin part is already fixed.) | AP-09 landings |
| 19 | DC-03 | Keep the "salud" colour scheme in the dashboard sidebar? | Keeping it sets the sector apart, and it is already tokenized. Removing it means less to maintain. | Keep it. It is tokenized at 5.6:1 or better. | Closing DC-03 |
| 20 | OM-15 | Is reordering gallery photos and intake questions in scope? | A sortable list with keyboard buttons, or no reordering. Intake already has `PATCH /intake/campos/reordenar`. The gallery has no order endpoint. | Out of scope for now. Remove the "en el mismo orden" promise. | OM-15 (B12) |

---

## 3. Backend changes needed

| # | Change (endpoint / DTO / field) | Why | Unblocks |
| --- | --- | --- | --- |
| B1 | `tieneIntake` on `ServicioPublico` | The step total can still change for businesses whose questions are tied to specific services | BF-10 |
| B2 | `diasAnticipacionMinima` in `GET /publico/citas/{codigo}` and in the Mis citas response | The frontend already passes it to the reschedule picker, but it has no effect until the backend sends it | BF-19; its Mis citas occurrence |
| B3 | Weekly availability endpoint | The availability dots now cost 7 per-day requests per week | BF-06 (performance only) |
| B4 | `sector` in `GET /publico/citas/{codigo}` | The receipt reads the sector from the cached business query, which is missing after a direct visit | BF-25 robustness |
| B5 | Restore endpoints for a reverted payment and an annulled deposit that keep `FechaPago`/`RegistradoPorId` and `AnticipoRecibidoEn`/`Por` | Re-registering would move the payment to the time and user of the undo | DC-07 undo (the confirmation dialog stays until then) |
| B6 | Restore endpoint for a deleted notification | Deleting a notification has no undo | DC-33 (notification part) |
| B7 | Batch confirm and batch reminder endpoint | Bulk actions | DC-30 (decision 14) |
| B8 | 2FA recovery codes (generate, store hashed, accept at login) | Losing the phone locks the user out | DC-29 (decision 9) |
| B9 | Restricted kiosk token or role | Kiosk exit opens the full owner session | DC-13 (decision 3) |
| B10 | Enforce the Empleado permission matrix (export, cash closing, payment reversal, global client edit) | Hiding controls in the UI is not enough | DC-14 (decision 2) |
| B11 | `PATCH` to save `PortadaObjectPosition` on its own | `PUT /negocios/perfil` is a full update, so "Confirmar" cannot save the position | OM-04 |
| B12 | Order field and reorder endpoint for gallery photos | Only intake has a reorder endpoint | OM-15 (decision 20) |
| B13 | Employee "Desactivar" endpoint, plus a count of future appointments for an employee or service | The deletion dialogs cannot state the consequences | OM-17 (decision 7) |
| B14 | Coupon list that includes inactive coupons, plus a reactivation call | The list returns active coupons only | OM-17 (decision 7) |
| B15 | `GET /me/resenas`: approved-only filter, plus average and distribution computed on the server | Counts and the average are calculated from one page | OM-21 (decision 15) |
| B16 | `PUT` for coupons | Coupons can only be deleted and recreated | OM-24 |
| B17 | "Has a user" flag on `EmpleadoDto`; email-invitation set-password flow | The "Con acceso / Sin acceso" badge; secure invitations | OM-26 (decision 8); S6 |
| B18 | Full client export endpoint that writes an audit-log entry | The export only covers the visible page | OM-09 (decision 10); S7 |
| B19 | Server-side retention of deleted logo, cover and policies files until the undo window ends | Undo for asset deletion | OM-11 |
| B20 | `plan` field on `RegistroNegocioDto` | Records which plan the visitor chose on the landing | AP-08 |
| B21 | Activation email from `NegociosController.Activar`; fix the welcome email that says clients can book "a partir de hoy" | Nobody tells the owner when the page goes live, and the welcome email is wrong | AP-02 (decision 1) |
| B22 | Endpoint to correct the email after sign-up | A mistyped email leaves the account and its slug unreachable | AP-03 |
| B23 | `fechaCreacion` and `emailConfirmado` in `NegocioMetricasDto` | Registration date, verified badge and newest-first sort in the activation queue | AP-07 |
| B24 | `GET /api/admin/audit`: filter by email and date range | Searching only works with a raw UUID | AP-24 |
| B25 | Business phone in the Mis citas response; a one-time code for phone-only clients | Phone-only clients can only be told to "contact the business" | AP-04 (decision 4); S4 |
| B26 | Localized `IdentityErrorDescriber`, or Identity error codes in the response | The client maps English Identity messages to Spanish | AP-12 (optional cleanup) |

Security changes on the backend (Hangfire ticket, cookie sessions, generic enumeration responses, email out of query strings) are in section 4.

---

## 4. Security follow-ups

Severity values are estimates. Route the open items to a `review-risk` pass.

| # | Item | Location | Severity (est.) | Status / recommended fix |
| --- | --- | --- | --- | --- |
| S1 | Stored XSS in three print windows: the SuperAdmin subscription receipt (business name comes from anonymous registration), the cash-closing print, and `TicketRecibo` (client name comes from public booking) | `utils/comprobanteSuscripcion.ts`, `utils/impresionCorte.ts`, `components/dashboard/TicketRecibo.tsx` | High | **Fixed in `4de5ebd`.** `escapeHtml` (`src/utils/html.ts`); tests show that `<img src=x onerror=…>` renders as text. The later QR sheet (`utils/impresionQr.ts`, `d4bde59`) escapes its values too and accepts only a PNG data URL. No `innerHTML` or `dangerouslySetInnerHTML` sinks remain in `src/`. |
| S2 | JWT in a URL query string on the Hangfire link | `src/layouts/AdminLayout.tsx:157` (`/hangfire-session?token=…`, still present) | High | Open. Exchange the token for a short-lived one-time ticket through a POST, or use a cookie-authenticated dashboard. The token ends up in browser history, server logs and proxies. |
| S3 | Access and refresh tokens persisted in `localStorage` | `src/store/authStore.ts:25` | Medium–High | Open. Put the refresh token in an `httpOnly`, `SameSite` cookie and keep the access token in memory. The privacy page also claims cookies (AP-16). |
| S4 | Mis citas: lookup by phone with no verification; one global `localStorage` key across businesses; the client email sent in query strings on `DELETE` and `PATCH` | `MisCitasPage.tsx`, `CancelarCitaPage.tsx` | Medium | Open. A one-time code or a signed link (decision 4). Key the storage per business and add "Olvidar este dispositivo". Move the email into the request body or a signed token. |
| S5 | Account enumeration: registration answers "Ya existe una cuenta con este correo"; lockout returns a distinct 429 only for accounts that exist | `PublicoController.cs:893-894`, `AutenticacionController.cs:53-54` | Low–Medium | Open. Return a generic registration response and send the "you already have an account" notice by email. Make the lockout response match the invalid-credentials response. Keep the rate limits. |
| S6 | The owner picks employee passwords; the SuperAdmin sets owner passwords and can confirm an email in one click. There is no forced change on first login. | `EmpleadosPage.tsx`, `NegociosAdminPage.tsx` | Medium | Open. Email invitation (decision 8, B17), forced change on first login, a longer minimum length. Confirm and audit-log the admin "Confirmar correo" action. |
| S7 | Client data export (phone, email, internal notes) with no audit trail | `ClientesPage.tsx`, `ReportesPage.tsx` | Medium | Open. Write an audit entry for each export: who, when and how many rows (decision 10, B18). |
| S8 | Upload type and size are checked only on the client (10 MB cap, formats from `BlobStorageService`) | `src/lib/imagenes.ts`, `hooks/useSubirImagen.ts` | Low | Accepted. The server is the authority: it enforces formats and cuts uploads at 20 MB. Keep the client checks in sync with the server. |
| S9 | Excel cells that start with `=` | `src/utils/exportarExcel.ts` | Low | Text is written as string cells (numbers, currency and dates are typed since `d4bde59`). Confirm how Excel opens a string that starts with `=`. |

---

## 5. Remaining frontend work (no decision needed)

**S** is under half a day, **M** is 1–2 days, **L** is 3 days or more. The occurrence rows were checked in the code on 2026-10-21. No Status line tracks them; the five fixed in this change are annotated in the occurrence table of `auth-public-admin.md`.

| Work | Source | Size |
| --- | --- | --- |
| Guard programmatic `navigate()` (user menu, notifications) against unsaved Perfil changes: move to a data router with `useBlocker`, or wrap those calls | OM-03 | M |
| Move the `useState` forms in CitasPage (new, repeat, edit client) to react-hook-form + zod | DC-19 | M |
| Shared `Campo` primitive (label, hint, error, ids); move login and registration fields onto `campoAuth` | DC-19, OM-23, AP-27 | M |
| Extract the duplicated `Navbar` and `PricingCard` into `components/landing/` | AP-20 | M |
| Galería lightbox and the Perfil cover-positioning overlay are still custom: use `Modal`, and add `touch-action: none`, `onPointerCancel` and a keyboard alternative to the drag | DC-18, OM-07 | M |
| Page titles on dashboard routes (`useTituloPagina`) | AP-17 | S |
| Calendar and Gantt: use business hours as the base visible range instead of 7–21 | DC-12 | S |
| Make `tipo` required in `toast()` | OM-12 | S |
| One `impeccable clarify` copy pass across the app (never run) | BF-25, DC-34, OM-32 | S |
| Re-score each audit after its verification pass (the baseline scores date from before the fixes) | All | S |

**Fixed in this change (pending commit), removed from the table above:**

- Mis citas reschedule sheet is a Radix Dialog: labelled title, focus trap, Escape, focus return to "Reagendar" (DC-18 occurrence).
- AdminLayout drawer: `inert` when closed, `role="dialog"` + `aria-modal` when open, focus trap, Escape, focus return (DC-10 occurrence).
- AdminLayout shows the "¿Sigues ahí?" warning before the inactivity logout, through the shared `AvisoInactividad` (DC-27 occurrence).
- Admin metrics and subscriptions failures show `ErrorCarga` with "Reintentar" instead of zero KPIs or "No hay negocios registrados" (DC-32 occurrence).
- Admin shell logo uses `LogoMarca` (9.8 KB light copy; new 9.8 KB `logo-appointva-oscuro.png` in dark mode); `AppLogo` removed (AP-11).

---

## 6. Manual verification checklist

### Already verified in the browser during this work

- [x] Booking: browser back/forward follows the wizard, and the step is in the URL (BF-01).
- [x] Booking: weekly availability dots on the day picker (BF-06).
- [x] Booking: staff step at 375px, as rows matching the service step (BF-23).
- [x] Citas: appointment cards at 375px; the actions sheet stays open across rotation (DC-01, `165386e`, `a05c9ed`).
- [x] Inicio: agenda shown first; dates in Spanish sentence case (DC-05).
- [x] Citas in light and dark mode after the `gray-*` to `slate-*` rename (DC-36).
- [x] Reportes heatmap in dark mode (OM-08).
- [x] Registration: sector selector and live password rules (AP-01, AP-12).
- [x] Admin deactivation dialog in dark mode (AP-06).
- [x] Cancel page for a completed appointment (AP-18).

### Still to check

Test as Propietario and as Empleado where it applies.

**Theme and viewport**
- [ ] Public, auth, landing, legal and 404 routes stay light when the OS is in dark mode.
- [ ] Booking, confirmation, Mis citas, waitlist, cancel and review pages at 375px: no horizontal scroll; the action bar clears the safe area.
- [ ] Dashboard at 375px and 1280px in light and dark mode: Inicio for both roles, Pagos, 2FA, Mi perfil, notes modal, error inputs (DC-02, DC-11).
- [ ] "Salud" sidebar and mobile header in both themes (DC-03).
- [ ] Status colours match across list, detail, calendar, Gantt and kiosk in both themes (DC-06).
- [ ] Categorical palette in both themes: Gantt and kiosk avatars, trend chart, Reportes payment methods and new/returning bars (DC-20).
- [ ] Owner screens in dark mode: time blocks, coupon pill, client avatar, waitlist states, danger zone, blocked days (OM-08); error borders (OM-23).
- [ ] Admin pages in light and dark mode beyond the deactivation dialog; kiosk on a wall screen (DC-21).

**Touch**
- [ ] Action sheet on calendar, Gantt, Inicio and detail: reschedule, notes, deposit, repeat (DC-01).
- [ ] Android back button and iOS edge swipe keep entered data on every booking step (BF-02).
- [ ] Gallery delete visible on touch screens; client cards open the detail view (OM-07, OM-10).
- [ ] Cover-position drag on touch screens; 44px targets on row actions, revert payment, drawer, bell, calendar and Gantt toggles (DC-22).

**Keyboard and screen reader**
- [ ] Booking: the step change moves focus to the heading and is announced; errors are announced; day and slot buttons announce their pressed state (BF-03, BF-12, BF-22).
- [ ] Lightboxes, the drawer, the user menu and the bell: focus trap, Escape, focus return (BF-20, DC-10, DC-18).
- [ ] `Switch` (Space, Enter, arrow keys); the "¿Descartar cambios?" dialog on Escape, overlay click and sidebar links (OM-02, OM-03).
- [ ] Review stars as a radio group with arrow keys; the password checklist and strength meter are announced (AP-05, AP-12).
- [ ] Toasts: announced, Undo works, pause on hover and focus separately (DC-17).

**Print windows and files**
- [ ] Cash-closing print, `TicketRecibo`, admin subscription receipt and QR sheet: correct layout, names with markup print as text, a toast when the popup is blocked (S1, OM-28).
- [ ] Excel files open with real number, currency and date cells and the right period (Reportes ×3, Clientes, Pagos) (OM-19).

**Uploads and behaviour**
- [ ] Upload progress per file and per row, the indeterminate bar, "Procesando…", files over the limit reported (OM-14, OM-16).
- [ ] After 18:00 in UTC-6, "today" is correct in booking, Inicio, badges and pickers (BF-05, DC-04).
- [ ] Overlapping appointments side by side; cancelled ones behind active ones (DC-12).
- [ ] The inactivity warning one minute before logout (DC-27); kiosk and Gantt offline banners clear on their own (DC-28, DC-32).
- [ ] Payment, cash-closing and 2FA errors appear inline; "Cambios sin guardar en el cierre" (DC-08).
- [ ] The confirmation headline matches the status and the deposit; clipboard fallback (BF-04, BF-27).
- [ ] Verification resend cooldown per address; the "Solicitar un nuevo enlace" flow; legal "Volver" when the page opens in a new tab (AP-03, AP-14, AP-15).
- [ ] Landings: reduced motion, the navbar background on scroll, "Sin descuento anual" in Anual mode (AP-20, AP-21, AP-08).
- [ ] The cover position shows "sin guardar" and survives an upload (OM-04).

---

## 7. Test infrastructure notes

- **`testTimeout: 15000`** (`vite.config.ts`, added in `165386e`): when many jsdom files run in parallel, a test that takes about 300 ms on its own went over Vitest's 5 s default. The higher limit absorbs CPU contention, and a test that truly hangs still fails.
- **`asyncUtilTimeout: 3000`** (`src/test/setup.ts`, added in `4de5ebd`): the same parallel load pushed `findBy*` and `waitFor` past Testing Library's 1 s default while the UI was correct. Tests that race against Radix focus (`BookingPage`) explicitly wait for focus inside the dialog before sending Escape (`a05c9ed`).
- **Stale modules from the dev PWA:** the service worker on `localhost` can keep serving old modules after an edit, so the browser shows code that no longer exists. Fix: DevTools → Application → Service workers → Unregister (and clear site data if needed), then hard reload. Rule this out first when a browser check disagrees with the source.
