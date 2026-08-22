# Multiple Schedule Intervals Per Day — Design Spec

## Goal

Allow a business and its employees to define multiple open time windows per weekday (e.g., Monday 8am–12pm and 1pm–7pm), replacing the current single-interval-per-day constraint.

## Background

Currently `HorarioNegocio` and `HorarioEmpleado` store one row per weekday, with `HoraInicio` and `HoraFin` defining a single continuous open window. The slot generation algorithm iterates once over that window. This design eliminates the one-row-per-day constraint and adapts all consumers.

---

## Section 1 — Data Model

### HorarioNegocio (existing table, extended)

No new columns. Remove the implicit "one row per (NegocioId, DiaSemana)" application constraint.

| Column | Change |
|---|---|
| Id, NegocioId, DiaSemana, HoraInicio, HoraFin | No change |
| Activo | Semantic change: was "day open/closed", now "this specific interval is enabled". A closed day = all its intervals have `Activo=0`, or no rows exist for that day. |

Allow multiple rows per `(NegocioId, DiaSemana)`. Add a non-unique index on `(NegocioId, DiaSemana)` if not already present.

**Migration**: existing rows are untouched — each becomes the first (and only) interval for that day. No data loss, no transformation required.

### HorarioEmpleado (existing table, extended)

Identical changes: remove the one-row-per-day constraint, same `Activo` semantic change, same index.

---

## Section 2 — API Contract

### Business schedule

**GET `/api/negocios/perfil/horarios`**

Response — array of 7 day objects, one per weekday (0=Sunday … 6=Saturday). Days with no active intervals are included with `activo: false` and `intervalos: []`.

```json
[
  {
    "diaSemana": 1,
    "activo": true,
    "intervalos": [
      { "id": "guid", "horaInicio": "08:00", "horaFin": "12:00" },
      { "id": "guid", "horaInicio": "13:00", "horaFin": "19:00" }
    ]
  },
  {
    "diaSemana": 2,
    "activo": false,
    "intervalos": []
  }
]
```

**PUT `/api/negocios/perfil/horarios`**

Request body: same structure as GET response, but `id` fields on intervals are optional (ignored on write). The server performs a **full replace per day**: deletes all existing rows for each `diaSemana` present in the payload, then inserts the new intervals.

Input DTO per day:
```json
{
  "diaSemana": 1,
  "activo": true,
  "intervalos": [
    { "horaInicio": "08:00", "horaFin": "12:00" },
    { "horaInicio": "13:00", "horaFin": "19:00" }
  ]
}
```

Server-side validations (400 if violated):
- `horaInicio < horaFin` on every interval
- No two intervals on the same day overlap: `max(a.inicio, b.inicio) < min(a.fin, b.fin)`
- Intervals are sorted ascending by `horaInicio` before insert
- If `activo: false`, intervals array is ignored (all rows for that day are deleted or set `Activo=0`)

### Employee schedule

**GET `/api/empleados/{id}/horario`** and **PUT `/api/empleados/{id}/horario`**

Same structure and validation rules as the business endpoints above, keyed by `EmpleadoId`.

---

## Section 3 — Slot Generation Algorithm

File: `AppointVaAPI/Services/DisponibilidadService.cs`

### Current behavior (single interval per day)
```
slotInicio = fecha + horario.HoraInicio
horarioFin = fecha + horario.HoraFin
while slotInicio + duracion <= horarioFin:
  check overlaps → emit slot
  slotInicio += duracion
```

### New behavior (multiple intervals per day)

```
intervalosEmpleado = HorariosEmpleado
  WHERE EmpleadoId = X AND DiaSemana = Y AND Activo = 1
  ORDER BY HoraInicio

intervalosNegocio = HorariosNegocio
  WHERE NegocioId = Z AND DiaSemana = Y AND Activo = 1
  ORDER BY HoraInicio

// No open intervals on the business side = day is closed, return empty
if intervalosNegocio is empty: return []

for each intervaloEmpleado in intervalosEmpleado:
  slotInicio = fecha + intervaloEmpleado.HoraInicio
  slotFin    = fecha + intervaloEmpleado.HoraFin

  while slotInicio + duracion <= slotFin:
    // Slot must fall within at least one business interval
    dentroNegocio = intervalosNegocio.Any(n =>
      slotInicio >= fecha + n.HoraInicio &&
      slotInicio + duracion <= fecha + n.HoraFin)

    if dentroNegocio AND not overlaps existing cita AND not overlaps block AND not in the past:
      emit slot

    slotInicio += duracion
```

**Key rule**: an employee slot is only valid when it falls entirely within one of the business's open intervals. This enforces business-wide partial closures (e.g., "all employees unavailable 1pm–3pm on Tuesdays") without extra configuration.

The existing overlap checks for appointments (including buffer) and `BloqueosHorarios` are unchanged.

---

## Section 4 — Dashboard UI

### Business schedule (PerfilPage — "Horarios" tab)

**Current**: each weekday shows a toggle + two `TimePicker` inputs.

**New**: each weekday shows a toggle + a list of interval rows.

Per-day layout when active:
```
[Lunes]  ● Activo
  [08:00] — [12:00]  [✕]
  [13:00] — [19:00]  [✕]
  [+ Agregar intervalo]
```

Rules:
- Minimum 1 interval when the day is active. The last interval cannot be deleted.
- "+ Agregar intervalo" appends a new row initialized to the end of the last interval (e.g., last ends at 12:00 → new starts at 12:00, ends at 13:00).
- Toggling a day OFF disables all its intervals (sends `activo: false`); toggling it back ON restores the last saved intervals.
- Inline validation: red border + error message if `horaInicio >= horaFin` or two intervals overlap, blocking the save button.

Frontend state shape per day:
```ts
interface DiaHorario {
  diaSemana: number;
  activo: boolean;
  intervalos: { horaInicio: string; horaFin: string }[];
}
```

### Employee schedule modal (EmpleadosPage)

Same pattern as business schedule. The existing modal that shows 7 days × one `<input type="time">` pair is replaced with 7 days × interval list with the same +/✕ controls.

The block creation form currently constrains time pickers to business hours. After this change it constrains to the union of active business intervals for the selected weekday.

---

## Files Affected

### Backend
| File | Change |
|---|---|
| `Models/HorarioNegocio.cs` | No structural change; semantic clarification in comments |
| `Models/HorarioEmpleado.cs` | Same |
| `Models/Dtos/Negocios/HorarioNegocioDto.cs` | New grouped DTO with `intervalos` array |
| `Models/Dtos/Empleados/HorarioEmpleadoDto.cs` | Same |
| `Controllers/V1/NegociosController.cs` | Replace upsert-by-day with delete+reinsert; add interval validations |
| `Controllers/V1/EmpleadosController.cs` | Same |
| `Services/DisponibilidadService.cs` | Multi-interval slot loop |
| `Data/Migrations/` | Non-unique index on (NegocioId, DiaSemana) and (EmpleadoId, DiaSemana) |

### Frontend
| File | Change |
|---|---|
| `src/types/index.ts` | Update `HorarioDto` and `ActualizarHorarioDto` types |
| `src/api/negocios.ts` | Update `obtenerHorarios` / `actualizarHorarios` to new shape |
| `src/api/empleados.ts` | Update `obtenerHorario` / `actualizarHorario` to new shape |
| `src/pages/dashboard/PerfilPage.tsx` | Replace day-level time pickers with interval list UI |
| `src/pages/dashboard/EmpleadosPage.tsx` | Replace modal time pickers with interval list UI |

---

## Constraints

- A day with `activo: false` must produce zero available slots regardless of interval data.
- Intervals on the same day must not overlap (validated both server and client side).
- A slot is only emitted when it fits **entirely** within one business interval AND one employee interval.
- Existing appointments are not affected by this change — slots already booked remain valid.
- The migration must not delete or alter any existing schedule data.
