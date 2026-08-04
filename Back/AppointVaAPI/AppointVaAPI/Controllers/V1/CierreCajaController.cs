using System.Text.Json;
using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Pagos;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1;

[ApiController]
[Route("api/cierre-caja")]
[Authorize(Roles = Roles.Propietario)]
public class CierreCajaController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IContextoNegocio _contexto;

    public CierreCajaController(ApplicationDbContext db, IContextoNegocio contexto)
    {
        _db = db;
        _contexto = contexto;
    }

    [HttpGet]
    public async Task<ActionResult<CierreCajaDto>> Get([FromQuery] string fecha)
    {
        if (!DateOnly.TryParse(fecha, out var fechaDate))
            return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");

        if (_contexto.NegocioId is not Guid negocioId)
            return Unauthorized();

        var fechaUtc = fechaDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var cierre = await _db.CierresCaja
            .FirstOrDefaultAsync(c => c.NegocioId == negocioId && c.Fecha.Date == fechaUtc.Date);

        var efectivoCobrado = await ComputarEfectivoCobradoAsync(negocioId, fechaUtc);

        if (cierre is null)
        {
            return Ok(new CierreCajaDto
            {
                Fecha = fecha,
                EfectivoCobrado = efectivoCobrado
            });
        }

        return Ok(MapearDto(cierre, efectivoCobrado));
    }

    [HttpPost]
    public async Task<ActionResult<CierreCajaDto>> Guardar([FromBody] GuardarCierreCajaDto dto)
    {
        if (!DateOnly.TryParse(dto.Fecha, out var fechaDate))
            return BadRequest("Formato de fecha inválido. Use YYYY-MM-DD.");

        if (_contexto.NegocioId is not Guid negocioId)
            return Unauthorized();

        var fechaUtc = fechaDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var cierre = await _db.CierresCaja
            .FirstOrDefaultAsync(c => c.NegocioId == negocioId && c.Fecha.Date == fechaUtc.Date);

        var retirosJson = JsonSerializer.Serialize(dto.Retiros);

        if (cierre is null)
        {
            cierre = new CierreCaja
            {
                Id = Guid.NewGuid(),
                NegocioId = negocioId,
                Fecha = fechaUtc,
                EfectivoInicial = dto.EfectivoInicial,
                EfectivoContado = dto.EfectivoContado,
                RetirosJson = retirosJson,
                CerradoEn = DateTime.UtcNow,
                CerradoPorId = _contexto.UsuarioId,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow
            };
            _db.CierresCaja.Add(cierre);
        }
        else
        {
            cierre.EfectivoInicial = dto.EfectivoInicial;
            cierre.EfectivoContado = dto.EfectivoContado;
            cierre.RetirosJson = retirosJson;
            cierre.CerradoEn = DateTime.UtcNow;
            cierre.CerradoPorId = _contexto.UsuarioId;
            cierre.FechaActualizacion = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        var efectivoCobrado = await ComputarEfectivoCobradoAsync(negocioId, fechaUtc);
        return Ok(MapearDto(cierre, efectivoCobrado));
    }

    private async Task<decimal> ComputarEfectivoCobradoAsync(Guid negocioId, DateTime fecha)
    {
        var citas = await _db.Citas
            .Where(c =>
                c.NegocioId == negocioId &&
                c.Pagada &&
                c.FechaPago.HasValue &&
                c.FechaPago.Value.Date == fecha.Date)
            .ToListAsync();

        return citas.Sum(c =>
        {
            var total = c.MontoCobrado ?? c.Precio;
            var m2 = c.MontoPago2 ?? 0m;
            var m1 = total - m2;
            decimal result = 0m;
            if (string.Equals(c.MetodoPago, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m1;
            if (string.Equals(c.MetodoPago2, "Efectivo", StringComparison.OrdinalIgnoreCase)) result += m2;
            return result;
        });
    }

    private static CierreCajaDto MapearDto(CierreCaja c, decimal efectivoCobrado)
    {
        var retiros = JsonSerializer.Deserialize<List<RetiroCajaDto>>(c.RetirosJson)
                      ?? new List<RetiroCajaDto>();
        var totalRetiros = retiros.Sum(r => r.Monto);
        var esperado = c.EfectivoInicial + efectivoCobrado - totalRetiros;
        var diferencia = c.EfectivoContado - esperado;

        return new CierreCajaDto
        {
            Id = c.Id,
            Fecha = c.Fecha.ToString("yyyy-MM-dd"),
            EfectivoInicial = c.EfectivoInicial,
            EfectivoContado = c.EfectivoContado,
            EfectivoCobrado = efectivoCobrado,
            TotalRetiros = totalRetiros,
            EfectivoEsperado = esperado,
            Diferencia = diferencia,
            Retiros = retiros,
            CerradoEn = c.CerradoEn
        };
    }
}
