using AppointVaAPI.Services;
using AppointVaAPI.Services.IServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AppointVaAPI.Filters
{
    /// <summary>
    /// Lote 5 (G1): the action runs only with a valid step-up proof in the
    /// <see cref="ReautenticacionService.Encabezado"/> header (see <see cref="ReautenticacionService"/>).
    /// It runs after authorization, so the session and role checks still apply first; without the
    /// proof the answer is 403 with <see cref="CodigoError"/>, which the front turns into the
    /// "confirm it's you" step.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class RequiereReautenticacionAttribute : Attribute, IAsyncActionFilter
    {
        public const string CodigoError = "REAUTENTICACION_REQUERIDA";

        public const string Mensaje = "Confirma tu identidad para continuar: escribe tu contraseña y el código de tu app.";

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var servicio = context.HttpContext.RequestServices.GetRequiredService<IReautenticacionService>();
            var prueba = context.HttpContext.Request.Headers[ReautenticacionService.Encabezado].FirstOrDefault();

            if (!await servicio.ValidarAsync(context.HttpContext.User, prueba))
            {
                context.Result = Rechazo();
                return;
            }

            await next();
        }

        /// <summary>The same answer for controllers that check the proof themselves.</summary>
        public static IActionResult Rechazo() =>
            new ObjectResult(new { mensaje = Mensaje, codigoError = CodigoError }) { StatusCode = StatusCodes.Status403Forbidden };
    }
}
