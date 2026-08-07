# Dashboard Notifications Bell — Design Spec

## Goal

Add a notification bell to the propietario dashboard topbar that shows new bookings and cancellations, with a date/time display alongside it and manual per-notification deletion.

## Context

AppointVa already sends Web Push notifications (VAPID) and email/WhatsApp to staff when a cita is created or rescheduled. There is no in-app notification history — the bell adds a persistent, dismissable record of events visible from any device.

**Tech Stack:** ASP.NET Core 8 / EF Core 8 / SQL Server · React 19 / TypeScript / TanStack Query v5 / Tailwind CSS

---

## Global Constraints

- Two notification types only: `"NuevaCita"` | `"Cancelacion"`
- Notifications are per-negocio, visible to all Propietario-role users of that negocio
- No real-time (WebSocket/SignalR) — polling at 30-second intervals, consistent with existing dashboard pattern
- No new npm runtime dependencies
- TypeScript strict — no `any`
- Propietario cannot change notification type or content — backend generates both fields
- Unread badge clears when the dropdown is opened (mark-all-read on open)
- Deletion is manual and permanent — no undo, no auto-expiry
- Date/time display updates every 60 seconds via `setInterval`

---

## Section 1: Data Model

### 1a. New table — `NotificacionesDashboard`

| Column | Type | Notes |
|---|---|---|
| `Id` | `Guid` | PK, `NEWID()` default |
| `NegocioId` | `Guid` | FK → `Negocios.Id`, cascade delete |
| `Tipo` | `string(20)` | `"NuevaCita"` or `"Cancelacion"` |
| `Titulo` | `string(200)` | E.g. "Nueva cita de Ana García" |
| `Descripcion` | `string(500)` | Service + employee + formatted time |
| `FechaCreacion` | `DateTime` | UTC, set server-side |
| `Leida` | `bool` | Default `false` |
| `CitaId` | `Guid?` | Optional FK → `Citas.Id`, set null on delete |

EF Core migration: `AddColumn` for each field, index on `(NegocioId, Leida)` for the unread-count query.

### 1b. Entity

**File:** `Back/AppointVaAPI/AppointVaAPI/Models/NotificacionDashboard.cs`

```csharp
public class NotificacionDashboard
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid NegocioId { get; set; }
    public Negocio Negocio { get; set; } = null!;
    public string Tipo { get; set; } = string.Empty;
    public string Titulo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public bool Leida { get; set; } = false;
    public Guid? CitaId { get; set; }
}
```

Add `DbSet<NotificacionDashboard> NotificacionesDashboard` to `ApplicationDbContext`.

---

## Section 2: Backend — API

### 2a. Controller

**File:** `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NotificacionesController.cs`

Auth: `[Authorize(Roles = Roles.Propietario)]` on the controller. NegocioId resolved from `User.FindFirstValue("negocioId")`.

**Endpoints:**

```
GET    /api/notificaciones          → list (50 most recent, desc by FechaCreacion)
PUT    /api/notificaciones/marcar-leidas  → mark all unread as leida=true for this negocio
DELETE /api/notificaciones/{id}     → delete one (must belong to this negocio)
```

**GET response DTO:**

```csharp
public record NotificacionDto(
    Guid Id,
    string Tipo,
    string Titulo,
    string Descripcion,
    DateTime FechaCreacion,
    bool Leida,
    Guid? CitaId
);
```

**GET** returns max 50 records ordered by `FechaCreacion DESC`. No pagination needed.

**PUT marcar-leidas** updates `Leida = true` where `NegocioId == negocioId && Leida == false`. Returns 204.

**DELETE** finds by Id, validates `NegocioId` matches, deletes, returns 204. Returns 404 if not found or negocio mismatch.

### 2b. Notification creation — hook into existing flows

**File to modify:** `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/PublicoController.cs`

After saving a new cita in `CrearCita`, insert a `NotificacionDashboard`:

```csharp
var notif = new NotificacionDashboard
{
    NegocioId = negocio.Id,
    Tipo = "NuevaCita",
    Titulo = $"Nueva cita de {dto.NombreCliente}",
    Descripcion = $"{servicio.Nombre} con {empleado.Nombre} · {cita.InicioEn.ToLocalTime():ddd d MMM, HH:mm}",
    CitaId = cita.Id
};
_context.NotificacionesDashboard.Add(notif);
await _context.SaveChangesAsync();
```

**File to modify:** `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/CitasController.cs`

After saving a new cita in `Crear`, insert the same `NuevaCita` notification.

After setting estado to `Cancelada` in `CambiarEstado`, insert a `Cancelacion` notification:

```csharp
var notif = new NotificacionDashboard
{
    NegocioId = cita.NegocioId,
    Tipo = "Cancelacion",
    Titulo = $"Cita cancelada — {cita.NombreCliente}",
    Descripcion = $"{cita.Servicio.Nombre} con {cita.Empleado.Nombre} · {cita.InicioEn.ToLocalTime():ddd d MMM, HH:mm}",
    CitaId = cita.Id
};
_context.NotificacionesDashboard.Add(notif);
await _context.SaveChangesAsync();
```

Also hook into `PublicoController.CancelarCita` (client self-service cancellation).

---

## Section 3: Frontend

### 3a. API client

**File:** `Front/src/api/notificaciones.ts`

```ts
export interface NotificacionDto {
  id: string;
  tipo: 'NuevaCita' | 'Cancelacion';
  titulo: string;
  descripcion: string;
  fechaCreacion: string;
  leida: boolean;
  citaId?: string;
}

export const notificacionesApi = {
  listar: (): Promise<NotificacionDto[]> =>
    api.get('/notificaciones').then(r => r.data),

  marcarLeidas: (): Promise<void> =>
    api.put('/notificaciones/marcar-leidas').then(() => undefined),

  eliminar: (id: string): Promise<void> =>
    api.delete(`/notificaciones/${id}`).then(() => undefined),
};
```

### 3b. Hook

**File:** `Front/src/hooks/useNotificaciones.ts`

```ts
export function useNotificaciones() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['notificaciones'],
    queryFn: notificacionesApi.listar,
    refetchInterval: 30_000,
  });

  const marcarLeidas = useMutation({
    mutationFn: notificacionesApi.marcarLeidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const eliminar = useMutation({
    mutationFn: notificacionesApi.eliminar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  });

  const noLeidas = (query.data ?? []).filter(n => !n.leida).length;

  return { notificaciones: query.data ?? [], noLeidas, marcarLeidas, eliminar };
}
```

### 3c. Bell component

**File:** `Front/src/components/dashboard/NotificacionesBell.tsx`

- `useState` for `open: boolean`
- `useRef` on the container + `useEffect` for click-outside detection (same pattern as existing dropdowns)
- On open: call `marcarLeidas.mutate()` immediately
- Badge: red pill with `noLeidas` count, hidden when 0
- Dropdown (absolute positioned, z-50, shadow-lg, rounded-xl, w-80):
  - Header: "Notificaciones"
  - List of `NotificacionDto`, ordered by `fechaCreacion` desc (already sorted from API)
  - Each row: icon (🗓 NuevaCita / ✕ Cancelacion), `titulo` bold, `descripcion` small gray, relative time (e.g. "hace 5 min"), × button to delete
  - Empty state: "Sin notificaciones" centered, muted
- Relative time: computed from `fechaCreacion` — "hace N min", "hace N h", or date string if older than 24 h

### 3d. Date/time display

Added inline in `DashboardLayout.tsx` topbar, to the left of `NotificacionesBell`:

```tsx
function FechaHoraActual() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const fecha = ahora.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const hora = ahora.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return (
    <span className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 select-none">
      {fecha} · {hora}
    </span>
  );
}
```

### 3e. DashboardLayout changes

**File:** `Front/src/layouts/DashboardLayout.tsx`

In the topbar right section, add before the user avatar:
```tsx
<FechaHoraActual />
<NotificacionesBell />
```

---

## Out of Scope

- Pagination of notifications (max 50 is sufficient)
- Auto-expiry / TTL on old notifications
- Employee-role notifications (Propietario only)
- Notification preferences or filtering by type
- Real-time delivery (WebSocket/SignalR)
- Click-through from notification to the specific cita
