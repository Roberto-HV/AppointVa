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
- Primary color is **slate**. Brand gold `#C8A961` is for the logo/mark ONLY — never for buttons, links, or accents.
- Appointment status colors (pending, confirmed, completed, etc.) are semantic tokens — use them, never hardcode hex values.
- Font: Inter.
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
