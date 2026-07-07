using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Models.Dtos.Clientes;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services.IServices;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Data;
using System.Security.Cryptography;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/citas")]
    [Authorize(Roles = $"{Roles.Propietario},{Roles.Empleado}")]
    public class CitasController : ControllerBase
    {
        private readonly ICitaRepository _citaRepo;
        private readonly IClienteRepository _clienteRepo;
        private readonly IServicioRepository _servicioRepo;
        private readonly IContextoNegocio _contexto;
        private readonly ApplicationDbContext _db;
        private readonly INotificacionService _notificacion;
        private readonly IBackgroundJobClient _jobClient;
        private readonly IConfiguration _config;

        public CitasController(
            ICitaRepository citaRepo,
            IClienteRepository clienteRepo,
            IServicioRepository servicioRepo,
            IContextoNegocio contexto,
            ApplicationDbContext db,
            INotificacionService notificacion,
            IBackgroundJobClient jobClient,
            IConfiguration config)
        {
            _citaRepo = citaRepo;
            _clienteRepo = clienteRepo;
            _servicioRepo = servicioRepo;
            _contexto = contexto;
            _db = db;
            _notificacion = notificacion;
            _jobClient = jobClient;
            _config = config;
        }

        // GET api/citas?desde=...&hasta=...&empleadoId=...&pagina=1&tamano=100
        [HttpGet]
        public async Task<IActionResult> ObtenerTodas(
            [FromQuery] DateTime? desde,
            [FromQuery] DateTime? hasta,
            [FromQuery] Guid? empleadoId,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 0)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            // Un empleado solo puede ver sus propias citas — resuelve UsuarioId → EmpleadoId
            Guid? filtroEmpleado = empleadoId;
            if (_contexto.Rol == Roles.Empleado)
            {
                var registroEmpleado = await _db.Empleados
                    .FirstOrDefaultAsync(e =>
                        e.NegocioId == _contexto.NegocioId.Value &&
                        e.UsuarioId == _contexto.UsuarioId &&
                        e.FechaEliminacion == null);

                if (registroEmpleado is null) return Forbid();
                filtroEmpleado = registroEmpleado.Id;
            }

            var citas = await _citaRepo.ObtenerCitasAsync(
                _contexto.NegocioId.Value, desde, hasta, filtroEmpleado);

            var total = citas.Count;
            Response.Headers["X-Total-Count"] = total.ToString();

            var resultado = tamano > 0
                ? citas.Skip((pagina - 1) * tamano).Take(tamano)
                : citas.AsEnumerable();

            return Ok(resultado.Select(MapearDto));
        }

        // GET api/citas/{id}
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> ObtenerPorId(Guid id)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

            return Ok(MapearDto(cita));
        }

        // POST api/citas — crear cita desde el panel (propietario/empleado)
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] CrearCitaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            if (dto.InicioEn <= DateTime.UtcNow)
                return BadRequest(new { mensaje = "La fecha de la cita debe ser en el futuro" });

            var negocioId = _contexto.NegocioId.Value;

            // Verificar límite de citas del plan
            var planLimite = await _db.Negocios
                .Where(n => n.Id == negocioId)
                .Select(n => n.Plan != null ? n.Plan.MaxCitasMes : 0)
                .FirstOrDefaultAsync();
            if (planLimite > 0)
            {
                var inicioMes = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var citasMes = await _db.Citas.CountAsync(c => c.NegocioId == negocioId && c.InicioEn >= inicioMes);
                if (citasMes >= planLimite)
                    return StatusCode(402, new { mensaje = $"Has alcanzado el límite de {planLimite} citas para este mes. Actualiza tu plan para continuar." });
            }

            var servicio = await _servicioRepo.ObtenerPorIdAsync(dto.ServicioId, negocioId);
            if (servicio is null)
                return BadRequest(new { mensaje = "Servicio no válido" });

            // Validar que el empleado pertenece a este negocio
            var empleadoValido = await _db.Empleados
                .AnyAsync(e => e.Id == dto.EmpleadoId && e.NegocioId == negocioId && e.FechaEliminacion == null);
            if (!empleadoValido)
                return BadRequest(new { mensaje = "Empleado no válido" });

            var empleadoOfreceServicio = await _db.EmpleadosServicios
                .AnyAsync(es => es.EmpleadoId == dto.EmpleadoId && es.ServicioId == dto.ServicioId);
            if (!empleadoOfreceServicio)
                return BadRequest(new { mensaje = "El empleado no ofrece este servicio" });

            var finEn = dto.InicioEn.AddMinutes(servicio.DuracionMinutos);

            // Verificar que el empleado tenga horario activo para ese día y que el slot caiga dentro
            var diaSemana = (byte)(dto.InicioEn.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)dto.InicioEn.DayOfWeek);
            var horarioEmpleado = await _db.HorariosEmpleados
                .FirstOrDefaultAsync(h => h.EmpleadoId == dto.EmpleadoId && h.DiaSemana == diaSemana && h.Activo == 1);
            if (horarioEmpleado is null)
                return BadRequest(new { mensaje = "El empleado no trabaja ese día" });
            var slotInicio = dto.InicioEn.TimeOfDay;
            var slotFin = finEn.TimeOfDay;
            if (slotInicio < horarioEmpleado.HoraInicio || slotFin > horarioEmpleado.HoraFin)
                return BadRequest(new { mensaje = "El horario seleccionado está fuera del horario laboral del empleado" });

            // Transacción serializable: previene que dos reservas simultáneas ocupen el mismo slot
            Cita cita;
            Cliente cliente;
            using (var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable))
            {
                try
                {
                    var haySolapamiento = await _citaRepo.ExisteSolapamientoAsync(dto.EmpleadoId, dto.InicioEn, finEn);
                    if (haySolapamiento)
                    {
                        await tx.RollbackAsync();
                        return Conflict(new { mensaje = "El horario seleccionado ya no está disponible" });
                    }

                    cliente = await _clienteRepo.ObtenerOCrearAsync(
                        negocioId, dto.NombreCliente, dto.TelefonoCliente, dto.EmailCliente);

                    cita = new Cita
                    {
                        Id = Guid.NewGuid(),
                        NegocioId = negocioId,
                        CodigoConfirmacion = GenerarCodigo(),
                        ClienteId = cliente.Id,
                        EmpleadoId = dto.EmpleadoId,
                        ServicioId = dto.ServicioId,
                        InicioEn = dto.InicioEn,
                        FinEn = finEn,
                        Estado = EstadosCitas.Confirmada,
                        Precio = servicio.Precio,
                        Notas = dto.Notas,
                        CreadoPorUsuarioId = _contexto.UsuarioId,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };

                    await _citaRepo.CrearAsync(cita);

                    cliente.TotalCitas++;
                    cliente.UltimaCitaEn = dto.InicioEn;
                    cliente.FechaActualizacion = DateTime.UtcNow;
                    await _clienteRepo.ActualizarAsync(cliente);

                    await tx.CommitAsync();
                }
                catch (Exception ex) when (EsConflictoSerializacion(ex))
                {
                    await tx.RollbackAsync();
                    return Conflict(new { mensaje = "El horario fue reservado en este momento. Intenta de nuevo." });
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            }

            // Programar recordatorio usando el setting del negocio (no hardcodeado)
            if (!string.IsNullOrWhiteSpace(cliente.Email))
            {
                var horasAntes = await _db.Negocios
                    .Where(n => n.Id == negocioId)
                    .Select(n => n.HorasRecordatorio)
                    .FirstOrDefaultAsync();
                var horas = horasAntes > 0 ? horasAntes : 24;
                var horaRecordatorio = cita.InicioEn.AddHours(-horas);
                if (horaRecordatorio > DateTime.UtcNow)
                    _jobClient.Schedule<IRecordatorioService>(
                        s => s.EnviarRecordatorioCitaAsync(cita.Id),
                        horaRecordatorio);
            }

            var creada = await _citaRepo.ObtenerPorIdAsync(cita.Id, negocioId);
            return CreatedAtAction(nameof(ObtenerPorId), new { id = cita.Id }, MapearDto(creada!));
        }

        // PATCH api/citas/{id}/estado
        [HttpPatch("{id:guid}/estado")]
        public async Task<IActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoCitaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

            if (cita.Estado == EstadosCitas.Cancelada || cita.Estado == EstadosCitas.Completada)
                return BadRequest(new { mensaje = "No se puede modificar una cita ya finalizada" });

            var estadoAnterior = cita.Estado;
            cita.Estado = dto.NuevoEstado;
            cita.MotivoCancelacion = dto.NuevoEstado == EstadosCitas.Cancelada ? dto.Motivo : null;
            cita.FechaActualizacion = DateTime.UtcNow;

            await _citaRepo.ActualizarAsync(cita);

            // Actualizar estadísticas de inasistencia
            if (dto.NuevoEstado == EstadosCitas.Inasistencia && estadoAnterior != EstadosCitas.Inasistencia)
            {
                var cliente = await _clienteRepo.ObtenerPorIdAsync(cita.ClienteId, _contexto.NegocioId.Value);
                if (cliente is not null)
                {
                    cliente.CantidadInasistencias++;
                    cliente.FechaActualizacion = DateTime.UtcNow;
                    await _clienteRepo.ActualizarAsync(cliente);
                }
            }

            // Notificar por email si el cliente tiene correo
            var emailDestino = cita.Cliente?.Email;
            if (!string.IsNullOrWhiteSpace(emailDestino))
            {
                if (dto.NuevoEstado == EstadosCitas.Cancelada)
                    _jobClient.Enqueue<NotificacionJob>(j => j.EnviarCancelacionAsync(cita.Id, emailDestino, cita.Cliente!.NombreCompleto));

                if (dto.NuevoEstado == EstadosCitas.Completada && estadoAnterior != EstadosCitas.Completada)
                {
                    var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower();
                    var resena = new Resena
                    {
                        Id = Guid.NewGuid(),
                        NegocioId = cita.NegocioId,
                        CitaId = cita.Id,
                        NombreCliente = cita.Cliente!.NombreCompleto,
                        Token = token,
                        Respondida = false,
                        Aprobada = true,
                        FechaCreacion = DateTime.UtcNow,
                        FechaExpiracion = DateTime.UtcNow.AddDays(7)
                    };
                    await _db.Resenas.AddAsync(resena);
                    await _db.SaveChangesAsync();

                    var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
                    var urlResena = $"{frontendUrl}/resena/{token}";
                    _jobClient.Enqueue<NotificacionJob>(j => j.EnviarSolicitudResenaAsync(cita.Id, emailDestino, cita.Cliente!.NombreCompleto, urlResena));
                }
            }

            return Ok(MapearDto(cita));
        }

        // PATCH api/citas/{id}/pago
        [HttpPatch("{id:guid}/pago")]
        public async Task<IActionResult> MarcarPago(Guid id, [FromBody] MarcarPagoDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

            cita.Pagada = dto.Pagada;
            cita.MetodoPago = dto.Pagada ? dto.MetodoPago : null;
            cita.FechaActualizacion = DateTime.UtcNow;

            await _citaRepo.ActualizarAsync(cita);
            return Ok(MapearDto(cita));
        }

        // PATCH api/citas/{id}/notas
        [HttpPatch("{id:guid}/notas")]
        public async Task<IActionResult> ActualizarNotas(Guid id, [FromBody] ActualizarNotasCitaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

            cita.Notas = string.IsNullOrWhiteSpace(dto.Notas) ? null : dto.Notas.Trim();
            cita.FechaActualizacion = DateTime.UtcNow;

            await _citaRepo.ActualizarAsync(cita);
            return Ok(MapearDto(cita));
        }

        // PATCH api/citas/{id}/reagendar
        [HttpPatch("{id:guid}/reagendar")]
        public async Task<IActionResult> Reagendar(Guid id, [FromBody] ReagendarCitaDto dto)
        {
            if (_contexto.NegocioId is null) return Unauthorized();

            var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
            if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

            if (cita.Estado == EstadosCitas.Cancelada || cita.Estado == EstadosCitas.Completada)
                return BadRequest(new { mensaje = "No se puede reagendar una cita ya finalizada" });

            var duracion = (int)(cita.FinEn - cita.InicioEn).TotalMinutes;
            var nuevoFin = dto.InicioEn.AddMinutes(duracion);

            var haySolapamiento = await _citaRepo.ExisteSolapamientoAsync(cita.EmpleadoId, dto.InicioEn, nuevoFin, cita.Id);
            if (haySolapamiento)
                return Conflict(new { mensaje = "El horario seleccionado ya no está disponible" });

            var fechaOriginal = cita.InicioEn;
            cita.InicioEn = dto.InicioEn;
            cita.FinEn = nuevoFin;
            cita.FechaActualizacion = DateTime.UtcNow;

            await _citaRepo.ActualizarAsync(cita);

            var emailCliente = cita.Cliente?.Email;
            if (!string.IsNullOrWhiteSpace(emailCliente))
                _jobClient.Enqueue<NotificacionJob>(j => j.EnviarReagendaAsync(cita.Id, emailCliente, cita.Cliente!.NombreCompleto, fechaOriginal));

            return Ok(MapearDto(cita));
        }

        private static bool EsConflictoSerializacion(Exception ex)
        {
            var inner = ex;
            while (inner is not null)
            {
                if (inner.GetType().Name.Contains("Postgres") &&
                    (inner.Message.Contains("40001") || inner.Message.Contains("serialization") || inner.Message.Contains("deadlock")))
                    return true;
                inner = inner.InnerException;
            }
            return false;
        }

        private static string GenerarCodigo()
        {
            var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(4);
            return Convert.ToHexString(bytes).ToUpper();
        }

        private static CitaDto MapearDto(Cita c) => new()
        {
            Id = c.Id,
            CodigoConfirmacion = c.CodigoConfirmacion,
            NegocioId = c.NegocioId,
            ClienteId = c.ClienteId,
            NombreCliente = c.Cliente?.NombreCompleto ?? string.Empty,
            TelefonoCliente = c.Cliente?.Telefono ?? string.Empty,
            EmailCliente = c.Cliente?.Email,
            EmpleadoId = c.EmpleadoId,
            NombreEmpleado = c.Empleado?.Nombre ?? string.Empty,
            ServicioId = c.ServicioId,
            NombreServicio = c.Servicio?.Nombre ?? string.Empty,
            DuracionMinutos = c.Servicio?.DuracionMinutos ?? 0,
            Precio = c.Precio,
            Pagada = c.Pagada,
            MetodoPago = c.MetodoPago,
            InicioEn = c.InicioEn,
            FinEn = c.FinEn,
            Estado = c.Estado,
            EstadoTexto = PublicoController.ObtenerEstadoTexto(c.Estado),
            Notas = c.Notas,
            MotivoCancelacion = c.MotivoCancelacion,
            ComprobanteUrl = c.ComprobanteUrl,
            FechaCreacion = c.FechaCreacion
        };
    }
}
