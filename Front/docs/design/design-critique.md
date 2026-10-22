# AppointVa — Design Critique (visual identity)

Date: 2026-10-21 · Scope: visual identity, not usability/a11y (see `docs/audits/`).
Method: single-context review (no detector run). Live app at `localhost:5177` was inspected at 1280px and 375px, light and dark, plus source.
Seen live: `/landing`, `/salud`, `/b/salon-aramis` steps 1–4 (no booking submitted), `/cita/507E5262`, `/cita/0D3F132E`, `/dashboard` (Inicio, light/dark, mobile), `/dashboard/citas` (list, calendar, gantt), `/dashboard/reportes`, `/dashboard/perfil`, `/dashboard/servicios` (light/dark), `/dashboard/kiosk`.
Not seen live: `/login`, `/registro` (the owner session redirects them), `/dashboard/pagos` (redirects to Inicio on this plan), `/admin` (needs a different login). Those are judged from code.

---

## 1. Verdict and score

| # | Heuristic (judged for visual design) | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Step bar, status badges and progress are clear. Status colour is the only colour that means anything. |
| 2 | Match with the real world | 3 | Spanish is correct but reads like a template ("Todo lo que necesitas, nada de lo que no."). |
| 3 | User control | 3 | Fine. |
| 4 | Consistency | 2 | Three different blacks (zinc-950, zinc-900, slate-900/navy). Labels are sometimes UPPERCASE and sometimes sentence case. Times show as `9:00 am`, `10:00 a.m.` and `02:00 p.m.` |
| 5 | Error prevention | 3 | Fine. |
| 6 | Recognition | 3 | Fine. |
| 7 | Flexibility | 2 | Dashboard density is fixed. Every page is a stack of cards. |
| 8 | Aesthetic and minimalist | 2 | Hero-metric rows, empty charts of zeros, eyebrow labels, and cards inside cards. |
| 9 | Error recovery | 3 | Fine. |
| 10 | Help | 2 | Help is a stock FAQ accordion. There is no contextual voice. |
| **Total** | | **26/40** | **Acceptable**. The structure is solid but the product has no identity. |

**Honest verdict.** AppointVa is careful, accessible and consistent, but almost none of it is specific to AppointVa. You could swap the logo for a CRM, a gym app or a dental-billing tool and nothing would need to change. The palette is shadcn's slate-on-white default. The type is one family at one rhythm: heavy black headings, then grey-500 body. Every surface is a `rounded-xl` white card with a 1px border. The landing runs the complete 2023 SaaS template in order: pill badge, three-line hero with a two-tone last line, phone mockup with a floating toast, stats strip, "CARACTERÍSTICAS" eyebrow, six icon cards, "Listo en 3 pasos" with numbered circles, three-tier pricing with a dark "Más popular" middle card, FAQ, dark CTA band. The dashboard opens with the hero-metric template (HOY / SEMANA / MES, twice). The two most emotional moments (a client gets a slot, an owner gets the first booking) are drawn as receipts on a near-black header. The only warm, human element is the gold logo, and a rule keeps it locked out of everything else. The product sells to Mexican barbers, stylists and doctors, but nothing in it looks like a barbershop, a salon, a consulting room or Mexico.

---

## 2. Top 8 generic / "AI-made" tells

**T1 — Shadcn-slate default palette with no warmth.**
Screens: everywhere. Slate-700 buttons, slate-50 page, slate-200 borders, slate-400 labels (`src/index.css:21-45`).
Why it reads generic: this is the default output of `npx shadcn init` with the slate base. It signals "assembled", not "chosen". It is also cold (hue 215) for beauty and barber businesses, which sell touch, warmth and craft.
Fix: pick a neutral ramp with a temperature (Section 3) and keep slate only where coolness is the point, in salud. Give AppointVa one brand accent that is not the logo gold, so the gold rule can stay.

**T2 — The landing is the SaaS template, section by section.**
Screen: `/landing` at 1280px. Pill badge "Para negocios de servicios · México", three-line hero with the last line greyed, phone mockup on a blurred grey blob (`LandingPage.tsx:24`), a `< 24 h / 24/7 / $0 / $249` stats strip, eyebrows (`LandingPage.tsx:312,328,351`), a grid of six identical icon+title+text cards, "01/02/03" step circles joined by a gradient hairline (`:357`), pricing with a dark middle card, FAQ, dark CTA. `/salud` is the same page with a palette swap and no visual in its hero.
Why it reads generic: every section is the category default. Nothing shows a real business, a real booking page or a real Mexican street.
Fix: lead with the product itself. Show the booking page of a believable barbershop at full bleed, with its own photo and brand colour. Delete the eyebrows. Turn the six feature cards into two or three real-screen vignettes. Drop the numbered steps, since three steps is not a sequence anyone needs to track.

**T3 — The hero-metric dashboard.**
Screen: `/dashboard` Inicio. "CITAS" eyebrow, then three white stat cards (HOY 0, SEMANA 0, MES 6). Then an "INGRESOS" eyebrow and three navy stat cards ($0.00 ×3). Then a 14-day dual-axis chart that is a flat line at zero. Then "Próximas citas: No hay citas próximas" next to "Top servicios" bars (`InicioPage.tsx:35,517,534`).
Why it reads generic: big number, small label, repeated in two colours, is the most common AI dashboard pattern. It shows six zeros to a salon owner at 8 p.m. who has nothing booked.
Fix: replace the metric rows with one "today" header sentence (Section 5). Show at most three numbers, set inline in text with tabular figures. Hide the chart until there is data, and put a sentence in its place.

**T4 — Card soup and cards inside cards.**
Screens: Inicio ("Agenda de hoy" card containing an empty-state card area), Servicios (category card holding service rows that each look like a card, with toggle, Destacado, Editar and Eliminar), Perfil (tabs inside a card with form sections). The booking step 1 list is eight bordered `rounded-2xl` boxes.
Why it reads generic: the source has 437 `rounded-xl`/`rounded-2xl` uses. When everything is a white rounded rectangle with a border, nothing has rank.
Fix: one elevation per level. Make the page canvas the surface, and use cards only for things you can pick up (an appointment, a service in the booking flow). Render management lists as divided rows on one surface (Servicios, Reportes). On booking step 1, use rows with dividers and keep the strong selected state.

**T5 — Uppercase tracked micro-labels everywhere.**
Screens: booking ("CORTE Y PEINADO", "TELÉFONO *" next to "Notas (opcional)"), confirmation ("CÓDIGO DE CONFIRMACIÓN", "ESTADO / NEGOCIO / SERVICIO…", "¿QUÉ SIGUE?"), dashboard section heads, reportes table heads. There are 98 `uppercase tracking-*` uses.
Why it reads generic: the small-caps grey label is how a template fakes hierarchy. It also mixes casing inside one form.
Fix: use sentence-case labels in `text-sm font-medium`, with section heads one size step up. Keep uppercase for one thing only: the confirmation code.

**T6 — Near-black heroes with a brand-tinted glow.**
Screens: `/cita/*` header is `bg-zinc-950` with a 28% radial glow of the brand colour (`ConfirmacionPage.tsx:330-337`, labelled "Style C" in the source). The booking step bar is `bg-zinc-900` (`IndicadorPasos.tsx:19`). The login side panel is dark with three `bg-white/10 backdrop-blur` glass cards (`LoginPage.tsx:289-311`).
Why it reads generic: the "dark section + soft colour bloom + glass chips" look is the 2024 AI-landing signature. With a slate brand colour the glow disappears, so the client's best moment ("¡Cita confirmada!") is a black slab with a grey icon. Zinc is also a different grey family from the slate in the rest of the app.
Fix: put the business on the confirmation header (its cover photo or brand colour, its logo, its name), on a light surface. Remove the glass cards and the radial glow. Use one ink token for all darks.

**T7 — Pattern-generator cover backgrounds.**
Screen: `/b/salon-aramis` hero shows a navy field with thin arcs ("Arcos"). Other presets are `repeating-linear-gradient` stripes, grids and rhombi, plus SVG-turbulence grain ("Arena", "Niebla", "Terrazo") (`lib/portadaPresets.ts:58-69,124-173`).
Why it reads generic: procedural stripes and grain stand in for imagery. They look like wallpaper and carry nothing of the business. The business card under them is a lone letter "S" for "Salón Aramis".
Fix: the cover should be the business's photo first, its solid brand colour second, and one quiet tint third. Keep at most three presets and drop the grids, stripes and grain. Derive the monogram from the distinctive word ("Aramis" → "A", skipping "Salón", "Barbería", "Clínica", "Consultorio").

**T8 — Robotic copy and default number formatting.**
Examples: "Todo lo que necesitas, nada de lo que no.", "Selecciona un servicio para continuar", "Sin citas para hoy", "No hay citas próximas", "$280.00" for whole pesos, "Sistema de gestión de citas para negocios de servicios". Times appear in three formats.
Why it reads generic: these are the neutral placeholder lines a model writes. Prices with `.00` read like an invoice, not a menu. Only 15 `tabular-nums` uses exist, so columns of times and prices wobble.
Fix: write in a warm, local `tú` voice (rewrites in Section 3). Use `$280` for whole amounts (`utils/formatters.ts:2`). Use one time formatter (`utils/formatters.ts:70-115`, `DashboardLayout.tsx:54`, `CancelarCitaPage.tsx:31`) with the "9:00 a. m." es-MX style or a 24h option. Apply `tabular-nums` to every time, price and count.

---

## 3. Three visual directions

All three keep Inter for UI, keep the semantic status system, keep light-only public pages, and keep the business colour driving the booking CTA through `brandSolid()`.

### A. "Estudio cálido" (Warm studio) — RECOMMENDED · Effort M

**Mood:** a well-run neighbourhood studio. Paper, ink, a little brass. Calm, tactile, human.

| Role | Light | Dark |
|---|---|---|
| Ink / primary (buttons, headings) | `#1F1B16` | `#F4EFE8` |
| Brand accent (AppointVa: links, focus, active nav, progress) | Terracotta `#B4532A` | `#E07A4F` |
| Neutral warm (canvas / surface / line / muted text) | `#FAF7F2` / `#FFFFFF` / `#E8E1D6` / `#6B6257` | `#16130F` / `#1F1B16` / `#352F27` / `#A69B8D` |
| Neutral cool (salud only) | `#F5F8FA` / `#DDE5EB` / `#5B6B78` | `#0E1417` / `#24313A` / `#93A4B1` |
| Logo gold (unchanged, logo only) | `#C8A961` | `#C8A961` |
| Semantic: pending / confirmed / completed / cancelled / absent | `#B7791F` / `#2F7D4F` / `#3D5A80` / `#B03A2E` / `#8A8177` | lighter 400-equivalents on 18% tints |

- **Type:** Inter for UI, at 400 / 500 / 600 only (drop `font-black`, used 52 times). Display face: **Fraunces** (variable, OFL, `@fontsource-variable/fraunces`) at opsz 72, weight 500–600, used only for H1/H2 on landing, booking business name, the confirmation headline and the dashboard "today" header. Scale (1.25): 12 / 14 / 16 / 20 / 25 / 31 / 39 / 49 px. Body 16/1.55, headings tracking -0.02em. Use `tabular-nums` for times and money.
- **Depth and shape:** cards 14px radius, controls 10px, pills only for chips and badges. Elevation is a warm shadow `0 1px 2px rgb(31 27 22 / .06), 0 4px 16px rgb(31 27 22 / .06)` **or** a border, never both. Lists are divided rows on one surface.
- **Motion:** unhurried and settling. 180–240ms with `cubic-bezier(.22,1,.36,1)` (ease-out-quint). One authored moment: the confirmation stamp (Section 5). Everything else stays a fade or a slight lift.
- **Copy tone:** a friendly front-desk person. Warm `tú`, short, concrete.
  - "Todo lo que necesitas, nada de lo que no." → "Tu agenda llena, sin contestar el teléfono."
  - "Sin citas para hoy" → "Hoy tienes la agenda libre. Comparte tu enlace y llénala."
  - "¿Qué servicio necesitas?" / "Selecciona un servicio para continuar" → "¿Qué te hacemos hoy?" (belleza) / "¿Qué tipo de consulta necesitas?" (salud), with the subline removed.
- **Per sector:** belleza and barbería keep the warm paper and terracotta. Salud swaps to the cool neutral ramp and uses the existing `#0F4C75` as its accent (already approved for the salud sidebar), keeps Fraunces off, and goes up one size step for legibility.
- **Booking page with the business colour:** the business colour owns the cover (photo with a brand-colour scrim, or flat colour), the CTA and the selected states. AppointVa's terracotta never appears there. Warm paper stays as the canvas, which sits well under almost any brand hue, while slate clashes with warm brands.
- **Trade-offs:** a serif display may read "too boutique" for barbershops. Mitigate by using it only on the landing and confirmation, never in the dashboard chrome. Every component touches colour tokens, but tokens are already centralised, so the work is mostly `index.css`, `tailwind.config.js` and a sweep of raw `slate-*` classes.
- **Why recommended:** it fixes the biggest tell (cold default slate) at token level. It gives the brand gold a matching world without breaking the "gold only in the logo" rule. It also suits all three sectors, because salud gets its own cool ramp.

### B. "Calma clínica" (Clinical calm) · Effort S

**Mood:** a quiet, precise, trustworthy health app. Air, blue-green, nothing extra.

| Role | Light | Dark |
|---|---|---|
| Primary | Deep teal `#0F4C5C` | `#7CC4CF` |
| Accent | `#1B6CA8` | `#6FA8DC` |
| Neutral cool | `#F6F9FB` / `#FFFFFF` / `#DCE4EA` / `#566573` | `#0B1216` / `#121B21` / `#22313A` / `#95A6B3` |
| Neutral warm (belleza tint) | `#FAF8F6` / `#E9E3DD` / `#6E655C` | n/a |
| Semantic | current status tokens, desaturated 10% | current dark tokens |

- **Type:** Inter only, using its display optical size (Inter 4 `opsz`, if the self-hosted `@fontsource-variable/inter` build includes that axis; verify). Weights 400/500/600. Scale 1.2: 12/14/16/19/23/28/33. Big numbers in 600 with tabular figures.
- **Depth and shape:** 8px radius everywhere, hairline borders, no shadows except popovers. Lots of whitespace with a strict 8px grid.
- **Motion:** almost none. 120–160ms opacity and colour only. Success is a check that draws itself once.
- **Copy tone:** clear, reassuring, formal-friendly (still `tú`).
  - "¡Cita agendada!" → "Recibimos tu solicitud. El consultorio la confirmará pronto."
  - "Sin citas para hoy" → "No hay consultas programadas para hoy."
  - "Todo lo que necesitas, nada de lo que no." → "Menos llamadas. Más tiempo con tus pacientes."
- **Per sector:** excellent for salud. For belleza, swap in the warm neutral, but the system still reads like a clinic, which hurts salons and barbershops.
- **Booking page:** the business colour is used only on the CTA and a thin top band, while the cover stays neutral. This is safe, but it puts the storefront in the background.
- **Trade-offs:** cheapest and most coherent, but it changes the least. It is still close to "generic SaaS, just teal". Use it if salud becomes the main market.

### C. "Local con carácter" (Bold local) · Effort L

**Mood:** a Mexican barbershop sign and a mercado poster. Confident, graphic, proudly local.

| Role | Light | Dark |
|---|---|---|
| Ink | `#141414` | `#F5F1EA` |
| Accent (AppointVa) | Rosa mexicano `#D6266E` | `#F0629A` |
| Secondary accent | Cobalt `#1F4FBF` | `#7C9BF0` |
| Neutral warm | `#F5F1EA` / `#FFFDF8` / `#1414141A` / `#5C554C` | `#121110` / `#1C1A18` / `#2E2B27` / `#A39A8E` |
| Neutral cool (salud) | `#F2F5F7` / `#D5DEE5` / `#51606C` | `#0D1215` / `#22303A` / `#8FA0AD` |
| Semantic | pending `#C77700`, confirmed `#18794E`, completed `#1F4FBF`, cancelled `#C2261D`, absent `#77706A` | 400-equivalents |

- **Type:** display face **Bricolage Grotesque** (variable wdth/opsz, OFL, self-hostable) at 700–800, condensed width for headlines. Inter 400/500/600 for UI. Big jumps in the scale (1.333): 12/16/21/28/38/50/67.
- **Depth and shape:** flat colour blocks, 6px radius, no shadows, thick 2px ink rules as dividers, colour fields instead of cards.
- **Motion:** snappy and playful. 140ms with a slight overshoot on selection. A ticket "tear" or stamp on confirmation.
- **Copy tone:** direct, a little cheeky, colloquial Mexican.
  - "Tu agenda online. Sin llamadas." → "Que te agenden, no que te marquen."
  - "Sin citas para hoy" → "Día tranquilo. ¿Lanzamos una promo?"
  - "¡Cita confirmada!" → "¡Listo, ya quedó! Nos vemos el jueves."
- **Per sector:** very strong for barbería and belleza. For salud it needs a separate restrained mode (cool neutral, cobalt only, no colloquialisms), which nearly doubles the system.
- **Booking page:** the business colour fills the full cover block with a huge condensed business name. That is very storefront-like, but it fights some brand hues, so it needs strict contrast rules.
- **Trade-offs:** the most memorable and the most risky. Colloquial copy can age badly or put off clinics. It is a full redesign of the landing and booking flow.

**Recommendation: A, "Estudio cálido".** It removes the generic signal at the token level, gives every sector a fitting base, and keeps the business brand in charge of its own storefront. It does this at medium cost and without a rewrite.

---

## 4. Quick wins for any direction (ranked)

1. **One ink token, no zinc.** Replace `bg-zinc-950`/`zinc-900` with a single `--ink` token: `components/booking/IndicadorPasos.tsx:19`, `pages/publico/ConfirmacionPage.tsx:330,393`, `pages/publico/BookingPage.tsx:1258,1339`.
2. **Delete eyebrows and section kickers.** `LandingPage.tsx:312,328,351` (and the matching lines in `LandingPageSalud.tsx`), `InicioPage.tsx:517,534`. Let the headings carry the hierarchy.
3. **Number typography.** Drop `.00` for whole pesos in `utils/formatters.ts:2`. Use one time format across `utils/formatters.ts:70-115`, `layouts/DashboardLayout.tsx:54` and `pages/publico/CancelarCitaPage.tsx:31`. Add `tabular-nums` to prices, times and metrics.
4. **Sentence-case labels.** Remove `uppercase tracking-*` from form labels and data-list keys (booking `PasoDatosCliente.tsx`, `ConfirmacionPage.tsx`, Reportes table heads). Keep it only for the confirmation code.
5. **Kill decoration.** Remove the blurred grey blob (`LandingPage.tsx:24`), the login glass cards (`pages/auth/LoginPage.tsx:289-311`), the confirmation radial glow (`ConfirmacionPage.tsx:331-333`) and the 3px left-border callout (`pages/dashboard/EmpleadosPage.tsx:646`).
6. **Inicio without zeros.** Hide the 14-day chart and the "Top servicios" bars when there is no data. Collapse the two metric rows into one line (`pages/dashboard/InicioPage.tsx:30-40,510-560`).
7. **Pare down cover presets.** Keep photo, flat brand colour and one soft tint. Retire the stripes, grids, rhombi and grain (`lib/portadaPresets.ts:58-69,140-180`). Use a smart monogram that skips "Salón/Barbería/Clínica".
8. **Theme the browser surfaces.** In `src/index.css`, add `::selection` (accent at 20%), `caret-color`, `accent-color` (native checkboxes/radios), and thin themed scrollbars for `main` and the sidebar.
9. **Remove `font-black`.** Cap headings at 700 (600 is better). The heavy 900 headings plus grey-400 subtitles make the "AI hero" contrast (52 uses).
10. **Flatten Servicios and Reportes.** Render them as divided rows on one surface, not cards in cards (`pages/dashboard/ServiciosPage.tsx`).

---

## 5. Signature moments to add

1. **The confirmation stamp (`/cita/:codigo`).** A light page, with the business cover photo or brand colour as a short band and its logo and name on top. The headline is set in the display face: "Te esperamos el jueves 22 a las 9:00". The confirmation code sits in a ticket stub with a perforated edge drawn in CSS geometry, and a stamp ("Confirmada" or "Por confirmar", in the status colour) lands on it once with a 240ms scale-and-settle (skipped under reduced motion). Calendar and WhatsApp buttons sit right under the stub. This is the peak moment, and right now it is a black slab.
2. **The dashboard "today" header (Inicio).** Replace "Hola, Aramis" and the six stat cards with one composed sentence that uses the greeting logic already in `InicioPage.tsx:682`. For example: "Buenas tardes, Aramis. Hoy tienes **4 citas**, la siguiente es **Corte de dama a las 5:30** con Sofía." Below it, show a horizontal timeline strip for today (one lane, with the current time as a needle). On an empty day it says: "Agenda libre hoy. Comparte tu enlace →", with a copy-link button.
3. **First booking ever.** The first time a real client books, show a one-time full-width card on Inicio: "¡Tu primera reserva en línea!", with the client's first name, the service, a small confetti of the business's own brand colour (once, under 1s) and a "Compártelo en tus redes" action. It ties the activation checklist ("5/7 completados") to a payoff.
4. **Empty states with a voice, not an icon.** Replace the magnifier-with-x and "No hay citas en este rango" (Citas) with a sector-aware line and one action. Belleza: "Nada agendado en estas fechas. ¿Mover el rango o crear una cita?" Salud: "Sin consultas en este periodo." Use the existing `components/ui/EmptyState.tsx`, add a `tono` prop per sector, and use no illustrations unless real ones are commissioned.
5. **Booking step 1 as a menu.** Show the services as a printed salon menu: name and price on one baseline with a dotted leader, duration in the muted colour, and category headings in the display face. Selecting a service fills a check in the business colour, and the sticky bar shows "Corte de dama · 45 min · $280 — Continuar".

---

## 6. What NOT to change

- **The semantic status system.** The tokens (`--status-*`), contrast-checked light and dark variants and the dot+label badges are the most designed thing in the app. Re-tune the hues per direction but keep the structure.
- **`brandSolid()` and business colour on the booking CTA** (`lib/colorUtils.ts:122`). This is exactly right: the storefront belongs to the business and the contrast is guaranteed.
- **The salud sidebar `#0F4C75`.** It is a real sector signal and the seed of a salud palette.
- **The booking wizard structure.** Four steps, a sticky bottom action bar, a running summary and the breadcrumb chip. It is mobile-first done right.
- **The categorical palette for employees** (Gantt and kiosk avatars). It gives instant recognition. Just make sure no category hue collides with the new accent.
- **The kiosk mode.** Its huge clock, dark full-screen view and per-employee columns already feel purpose-built. Only the type needs the new scale.
- **The gold logo, and the rule against spreading gold.** Keep the gold unique. Build warmth around it with neutrals instead of copying it onto buttons.
- **Light-only public pages.** This is correct for a storefront that clients open from WhatsApp in daylight.
