# UI/UX Roadmap: Final State

- **Updated:** 2026-10-21
- **Branch:** `docs/front-claude-md` (HEAD `7461858`). The frontend parts of the 20 product decisions (section 2) are applied in the working tree, pending commit.
- **Sources:** [`booking-flow.md`](booking-flow.md) (BF), [`dashboard-core.md`](dashboard-core.md) (DC), [`owner-management.md`](owner-management.md) (OM), [`auth-public-admin.md`](auth-public-admin.md) (AP)
- **Caveat:** The audits are code-based. Only the checks marked as verified in [section 6](#6-manual-verification-checklist) were done in a browser.

**Bottom line:** 124 findings. 105 are fixed, 18 are partly fixed and 1 is open; none waits on a product decision any more. All 20 decisions were answered on 2026-10-21 and their frontend parts are applied in the working tree (pending commit). What remains is backend work (16 of the 18 partial items and the open OM-09; see section 2.1 and section 3), one input from the product owner (the privacy contact address, AP-16) and the frontend tasks in section 5 (OM-03).

---

## 1. Executive summary

### Status by report (recounted from every Status line)

| Report | Total | Fixed | Partially fixed | Open: decision | Open: backend |
| --- | --- | --- | --- | --- | --- |
| Booking flow (BF) | 27 | 27 | 0 | 0 | 0 |
| Dashboard core (DC) | 36 | 33 | 3 | 0 | 0 |
| Owner management (OM) | 33 | 24 | 8 | 0 | 1 |
| Auth, public, admin (AP) | 28 | 21 | 7 | 0 | 0 |
| **Total** | **124** | **105** | **18** | **0** | **1** |

Recounted after the decisions (2026-10-21, pending commit). Newly fixed: DC-03, DC-28, DC-30, OM-06, OM-15, OM-27, AP-09, AP-10, AP-22. Moved from "open: decision" to "partly fixed – backend": DC-13, DC-14; to "partly fixed": AP-16 (contact address pending); to "open: backend": OM-09.

- **Open (1):** OM-09, backend only (B18).
- **Partly fixed (18), grouped by what blocks the rest:**
  - The backend (16): DC-13, DC-14, DC-29, OM-04, OM-11, OM-17, OM-21, OM-24, OM-26, OM-29, AP-02, AP-03, AP-04, AP-07, AP-08, AP-24.
  - Input from the product owner (1): AP-16 (privacy contact address).
  - Frontend work (1): OM-03.
- **Fixed, but one part only takes effect once the backend changes:** BF-10 (stable step total), BF-19 (minimum notice when rescheduling), DC-07 (a true undo for payment reversal).
- **Open or partial items by severity:** not recounted per severity after the decisions. DC-03, the only severity-4 item, is closed (decision 19).

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

## 2. Product decisions (answered 2026-10-21)

All 20 decisions are answered. "Frontend (pending commit)" is what this change applied; "Backend still needed" lists the B-items in section 3 that finish each one.

| # | IDs | Decision | Frontend (pending commit) | Backend still needed |
| --- | --- | --- | --- | --- |
| 1 | AP-02 | Keep manual activation; promise a time frame; tell the owner when it is live. | `lib/activacion.ts`: "en menos de 24 horas hábiles" on the registration steps, landing FAQs, `/salud` and the dashboard banner; because no activation email exists (checked `NegociosController.Activar`), the copy says "Revisa tu panel: el aviso desaparece cuando tu negocio esté activo". All "5 minutos" and "gratis" claims removed (landings, login panel). Admin keeps pending businesses first (verified). | B21 (activation email, welcome email). Then switch the copy to "Te avisaremos por correo". |
| 2 | DC-14 | Restricted Empleado: no export, no payment reversal, no deposit annulment, no cash closing, no global client edits; may charge and record deposits on own appointments. | `hooks/usePermisos.ts` gates Citas (Exportar, Editar datos del cliente, Anular anticipo), Pagos (Corte del día tab and closing, Revertir, Exportar) and Clientes (Exportar). | B10, including an employee check on `PATCH /citas/{id}/cliente`. |
| 3 | DC-13 | Password to exit the kiosk, exit hidden behind a long press. | Hold 1.5 s (pointer, or Enter/Space on the focused button) with a visible hint; password dialog re-checks the session email via `POST /auth/login` and revokes the extra session; wrong password stays on the kiosk. | B9 (restricted kiosk token). Failed exit attempts count toward the login lockout until then. |
| 4 | AP-04 (+S4) | Keep the message; add a one-time code with the S4 fix. | No change; copy already honest. | B25, S4. |
| 5 | AP-08 | Pro annual 382 (15 % off 449); no "gratis"; show MXN. | `PRECIOS_PLANES` shared by both landings; "MXN/mes", "MXN/año"; "Hasta −20%" badge; CTAs "Crear mi cuenta" / "Empezar ahora". | B20 (`plan` on registration) for `?plan=`. |
| 6 | OM-06 | WhatsApp deep link that records the state; email later. | "Avisar por WhatsApp" (`urlAvisoListaEsperaWhatsApp`) with business, service, freed date/time and booking link; records "Notificado". Without a phone, only "Marcar como avisado". | Optional: B29 (email through `NotificarListaEsperaAsync`). |
| 7 | OM-17 | "Desactivar" by default; block deletion while future appointments exist; coupon reactivation. | `DialogoEliminarConCitas` blocks employee and service deletion with the count of open appointments from today and a link to Citas filtered; "Ocultar de reservas" is the primary action for services. | B13 and B14: done on `feat/back-bloque2` (not committed). Employee "Desactivar"/"Reactivar", server-side future-appointment counts, a 409 on deletion with open appointments, and coupon reactivation. |
| 8 | OM-26 (+S6) | Email invitation; forced password change on first login meanwhile. | None: the backend has no "must change password" flag (checked). | B17, B27. |
| 9 | DC-29 | Recovery codes; 2FA optional but promoted to owners. | Dismissible "Protege tu negocio…" card in Mi perfil for owners while 2FA is off. | B8. |
| 10 | OM-09 (+S7) | Full client export with an audit-log entry. | None; copy stays "Solo esta página: n de N". | B18, S7. |
| 11 | OM-29 | 30-day grace period, future appointments cancelled with notice, export first. | Dialog no longer implies a grace period: it says deletion is immediate and irreversible and that an active business blocks it. | B28. |
| 12 | DC-28 | Kiosk shows first name + initial, read-only. | `nombreConInicial` ("María G."). | None. |
| 13 | AP-16 | Correct the facts now, legal review later. | Privacy page: "PBKDF2, mediante ASP.NET Core Identity"; session in `localStorage`, not cookies. Other wording untouched. | None. **TODO (product owner):** provide the correct contact address; the page still shows the current one on purpose. |
| 14 | DC-30 | "Confirmar seleccionadas" only (no bulk cancel or reminders). | Checkboxes on Pendiente rows/cards, sticky bar with count and progress, sequential calls to the single-appointment endpoint, summary toast with "Reintentar". Owner and Empleado (own appointments). | Optional: B7 (fewer requests). |
| 15 | OM-21 | Approved reviews only, server-side average; replies later. | None; copy honest. | B15. |
| 16 | OM-27 + AP-22 | "Las notificaciones se envían por correo"; hide "Negocios reales" on `/salud`; add FAQ and final CTA there. | WhatsApp reminder claims removed (settings, `/salud` features and plan); FAQ answer in `lib/notificaciones.ts`; `/salud` gets FAQ + CTA from the shared `components/landing/FaqItem.tsx` and `CtaFinal.tsx`. | None. |
| 17 | AP-10 | Self-host Inter as a variable WOFF2 subset. | Added `@fontsource-variable/inter@5.3.0` (exact pin); one `@font-face` for the Latin subset (48 KB) with `font-display: swap` and a system fallback stack. | None. |
| 18 | AP-09 | No gold exception on the landings. | Gold only in the "Va" of the logo; all accents slate. | None. |
| 19 | DC-03 | Keep the "salud" sidebar scheme. | No code; closed. | None. |
| 20 | OM-15 | Intake reordering in scope; gallery out. | "Subir"/"Bajar" buttons on Cuestionario rows with `PATCH /intake/campos/reordenar`, live-region announcement, rollback on error; Galería no longer promises "en el mismo orden". | None (B12 only if gallery ordering comes back). |

### 2.1 Backend work needed for these decisions

In priority order. Details in section 3.

- **B10** Enforce the Empleado matrix on the server (export endpoints, cash closing, payment reversal, deposit annulment, `PATCH /citas/{id}/cliente`). Decision 2.
- **B9** Restricted kiosk token or role, plus a verify-password endpoint that does not count toward the login lockout. Decision 3.
- **B21** Activation email from `NegociosController.Activar`; fix the welcome email. Decision 1.
- ~~**B13** Employee "Desactivar" endpoint and a count of future appointments per employee or service. Decision 7.~~ Done on `feat/back-bloque2` (not committed); see section 3.
- ~~**B14** Coupon list with inactive coupons and a reactivation call. Decision 7.~~ Done on `feat/back-bloque2` (not committed); see section 3.
- **B8** 2FA recovery codes. Decision 9.
- **B17 + B27** Email invitation with a set-password link; meanwhile a "must change password" flag checked at login. Decision 8.
- **B18** Full client export with an audit-log entry. Decision 10.
- **B28** Account deletion with a 30-day grace period, cancellation notices and a data export. Decision 11.
- **B25** One-time code for phone-only Mis citas clients (with S4). Decision 4.
- **B15** Approved-only reviews with server-side average. Decision 15.
- **B20** `plan` on `RegistroNegocioDto`. Decision 5.
- Optional: **B7** batch confirm (decision 14 works without it), **B29** waitlist email (decision 6).

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
| B9 | Restricted kiosk token or role; a verify-password endpoint | Kiosk exit opens the full owner session; the interim exit check reuses `POST /auth/login`, so failed attempts count toward the lockout | DC-13 (decision 3) |
| B10 | Enforce the Empleado permission matrix (export, cash closing, payment reversal, deposit annulment, global client edit; `PATCH /citas/{id}/cliente` has no employee check) | The UI now hides these controls (`usePermisos`), but hiding is not enough | DC-14 (decision 2) |
| B11 | `PATCH` to save `PortadaObjectPosition` on its own | `PUT /negocios/perfil` is a full update, so "Confirmar" cannot save the position | OM-04 |
| B12 | Order field and reorder endpoint for gallery photos | Only intake has a reorder endpoint | OM-15 (decision 20) |
| B13 | Employee "Desactivar" endpoint, plus a count of future appointments for an employee or service | The deletion dialogs cannot state the consequences | OM-17 (decision 7). **Done on `feat/back-bloque2` (not committed):** `PATCH /empleados/{id}/desactivar` and `/reactivar` (GestionCompleta; reactivation checks the plan's employee limit, 402), `GET /empleados/{id}/citas-futuras` and `GET /servicios/{id}/citas-futuras` (Pendiente/Confirmada from local midnight in the business zone). `DELETE` of an employee or service now returns 409 while such appointments exist. Inactive employees are refused by dashboard booking and by availability for a chosen employee (public booking and kiosk already filtered them). Front: Empleados lists inactive employees with "Reactivar"; "Desactivar" is the primary action in the delete dialog; both dialogs use the server count. |
| B14 | Coupon list that includes inactive coupons, plus a reactivation call | The list returns active coupons only | OM-17 (decision 7). **Done on `feat/back-bloque2` (not committed):** `GET /descuentos?incluirInactivos=true` and `PATCH /descuentos/{id}/reactivar` (409 while another active coupon has the same code). `DELETE` is now labelled "Desactivar" in Cupones; deactivated coupons show under "Inactivos" with "Reactivar". |
| B15 | `GET /me/resenas`: approved-only filter, plus average and distribution computed on the server | Counts and the average are calculated from one page | OM-21 (decision 15) |
| B16 | `PUT` for coupons | Coupons can only be deleted and recreated | OM-24. **Done on `feat/back-bloque2` (not committed):** `PUT /descuentos/{id}` with the create rules (create and edit now also reject an unknown type, a percentage above 100 and spaces in the code). `UsoActual` is kept and the limit cannot go below it (400); bookings that used the coupon keep their stored price; editing does not change `Activo`; the code must stay unique among active coupons. Front: "Editar" on each coupon; an untouched past expiry date does not block saving. |
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
| B27 | "Must change password" flag on the user, set when the owner or SuperAdmin chooses the password, checked at login | Interim measure until invitations exist (decision 8) | OM-26; S6 |
| B28 | Account deletion with a 30-day grace period, cancellation of future appointments with client notice, and a data export offered first | Today deletion is immediate (decision 11) | OM-29 |
| B29 | Send the waitlist email through `NotificarListaEsperaAsync` when an entry is marked "Notificado" | Optional automatic channel next to the WhatsApp link (decision 6) | OM-06 (optional) |

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

**Decisions applied on 2026-10-21 (not yet seen in a browser)**
- [ ] Landings `/` and `/salud`: Inter loads (Network shows one `inter-latin-wght-normal-*.woff2`), no gold outside the logo, Pro annual $382 MXN, CTAs "Crear mi cuenta" / "Empezar ahora", `/salud` FAQ and final CTA at 375px and 1280px.
- [ ] Kiosk: long press with a finger and with Enter, the hint, wrong password stays, right password returns to Citas; check that the account is not locked after a couple of wrong tries in normal use.
- [ ] Citas "Confirmar seleccionadas": checkboxes on table and cards, sticky bar above the safe area at 375px, progress text, toast with "Reintentar", in light and dark mode; as Empleado.
- [ ] Empleado: no Exportar, no Revertir, no Corte del día, no "Editar datos del cliente", no "Anular anticipo"; can still charge and register a deposit.
- [ ] Waitlist "Avisar por WhatsApp" opens WhatsApp with the right text and marks the entry "Notificado".
- [ ] Deleting an employee/service with future appointments shows the block and the link opens Citas filtered.
- [ ] Cuestionario "Subir"/"Bajar" with keyboard and screen reader; order persists after reload.
- [ ] Mi perfil 2FA card for an owner without 2FA, dismiss, reload.

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
