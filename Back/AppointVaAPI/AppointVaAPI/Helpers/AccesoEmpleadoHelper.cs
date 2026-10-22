using AppointVaAPI.Constants;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Helpers
{
    /// <summary>
    /// Panel access of a user who only holds the Empleado role is tied to their employee
    /// record: deactivating the employee (B13) blocks login, refresh and 2FA verification,
    /// and reactivating restores it. Usuario.Activo is left alone so account deletion and
    /// owner/superadmin deactivation keep their own meaning. An owner or superadmin linked
    /// to an employee profile (owner who also takes appointments) is never locked out.
    /// </summary>
    public static class AccesoEmpleadoHelper
    {
        public static async Task<bool> AccesoBloqueadoAsync(
            ApplicationDbContext db, UserManager<ApplicationUser> userManager, ApplicationUser usuario)
        {
            var empleadoInactivo = await db.Empleados.AnyAsync(e =>
                e.UsuarioId == usuario.Id && e.FechaEliminacion == null && e.Activo == 0);
            return empleadoInactivo && await DependeDelEmpleadoAsync(userManager, usuario);
        }

        public static async Task<bool> DependeDelEmpleadoAsync(
            UserManager<ApplicationUser> userManager, ApplicationUser usuario)
        {
            var roles = await userManager.GetRolesAsync(usuario);
            return roles.Contains(Roles.Empleado)
                && !roles.Contains(Roles.Propietario)
                && !roles.Contains(Roles.SuperAdmin);
        }
    }
}
