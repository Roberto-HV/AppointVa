using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Jobs;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Citas;
using AppointVaAPI.Models.Dtos.Negocios;
using AppointVaAPI.Models.Dtos.Publico;
using AppointVaAPI.Repository.IRepository;
using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using Hangfire;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Cryptography;
using System.Text;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/publico")]
    public class PublicoController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly INegocioRepository _negocioRepo;
        private readonly ICitaRepository _citaRepo;
        private readonly IClienteRepository _clienteRepo;
        private readonly IDisponibilidadService _disponibilidad;
        private readonly INotificacionService _notificacion;
        private readonly IEmailService _email; // solo para emails de autenticación
        private readonly IConfiguration _config;
        private readonly IBackgroundJobClient _jobClient;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IBlobStorageService _blob;
        private readonly IPushService _push;

        public PublicoController(
            ApplicationDbContext db,
            INegocioRepository negocioRepo,
            ICitaRepository citaRepo,
            IClienteRepository clienteRepo,
            IDisponibilidadService disponibilidad,
            INotificacionService notificacion,
            IEmailService email,
            IConfiguration config,
            IBackgroundJobClient jobClient,
            UserManager<ApplicationUser> userManager,
            IBlobStorageService blob,
            IPushService push)
        {
            _db = db;
            _negocioRepo = negocioRepo;
            _citaRepo = citaRepo;
            _clienteRepo = clienteRepo;
            _disponibilidad = disponibilidad;
            _notificacion = notificacion;
            _email = email;
            _config = config;
            _jobClient = jobClient;
            _userManager = userManager;
            _blob = blob;
            _push = push;
        }

        // GET api/publico/negocios/{slug}
        [HttpGet("negocios/{slug}")]
        [EnableRateLimiting("PublicoGeneral")]
        [OutputCache(PolicyName = "NegocioPublico")]
        public async Task<IActionResult> ObtenerNegocio(string slug)
        {
            var negocio = await _negocioRepo.ObtenerPorSlugAsync(slug);
            if (negocio is null || negocio.Activo != 1)
                return NotFound(new { mensaje = "Negocio no encontrado" });

            var servicios = await _db.Servicios
                .Include(s => s.Categoria)
                .Where(s => s.NegocioId == negocio.Id && s.Activo == 1)
                .OrderBy(s => s.Orden)
                .ToListAsync();

            var empleados = await _db.Empleados
                .Where(e => e.NegocioId == negocio.Id && e.Activo == 1 && e.FechaEliminacion == null)
                .Select(e => new
                {
                    e.Id, e.Nombre, e.FotoUrl, e.Biografia,
                    ServicioIds = _db.EmpleadosServicios
                        .Where(es => es.EmpleadoId == e.Id)
                        .Select(es => es.ServicioId)
                        .ToList()
                })
                .AsNoTracking()
                .ToListAsync();

            var empleadoIds = empleados.Select(e => e.Id).ToList();
            var ratingsEmpleados = await _db.Resenas
                .Where(r => r.CitaId != null && r.Aprobada)
                .Join(_db.Citas, r => r.CitaId, c => c.Id, (r, c) => new { c.EmpleadoId, r.Rating })
                .Where(x => empleadoIds.Contains(x.EmpleadoId))
                .GroupBy(x => x.EmpleadoId)
                .Select(g => new { EmpleadoId = g.Key, Promedio = g.Average(x => (double)x.Rating), Total = g.Count() })
                .ToListAsync();

            var galeria = await _db.ImagenesNegocios
                .Where(i => i.NegocioId == negocio.Id)
                .OrderBy(i => i.Orden)
                .AsNoTracking()
                .ToListAsync();

            var resenas = await _db.Resenas
                .Where(r => r.NegocioId == negocio.Id && r.Aprobada && r.Respondida)
                .OrderByDescending(r => r.FechaCreacion)
                .Take(20)
                .AsNoTracking()
                .ToListAsync();

            var dto = new NegocioPublicoDto
            {
                Id = negocio.Id,
                Slug = negocio.Slug,
                Nombre = negocio.Nombre,
                Descripcion = negocio.Descripcion,
                LogoUrl = negocio.LogoUrl,
                PortadaUrl = negocio.PortadaUrl,
                ColorPrimario = negocio.ColorPrimario,
                ColorSecundario = negocio.ColorSecundario,
                Telefono = negocio.Telefono,
                TelefonoWhatsApp = negocio.TelefonoWhatsApp,
                HorasCancelacion = negocio.HorasCancelacion,
                AutoConfirmar = negocio.AutoConfirmar,
                ListaEsperaActiva = negocio.ListaEsperaActiva,
                RequiereAnticipo = negocio.RequiereAnticipo,
                MontoAnticipo = negocio.MontoAnticipo,
                InstruccionesAnticipo = negocio.InstruccionesAnticipo,
                InstagramUrl = negocio.InstagramUrl,
                FacebookUrl = negocio.FacebookUrl,
                TiktokUrl = negocio.TiktokUrl,
                Servicios = servicios.Select(s => new ServicioPublicoDto
                {
                    Id = s.Id,
                    CategoriaId = s.CategoriaId,
                    CategoriaNombre = s.Categoria?.Nombre,
                    Nombre = s.Nombre,
                    Descripcion = s.Descripcion,
                    DuracionMinutos = s.DuracionMinutos,
                    BufferMinutos = s.BufferMinutos,
                    Precio = s.Precio,
                    ImagenUrl = s.ImagenUrl,
                    Orden = s.Orden
                }).ToList(),
                Empleados = empleados.Select(e =>
                {
                    var rating = ratingsEmpleados.FirstOrDefault(r => r.EmpleadoId == e.Id);
                    return new EmpleadoPublicoDto
                    {
                        Id = e.Id,
                        Nombre = e.Nombre,
                        FotoUrl = e.FotoUrl,
                        Biografia = e.Biografia,
                        ServicioIds = e.ServicioIds,
                        PromedioResenas = rating?.Promedio ?? 0,
                        TotalResenas = rating?.Total ?? 0
                    };
                }).ToList(),
                Galeria = galeria.Select(i => new ImagenGaleriaDto
                {
                    Id = i.Id,
                    Url = i.Url,
                    Descripcion = i.Descripcion,
                    Orden = i.Orden
                }).ToList(),
                Resenas = resenas.Select(r => new ResenaPublicaDto
                {
                    Rating = r.Rating,
                    Comentario = r.Comentario,
                    NombreCliente = r.NombreCliente,
                    FechaCreacion = r.FechaCreacion
                }).ToList(),
                PromedioResenas = resenas.Count > 0 ? resenas.Average(r => r.Rating) : 0,
                TotalResenas = resenas.Count
            };

            return Ok(dto);
        }

        // GET api/publico/disponibilidad?servicioId=...&empleadoId=...&fecha=yyyy-MM-dd
        [HttpGet("disponibilidad")]
        [EnableRateLimiting("PublicoGeneral")]
        public async Task<IActionResult> ObtenerDisponibilidad(
            [FromQuery] Guid servicioId,
            [FromQuery] Guid? empleadoId,
            [FromQuery] string fecha)
        {
            if (!DateOnly.TryParseExact(fecha, "yyyy-MM-dd", out var fechaFiltro))
                return BadRequest(new { mensaje = "Formato de fecha inválido. Use yyyy-MM-dd" });

            if (fechaFiltro < DateOnly.FromDateTime(DateTime.Today))
                return BadRequest(new { mensaje = "No se pueden consultar fechas pasadas" });

            var servicio = await _db.Servicios.FirstOrDefaultAsync(s => s.Id == servicioId && s.Activo == 1);
            if (servicio is null)
                return NotFound(new { mensaje = "Servicio no encontrado" });

            var slots = await _disponibilidad.ObtenerSlotsDisponiblesAsync(
                servicio.NegocioId, servicioId, empleadoId, fechaFiltro);

            return Ok(slots);
        }

        // POST api/publico/citas
        [HttpPost("citas")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> CrearCita([FromBody] CrearCitaPublicaDto dto)
        {
            var negocio = await _negocioRepo.ObtenerPorSlugAsync(dto.NegocioSlug);
            if (negocio is null || negocio.Activo != 1)
                return NotFound(new { mensaje = "Negocio no encontrado" });

            // Verificar límite de citas del plan
            var planLimite = await _db.Negocios
                .Where(n => n.Id == negocio.Id)
                .Select(n => n.Plan != null ? n.Plan.MaxCitasMes : 0)
                .FirstOrDefaultAsync();
            if (planLimite > 0)
            {
                var ahora = DateTime.UtcNow;
                var inicioMes = new DateTime(ahora.Year, ahora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var citasMes = await _db.Citas.CountAsync(c => c.NegocioId == negocio.Id && c.InicioEn >= inicioMes);
                if (citasMes >= planLimite)
                    return StatusCode(402, new { mensaje = "Este negocio ha alcanzado su límite de citas para este mes. Por favor contáctalo directamente." });
            }

            var servicio = await _db.Servicios
                .FirstOrDefaultAsync(s => s.Id == dto.ServicioId && s.NegocioId == negocio.Id && s.Activo == 1);
            if (servicio is null)
                return BadRequest(new { mensaje = "Servicio no válido para este negocio" });

            // Validar que el empleado pertenece a este negocio
            var empleadoValido = await _db.Empleados
                .AnyAsync(e => e.Id == dto.EmpleadoId && e.NegocioId == negocio.Id && e.FechaEliminacion == null && e.Activo == 1);
            if (!empleadoValido)
                return BadRequest(new { mensaje = "Empleado no válido para este negocio" });

            var empleadoOfreceServicio = await _db.EmpleadosServicios
                .AnyAsync(es => es.EmpleadoId == dto.EmpleadoId && es.ServicioId == dto.ServicioId);
            if (!empleadoOfreceServicio)
                return BadRequest(new { mensaje = "El empleado no ofrece este servicio" });

            var finEn = dto.InicioEn.AddMinutes(servicio.DuracionMinutos);

            // Validar descuento si se proporcionó código
            Descuento? descuentoAplicado = null;
            decimal precioFinal = servicio.Precio;
            if (!string.IsNullOrWhiteSpace(dto.CodigoDescuento))
            {
                var codigoNorm = dto.CodigoDescuento.Trim().ToUpper();
                descuentoAplicado = await _db.Descuentos.FirstOrDefaultAsync(d =>
                    d.NegocioId == negocio.Id && d.Codigo == codigoNorm && d.Activo);

                if (descuentoAplicado != null &&
                    !(descuentoAplicado.FechaExpiracion.HasValue && descuentoAplicado.FechaExpiracion < DateTime.UtcNow) &&
                    !(descuentoAplicado.UsoMaximo.HasValue && descuentoAplicado.UsoActual >= descuentoAplicado.UsoMaximo))
                {
                    if (descuentoAplicado.Tipo == "Porcentaje")
                        precioFinal = servicio.Precio * (1 - descuentoAplicado.Valor / 100m);
                    else
                        precioFinal = Math.Max(0, servicio.Precio - descuentoAplicado.Valor);
                }
                else
                {
                    descuentoAplicado = null;
                }
            }

            // Transacción serializable: previene que dos reservas simultáneas ocupen el mismo slot
            Cita cita;
            Cliente cliente;
            var codigo = GenerarCodigoConfirmacion();

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
                        negocio.Id, dto.NombreCliente, dto.TelefonoCliente, dto.EmailCliente);

                    cita = new Cita
                    {
                        Id = Guid.NewGuid(),
                        NegocioId = negocio.Id,
                        CodigoConfirmacion = codigo,
                        ClienteId = cliente.Id,
                        EmpleadoId = dto.EmpleadoId,
                        ServicioId = dto.ServicioId,
                        InicioEn = dto.InicioEn,
                        FinEn = finEn,
                        Estado = negocio.AutoConfirmar ? EstadosCitas.Confirmada : EstadosCitas.Pendiente,
                        Precio = precioFinal,
                        Notas = dto.Notas,
                        FechaCreacion = DateTime.UtcNow,
                        FechaActualizacion = DateTime.UtcNow
                    };

                    await _citaRepo.CrearAsync(cita);

                    cliente.TotalCitas++;
                    cliente.UltimaCitaEn = dto.InicioEn;
                    cliente.FechaActualizacion = DateTime.UtcNow;
                    await _clienteRepo.ActualizarAsync(cliente);

                    if (descuentoAplicado != null)
                    {
                        descuentoAplicado.UsoActual++;
                        await _db.SaveChangesAsync();
                    }

                    await tx.CommitAsync();
                }
                catch (Exception ex) when (EsConflictoSerializacion(ex))
                {
                    await tx.RollbackAsync();
                    return Conflict(new { mensaje = "El horario fue reservado en este momento. Por favor elige otro." });
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            }

            var empleado = await _db.Empleados.FindAsync(dto.EmpleadoId);

            var backendUrl = _config["BackendUrl"] ?? string.Empty;
            var icalUrl = string.IsNullOrWhiteSpace(backendUrl) ? null : $"{backendUrl}/api/publico/citas/{codigo}/ical";
            cita.Negocio = negocio;
            cita.Servicio = servicio;
            cita.Empleado = empleado;
            cita.Cliente = cliente;
            var googleCalUrl = GenerarGoogleCalendarUrl(cita);

            var respuesta = new ConfirmacionCitaDto
            {
                Id = cita.Id,
                CodigoConfirmacion = codigo,
                NombreNegocio = negocio.Nombre,
                NegocioSlug = negocio.Slug,
                NombreServicio = servicio.Nombre,
                NombreEmpleado = empleado?.Nombre ?? string.Empty,
                NombreCliente = cliente.NombreCompleto,
                InicioEn = cita.InicioEn,
                FinEn = cita.FinEn,
                Precio = cita.Precio,
                Estado = cita.Estado,
                EstadoTexto = ObtenerEstadoTexto(cita.Estado),
                Notas = cita.Notas,
                IcalUrl = icalUrl,
                WebcalUrl = icalUrl?.Replace("https://", "webcal://").Replace("http://", "webcal://"),
                GoogleCalUrl = googleCalUrl,
                RequiereAnticipo = negocio.RequiereAnticipo,
                MontoAnticipo = negocio.MontoAnticipo,
                InstruccionesAnticipo = negocio.InstruccionesAnticipo
            };

            // Enviar email de confirmación si el cliente tiene correo
            if (!string.IsNullOrWhiteSpace(dto.EmailCliente))
            {
                var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
                var urlCita = $"{frontendUrl}/b/{negocio.Slug}/confirmacion/{codigo}";
                var urlCancelacion = $"{frontendUrl}/cancelar/{codigo}";
                _ = Task.Run(() => _notificacion.EnviarConfirmacionCitaAsync(cita, dto.EmailCliente, cliente.NombreCompleto, urlCita, icalUrl, googleCalUrl, urlCancelacion));
            }

            // Notificación push al empleado asignado (Hangfire crea su propio scope/DbContext)
            _jobClient.Enqueue<IPushService>(s => s.EnviarNuevaCitaEmpleadoAsync(cita.Id));

            // Agendar recordatorio configurable antes de la cita si el cliente tiene correo
            if (!string.IsNullOrWhiteSpace(dto.EmailCliente))
            {
                var horas = negocio.HorasRecordatorio > 0 ? negocio.HorasRecordatorio : 24;
                var horaRecordatorio = cita.InicioEn.AddHours(-horas);
                if (horaRecordatorio > DateTime.UtcNow)
                    _jobClient.Schedule<IRecordatorioService>(s => s.EnviarRecordatorioCitaAsync(cita.Id), horaRecordatorio);
            }

            return CreatedAtAction(nameof(ObtenerCita), new { codigo }, respuesta);
        }

        // GET api/publico/citas/{codigo}
        [HttpGet("citas/{codigo}")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> ObtenerCita(string codigo)
        {
            var cita = await _citaRepo.ObtenerPorCodigoAsync(codigo);
            if (cita is null)
                return NotFound(new { mensaje = "Cita no encontrada" });

            var backendUrl = _config["BackendUrl"] ?? string.Empty;
            var icalUrl = string.IsNullOrWhiteSpace(backendUrl) ? null : $"{backendUrl}/api/publico/citas/{codigo}/ical";
            var googleCalUrl = GenerarGoogleCalendarUrl(cita);

            return Ok(new ConfirmacionCitaDto
            {
                Id = cita.Id,
                CodigoConfirmacion = cita.CodigoConfirmacion,
                NombreNegocio = cita.Negocio?.Nombre ?? string.Empty,
                NegocioSlug = cita.Negocio?.Slug ?? string.Empty,
                ServicioId = cita.ServicioId,
                EmpleadoId = cita.EmpleadoId,
                NombreServicio = cita.Servicio?.Nombre ?? string.Empty,
                NombreEmpleado = cita.Empleado?.Nombre ?? string.Empty,
                NombreCliente = cita.Cliente?.NombreCompleto ?? string.Empty,
                InicioEn = cita.InicioEn,
                FinEn = cita.FinEn,
                Precio = cita.Precio,
                Estado = cita.Estado,
                EstadoTexto = ObtenerEstadoTexto(cita.Estado),
                Notas = cita.Notas,
                IcalUrl = icalUrl,
                WebcalUrl = icalUrl?.Replace("https://", "webcal://").Replace("http://", "webcal://"),
                GoogleCalUrl = googleCalUrl,
                HorasCancelacion = cita.Negocio?.HorasCancelacion ?? 0,
                InstagramUrl = cita.Negocio?.InstagramUrl,
                FacebookUrl = cita.Negocio?.FacebookUrl,
                TiktokUrl = cita.Negocio?.TiktokUrl,
                ColorPrimario = cita.Negocio?.ColorPrimario ?? "#334155"
            });
        }

        // GET api/publico/citas/{codigo}/ical
        [HttpGet("citas/{codigo}/ical")]
        [EnableRateLimiting("PublicoGeneral")]
        public async Task<IActionResult> ObtenerIcal(string codigo)
        {
            var cita = await _citaRepo.ObtenerPorCodigoAsync(codigo);
            if (cita is null) return NotFound();

            var sb = new StringBuilder();
            sb.Append("BEGIN:VCALENDAR\r\n");
            sb.Append("VERSION:2.0\r\n");
            sb.Append("PRODID:-//AppointVa//AppointVa//ES\r\n");
            sb.Append("CALSCALE:GREGORIAN\r\n");
            sb.Append("METHOD:PUBLISH\r\n");
            sb.Append("BEGIN:VEVENT\r\n");
            sb.Append($"DTSTART:{cita.InicioEn:yyyyMMddTHHmmssZ}\r\n");
            sb.Append($"DTEND:{cita.FinEn:yyyyMMddTHHmmssZ}\r\n");
            sb.Append($"DTSTAMP:{DateTime.UtcNow:yyyyMMddTHHmmssZ}\r\n");
            sb.Append($"UID:{cita.CodigoConfirmacion}@appointva\r\n");
            sb.Append($"SUMMARY:{cita.Servicio?.Nombre ?? "Cita"} con {cita.Empleado?.Nombre ?? "el equipo"}\r\n");
            var descripcion = $"Negocio: {cita.Negocio?.Nombre ?? "AppointVa"}\\n" +
                              $"Servicio: {cita.Servicio?.Nombre ?? string.Empty}\\n" +
                              $"Profesional: {cita.Empleado?.Nombre ?? string.Empty}\\n" +
                              $"Código: {cita.CodigoConfirmacion}";
            sb.Append($"DESCRIPTION:{descripcion}\r\n");
            if (!string.IsNullOrWhiteSpace(cita.Negocio?.Direccion))
                sb.Append($"LOCATION:{cita.Negocio.Direccion}\r\n");
            if (!string.IsNullOrWhiteSpace(cita.Negocio?.Email))
                sb.Append($"ORGANIZER;CN={cita.Negocio.Nombre ?? "AppointVa"}:mailto:{cita.Negocio.Email}\r\n");
            sb.Append("STATUS:CONFIRMED\r\n");
            sb.Append("SEQUENCE:0\r\n");
            sb.Append("BEGIN:VALARM\r\n");
            sb.Append("ACTION:DISPLAY\r\n");
            sb.Append("DESCRIPTION:Recordatorio de cita\r\n");
            sb.Append("TRIGGER:-PT1H\r\n");
            sb.Append("END:VALARM\r\n");
            sb.Append("END:VEVENT\r\n");
            sb.Append("END:VCALENDAR");

            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/calendar; charset=utf-8", $"cita-{codigo}.ics");
        }

        // DELETE api/publico/citas/{codigo}?email=...  — el cliente cancela su propia cita
        [HttpDelete("citas/{codigo}")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> CancelarCita(string codigo, [FromQuery] string? email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { mensaje = "El correo es requerido para cancelar la cita." });

            var cita = await _citaRepo.ObtenerPorCodigoAsync(codigo);
            if (cita is null)
                return NotFound(new { mensaje = "Cita no encontrada" });

            var emailCliente = cita.Cliente?.Email ?? string.Empty;
            if (!emailCliente.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase))
                return Forbid();

            if (cita.Estado == EstadosCitas.Cancelada)
                return BadRequest(new { mensaje = "La cita ya está cancelada" });

            if (cita.Estado == EstadosCitas.Completada)
                return BadRequest(new { mensaje = "No se puede cancelar una cita completada" });

            // Verificar política de cancelación del negocio
            var horasCancelacion = cita.Negocio?.HorasCancelacion ?? 0;
            if (horasCancelacion > 0)
            {
                var tiempoRestante = cita.InicioEn - DateTime.UtcNow;
                if (tiempoRestante.TotalHours < horasCancelacion)
                    return BadRequest(new { mensaje = $"No se puede cancelar con menos de {horasCancelacion} hora{(horasCancelacion == 1 ? "" : "s")} de anticipación." });
            }

            cita.Estado = EstadosCitas.Cancelada;
            cita.MotivoCancelacion = "Cancelada por el cliente";
            cita.FechaActualizacion = DateTime.UtcNow;
            await _citaRepo.ActualizarAsync(cita);

            if (!string.IsNullOrWhiteSpace(emailCliente))
                _jobClient.Enqueue<NotificacionJob>(j => j.EnviarCancelacionAsync(cita.Id, emailCliente, cita.Cliente!.NombreCompleto));

            if (cita.Negocio?.ListaEsperaActiva == true && cita.InicioEn > DateTime.UtcNow.AddHours(2))
            {
                var hayEnEspera = await _db.ListaEspera
                    .AnyAsync(le => le.NegocioId == cita.NegocioId
                                 && le.ServicioId == cita.ServicioId
                                 && le.Estado == "Esperando");
                if (hayEnEspera)
                    _jobClient.Enqueue<NotificacionJob>(j => j.NotificarListaEsperaAsync(cita.NegocioId, cita.ServicioId));
            }

            return NoContent();
        }

        // POST api/publico/citas/{codigo}/comprobante — el cliente sube su comprobante de anticipo
        [HttpPost("citas/{codigo}/comprobante")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> SubirComprobante(string codigo, IFormFile archivo)
        {
            if (archivo == null || archivo.Length == 0)
                return BadRequest(new { mensaje = "El archivo es obligatorio" });

            var cita = await _db.Citas
                .Include(c => c.Negocio)
                .FirstOrDefaultAsync(c => c.CodigoConfirmacion == codigo);
            if (cita is null)
                return NotFound(new { mensaje = "Cita no encontrada" });

            if (cita.Estado == EstadosCitas.Cancelada || cita.Estado == EstadosCitas.Completada)
                return BadRequest(new { mensaje = "No se puede subir comprobante para esta cita" });

            var url = await _blob.SubirImagenAsync(archivo, "comprobantes");
            cita.ComprobanteUrl = url;
            cita.FechaActualizacion = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { comprobanteUrl = url });
        }

        // PATCH api/publico/citas/{codigo}/reagendar?email=... — el cliente reagenda su propia cita
        [HttpPatch("citas/{codigo}/reagendar")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> ReagendarPublico(string codigo, [FromQuery] string? email, [FromBody] ReagendarCitaDto dto)
        {
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { mensaje = "El correo es requerido para reagendar la cita." });

            var cita = await _citaRepo.ObtenerPorCodigoAsync(codigo);
            if (cita is null)
                return NotFound(new { mensaje = "Cita no encontrada" });

            var emailCliente = cita.Cliente?.Email ?? string.Empty;
            if (!emailCliente.Equals(email.Trim(), StringComparison.OrdinalIgnoreCase))
                return Forbid();

            if (cita.Estado == EstadosCitas.Cancelada || cita.Estado == EstadosCitas.Completada)
                return BadRequest(new { mensaje = "No se puede reagendar esta cita" });

            var horasCancelacion = cita.Negocio?.HorasCancelacion ?? 0;
            if (horasCancelacion > 0 && (cita.InicioEn - DateTime.UtcNow).TotalHours < horasCancelacion)
                return BadRequest(new { mensaje = $"No puedes reagendar con menos de {horasCancelacion} hora{(horasCancelacion == 1 ? "" : "s")} de anticipación." });

            var duracion = (int)(cita.FinEn - cita.InicioEn).TotalMinutes;
            var nuevoFin = dto.InicioEn.AddMinutes(duracion);

            var haySolapamiento = await _citaRepo.ExisteSolapamientoAsync(cita.EmpleadoId, dto.InicioEn, nuevoFin, cita.Id);
            if (haySolapamiento)
                return Conflict(new { mensaje = "El horario seleccionado ya no está disponible. Elige otro." });

            var fechaOriginal = cita.InicioEn;
            cita.InicioEn = dto.InicioEn;
            cita.FinEn = nuevoFin;
            cita.FechaActualizacion = DateTime.UtcNow;
            await _citaRepo.ActualizarAsync(cita);

            if (!string.IsNullOrWhiteSpace(emailCliente))
                _jobClient.Enqueue<NotificacionJob>(j => j.EnviarReagendaAsync(cita.Id, emailCliente, cita.Cliente!.NombreCompleto, fechaOriginal));

            return Ok(new { mensaje = "¡Cita reagendada exitosamente!" });
        }

        // GET api/publico/mis-citas?slug=...&email=...&telefono=...&pagina=1&tamano=10
        [HttpGet("mis-citas")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> ObtenerMisCitas(
            [FromQuery] string slug,
            [FromQuery] string email,
            [FromQuery] string telefono,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamano = 10)
        {
            if (string.IsNullOrWhiteSpace(slug) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(telefono))
                return BadRequest(new { mensaje = "Slug, email y teléfono son requeridos" });

            tamano = Math.Clamp(tamano, 1, 50);
            pagina = Math.Max(1, pagina);

            var negocio = await _negocioRepo.ObtenerPorSlugAsync(slug);
            if (negocio is null || negocio.Activo != 1)
                return NotFound(new { mensaje = "Negocio no encontrado" });

            var emailNorm = email.ToLower().Trim();
            var telefonoNorm = telefono.Trim();

            var baseQuery = _db.Citas
                .Where(c =>
                    c.NegocioId == negocio.Id &&
                    c.Cliente != null &&
                    c.Cliente.Email != null &&
                    c.Cliente.Email.ToLower() == emailNorm &&
                    c.Cliente.Telefono == telefonoNorm)
                .AsNoTracking();

            var total = await baseQuery.CountAsync();

            var citas = await baseQuery
                .Include(c => c.Empleado)
                .Include(c => c.Servicio)
                .OrderByDescending(c => c.InicioEn)
                .Skip((pagina - 1) * tamano)
                .Take(tamano)
                .ToListAsync();

            Response.Headers["X-Total-Count"] = total.ToString();
            Response.Headers["Access-Control-Expose-Headers"] = "X-Total-Count";

            return Ok(citas.Select(c => new
            {
                id = c.Id,
                codigoConfirmacion = c.CodigoConfirmacion,
                nombreNegocio = negocio.Nombre,
                negocioSlug = negocio.Slug,
                nombreServicio = c.Servicio?.Nombre ?? string.Empty,
                nombreEmpleado = c.Empleado?.Nombre ?? string.Empty,
                inicioEn = c.InicioEn,
                finEn = c.FinEn,
                precio = c.Precio,
                estado = c.Estado,
                estadoTexto = ObtenerEstadoTexto(c.Estado),
            }));
        }

        // POST api/publico/registro — auto-registro de un nuevo negocio
        [HttpPost("registro")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> RegistrarNegocio([FromBody] RegistroNegocioDto dto)
        {
            if (await _db.Negocios.AnyAsync(n => n.Slug == dto.Slug))
                return Conflict(new { mensaje = "Ese identificador ya está en uso. Prueba con otro." });

            if (await _userManager.FindByEmailAsync(dto.Email) is not null)
                return Conflict(new { mensaje = "Ya existe una cuenta con este correo." });

            var negocio = new Negocio
            {
                Id = Guid.NewGuid(),
                Slug = dto.Slug,
                Nombre = dto.NombreNegocio,
                Telefono = dto.Telefono,
                Activo = 0, // inactivo hasta que el SuperAdmin apruebe y asigne un plan
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };

            ApplicationUser usuario;
            using (var tx = await _db.Database.BeginTransactionAsync())
            {
                try
                {
                    await _db.Negocios.AddAsync(negocio);
                    await _db.SaveChangesAsync();

                    usuario = new ApplicationUser
                    {
                        Id = Guid.NewGuid(),
                        UserName = dto.Email,
                        Email = dto.Email,
                        Nombre = dto.NombrePropietario,
                        NegocioId = negocio.Id,
                        Activo = true,
                        FechaCreacion = DateTime.UtcNow
                    };

                    var resultado = await _userManager.CreateAsync(usuario, dto.Contrasena);
                    if (!resultado.Succeeded)
                    {
                        await tx.RollbackAsync();
                        var errores = resultado.Errors.Select(e => e.Description);
                        return BadRequest(new { mensaje = "No se pudo crear la cuenta.", errores });
                    }

                    await _userManager.AddToRoleAsync(usuario, Roles.Propietario);
                    await tx.CommitAsync();
                }
                catch
                {
                    await tx.RollbackAsync();
                    throw;
                }
            }

            var token = await _userManager.GenerateEmailConfirmationTokenAsync(usuario);
            var tokenEncoded = Uri.EscapeDataString(token);
            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var urlVerificacion = $"{frontendUrl}/verificar-email?userId={usuario.Id}&token={tokenEncoded}";
            _ = Task.Run(() => _email.EnviarVerificacionEmailAsync(dto.Email, dto.NombrePropietario, urlVerificacion));

            return StatusCode(201, new { mensaje = "Negocio registrado. Revisa tu correo para verificar tu cuenta." });
        }

        // GET api/publico/verificar-email?userId=...&token=...
        [HttpGet("verificar-email")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> VerificarEmail([FromQuery] string userId, [FromQuery] string token)
        {
            var usuario = await _userManager.FindByIdAsync(userId);
            if (usuario is null)
                return BadRequest(new { mensaje = "Enlace de verificación inválido." });

            if (usuario.EmailConfirmed)
                return Ok(new { mensaje = "Tu correo ya estaba verificado. Puedes iniciar sesión." });

            var resultado = await _userManager.ConfirmEmailAsync(usuario, Uri.UnescapeDataString(token));
            if (!resultado.Succeeded)
                return BadRequest(new { mensaje = "El enlace de verificación es inválido o ha expirado." });

            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var negocio = await _db.Negocios
                .Where(n => n.Id == usuario.NegocioId)
                .Select(n => new { n.Nombre, n.Slug })
                .FirstOrDefaultAsync();
            if (negocio is not null)
                _ = Task.Run(() => _email.EnviarBienvenidaAsync(
                    usuario.Email!,
                    usuario.Nombre ?? usuario.Email!,
                    negocio.Nombre,
                    negocio.Slug,
                    $"{frontendUrl}/dashboard"));

            return Ok(new { mensaje = "¡Correo verificado! Ya puedes iniciar sesión." });
        }

        // GET api/publico/resenas/{token} — verifica token y devuelve info de la cita
        [HttpGet("resenas/{token}")]
        [EnableRateLimiting("PublicoGeneral")]
        public async Task<IActionResult> ObtenerTokenResena(string token)
        {
            var resena = await _db.Resenas
                .Include(r => r.Cita).ThenInclude(c => c!.Servicio)
                .Include(r => r.Cita).ThenInclude(c => c!.Empleado)
                .Include(r => r.Negocio)
                .FirstOrDefaultAsync(r => r.Token == token);

            if (resena is null)
                return NotFound(new { mensaje = "Enlace no válido" });

            if (resena.Respondida)
                return BadRequest(new { mensaje = "Esta reseña ya fue enviada. ¡Gracias por tu opinión!" });

            if (resena.FechaExpiracion.HasValue && resena.FechaExpiracion < DateTime.UtcNow)
                return BadRequest(new { mensaje = "Este enlace ha expirado." });

            return Ok(new
            {
                negocioNombre = resena.Negocio?.Nombre ?? string.Empty,
                servicio = resena.Cita?.Servicio?.Nombre ?? string.Empty,
                empleado = resena.Cita?.Empleado?.Nombre ?? string.Empty,
                fecha = resena.Cita?.InicioEn
            });
        }

        // POST api/publico/resenas/{token} — enviar reseña
        [HttpPost("resenas/{token}")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> EnviarResena(string token, [FromBody] EnviarResenaDto dto)
        {
            if (dto.Rating < 1 || dto.Rating > 5)
                return BadRequest(new { mensaje = "El rating debe ser entre 1 y 5" });

            var resena = await _db.Resenas.FirstOrDefaultAsync(r => r.Token == token);
            if (resena is null)
                return NotFound(new { mensaje = "Enlace no válido" });

            if (resena.Respondida)
                return BadRequest(new { mensaje = "Esta reseña ya fue enviada." });

            if (resena.FechaExpiracion.HasValue && resena.FechaExpiracion < DateTime.UtcNow)
                return BadRequest(new { mensaje = "Este enlace ha expirado." });

            resena.Rating = dto.Rating;
            resena.Comentario = dto.Comentario?.Trim();
            resena.Respondida = true;
            await _db.SaveChangesAsync();

            return Ok(new { mensaje = "¡Gracias por tu reseña!" });
        }

        // GET api/publico/cliente?email=xxx&slug=yyy — pre-relleno de datos para cliente recurrente
        [HttpGet("cliente")]
        [EnableRateLimiting("PublicoGeneral")]
        public async Task<IActionResult> BuscarClienteDatos([FromQuery] string email, [FromQuery] string slug)
        {
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(slug))
                return BadRequest();

            var negocio = await _db.Negocios
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Slug == slug && n.Activo == 1);
            if (negocio is null)
                return NotFound();

            var emailNorm = email.Trim().ToLower();
            var cliente = await _db.Clientes
                .AsNoTracking()
                .Where(c => c.NegocioId == negocio.Id && c.Email == emailNorm)
                .FirstOrDefaultAsync();

            if (cliente is null)
                return NotFound(new { mensaje = "No encontramos citas con ese correo." });

            return Ok(new
            {
                nombreCliente = cliente.NombreCompleto,
                emailCliente = cliente.Email,
            });
        }

        // POST api/publico/reenviar-verificacion
        [HttpPost("reenviar-verificacion")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> ReenviarVerificacion([FromBody] ReenviarVerificacionDto dto)
        {
            const string respuestaGenerica = "Si el correo está registrado y pendiente de verificación, recibirás un email.";
            var usuario = await _userManager.FindByEmailAsync(dto.Email);
            if (usuario is null || usuario.EmailConfirmed)
                return Ok(new { mensaje = respuestaGenerica });

            var token = await _userManager.GenerateEmailConfirmationTokenAsync(usuario);
            var tokenEncoded = Uri.EscapeDataString(token);
            var frontendUrl = _config["FrontendUrl"] ?? "https://appointva.com";
            var url = $"{frontendUrl}/verificar-email?userId={usuario.Id}&token={tokenEncoded}";
            _ = Task.Run(() => _email.EnviarVerificacionEmailAsync(dto.Email, usuario.Nombre ?? dto.Email, url));

            return Ok(new { mensaje = respuestaGenerica });
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

        private static string GenerarGoogleCalendarUrl(Cita cita)
        {
            var titulo = Uri.EscapeDataString(
                $"{cita.Servicio?.Nombre ?? "Cita"} - {cita.Negocio?.Nombre ?? "AppointVa"}");
            var inicio = cita.InicioEn.ToString("yyyyMMddTHHmmssZ");
            var fin = cita.FinEn.ToString("yyyyMMddTHHmmssZ");
            var detalles = Uri.EscapeDataString(
                $"Cita con {cita.Empleado?.Nombre ?? "el equipo"} en {cita.Negocio?.Nombre ?? "AppointVa"}");
            return $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titulo}&dates={inicio}/{fin}&details={detalles}";
        }

        private static string GenerarCodigoConfirmacion()
        {
            var bytes = RandomNumberGenerator.GetBytes(4);
            return Convert.ToHexString(bytes).ToUpper();
        }

        // POST api/publico/lista-espera — cliente se une a la lista
        [HttpPost("lista-espera")]
        [EnableRateLimiting("PublicoEstricto")]
        public async Task<IActionResult> UnirseListaEspera([FromBody] UnirseListaEsperaDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Slug))
                return BadRequest(new { mensaje = "Slug requerido" });

            var negocio = await _db.Negocios
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Slug == dto.Slug && n.Activo == 1);
            if (negocio is null)
                return NotFound(new { mensaje = "Negocio no encontrado" });

            var entrada = new ListaEspera
            {
                Id = Guid.NewGuid(),
                NegocioId = negocio.Id,
                ServicioId = dto.ServicioId,
                EmpleadoId = dto.EmpleadoId,
                NombreCliente = dto.NombreCliente.Trim(),
                TelefonoCliente = dto.TelefonoCliente.Trim(),
                EmailCliente = dto.EmailCliente?.Trim().ToLower(),
                FechaPreferida = dto.FechaPreferida,
                Estado = "Esperando",
                FechaCreacion = DateTime.UtcNow,
            };

            _db.ListaEspera.Add(entrada);
            await _db.SaveChangesAsync();
            return Ok(new { mensaje = "Te has unido a la lista de espera", id = entrada.Id });
        }

        internal static string ObtenerEstadoTexto(byte estado) => estado switch
        {
            EstadosCitas.Pendiente => "Pendiente",
            EstadosCitas.Confirmada => "Confirmada",
            EstadosCitas.Completada => "Completada",
            EstadosCitas.Cancelada => "Cancelada",
            EstadosCitas.Inasistencia => "Inasistencia",
            _ => "Desconocido"
        };
    }
}

