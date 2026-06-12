using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Controllers.V1
{
    [ApiController]
    [Route("api/planes")]
    [Authorize(Roles = Roles.SuperAdmin)]
    public class PlanesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public PlanesController(ApplicationDbContext db) => _db = db;

        // GET api/planes
        [HttpGet]
        public async Task<IActionResult> ObtenerTodos()
        {
            var planes = await _db.Planes
                .Where(p => p.Activo == 1)
                .OrderBy(p => p.PrecioMensual)
                .Select(p => new
                {
                    p.Id,
                    p.Nombre,
                    p.PrecioMensual,
                    p.MaxEmpleados,
                    p.MaxCitasMes
                })
                .ToListAsync();

            return Ok(planes);
        }
    }
}
