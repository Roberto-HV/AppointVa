using AppointVaAPI.Models;

namespace AppointVaAPI.Repository.IRepository
{
    public enum ResultadoResolucionCliente
    {
        /// <summary>No había cliente con ese teléfono; se creó uno nuevo.</summary>
        Creado,

        /// <summary>El teléfono ya existía y el nombre enviado coincide con el registrado.</summary>
        Encontrado,

        /// <summary>
        /// El teléfono ya existía pero a nombre de otra persona. No se creó ni
        /// modificó nada: el llamador decide si confirmar o pedir otro teléfono.
        /// </summary>
        ConflictoNombre
    }

    /// <param name="Cliente">
    /// El cliente resultante. En <see cref="ResultadoResolucionCliente.ConflictoNombre"/>
    /// es el cliente ya registrado, para poder mostrar el nombre en archivo.
    /// </param>
    public sealed record ResolucionCliente(ResultadoResolucionCliente Resultado, Cliente Cliente);
}
