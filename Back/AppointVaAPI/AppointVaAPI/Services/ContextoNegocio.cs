using AppointVaAPI.Constants;
using AppointVaAPI.Services.IServices;

namespace AppointVaAPI.Services
{
    public class ContextoNegocio : IContextoNegocio
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ContextoNegocio(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public Guid? NegocioId
        {
            get
            {
                var valor = _httpContextAccessor.HttpContext?.User
                    .FindFirst(ClaimsTipos.NegocioId)?.Value;
                return Guid.TryParse(valor, out var id) ? id : null;
            }
        }

        public Guid UsuarioId
        {
            get
            {
                var valor = _httpContextAccessor.HttpContext?.User
                    .FindFirst(ClaimsTipos.UsuarioId)?.Value;
                return Guid.TryParse(valor, out var id) ? id : Guid.Empty;
            }
        }

        public string Rol =>
            _httpContextAccessor.HttpContext?.User
                .FindFirst(ClaimsTipos.Rol)?.Value ?? string.Empty;

        public bool EsSuperAdmin => Rol == Roles.SuperAdmin;
    }
}
