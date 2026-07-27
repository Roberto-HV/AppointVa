# AppointVa — Frontend

Frontend del SaaS de reservas AppointVa. React 19 + TypeScript + Vite.

## Stack

- **React 19** + **TypeScript**
- **Vite** — bundler y dev server
- **Tailwind CSS** — estilos utilitarios con soporte dark mode
- **TanStack Query** — server state y caché
- **Radix UI** — componentes accesibles (Dialog, Select, Tooltip, etc.)
- **React Router v6** — navegación
- **Framer Motion** — animaciones
- **Recharts** — gráficas en el dashboard
- **Lucide React** — iconos
- **Vitest + Testing Library** — tests unitarios

## Setup

```bash
npm install

# Crea el archivo de variables de entorno
echo "VITE_API_URL=https://localhost:7xxx/api" > .env.local

npm run dev
```

## Comandos

```bash
npm run dev           # desarrollo en http://localhost:5173
npm run build         # build de producción (tsc + vite build)
npm run preview       # previsualizar build
npm run test          # tests unitarios
npm run test:watch    # tests en modo watch
npm run test:coverage # cobertura
npm run lint          # ESLint
```

## Estructura

```
src/
├── api/           # clientes HTTP por dominio (citasApi, negociosApi, etc.)
├── components/    # componentes reutilizables
│   ├── ui/        # primitivos (Modal, Skeleton, Badge, etc.)
│   └── booking/   # componentes del flujo de reserva público
├── hooks/         # hooks personalizados (useTheme, etc.)
├── layouts/       # DashboardLayout, PublicLayout
├── pages/
│   ├── dashboard/ # páginas del panel de negocio
│   ├── publico/   # booking, confirmación, mis citas
│   └── admin/     # superadmin
├── store/         # Zustand (authStore)
├── types/         # tipos TypeScript compartidos
└── utils/         # formatters, helpers
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base de la API (sin `/` final) |

## Deploy

Vercel. Auto-deploy desde la rama `main`. No requiere configuración adicional — Vercel detecta Vite automáticamente.
