# AppointVa Front — Claude Instructions

Appointment-booking SaaS frontend. Business owners and employees manage appointments in the dashboard; end clients book through public pages (`/b/:slug`).

## Stack

- React 19 + TypeScript + Vite (PWA)
- react-router-dom 7 — all routes live in `src/App.tsx`
- shadcn/ui on Radix, lucide-react icons, framer-motion
- Tailwind 3 with `darkMode: "class"`
- TanStack Query (server state), Zustand (`src/store`), react-hook-form + zod, axios (`src/api`)
- Tests: Vitest + Testing Library (co-located), Playwright (`e2e/`)

## Structure

- `src/pages/{auth,publico,dashboard,admin}` — one file per screen
- `src/components/{ui,booking,dashboard,icons}` — `ui/` is shadcn; booking wizard steps are `Paso*.tsx`
- `src/layouts` — `DashboardLayout`, `AdminLayout`
- `src/hooks`, `src/lib`, `src/types`, `src/utils`

## Conventions

- UI copy is **Spanish** (neutral, professional). Keep it that way.
- Identifiers follow the existing mix: Spanish domain names (`citas`, `PasoFechaHora`, `RutaProtegida`), English React conventions (`Page`, `Layout`, `use*`).
- Reuse existing `src/components/ui` primitives before creating new ones.
- Theme scope:
  - **Public pages** (`src/pages/publico`, `src/components/booking`, and public auth-free routes like `/b/:slug`, `/cita/:codigo`, `/resena/:token`) are **light mode only**. Never apply `.dark` there and do not add `dark:` variants to booking components.
  - **Dashboard and admin** (`src/pages/dashboard`, `src/pages/admin`, their layouts) must work in light AND dark mode.
  - Enforced by route: only `/dashboard*` and `/admin*` may carry `.dark`. Every other route (booking, landing, auth, legal, 404) is light-only. See `src/lib/temaPorRuta.ts`, `src/components/TemaPorRuta.tsx` and the boot script in `index.html` (keep the three in sync).
- Public booking pages are mobile-first.

## Design System (source of truth)

- Token reference: `docs/design-system.css`; actual tokens: `src/index.css` + `tailwind.config.js`
- Base is **navy/slate**. Primary is navy slate (`#334155` light / `#E2E8F0` dark; `bg-primary`); ink is deep navy for dark slabs (`#1E293B` light / `#E2E8F0` dark; `bg-ink`). Tailwind's `slate-*` scale resolves to the `--neutral-*` ramp, whose default values are Tailwind's own slate (`gray-*`/`zinc-*` are Tailwind's defaults); prefer semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`) for new code.
- AppointVa brand accent is the **navy primary** (`text-accent-brand`, `bg-accent-brand/10`, `ring-accent-brand`; same value as `--ring`) for links, focus rings, active nav and progress. No terracotta or warm-paper neutrals. **Never on the booking page `/b/:slug`** (or other business-branded public pages): there the business colour owns the cover, CTA and selected states through `brandSolid()`.
- Brand gold `#C8A961` is still for the logo/mark ONLY — never for buttons, links, or accents.
- Sector salud: cool neutral ramp and `#0F4C75` accent via `[data-sector="salud"]` (DashboardLayout sets it on `<html>`; salud public pages on their root). Don't duplicate components per sector.
- Appointment status colors (pending, confirmed, completed, etc.) are semantic tokens — use them, never hardcode hex values.
- Fonts: Inter for UI (400/500/600, 700 max, never `font-black`). Display face **Fraunces** (`font-display`) ONLY for the landing H1/H2 (not `/salud`). Never in the dashboard, the public booking flow (`/b/:slug`) or the confirmation page: those use Inter.
- Shape and depth: cards `rounded-xl` (14px), controls `rounded-lg` (10px), pills only for chips/badges. Elevation is `shadow-card` OR a border, never both (`.tarjeta` is the card primitive). Motion 180–240ms with `ease-calma`.
- Numbers: `tabular-nums` for times, money and counts; one time format (`formatHora`/`formatHoraDe`); whole pesos without `.00` (`formatPrecio`). Labels are sentence case; uppercase only for the confirmation code.
- If a change needs a new token, add it to `src/index.css`/`tailwind.config.js` AND document it in `docs/design-system.css`.

## Design & UX Work — Required Skills

For any task that touches UI (new screen, redesign, polish, audit, component), use these skills:

| Need | Skill |
| --- | --- |
| Overall design quality, avoiding generic AI look | `impeccable` |
| Visual hierarchy, spacing, color, depth | `refactoring-ui` |
| Usability audit (Nielsen heuristics, severity) | `ux-heuristics` |
| Affordances, feedback, error prevention | `design-everyday-things` |
| Loading states, toggles, form feedback, transitions | `microinteractions` |
| Type scale, readability | `web-typography` |
| Final "is this good enough to ship" review | `steve-jobs-design-review` |
| Landing pages only (`/`, `/landing`, `/salud`) | `top-design` |

## Screen Audits

When auditing a screen:

1. Read the page file and the components it renders.
2. Evaluate with `ux-heuristics` (severity per issue) and `refactoring-ui` (visual issues).
3. Report findings as a prioritized list: severity, issue, file:line, proposed fix.
4. Do NOT change code until the user approves the findings.
5. Apply fixes one screen at a time; keep existing tests green and update them when behavior changes.

Record audit results in `docs/audits/<screen-name>.md` so work can resume across sessions.
