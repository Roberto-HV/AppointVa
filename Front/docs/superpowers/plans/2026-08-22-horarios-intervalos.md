# Multiple Schedule Intervals Per Day — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow businesses and employees to define multiple open time windows per weekday (e.g., Mon 8–12 and 13–19), replacing the single-interval-per-day constraint.

**Architecture:** The existing `HorarioNegocio` and `HorarioEmpleado` tables already allow multiple rows per day (no DB unique constraint exists — uniqueness was enforced only by app logic). The change removes that app-level upsert logic and replaces it with delete-then-reinsert per day. The API contract changes from a flat `{ diaSemana, horaInicio, horaFin, activo }` per day to a grouped `{ diaSemana, activo, intervalos: [{horaInicio, horaFin}] }`. The slot generation algorithm iterates each employee interval independently and validates that every slot falls within at least one open business interval.

**Tech Stack:** .NET 8 / EF Core / PostgreSQL (backend) · React 18 / TypeScript / TanStack Query (frontend)

**Spec:** `docs/superpowers/specs/2026-08-22-horarios-intervalos-design.md`

## Global Constraints

- `HoraInicio` and `HoraFin` are stored as `TimeSpan` in the DB and serialized as `"HH:mm"` strings in the API.
- DiaSemana convention: `0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado` — matches `HorarioNegocio` and `(int)DayOfWeek` in C#.
- A day with no interval rows in the DB is considered closed. Toggling a day OFF deletes all its interval rows.
- A slot is valid only when it falls entirely within **both** an employee interval AND a business interval.
- Existing appointments are never modified.
- All existing schedule data stays valid — existing single-interval rows become the first interval of each day.
- No `Activo` column on interval rows — presence of a row for a day means that interval is active.

---

### Task 1: Backend — New DTO classes

**Files:**
- Create: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Horarios/HorarioIntervaloDto.cs`
- Create: `Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Horarios/HorarioDiaDto.cs`

**Interfaces:**
- Produces: `HorarioIntervaloDto` and `HorarioDiaDto` — consumed by Tasks 3, 4, 5, 6.

- [ ] **Step 1: Create `HorarioIntervaloDto.cs`**

```csharp
namespace AppointVaAPI.Models.Dtos.Horarios
{
    public class HorarioIntervaloDto
    {
        public string HoraInicio { get; set; } = string.Empty; // "HH:mm"
        public string HoraFin    { get; set; } = string.Empty; // "HH:mm"
    }
}
```

- [ ] **Step 2: Create `HorarioDiaDto.cs`**

This DTO is used for both GET responses and PUT requests.

```csharp
namespace AppointVaAPI.Models.Dtos.Horarios
{
    public class HorarioDiaDto
    {
        public byte DiaSemana { get; set; } // 0=Dom … 6=Sáb
        public bool Activo    { get; set; }
        public List<HorarioIntervaloDto> Intervalos { get; set; } = new();
    }
}
```

- [ ] **Step 3: Build the backend to confirm no compile errors**

```
cd Back\AppointVaAPI
dotnet build AppointVaAPI
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Back/AppointVaAPI/AppointVaAPI/Models/Dtos/Horarios/
git commit -m "feat(horarios): add HorarioDiaDto and HorarioIntervaloDto for multi-interval schedule"
```

---

### Task 2: Backend — EF Core migration

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/HorarioNegocio.cs`
- Modify: `Back/AppointVaAPI/AppointVaAPI/Models/HorarioEmpleado.cs`
- Create: migration file (auto-generated)

**Interfaces:**
- Consumes: existing model files
- Produces: DB index `IX_HorariosNegocios_NegocioId_DiaSemana` and `IX_HorariosEmpleados_EmpleadoId_DiaSemana` — enables efficient per-day queries now that multiple rows per day exist.

**Note:** The `Activo` column is kept on both models for now but is no longer meaningful after Task 3/4 replace the logic. It will stay as `1` on all inserted rows and can be removed in a future cleanup. Do NOT remove it now — that would require a separate migration and breaks the existing SELECT queries until all tasks are done.

- [ ] **Step 1: Add `[Index]` attributes to `HorarioNegocio.cs`**

Add `using Microsoft.EntityFrameworkCore;` at the top and the `[Index]` attribute on the class. Replace the entire file:

```csharp
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    [Index(nameof(NegocioId), nameof(DiaSemana))]
    public class HorarioNegocio
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid NegocioId { get; set; }
        [ForeignKey("NegocioId")]
        public Negocio? Negocio { get; set; }
        [Required]
        public byte DiaSemana { get; set; } // 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
        [Required]
        public TimeSpan HoraInicio { get; set; }
        [Required]
        public TimeSpan HoraFin { get; set; }
        [Required]
        public int Activo { get; set; }
    }
}
```

- [ ] **Step 2: Add `[Index]` attribute to `HorarioEmpleado.cs`**

```csharp
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AppointVaAPI.Models
{
    [Index(nameof(EmpleadoId), nameof(DiaSemana))]
    public class HorarioEmpleado
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid EmpleadoId { get; set; }
        [ForeignKey("EmpleadoId")]
        public Empleado? Empleado { get; set; }
        [Required]
        public byte DiaSemana { get; set; }
        [Required]
        public TimeSpan HoraInicio { get; set; }
        [Required]
        public TimeSpan HoraFin { get; set; }
        [Required]
        public int Activo { get; set; }
    }
}
```

- [ ] **Step 3: Create the EF migration**

Run from the solution root `Back\AppointVaAPI`:

```
dotnet ef migrations add AddHorarioIntervalosIndex --project AppointVaAPI --startup-project AppointVaAPI
```

Expected: a new file `Migrations/YYYYMMDDHHMMSS_AddHorarioIntervalosIndex.cs` created.

- [ ] **Step 4: Verify the migration adds only indexes (no destructive changes)**

Open the generated migration file. The `Up` method must contain two `CreateIndex` calls and nothing else. It must NOT drop or alter any columns. If it does, stop and investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add Back/AppointVaAPI/AppointVaAPI/Models/HorarioNegocio.cs
git add Back/AppointVaAPI/AppointVaAPI/Models/HorarioEmpleado.cs
git add Back/AppointVaAPI/AppointVaAPI/Data/Migrations/
git commit -m "feat(horarios): add composite index on (NegocioId,DiaSemana) and (EmpleadoId,DiaSemana)"
```

---

### Task 3: Backend — Negocio horarios controller (GET + PUT)

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NegociosController.cs`

**Interfaces:**
- Consumes: `HorarioDiaDto`, `HorarioIntervaloDto` from Task 1
- Produces: `GET /api/negocios/perfil/horarios` → `List<HorarioDiaDto>` · `PUT /api/negocios/perfil/horarios` body: `List<HorarioDiaDto>` → returns `List<HorarioDiaDto>`

Add `using AppointVaAPI.Models.Dtos.Horarios;` to the top of the controller file.

- [ ] **Step 1: Replace `ObtenerHorarios` method**

Find the existing `ObtenerHorarios` method (around line 297) and replace it entirely:

```csharp
// GET api/negocios/perfil/horarios
[HttpGet("perfil/horarios")]
[Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
public async Task<IActionResult> ObtenerHorarios()
{
    if (_contexto.NegocioId is null) return Unauthorized();

    var filas = await _db.HorariosNegocios
        .Where(h => h.NegocioId == _contexto.NegocioId.Value)
        .OrderBy(h => h.DiaSemana).ThenBy(h => h.HoraInicio)
        .ToListAsync();

    var resultado = Enumerable.Range(0, 7).Select(dia =>
    {
        var intervalos = filas.Where(h => h.DiaSemana == dia).ToList();
        return new HorarioDiaDto
        {
            DiaSemana = (byte)dia,
            Activo    = intervalos.Any(),
            Intervalos = intervalos.Select(h => new HorarioIntervaloDto
            {
                HoraInicio = h.HoraInicio.ToString(@"hh\:mm"),
                HoraFin    = h.HoraFin.ToString(@"hh\:mm")
            }).ToList()
        };
    });

    return Ok(resultado);
}
```

- [ ] **Step 2: Replace `ActualizarHorarios` method**

Find the existing `ActualizarHorarios` method (around line 328) and replace it entirely:

```csharp
// PUT api/negocios/perfil/horarios
[HttpPut("perfil/horarios")]
[Authorize(Roles = Roles.Propietario)]
public async Task<IActionResult> ActualizarHorarios([FromBody] List<HorarioDiaDto> dias)
{
    if (_contexto.NegocioId is null) return Unauthorized();

    // Validate
    foreach (var dia in dias.Where(d => d.Activo))
    {
        if (!dia.Intervalos.Any())
            return BadRequest(new { mensaje = $"El día {dia.DiaSemana} debe tener al menos un intervalo activo." });

        foreach (var iv in dia.Intervalos)
        {
            if (!TimeSpan.TryParse(iv.HoraInicio, out var ini) ||
                !TimeSpan.TryParse(iv.HoraFin,    out var fin))
                return BadRequest(new { mensaje = "Formato de hora inválido." });
            if (fin <= ini)
                return BadRequest(new { mensaje = "La hora de fin debe ser posterior a la de inicio." });
        }

        // Check overlap between intervals of the same day
        var sorted = dia.Intervalos
            .OrderBy(i => TimeSpan.Parse(i.HoraInicio))
            .ToList();
        for (int k = 0; k < sorted.Count - 1; k++)
        {
            if (TimeSpan.Parse(sorted[k].HoraFin) > TimeSpan.Parse(sorted[k + 1].HoraInicio))
                return BadRequest(new { mensaje = $"Los intervalos del día {dia.DiaSemana} se solapan." });
        }
    }

    // Full replace per day: delete existing rows for each day in the payload
    var diasEnviados = dias.Select(d => (byte)d.DiaSemana).Distinct().ToList();
    var existentes = await _db.HorariosNegocios
        .Where(h => h.NegocioId == _contexto.NegocioId.Value && diasEnviados.Contains(h.DiaSemana))
        .ToListAsync();
    _db.HorariosNegocios.RemoveRange(existentes);

    // Insert new intervals for active days (sorted by start time)
    foreach (var dia in dias.Where(d => d.Activo))
    {
        var sorted = dia.Intervalos
            .OrderBy(i => TimeSpan.Parse(i.HoraInicio))
            .ToList();
        foreach (var iv in sorted)
        {
            _db.HorariosNegocios.Add(new HorarioNegocio
            {
                Id        = Guid.NewGuid(),
                NegocioId = _contexto.NegocioId.Value,
                DiaSemana = dia.DiaSemana,
                HoraInicio = TimeSpan.Parse(iv.HoraInicio),
                HoraFin    = TimeSpan.Parse(iv.HoraFin),
                Activo     = 1
            });
        }
    }

    await _db.SaveChangesAsync();
    return await ObtenerHorarios();
}
```

- [ ] **Step 3: Build**

```
dotnet build AppointVaAPI
```

Expected: 0 errors. (Warnings about `ActualizarHorarioNegocioDto` being unused are expected if nothing else uses it — leave the class in place.)

- [ ] **Step 4: Smoke test with curl (backend must be running)**

```bash
# GET — should return 7 day objects each with an "intervalos" array
curl -s -H "Authorization: Bearer <token>" http://localhost:5048/api/negocios/perfil/horarios | python -m json.tool

# PUT — send two intervals for Monday, close Tuesday
curl -s -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  http://localhost:5048/api/negocios/perfil/horarios \
  -d '[{"diaSemana":1,"activo":true,"intervalos":[{"horaInicio":"08:00","horaFin":"12:00"},{"horaInicio":"13:00","horaFin":"19:00"}]},{"diaSemana":2,"activo":false,"intervalos":[]}]'
```

Expected: PUT returns the updated horarios object; Monday shows two intervalos, Tuesday shows `activo: false, intervalos: []`.

- [ ] **Step 5: Commit**

```bash
git add Back/AppointVaAPI/AppointVaAPI/Controllers/V1/NegociosController.cs
git commit -m "feat(horarios): rewrite negocio GET+PUT /horarios to support multiple intervals per day"
```

---

### Task 4: Backend — Empleado horarios controller (GET + PUT)

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Controllers/V1/EmpleadosController.cs`

**Interfaces:**
- Consumes: `HorarioDiaDto`, `HorarioIntervaloDto` from Task 1
- Produces: `GET /api/empleados/{id}/horario` → `List<HorarioDiaDto>` · `PUT /api/empleados/{id}/horario` body: `List<HorarioDiaDto>` → `{ mensaje: "Horario actualizado correctamente" }`

Add `using AppointVaAPI.Models.Dtos.Horarios;` to the top of the controller file.

The empleado controller currently uses a repository method `_repo.ObtenerHorariosAsync` and `_repo.ActualizarHorariosAsync`. These work at the HorarioEmpleado entity level. The PUT will be rewritten to use `_db` directly (same pattern as Task 3) to avoid modifying the repo interface. Verify that `_db` (the DbContext) is injected in `EmpleadosController` — if not, add it via constructor injection.

- [ ] **Step 1: Verify `_db` is available in `EmpleadosController`**

Open `EmpleadosController.cs` and check the constructor. If `ApplicationDbContext _db` is already injected, skip this step. If not, add it:

```csharp
private readonly ApplicationDbContext _db;

public EmpleadosController(
    IEmpleadoRepository repo,
    ApplicationDbContext db,    // add this
    IContextoUsuario contexto,
    /* other deps */)
{
    _repo = repo;
    _db = db;                   // add this
    _contexto = contexto;
}
```

- [ ] **Step 2: Replace `ObtenerHorario` method**

Find the existing `ObtenerHorario(Guid id)` method (around line 147) and replace it:

```csharp
// GET api/empleados/{id}/horario
[HttpGet("{id:guid}/horario")]
[Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado},{Roles.SuperAdmin}")]
public async Task<IActionResult> ObtenerHorario(Guid id)
{
    if (_contexto.NegocioId is null) return Unauthorized();

    var filas = await _db.HorariosEmpleados
        .Where(h => h.EmpleadoId == id)
        .OrderBy(h => h.DiaSemana).ThenBy(h => h.HoraInicio)
        .ToListAsync();

    var resultado = Enumerable.Range(0, 7).Select(dia =>
    {
        var intervalos = filas.Where(h => h.DiaSemana == dia).ToList();
        return new HorarioDiaDto
        {
            DiaSemana  = (byte)dia,
            Activo     = intervalos.Any(),
            Intervalos = intervalos.Select(h => new HorarioIntervaloDto
            {
                HoraInicio = h.HoraInicio.ToString(@"hh\:mm"),
                HoraFin    = h.HoraFin.ToString(@"hh\:mm")
            }).ToList()
        };
    });

    return Ok(resultado);
}
```

- [ ] **Step 3: Replace `ActualizarHorario` method**

Find the existing `ActualizarHorario(Guid id, ...)` method (around line 168) and replace it:

```csharp
// PUT api/empleados/{id}/horario
[HttpPut("{id:guid}/horario")]
[Authorize(Roles = $"{Roles.Propietario},{Roles.SuperAdmin}")]
public async Task<IActionResult> ActualizarHorario(Guid id, [FromBody] List<HorarioDiaDto> dias)
{
    if (_contexto.NegocioId is null) return Unauthorized();

    var empleado = await _repo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
    if (empleado is null) return NotFound(new { mensaje = "Empleado no encontrado" });

    // Validate
    foreach (var dia in dias.Where(d => d.Activo))
    {
        if (!dia.Intervalos.Any())
            return BadRequest(new { mensaje = $"El día {dia.DiaSemana} debe tener al menos un intervalo activo." });

        foreach (var iv in dia.Intervalos)
        {
            if (!TimeSpan.TryParse(iv.HoraInicio, out var ini) ||
                !TimeSpan.TryParse(iv.HoraFin,    out var fin))
                return BadRequest(new { mensaje = "Formato de hora inválido." });
            if (fin <= ini)
                return BadRequest(new { mensaje = "La hora de fin debe ser posterior a la de inicio." });
        }

        var sorted = dia.Intervalos.OrderBy(i => TimeSpan.Parse(i.HoraInicio)).ToList();
        for (int k = 0; k < sorted.Count - 1; k++)
        {
            if (TimeSpan.Parse(sorted[k].HoraFin) > TimeSpan.Parse(sorted[k + 1].HoraInicio))
                return BadRequest(new { mensaje = $"Los intervalos del día {dia.DiaSemana} se solapan." });
        }
    }

    // Full replace per day
    var diasEnviados = dias.Select(d => (byte)d.DiaSemana).Distinct().ToList();
    var existentes = await _db.HorariosEmpleados
        .Where(h => h.EmpleadoId == id && diasEnviados.Contains(h.DiaSemana))
        .ToListAsync();
    _db.HorariosEmpleados.RemoveRange(existentes);

    foreach (var dia in dias.Where(d => d.Activo))
    {
        var sorted = dia.Intervalos.OrderBy(i => TimeSpan.Parse(i.HoraInicio)).ToList();
        foreach (var iv in sorted)
        {
            _db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id         = Guid.NewGuid(),
                EmpleadoId = id,
                DiaSemana  = dia.DiaSemana,
                HoraInicio = TimeSpan.Parse(iv.HoraInicio),
                HoraFin    = TimeSpan.Parse(iv.HoraFin),
                Activo     = 1
            });
        }
    }

    await _db.SaveChangesAsync();
    return Ok(new { mensaje = "Horario actualizado correctamente" });
}
```

- [ ] **Step 4: Build**

```
dotnet build AppointVaAPI
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add Back/AppointVaAPI/AppointVaAPI/Controllers/V1/EmpleadosController.cs
git commit -m "feat(horarios): rewrite empleado GET+PUT /horario to support multiple intervals per day"
```

---

### Task 5: Backend — DisponibilidadService multi-interval slot generation

**Files:**
- Modify: `Back/AppointVaAPI/AppointVaAPI/Services/DisponibilidadService.cs`

**Interfaces:**
- Consumes: `HorariosEmpleados` and `HorariosNegocios` DbSets — now queried as multiple rows per day
- Produces: same `List<SlotDisponibleDto>` output — no change to callers

This task modifies **both** slot loops inside the service. Read the existing method carefully before editing — the variable names and data structures around the loops must be preserved.

**Key invariants to maintain:**
- The day-of-week value used to query `HorariosEmpleados` comes from the existing `diaSemana` local variable already computed in the method.
- For `HorariosNegocios`, use `(byte)(int)fechaDt.DayOfWeek` which gives `0=Sunday … 6=Saturday` — this matches the business schedule convention.
- All existing overlap checks (citas with buffer, bloqueos) are unchanged.
- The `DistinctBy(s => s.Inicio).OrderBy(s => s.Inicio)` at the end of the all-employees path is unchanged.

- [ ] **Step 1: Update the all-employees path (first slot loop)**

Find the block that loads horarios and loops per employee. It currently does:

```csharp
var horarios = await _db.HorariosEmpleados
    .Where(h => empleadoIds.Contains(h.EmpleadoId) && h.DiaSemana == diaSemana && h.Activo == 1)
    .ToListAsync();

foreach (var emp in empleadosActivos)
{
    var horario = horarios.FirstOrDefault(h => h.EmpleadoId == emp.Id);
    if (horario is null) continue;

    var citasEmp    = citasDelDia.Where(c => c.EmpleadoId == emp.Id).ToList();
    var bloqueosEmp = bloqueosDelDia.Where(b => b.EmpleadoId == emp.Id).ToList();

    var slotInicio  = fechaDt.Add(horario.HoraInicio);
    var horarioFin  = fechaDt.Add(horario.HoraFin);

    while (slotInicio + duracion <= horarioFin)
    {
        var slotFin      = slotInicio + duracion;
        var solapaCita   = citasEmp.Any(c => c.InicioEn < slotFin && c.FinEn.Add(buffer) > slotInicio);
        var solapaBloqueo = bloqueosEmp.Any(b => b.InicioEn < slotFin && b.FinEn > slotInicio);

        if (!solapaCita && !solapaBloqueo && ZonaHorariaHelper.ToDateTimeOffset(slotInicio, tz) > ahoraUtc)
        {
            todos.Add(new SlotDisponibleDto { ... });
        }
        slotInicio = slotInicio.Add(duracion);
    }
}
```

Replace it with:

```csharp
// Load all employee intervals for this day (multiple per employee allowed)
var horariosEmpleados = await _db.HorariosEmpleados
    .Where(h => empleadoIds.Contains(h.EmpleadoId) && h.DiaSemana == diaSemana && h.Activo == 1)
    .OrderBy(h => h.HoraInicio)
    .ToListAsync();

// Load business intervals for this day (0=Sunday … 6=Saturday)
var diaSemanaFecha = (byte)(int)fechaDt.DayOfWeek;
var intervalosNegocio = await _db.HorariosNegocios
    .Where(h => h.NegocioId == negocioId && h.DiaSemana == diaSemanaFecha && h.Activo == 1)
    .OrderBy(h => h.HoraInicio)
    .ToListAsync();

// If the business has no open intervals today, no slots are possible
if (!intervalosNegocio.Any()) return todos;

foreach (var emp in empleadosActivos)
{
    var intervalosEmp = horariosEmpleados.Where(h => h.EmpleadoId == emp.Id).ToList();
    if (!intervalosEmp.Any()) continue;

    var citasEmp     = citasDelDia.Where(c => c.EmpleadoId == emp.Id).ToList();
    var bloqueosEmp  = bloqueosDelDia.Where(b => b.EmpleadoId == emp.Id).ToList();

    foreach (var intervalo in intervalosEmp)
    {
        var slotInicio = fechaDt.Add(intervalo.HoraInicio);
        var slotMax    = fechaDt.Add(intervalo.HoraFin);

        while (slotInicio + duracion <= slotMax)
        {
            var slotFin = slotInicio + duracion;

            // Slot must fall entirely within at least one business interval
            var dentroNegocio = intervalosNegocio.Any(n =>
                slotInicio >= fechaDt.Add(n.HoraInicio) &&
                slotFin    <= fechaDt.Add(n.HoraFin));

            if (dentroNegocio)
            {
                var solapaCita    = citasEmp.Any(c => c.InicioEn < slotFin && c.FinEn.Add(buffer) > slotInicio);
                var solapaBloqueo = bloqueosEmp.Any(b => b.InicioEn < slotFin && b.FinEn > slotInicio);

                if (!solapaCita && !solapaBloqueo && ZonaHorariaHelper.ToDateTimeOffset(slotInicio, tz) > ahoraUtc)
                {
                    todos.Add(new SlotDisponibleDto
                    {
                        Inicio        = slotInicio,
                        Fin           = slotFin,
                        HoraTexto     = Hora12(slotInicio),
                        EmpleadoId    = emp.Id,
                        EmpleadoNombre = emp.Nombre
                    });
                }
            }

            slotInicio = slotInicio.Add(duracion);
        }
    }
}
```

**Important:** `return todos;` here replaces the early exit. The call to `todos.OrderBy(...).DistinctBy(...).ToList()` at the bottom of the method is unchanged — leave it in place.

- [ ] **Step 2: Update the single-employee path (second slot loop)**

Find `ObtenerSlotsEmpleadoAsync` (or the equivalent single-employee method). It currently loads one `horario` and runs one loop. Replace the load + loop section:

Current code pattern:
```csharp
// loads horario for one employee
var slotInicio = fechaDt.Add(horario.HoraInicio);
var horarioFin = fechaDt.Add(horario.HoraFin);

while (slotInicio + duracion <= horarioFin) { ... }
```

Replace with:
```csharp
// Load all intervals for this employee on this day
var intervalosEmp = await _db.HorariosEmpleados
    .Where(h => h.EmpleadoId == empleadoId && h.DiaSemana == diaSemana && h.Activo == 1)
    .OrderBy(h => h.HoraInicio)
    .ToListAsync();

if (!intervalosEmp.Any()) return slots;

// Load business intervals for this day
var diaSemanaFecha = (byte)(int)fechaDt.DayOfWeek;
var intervalosNegocio = await _db.HorariosNegocios
    .Where(h => h.NegocioId == negocioId && h.DiaSemana == diaSemanaFecha && h.Activo == 1)
    .OrderBy(h => h.HoraInicio)
    .ToListAsync();

if (!intervalosNegocio.Any()) return slots;

foreach (var intervalo in intervalosEmp)
{
    var slotInicio = fechaDt.Add(intervalo.HoraInicio);
    var slotMax    = fechaDt.Add(intervalo.HoraFin);

    while (slotInicio + duracion <= slotMax)
    {
        var slotFin = slotInicio + duracion;

        var dentroNegocio = intervalosNegocio.Any(n =>
            slotInicio >= fechaDt.Add(n.HoraInicio) &&
            slotFin    <= fechaDt.Add(n.HoraFin));

        if (dentroNegocio)
        {
            var solapaCita    = citasExistentes.Any(c => c.InicioEn < slotFin && c.FinEn.Add(buffer) > slotInicio);
            var solapaBloqueo = bloqueosExistentes.Any(b => b.InicioEn < slotFin && b.FinEn > slotInicio);

            if (!solapaCita && !solapaBloqueo && ZonaHorariaHelper.ToDateTimeOffset(slotInicio, tz) > ahoraUtc)
            {
                slots.Add(new SlotDisponibleDto
                {
                    Inicio    = slotInicio,
                    Fin       = slotFin,
                    HoraTexto = Hora12(slotInicio)
                });
            }
        }

        slotInicio = slotInicio.Add(duracion);
    }
}
```

**Note:** `negocioId` must be available in this method's scope. If it is not a parameter, find where the business context is loaded earlier in the method and extract `negocioId` from there.

- [ ] **Step 3: Build**

```
dotnet build AppointVaAPI
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Back/AppointVaAPI/AppointVaAPI/Services/DisponibilidadService.cs
git commit -m "feat(horarios): update slot generation to iterate multiple intervals and enforce business windows"
```

---

### Task 6: Frontend — Types and API functions

**Files:**
- Modify: `Front/src/types/index.ts`
- Modify: `Front/src/api/negocios.ts`
- Modify: `Front/src/api/empleados.ts`

**Interfaces:**
- Produces: `IntervaloDto`, `HorarioDiaDto` types and updated API functions — consumed by Tasks 7 and 8.

- [ ] **Step 1: Update `src/types/index.ts`**

Find the existing `HorarioDto` interface:
```ts
export interface HorarioDto {
  id?: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}
```

Replace it with:
```ts
export interface IntervaloDto {
  horaInicio: string; // "HH:mm"
  horaFin: string;    // "HH:mm"
}

export interface HorarioDiaDto {
  diaSemana: number; // 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
  activo: boolean;
  intervalos: IntervaloDto[];
}
```

Keep `HorarioDto` as a deprecated alias for now only if any other file still imports it — check with a project-wide search for `HorarioDto` in `.ts` and `.tsx` files. If only `negocios.ts` and `empleados.ts` reference it, remove the old definition entirely. If other files reference it, add a type alias `export type HorarioDto = HorarioDiaDto;` temporarily.

- [ ] **Step 2: Update `src/api/negocios.ts`**

Find `obtenerHorarios` and `actualizarHorarios`:
```ts
obtenerHorarios: async (): Promise<HorarioDto[]> => {
  const { data } = await api.get("/negocios/perfil/horarios");
  return data;
},
actualizarHorarios: async (horarios: HorarioDto[]): Promise<HorarioDto[]> => {
  const { data } = await api.put("/negocios/perfil/horarios", horarios);
  return data;
},
```

Replace with (update import of `HorarioDto` → `HorarioDiaDto`):
```ts
obtenerHorarios: async (): Promise<HorarioDiaDto[]> => {
  const { data } = await api.get("/negocios/perfil/horarios");
  return data;
},
actualizarHorarios: async (horarios: HorarioDiaDto[]): Promise<HorarioDiaDto[]> => {
  const { data } = await api.put("/negocios/perfil/horarios", horarios);
  return data;
},
```

Update the import line at the top of the file: `import type { ..., HorarioDiaDto } from "../types";` (remove `HorarioDto`, add `HorarioDiaDto`).

- [ ] **Step 3: Update `src/api/empleados.ts`**

Find `obtenerHorario` and `actualizarHorario`:
```ts
obtenerHorario: async (id: string): Promise<HorarioDto[]> => {
  const { data } = await api.get(`/empleados/${id}/horario`);
  return data;
},
actualizarHorario: async (id: string, horarios: HorarioDto[]): Promise<void> => {
  await api.put(`/empleados/${id}/horario`, horarios);
},
```

Replace with:
```ts
obtenerHorario: async (id: string): Promise<HorarioDiaDto[]> => {
  const { data } = await api.get(`/empleados/${id}/horario`);
  return data;
},
actualizarHorario: async (id: string, horarios: HorarioDiaDto[]): Promise<void> => {
  await api.put(`/empleados/${id}/horario`, horarios);
},
```

Update the import line similarly.

- [ ] **Step 4: Check for TypeScript compile errors**

```bash
cd Front
npx tsc --noEmit
```

Fix any type errors that appear before continuing. Common sources: any file that still uses `HorarioDto` with the old shape (`.horaInicio` directly on the day object instead of `.intervalos[0].horaInicio`).

- [ ] **Step 5: Commit**

```bash
git add Front/src/types/index.ts Front/src/api/negocios.ts Front/src/api/empleados.ts
git commit -m "feat(horarios): update frontend types and API to multi-interval HorarioDiaDto shape"
```

---

### Task 7: Frontend — PerfilPage business schedule UI

**Files:**
- Modify: `Front/src/pages/dashboard/PerfilPage.tsx`

**Interfaces:**
- Consumes: `HorarioDiaDto`, `IntervaloDto` from Task 6
- Produces: updated horarios tab UI — a list of intervals per day with +/✕ controls

The existing state is `useState<HorarioDto[]>`. It must become `useState<HorarioDiaDto[]>`. The helper `actualizarHorario(dia, campo, valor)` is replaced by three focused helpers.

- [ ] **Step 1: Update `horarios` state initialization and useEffect**

Find the state declaration (around line 193):
```tsx
const [horarios, setHorarios] = useState<HorarioDto[]>([]);
```
Change to:
```tsx
const [horarios, setHorarios] = useState<HorarioDiaDto[]>([]);
```

The `useEffect` that sets horarios from `horariosData` stays exactly the same — it already does `setHorarios(horariosData)`. No change needed there.

Remove the `actualizarHorario` function entirely. Add these three helpers in its place:

```tsx
const toggleDia = (diaSemana: number) => {
  setHorarios(prev => prev.map(h =>
    h.diaSemana === diaSemana
      ? {
          ...h,
          activo: !h.activo,
          intervalos: !h.activo && h.intervalos.length === 0
            ? [{ horaInicio: "09:00", horaFin: "18:00" }]
            : h.intervalos
        }
      : h
  ));
  setHorariosDirty(true);
};

const actualizarIntervalo = (
  diaSemana: number,
  idx: number,
  campo: "horaInicio" | "horaFin",
  valor: string
) => {
  setHorarios(prev => prev.map(h =>
    h.diaSemana === diaSemana
      ? {
          ...h,
          intervalos: h.intervalos.map((iv, i) =>
            i === idx ? { ...iv, [campo]: valor } : iv
          )
        }
      : h
  ));
  setHorariosDirty(true);
};

const agregarIntervalo = (diaSemana: number) => {
  setHorarios(prev => prev.map(h => {
    if (h.diaSemana !== diaSemana) return h;
    const ultimo = h.intervalos[h.intervalos.length - 1];
    const nuevaHora = ultimo?.horaFin ?? "09:00";
    return {
      ...h,
      intervalos: [...h.intervalos, { horaInicio: nuevaHora, horaFin: nuevaHora }]
    };
  }));
  setHorariosDirty(true);
};

const eliminarIntervalo = (diaSemana: number, idx: number) => {
  setHorarios(prev => prev.map(h =>
    h.diaSemana === diaSemana
      ? { ...h, intervalos: h.intervalos.filter((_, i) => i !== idx) }
      : h
  ));
  setHorariosDirty(true);
};

const intervaloInvalido = (h: HorarioDiaDto): boolean => {
  if (!h.activo) return false;
  for (const iv of h.intervalos) {
    if (!iv.horaInicio || !iv.horaFin || iv.horaInicio >= iv.horaFin) return true;
  }
  for (let i = 0; i < h.intervalos.length - 1; i++) {
    if (h.intervalos[i].horaFin > h.intervalos[i + 1].horaInicio) return true;
  }
  return false;
};
```

- [ ] **Step 2: Update the mutation to remove the argument type reference**

Find:
```tsx
mutationFn: () => negociosApi.actualizarHorarios(horarios),
```
This line stays the same — `horarios` is now `HorarioDiaDto[]` which matches the updated API function. No change needed.

- [ ] **Step 3: Replace the horarios tab render**

Find the horarios day list render (around line 807). Replace the entire `horarios.map(...)` block with:

```tsx
{horarios.map((h) => (
  <div key={h.diaSemana} className="py-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
    {/* Day toggle + name */}
    <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
      <div
        onClick={() => toggleDia(h.diaSemana)}
        className={`w-9 h-5 rounded-full transition relative cursor-pointer shrink-0 ${
          h.activo ? "bg-slate-700" : "bg-gray-300"
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
          h.activo ? "left-4" : "left-0.5"
        }`} />
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">{DIAS[h.diaSemana]}</span>
    </label>

    {h.activo ? (
      <div className="pl-11 space-y-1.5">
        {h.intervalos.map((iv, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-28">
              <TimePicker
                value={iv.horaInicio}
                onChange={(v) => actualizarIntervalo(h.diaSemana, idx, "horaInicio", v)}
              />
            </div>
            <span className="text-gray-400 dark:text-gray-500 text-sm shrink-0">—</span>
            <div className="w-28">
              <TimePicker
                value={iv.horaFin}
                onChange={(v) => actualizarIntervalo(h.diaSemana, idx, "horaFin", v)}
              />
            </div>
            {h.intervalos.length > 1 && (
              <button
                type="button"
                onClick={() => eliminarIntervalo(h.diaSemana, idx)}
                className="text-gray-400 hover:text-red-500 transition text-sm px-1"
                aria-label="Eliminar intervalo"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {intervaloInvalido(h) && (
          <p className="text-xs text-red-500">Verifica que los horarios no se solapan y que la hora de fin sea posterior a la de inicio.</p>
        )}
        <button
          type="button"
          onClick={() => agregarIntervalo(h.diaSemana)}
          className="text-xs text-slate-600 dark:text-slate-400 hover:underline mt-0.5"
        >
          + Agregar intervalo
        </button>
      </div>
    ) : (
      <span className="text-sm text-gray-400 dark:text-gray-500 pl-11">Cerrado</span>
    )}
  </div>
))}
```

- [ ] **Step 4: Disable save button when any day has an invalid interval**

Find the "Guardar horarios" button and update the `disabled` prop:

```tsx
disabled={guardandoHorarios || !horariosDirty || horarios.some(intervaloInvalido)}
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd Front && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Start the dev server and verify manually**

```bash
cd Front && npm run dev
```

Navigate to the dashboard → Horarios tab. Verify:
- Each day shows its intervals (existing days show one interval each)
- Toggle ON a closed day → appears with a default 09:00–18:00 interval
- Toggle OFF an active day → shows "Cerrado"
- "Agregar intervalo" adds a second row
- ✕ button removes an interval (disabled when only one remains)
- Saving with overlapping times is blocked (button disabled + red error text)
- Saving with valid two intervals persists and reloads correctly

- [ ] **Step 7: Commit**

```bash
git add Front/src/pages/dashboard/PerfilPage.tsx
git commit -m "feat(horarios): replace single time-picker with multi-interval list in negocio schedule UI"
```

---

### Task 8: Frontend — EmpleadosPage employee schedule modal UI

**Files:**
- Modify: `Front/src/pages/dashboard/EmpleadosPage.tsx`

**Interfaces:**
- Consumes: `HorarioDiaDto`, `IntervaloDto` from Task 6; `negociosApi.obtenerHorarios` returns `HorarioDiaDto[]` (already updated in Task 6)

- [ ] **Step 1: Update `HORARIO_BASE` constant**

Find:
```tsx
const HORARIO_BASE: HorarioDto[] = Array.from({ length: 7 }, (_, i) => ({
  diaSemana: i,
  horaInicio: "09:00",
  horaFin: "19:00",
  activo: i >= 1 && i <= 6,
}));
```

Replace with:
```tsx
const HORARIO_BASE: HorarioDiaDto[] = Array.from({ length: 7 }, (_, i) => ({
  diaSemana: i,
  activo: i >= 1 && i <= 6,
  intervalos: i >= 1 && i <= 6 ? [{ horaInicio: "09:00", horaFin: "19:00" }] : [],
}));
```

- [ ] **Step 2: Update `horarioLocal` state type**

Find:
```tsx
const [horarioLocal, setHorarioLocal] = useState<HorarioDto[]>([]);
```
Change to:
```tsx
const [horarioLocal, setHorarioLocal] = useState<HorarioDiaDto[]>([]);
```

- [ ] **Step 3: Update `abrirHorario` handler**

The existing handler merges the API response with `HORARIO_BASE`. The new API response is already `HorarioDiaDto[]` grouped by day. Update:

```tsx
const abrirHorario = async (emp: EmpleadoDto) => {
  setEmpleadoHorario(emp);
  try {
    const h = await empleadosApi.obtenerHorario(emp.id);
    // h is already HorarioDiaDto[] — merge with base for any missing days
    const merged = HORARIO_BASE.map((base) => {
      const existente = h.find((x) => x.diaSemana === base.diaSemana);
      return existente ?? base;
    });
    setHorarioLocal(merged);
  } catch {
    setHorarioLocal(HORARIO_BASE.map((h) => ({ ...h })));
  }
  setModalHorario(true);
};
```

- [ ] **Step 4: Add local interval helpers**

Add these helpers near the top of the component (after the state declarations):

```tsx
const toggleDiaEmpleado = (idx: number) => {
  setHorarioLocal(prev => prev.map((h, i) =>
    i !== idx ? h : {
      ...h,
      activo: !h.activo,
      intervalos: !h.activo && h.intervalos.length === 0
        ? [{ horaInicio: "09:00", horaFin: "19:00" }]
        : h.intervalos
    }
  ));
};

const actualizarIntervaloEmpleado = (
  dayIdx: number,
  ivIdx: number,
  campo: "horaInicio" | "horaFin",
  valor: string
) => {
  setHorarioLocal(prev => prev.map((h, i) =>
    i !== dayIdx ? h : {
      ...h,
      intervalos: h.intervalos.map((iv, j) =>
        j === ivIdx ? { ...iv, [campo]: valor } : iv
      )
    }
  ));
};

const agregarIntervaloEmpleado = (dayIdx: number) => {
  setHorarioLocal(prev => prev.map((h, i) => {
    if (i !== dayIdx) return h;
    const ultimo = h.intervalos[h.intervalos.length - 1];
    const nuevaHora = ultimo?.horaFin ?? "09:00";
    return { ...h, intervalos: [...h.intervalos, { horaInicio: nuevaHora, horaFin: nuevaHora }] };
  }));
};

const eliminarIntervaloEmpleado = (dayIdx: number, ivIdx: number) => {
  setHorarioLocal(prev => prev.map((h, i) =>
    i !== dayIdx ? h : { ...h, intervalos: h.intervalos.filter((_, j) => j !== ivIdx) }
  ));
};
```

- [ ] **Step 5: Update `rangoHorario` helper**

The `rangoHorario` function currently reads `h.horaInicio` and `h.horaFin` from `horariosNegocio`. Since `horariosNegocio` is now `HorarioDiaDto[]`, the constraint should cover the union of all business intervals for the day. Simplify to use the first and last interval:

```tsx
const rangoHorario = (fecha: string): { min: string; max: string } | null => {
  if (!fecha) return null;
  const dia = new Date(fecha + "T12:00").getDay();
  const h = horariosNegocio.find((x) => x.diaSemana === dia);
  const hoy = new Date().toISOString().slice(0, 10);

  const activeIntervals = h?.activo ? h.intervalos : [];
  const minNegocio = activeIntervals[0]?.horaInicio ?? "00:00";
  const maxNegocio = activeIntervals[activeIntervals.length - 1]?.horaFin ?? "23:30";

  const minEfectivo = fecha === hoy
    ? (ahoraMin() > minNegocio ? ahoraMin() : minNegocio)
    : minNegocio;

  return { min: minEfectivo, max: maxNegocio };
};
```

- [ ] **Step 6: Replace the horarios modal render**

Find the modal body that renders `horarioLocal.map((h, i) => ...)` and replace it:

```tsx
<div className="space-y-3">
  {horarioLocal.map((h, i) => (
    <div
      key={h.diaSemana}
      className={`rounded-lg border p-3 transition ${
        h.activo
          ? "bg-white border-gray-200 dark:bg-slate-800 dark:border-slate-600"
          : "bg-gray-50 border-gray-100 dark:bg-slate-700 dark:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => toggleDiaEmpleado(i)}
            className={`w-9 h-5 rounded-full transition relative cursor-pointer shrink-0 ${
              h.activo ? "bg-slate-700" : "bg-gray-300"
            }`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
              h.activo ? "left-4" : "left-0.5"
            }`} />
          </div>
          <span className={`text-sm font-medium ${
            h.activo ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"
          }`}>
            {DIAS[h.diaSemana]}
          </span>
        </label>
        {!h.activo && (
          <span className="text-xs text-gray-400 dark:text-gray-500">Descanso</span>
        )}
      </div>

      {h.activo && (
        <div className="ml-6 space-y-1.5">
          {h.intervalos.map((iv, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">De</span>
                <input
                  type="time"
                  value={iv.horaInicio}
                  onChange={(e) => actualizarIntervaloEmpleado(i, idx, "horaInicio", e.target.value)}
                  className="px-2 py-1 rounded border border-gray-200 text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">a</span>
                <input
                  type="time"
                  value={iv.horaFin}
                  onChange={(e) => actualizarIntervaloEmpleado(i, idx, "horaFin", e.target.value)}
                  className="px-2 py-1 rounded border border-gray-200 text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
                />
              </div>
              {h.intervalos.length > 1 && (
                <button
                  type="button"
                  onClick={() => eliminarIntervaloEmpleado(i, idx)}
                  className="text-gray-400 hover:text-red-500 transition text-sm px-1"
                  aria-label="Eliminar intervalo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => agregarIntervaloEmpleado(i)}
            className="text-xs text-slate-600 dark:text-slate-400 hover:underline mt-0.5"
          >
            + Agregar intervalo
          </button>
        </div>
      )}
    </div>
  ))}

  <button
    onClick={() => guardarHorario()}
    disabled={guardandoHorario}
    className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition mt-2"
  >
    {guardandoHorario ? "Guardando..." : "Guardar horario"}
  </button>
</div>
```

- [ ] **Step 7: Run TypeScript check**

```bash
cd Front && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Start dev server and verify the employee modal manually**

```bash
cd Front && npm run dev
```

Navigate to Empleados → click "Horarios" on an employee. Verify:
- Days show their existing intervals
- Toggle, add, remove intervals work the same as the business schedule
- "Guardar horario" persists the data and the modal re-opens with the saved intervals

- [ ] **Step 9: Commit**

```bash
git add Front/src/pages/dashboard/EmpleadosPage.tsx
git commit -m "feat(horarios): replace single time-picker with multi-interval list in employee schedule modal"
```

---

### Self-Review Checklist

- [x] **Spec coverage — Data model**: Tasks 1+2 handle new DTOs and the non-unique index. ✓
- [x] **Spec coverage — API**: Tasks 3+4 implement the grouped GET/PUT with full-replace-per-day and validations (no overlap, inicio < fin, active day needs ≥1 interval). ✓
- [x] **Spec coverage — Slot algorithm**: Task 5 implements multi-interval iteration for both employee paths and adds the business interval check. ✓
- [x] **Spec coverage — Dashboard UI**: Tasks 7+8 implement the toggle + interval list with +/✕ controls and inline validation. ✓
- [x] **Spec coverage — Existing data unaffected**: The migration adds only an index; existing single-interval rows are valid as the first interval of each day. ✓
- [x] **Type consistency**: `HorarioDiaDto` is defined in Task 6 and used by Tasks 7 and 8. `IntervaloDto` is used in Tasks 7 and 8 without renaming. ✓
- [x] **No placeholders**: All code blocks are complete and reference only types/methods defined in this plan. ✓
