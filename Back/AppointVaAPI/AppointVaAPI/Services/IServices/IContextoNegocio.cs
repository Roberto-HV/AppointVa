namespace AppointVaAPI.Services.IServices
{
    public interface IContextoNegocio
    {
        Guid? NegocioId { get; }
        Guid UsuarioId { get; }
        string Rol { get; }
        bool EsSuperAdmin { get; }
    }
}
