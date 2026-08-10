# AppointVa

SaaS de reservas y gestión de citas para negocios de servicios (salones, barberías, spas, clínicas, consultorios, veterinarias, fisioterapia y similares).

Los negocios reciben un enlace público personalizado (`/b/{slug}`) donde sus clientes pueden reservar citas en línea sin crear una cuenta.

## Estructura del repositorio

```
AppointVa/
├── Front/          # Frontend — React + TypeScript + Vite
└── Back/
    └── AppointVaAPI/  # Backend — ASP.NET Core 10 + C#
```

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Radix UI |
| Backend | ASP.NET Core 10, Entity Framework Core 10, C# |
| Base de datos | PostgreSQL (Render) |
| Email | Brevo (SMTP relay) |
| Auth | JWT + refresh tokens |
| Deploy frontend | Vercel (rama `main`) |
| Deploy backend | Render (rama `main`) |
| PWA | Vite PWA plugin |

## Entornos

| Entorno | Frontend | Backend |
|---------|----------|---------|
| Producción | Vercel — auto-deploy desde `main` | Render — auto-deploy desde `main` |
| Staging | — | Render — rama `develop` |

## Correr localmente

### Backend

```bash
cd Back/AppointVaAPI
# Configura la cadena de conexión en appsettings.Development.json
dotnet restore
dotnet run --project AppointVaAPI
# API disponible en https://localhost:7xxx
```

Variables de entorno necesarias en `appsettings.Development.json`:
- `ConnectionStrings:DefaultConnection` — PostgreSQL local o Render
- `Jwt:Key` — clave secreta para JWT
- `SmtpHost` / `SmtpUser` / `SmtpPassword` — credenciales SMTP de Brevo
- `FrontendUrl` — URL del frontend (ej. `http://localhost:5173`)

### Frontend

```bash
cd Front
npm install
cp .env.example .env.local   # o crea .env.local manualmente
npm run dev
# App disponible en http://localhost:5173
```

Variable necesaria en `.env.local`:
```
VITE_API_URL=https://localhost:7xxx/api
```

## Comandos útiles — Frontend

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run test         # tests unitarios (Vitest)
npm run test:watch   # tests en modo watch
npm run lint         # ESLint
```

## Flujo de branches

```
feature/* → develop → main (producción)
```

Sincronizar develop con main después de un merge directo a main:
```bash
git push origin main:develop
```

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| SuperAdmin | Panel de administración en `/superadmin` — gestiona negocios y planes |
| Propietario | Dashboard completo en `/dashboard` |
| Empleado | Vista reducida con agenda propia |
| Cliente | Portal público de reservas `/b/{slug}` y mis citas `/b/{slug}/mis-citas` |

## Módulos principales

- **Booking público** — reserva sin cuenta, confirmación por email
- **Dashboard** — citas, servicios, empleados, horarios, clientes, reportes, galería
- **Kiosk** — pantalla de recepción para el negocio
- **Intake** — cuestionario previo a la cita configurable por servicio
- **Notificaciones** — email automático en reserva, recordatorio y cambios de estado; push web para empleados; campana en el dashboard del propietario con historial de nuevas citas y cancelaciones
- **PWA** — instalable en móvil como app nativa
