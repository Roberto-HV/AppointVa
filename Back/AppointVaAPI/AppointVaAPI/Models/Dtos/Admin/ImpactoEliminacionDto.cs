namespace AppointVaAPI.Models.Dtos.Admin
{
    /// <summary>
    /// Lote 5 (I3): what deleting a business would erase, shown before the admin confirms.
    /// </summary>
    public class ImpactoEliminacionDto
    {
        public Guid NegocioId { get; set; }

        /// <summary>Whether "deactivate instead" still applies.</summary>
        public bool Activo { get; set; }

        /// <summary>Appointments from now on (business local time).</summary>
        public int CitasProximas { get; set; }
        public int CitasPasadas { get; set; }

        /// <summary>Including soft-deleted clients: the delete removes them too.</summary>
        public int Clientes { get; set; }
        public int Empleados { get; set; }
        public int Servicios { get; set; }

        /// <summary>Recorded subscription payments.</summary>
        public int Pagos { get; set; }

        /// <summary>Stored files: logo, cover, gallery, employee and service photos.</summary>
        public int Imagenes { get; set; }
        public int Resenas { get; set; }
    }
}
