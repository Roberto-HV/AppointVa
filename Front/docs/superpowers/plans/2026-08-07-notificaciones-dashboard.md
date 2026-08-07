# Dashboard Notifications Bell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a notification bell to the propietario dashboard that persists new-booking and cancellation events in a DB table, with a date/time display in the topbar and manual per-notification deletion.

**Architecture:** A new `NotificacionesDashboard` table stores in-app notification records; the backend inserts a row when a cita is created or cancelled and exposes three REST endpoints (list, mark-all-read, delete). The React frontend polls every 30 seconds via React Query, shows a bell with an unread badge, and clears the badge when the dropdown is opened.

**Tech Stack:** ASP.NET Core 8 / EF Core 8 / SQL Server — React 19 / TypeScript / TanStack Query v5 / Tailwind CSS / Vitest + React Testing Library

## Global Constraints

- Notification types: `"NuevaCita"` | `"Cancelacion"` — no others
- Endpoints require `[Authorize(Roles = Roles.Propietario)]`; `NegocioId` always from `IContextoNegocio`, never from route params
- GET returns max 50 records ordered by `FechaCreacion DESC` — no pagination
- Unread badge clears when dropdown opens (mark-all-read fires immediately on open)
- Deletion is permanent — no undo, no auto-expiry
- TypeScript strict — no `any`
- No new npm runtime dependencies
- Date/time updates every 60 seconds via `setInterval`; locale `es-MX`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `Back/…/Models/NotificacionDashboard.cs` | Create | Entity class |
| `Back/…/Data/ApplicationDbContext.cs` | Modify | Add DbSet + relationship + index |
| `Back/…/Migrations/…_AddNotificacionesDashboard.cs` | Generated | Schema migration |
| `Back/…/Controllers/V1/NotificacionesController.cs` | Create | 3 REST endpoints |
| `Back/…/Controllers/V1/PublicoController.cs` | Modify | Hook: insert on public booking + client cancellation |
| `Back/…/Controllers/V1/CitasController.cs` | Modify | Hook: insert on admin booking + state→Cancelada |
| `Front/src/api/notificaciones.ts` | Create | DTO type + API client |
| `Front/src/api/notificaciones.test.ts` | Create | API client tests |
| `Front/src/components/dashboard/NotificacionesBell.tsx` | Create | Bell + dropdown component |
| `Front/src/components/dashboard/NotificacionesBell.test.tsx` | Create | Component tests |
| `Front/src/layouts/DashboardLayout.tsx` | Modify | Add desktop topbar + date/time + bell |

---

### Task 1: Backend — Entity, DbContext, Migration

**Files:**
- Create: `Back/AppointVaAPI/AppointVaAPI/Models/NotificacionDashboard.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Data/ApplicationDbContext.cs`

**Interfaces:**
- Produces: `NotificacionDashboard` entity — used by Tasks 2 and 3
- Produces: `_db.NotificacionesDashboard` DbSet — used by Tasks 2 and 3

- [ ] **Step 1: Create the entity**

Create `Back/AppointVaAPI/AppointVaAPI/Models/NotificacionDashboard.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models
{
    public class NotificacionDashboard
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid NegocioId { get; set; }
        public Negocio Negocio { get; set; } = null!;

        [MaxLength(20)]
        public string Tipo { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Titulo { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Descripcion { get; set; } = string.Empty;

        public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

        public bool Leida { get; set; } = false;

        public Guid? CitaId { get; set; }
    }
}
```

- [ ] **Step 2: Add DbSet to ApplicationDbContext**

In `Back/AppointVaAPI/AppointVaAPI/Data/ApplicationDbContext.cs`, add after the last existing `DbSet`:

```csharp
public DbSet<NotificacionDashboard> NotificacionesDashboard { get; set; }
```

Then add the following inside `OnModelCreating`, after the `CierreCaja` block:

```csharp
modelBuilder.Entity<NotificacionDashboard>(n =>
{
    n.HasOne(x => x.Negocio).WithMany()
        .HasForeignKey(x => x.NegocioId)
        .OnDelete(DeleteBehavior.Cascade);
    n.HasIndex(x => new { x.NegocioId, x.Leida });
});
```

- [ ] **Step 3: Generate and inspect the migration**

Run from `Back/AppointVaAPI/AppointVaAPI/`:

```
dotnet ef migrations add AddNotificacionesDashboard
```

Expected: a new file in `Migrations/` with `AddColumn` calls for `Id`, `NegocioId`, `Tipo`, `Titulo`, `Descripcion`, `FechaCreacion`, `Leida`, `CitaId`, and a `CreateIndex` for `(NegocioId, Leida)`.

Open the generated file and verify it looks correct. No manual edits needed.

- [ ] **Step 4: Apply the migration**

```
dotnet ef database update
```

Expected: `Done.` with no errors.

- [ ] **Step 5: Commit**

```
git add Back/AppointVaAPI/AppointVaAPI/Models/NotificacionDashboard.cs
git add Back/AppointVaAPI/AppointVaAPI/Data/ApplicationDbContext.cs
git add Back/AppointVaAPI/AppointVaAPI/Migrations/
git commit -m "feat(notificaciones): add NotificacionDashboard entity and migration"
```

---

### Task 2: Backend — NotificacionesController

**Files:**
- Create: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NotificacionesController.cs`

**Interfaces:**
- Consumes: `_db.NotificacionesDashboard` (Task 1), `IContextoNegocio` (existing service)
- Produces: `GET /api/notificaciones`, `PUT /api/notificaciones/marcar-leidas`, `DELETE /api/notificaciones/{id}` — consumed by Task 4

- [ ] **Step 1: Create the controller**

Create `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NotificacionesController.cs`:

```csharp
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/notificaciones")]
    [Authorize(Roles = Roles.Propietario)]
    public class NotificacionesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IContextoNegocio _contexto;

        public NotificacionesController(ApplicationDbContext db, IContextoNegocio contexto)
        {
            _db = db;
            _contexto = contexto;
        }

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var notifs = await _db.NotificacionesDashboard
                .Where(n => n.NegocioId == _contexto.NegocioId.Value)
                .OrderByDescending(n => n.FechaCreacion)
                .Take(50)
                .Select(n => new NotificacionDto(
                    n.Id, n.Tipo, n.Titulo, n.Descripcion, n.FechaCreacion, n.Leida, n.CitaId))
                .ToListAsync();

            return Ok(notifs);
        }

        [HttpPut("marcar-leidas")]
        public async Task<IActionResult> MarcarLeidas()
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            await _db.NotificacionesDashboard
                .Where(n => n.NegocioId == _contexto.NegocioId.Value && !n.Leida)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.Leida, true));

            return NoContent();
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Eliminar(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var notif = await _db.NotificacionesDashboard
                .FirstOrDefaultAsync(n => n.Id == id && n.NegocioId == _contexto.NegocioId.Value);

            if (notif is null) return NotFound();

            _db.NotificacionesDashboard.Remove(notif);
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }

    public record NotificacionDto(
        Guid Id,
        string Tipo,
        string Titulo,
        string Descripcion,
        DateTime FechaCreacion,
        bool Leida,
        Guid? CitaId
    );
}
```

- [ ] **Step 2: Build to verify no compile errors**

```
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 3: Manual smoke test**

Start the API (`dotnet run`), authenticate as a Propietario, and call:

```
GET /api/notificaciones        → 200 [] (empty list)
PUT /api/notificaciones/marcar-leidas  → 204
DELETE /api/notificaciones/{random-guid}  → 404
```

- [ ] **Step 4: Commit**

```
git add Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NotificacionesController.cs
git commit -m "feat(notificaciones): add REST endpoints list, mark-read, delete"
```

---

### Task 3: Backend — Cita Creation and Cancellation Hooks

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/PublicoController.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/CitasController.cs`

**Interfaces:**
- Consumes: `_db.NotificacionesDashboard` (Task 1)
- Produces: rows in `NotificacionesDashboard` whenever a cita is created or cancelled

- [ ] **Step 1: Hook into PublicoController.CrearCita (public booking)**

In `PublicoController.CrearCita`, after the line `_jobClient.Enqueue<IPushService>(s => s.EnviarNuevaCitaEmpleadoAsync(cita.Id))`, add:

```csharp
_db.NotificacionesDashboard.Add(new NotificacionDashboard
{
    NegocioId = negocio.Id,
    Tipo = "NuevaCita",
    Titulo = $"Nueva cita de {cita.NombreCliente}",
    Descripcion = $"{servicio.Nombre} con {empleado.Nombre} · {cita.InicioEn.ToLocalTime():ddd d 'de' MMM, HH:mm}",
    CitaId = cita.Id
});
await _db.SaveChangesAsync();
```

- [ ] **Step 2: Hook into CitasController.Crear (admin-created booking)**

In `CitasController.Crear`, locate the block where the cita is saved and the Hangfire confirmation job is enqueued. After `_jobClient.Enqueue<NotificacionJob>(...)` for confirmation, add:

```csharp
_db.NotificacionesDashboard.Add(new NotificacionDashboard
{
    NegocioId = cita.NegocioId,
    Tipo = "NuevaCita",
    Titulo = $"Nueva cita de {cita.NombreCliente}",
    Descripcion = $"{servicio.Nombre} con {empleado.Nombre} · {cita.InicioEn.ToLocalTime():ddd d 'de' MMM, HH:mm}",
    CitaId = cita.Id
});
await _db.SaveChangesAsync();
```

The variables `servicio` and `empleado` are already in scope at that point. Use their `.Nombre` properties.

- [ ] **Step 3: Hook into CitasController.CambiarEstado (admin cancellation)**

In `CitasController.CambiarEstado`, after `await _citaRepo.ActualizarAsync(cita)`, add this block (before the existing `if (dto.NuevoEstado == EstadosCitas.Cancelada)` lista-espera block):

```csharp
if (dto.NuevoEstado == EstadosCitas.Cancelada)
{
    _db.NotificacionesDashboard.Add(new NotificacionDashboard
    {
        NegocioId = cita.NegocioId,
        Tipo = "Cancelacion",
        Titulo = $"Cita cancelada — {cita.NombreCliente}",
        Descripcion = $"{cita.Servicio?.Nombre ?? "Servicio"} con {cita.Empleado?.Nombre ?? "Empleado"} · {cita.InicioEn.ToLocalTime():ddd d 'de' MMM, HH:mm}",
        CitaId = cita.Id
    });
    await _db.SaveChangesAsync();
}
```

- [ ] **Step 4: Hook into PublicoController.CancelarCita (client self-service cancellation)**

Find `CancelarCita` in `PublicoController`. After the cita state is set to cancelled and saved, add:

```csharp
_db.NotificacionesDashboard.Add(new NotificacionDashboard
{
    NegocioId = cita.NegocioId,
    Tipo = "Cancelacion",
    Titulo = $"Cita cancelada — {cita.NombreCliente}",
    Descripcion = $"{cita.Servicio?.Nombre ?? "Servicio"} con {cita.Empleado?.Nombre ?? "Empleado"} · {cita.InicioEn.ToLocalTime():ddd d 'de' MMM, HH:mm}",
    CitaId = cita.Id
});
await _db.SaveChangesAsync();
```

Add `using AppointVaAPI.Models;` at the top of both files if the namespace is not already imported.

- [ ] **Step 5: Build and verify**

```
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 6: Smoke test**

Create a test booking via the public booking page. Then call `GET /api/notificaciones` authenticated as the Propietario and confirm a `NuevaCita` row appears.

Cancel that booking and confirm a `Cancelacion` row appears.

- [ ] **Step 7: Commit**

```
git add Back/AppointVaAPI/AppointVaAPI/Controllers/V1/PublicoController.cs
git add Back/AppointVaAPI/AppointVaAPI/Controllers/V1/CitasController.cs
git commit -m "feat(notificaciones): insert notification rows on cita create and cancel"
```

---

### Task 4: Frontend — API Client

**Files:**
- Create: `Front/src/api/notificaciones.ts`
- Create: `Front/src/api/notificaciones.test.ts`

**Interfaces:**
- Consumes: `api` axios instance from `./axios` (existing)
- Produces: `NotificacionDto`, `notificacionesApi.listar`, `notificacionesApi.marcarLeidas`, `notificacionesApi.eliminar` — consumed by Task 5

- [ ] **Step 1: Write the failing tests**

Create `Front/src/api/notificaciones.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as axiosModule from './axios';
import { notificacionesApi } from './notificaciones';

vi.mock('./axios', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mockNotifs = [
  {
    id: 'n1',
    tipo: 'NuevaCita' as const,
    titulo: 'Nueva cita de Ana',
    descripcion: 'Corte con María · lun 7 de ago, 10:00',
    fechaCreacion: '2026-08-07T10:00:00Z',
    leida: false,
    citaId: 'c1',
  },
];

describe('notificacionesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listar returns data from GET /notificaciones', async () => {
    vi.mocked(axiosModule.api.get).mockResolvedValue({ data: mockNotifs });
    const result = await notificacionesApi.listar();
    expect(axiosModule.api.get).toHaveBeenCalledWith('/notificaciones');
    expect(result).toEqual(mockNotifs);
  });

  it('marcarLeidas calls PUT /notificaciones/marcar-leidas', async () => {
    vi.mocked(axiosModule.api.put).mockResolvedValue({});
    await notificacionesApi.marcarLeidas();
    expect(axiosModule.api.put).toHaveBeenCalledWith('/notificaciones/marcar-leidas');
  });

  it('eliminar calls DELETE /notificaciones/{id}', async () => {
    vi.mocked(axiosModule.api.delete).mockResolvedValue({});
    await notificacionesApi.eliminar('n1');
    expect(axiosModule.api.delete).toHaveBeenCalledWith('/notificaciones/n1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd Front && npx vitest run src/api/notificaciones.test.ts
```

Expected: FAIL — `notificaciones` module not found.

- [ ] **Step 3: Create the API client**

Create `Front/src/api/notificaciones.ts`:

```typescript
import { api } from './axios';

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

- [ ] **Step 4: Run tests — all 3 must pass**

```
npx vitest run src/api/notificaciones.test.ts
```

Expected: `Tests 3 passed (3)`

- [ ] **Step 5: Commit**

```
git add Front/src/api/notificaciones.ts Front/src/api/notificaciones.test.ts
git commit -m "feat(notificaciones): add API client and types"
```

---

### Task 5: Frontend — NotificacionesBell Component

**Files:**
- Create: `Front/src/components/dashboard/NotificacionesBell.tsx`
- Create: `Front/src/components/dashboard/NotificacionesBell.test.tsx`

**Interfaces:**
- Consumes: `notificacionesApi`, `NotificacionDto` from `../../api/notificaciones` (Task 4)
- Produces: `<NotificacionesBell />` — consumed by Task 6

- [ ] **Step 1: Write the failing tests**

Create `Front/src/components/dashboard/NotificacionesBell.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificacionesBell } from './NotificacionesBell';
import * as notifModule from '../../api/notificaciones';

vi.mock('../../api/notificaciones', () => ({
  notificacionesApi: {
    listar: vi.fn(),
    marcarLeidas: vi.fn(),
    eliminar: vi.fn(),
  },
}));

function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificacionesBell />
    </QueryClientProvider>
  );
}

const mockNotifs = [
  {
    id: 'n1',
    tipo: 'NuevaCita' as const,
    titulo: 'Nueva cita de Ana',
    descripcion: 'Corte con María · lun 7 de ago, 10:00',
    fechaCreacion: new Date().toISOString(),
    leida: false,
  },
];

describe('NotificacionesBell', () => {
  beforeEach(() => {
    vi.mocked(notifModule.notificacionesApi.listar).mockResolvedValue(mockNotifs);
    vi.mocked(notifModule.notificacionesApi.marcarLeidas).mockResolvedValue(undefined);
    vi.mocked(notifModule.notificacionesApi.eliminar).mockResolvedValue(undefined);
  });

  it('shows unread badge count when there are unread notifications', async () => {
    renderBell();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('opens dropdown and shows notification title when bell is clicked', async () => {
    renderBell();
    await waitFor(() => screen.getByLabelText('Notificaciones'));
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    await waitFor(() => {
      expect(screen.getByText('Nueva cita de Ana')).toBeInTheDocument();
    });
  });

  it('calls marcarLeidas when dropdown opens with unread notifications', async () => {
    renderBell();
    await waitFor(() => screen.getByLabelText('Notificaciones'));
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    await waitFor(() => {
      expect(notifModule.notificacionesApi.marcarLeidas).toHaveBeenCalled();
    });
  });

  it('shows empty state message when no notifications', async () => {
    vi.mocked(notifModule.notificacionesApi.listar).mockResolvedValue([]);
    renderBell();
    await waitFor(() => screen.getByLabelText('Notificaciones'));
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    await waitFor(() => {
      expect(screen.getByText('Sin notificaciones')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npx vitest run src/components/dashboard/NotificacionesBell.test.tsx
```

Expected: FAIL — component module not found.

- [ ] **Step 3: Create the component**

Create `Front/src/components/dashboard/NotificacionesBell.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificacionesApi, type NotificacionDto } from '../../api/notificaciones';

function tiempoRelativo(fechaIso: string): string {
  const diff = Date.now() - new Date(fechaIso).getTime();
  const minutos = Math.floor(diff / 60_000);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return new Date(fechaIso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function NotificacionesBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: notificaciones = [] } = useQuery<NotificacionDto[]>({
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

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  function handleOpen() {
    setOpen(true);
    if (noLeidas > 0) marcarLeidas.mutate();
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Notificaciones
            </span>
          </div>

          {notificaciones.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Sin notificaciones
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
              {notificaciones.map(n => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="mt-0.5 text-base">
                    {n.tipo === 'NuevaCita' ? '🗓' : '❌'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {n.titulo}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {n.descripcion}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {tiempoRelativo(n.fechaCreacion)}
                    </p>
                  </div>
                  <button
                    onClick={() => eliminar.mutate(n.id)}
                    className="shrink-0 text-lg leading-none text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                    aria-label="Eliminar notificación"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — all 4 must pass**

```
npx vitest run src/components/dashboard/NotificacionesBell.test.tsx
```

Expected: `Tests 4 passed (4)`

- [ ] **Step 5: Commit**

```
git add Front/src/components/dashboard/NotificacionesBell.tsx
git add Front/src/components/dashboard/NotificacionesBell.test.tsx
git commit -m "feat(notificaciones): add NotificacionesBell component with tests"
```

---

### Task 6: Frontend — DashboardLayout Integration

**Files:**
- Modify: `Front/src/layouts/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `<NotificacionesBell />` from `../components/dashboard/NotificacionesBell` (Task 5)
- Produces: date/time display + bell in both mobile header and new desktop topbar

- [ ] **Step 1: Add FechaHoraActual helper and import NotificacionesBell**

At the top of `DashboardLayout.tsx`, add the import:

```typescript
import { NotificacionesBell } from '../components/dashboard/NotificacionesBell';
```

Add `Bell` to the lucide-react import if it is not already there (it is only needed if used directly; `NotificacionesBell` brings its own import, so no change needed to the lucide import).

Define `FechaHoraActual` as a module-level function in `DashboardLayout.tsx`, before the main component:

```typescript
function FechaHoraActual() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const fecha = ahora.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const hora = ahora.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return (
    <span className="hidden sm:block select-none text-sm capitalize text-slate-500 dark:text-slate-400">
      {fecha} · {hora}
    </span>
  );
}
```

(`useState` and `useEffect` are already imported at the top of `DashboardLayout.tsx` — do not add duplicate imports.)

- [ ] **Step 2: Add bell and date/time to the mobile header**

In the mobile `<header>` (the one with class `xl:hidden`), find the right-side user menu `<div>` that starts with:

```typescript
<div ref={headerUserRef} className="ml-auto flex items-center gap-2 relative">
```

Insert `<FechaHoraActual />` and `<NotificacionesBell />` as the first two children of that div, before the existing pending-chip and avatar button:

```typescript
<div ref={headerUserRef} className="ml-auto flex items-center gap-2 relative">
  <FechaHoraActual />
  <NotificacionesBell />
  {/* existing pendientesCnt chip and avatar button remain unchanged below */}
```

- [ ] **Step 3: Add desktop topbar**

The desktop layout currently has no topbar — it goes from `<aside>` directly to `<main>`. Find the `<main>` element in the JSX (the one that contains `<Outlet />`). Wrap the `<Outlet />` with a new desktop-only topbar inside `<main>`:

Replace:

```typescript
<main className="...existing classes...">
  <Outlet />
</main>
```

With:

```typescript
<main className="...existing classes...">
  {/* Desktop topbar — hidden on mobile (mobile has its own header) */}
  <header className="hidden xl:flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
    <FechaHoraActual />
    <NotificacionesBell />
  </header>
  <Outlet />
</main>
```

Keep all existing `<main>` classes — only wrap `<Outlet />` with the new header above it.

- [ ] **Step 4: TypeScript check**

```
cd Front && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the full test suite**

```
npx vitest run
```

Expected: all existing tests still pass + the 4 new NotificacionesBell tests + the 3 new API tests = total increases by 7.

- [ ] **Step 6: Verify visually**

Start the dev server (`npm run dev`). Log in as Propietario. Confirm:
- Mobile view: date/time and bell appear in the top header
- Desktop view (`xl` breakpoint): date/time and bell appear in the new topbar above the page content
- Bell opens a dropdown with "Sin notificaciones" when empty
- Date/time updates correctly and capitalizes the weekday

- [ ] **Step 7: Commit**

```
git add Front/src/layouts/DashboardLayout.tsx
git commit -m "feat(notificaciones): add date/time display and bell to dashboard topbar"
```
