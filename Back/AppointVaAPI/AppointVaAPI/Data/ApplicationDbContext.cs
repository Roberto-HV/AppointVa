using AppointVaAPI.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AppointVaAPI.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Plan> Planes { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Negocio> Negocios { get; set; }
        public DbSet<Empleado> Empleados { get; set; }
        public DbSet<HorarioEmpleado> HorariosEmpleados { get; set; }
        public DbSet<HorarioNegocio> HorariosNegocios { get; set; }
        public DbSet<BloqueoHorario> BloqueosHorarios { get; set; }
        public DbSet<CategoriaServicio> CategoriasServicios { get; set; }
        public DbSet<Servicio> Servicios { get; set; }
        public DbSet<EmpleadoServicio> EmpleadosServicios { get; set; }
        public DbSet<Cliente> Clientes { get; set; }
        public DbSet<Cita> Citas { get; set; }
        public DbSet<ImagenNegocio> ImagenesNegocios { get; set; }
        public DbSet<BloqueoNegocio> BloqueosNegocio { get; set; }
        public DbSet<Resena> Resenas { get; set; }
        public DbSet<ListaEspera> ListaEspera { get; set; }
        public DbSet<CampoIntake> CamposIntake { get; set; }
        public DbSet<RespuestaIntake> RespuestasIntake { get; set; }
        public DbSet<Descuento> Descuentos { get; set; }
        public DbSet<EmailLog> EmailLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configurar EmpleadoServicio como tabla de relación N a N con clave primaria compuesta
            modelBuilder.Entity<EmpleadoServicio>()
                .HasKey(es => new { es.EmpleadoId, es.ServicioId });

            modelBuilder.Entity<EmpleadoServicio>()
                .HasOne(es => es.Empleado)
                .WithMany()
                .HasForeignKey(es => es.EmpleadoId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<EmpleadoServicio>()
                .HasOne(es => es.Servicio)
                .WithMany()
                .HasForeignKey(es => es.ServicioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación Negocio -> Plan
            modelBuilder.Entity<Negocio>()
                .HasOne(n => n.Plan)
                .WithMany()
                .HasForeignKey(n => n.PlanId)
                .OnDelete(DeleteBehavior.SetNull);

            // Configurar relación Empleado -> Negocio (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Empleado>()
                .HasOne(e => e.Negocio)
                .WithMany()
                .HasForeignKey(e => e.NegocioId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación HorarioEmpleado -> Empleado
            modelBuilder.Entity<HorarioEmpleado>()
                .HasOne(he => he.Empleado)
                .WithMany()
                .HasForeignKey(he => he.EmpleadoId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación HorarioNegocio -> Negocio
            modelBuilder.Entity<HorarioNegocio>()
                .HasOne(hn => hn.Negocio)
                .WithMany()
                .HasForeignKey(hn => hn.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación BloqueoHorario -> Empleado
            modelBuilder.Entity<BloqueoHorario>()
                .HasOne(bh => bh.Empleado)
                .WithMany()
                .HasForeignKey(bh => bh.EmpleadoId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación CategoriaServicio -> Negocio (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<CategoriaServicio>()
                .HasOne(cs => cs.Negocio)
                .WithMany()
                .HasForeignKey(cs => cs.NegocioId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación Servicio -> Negocio (NO_ACTION para evitar ciclos de cascada)
            modelBuilder.Entity<Servicio>()
                .HasOne(s => s.Negocio)
                .WithMany()
                .HasForeignKey(s => s.NegocioId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación Servicio -> CategoriaServicio (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Servicio>()
                .HasOne(s => s.Categoria)
                .WithMany()
                .HasForeignKey(s => s.CategoriaId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación Cliente -> Negocio (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Cliente>()
                .HasOne(c => c.Negocio)
                .WithMany()
                .HasForeignKey(c => c.NegocioId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación Cita -> Negocio (CASCADE como ruta principal)
            modelBuilder.Entity<Cita>()
                .HasOne(c => c.Negocio)
                .WithMany()
                .HasForeignKey(c => c.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación Cita -> Cliente (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Cita>()
                .HasOne(c => c.Cliente)
                .WithMany()
                .HasForeignKey(c => c.ClienteId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación Cita -> Empleado (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Cita>()
                .HasOne(c => c.Empleado)
                .WithMany()
                .HasForeignKey(c => c.EmpleadoId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación Cita -> Servicio (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Cita>()
                .HasOne(c => c.Servicio)
                .WithMany()
                .HasForeignKey(c => c.ServicioId)
                .OnDelete(DeleteBehavior.NoAction);

            // Configurar relación BloqueoNegocio -> Negocio (CASCADE porque son datos del negocio)
            modelBuilder.Entity<BloqueoNegocio>()
                .HasOne(bn => bn.Negocio)
                .WithMany()
                .HasForeignKey(bn => bn.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación ImagenNegocio -> Negocio (CASCADE porque son contenido del negocio)
            modelBuilder.Entity<ImagenNegocio>()
                .HasOne(in_ => in_.Negocio)
                .WithMany()
                .HasForeignKey(in_ => in_.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación Resena -> Negocio (CASCADE)
            modelBuilder.Entity<Resena>()
                .HasOne(r => r.Negocio)
                .WithMany()
                .HasForeignKey(r => r.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configurar relación Resena -> Cita (NO_ACTION para evitar ciclos)
            modelBuilder.Entity<Resena>()
                .HasOne(r => r.Cita)
                .WithMany()
                .HasForeignKey(r => r.CitaId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<Resena>()
                .HasIndex(r => r.Token).IsUnique();
            modelBuilder.Entity<Resena>()
                .HasIndex(r => new { r.NegocioId, r.Aprobada });

            // Precisión decimal explícita para evitar truncamiento silencioso
            modelBuilder.Entity<Plan>()
                .Property(p => p.PrecioMensual).HasPrecision(10, 2);
            modelBuilder.Entity<Servicio>()
                .Property(s => s.Precio).HasPrecision(10, 2);
            modelBuilder.Entity<Cita>()
                .Property(c => c.Precio).HasPrecision(10, 2);

            // Índices para búsquedas frecuentes
            modelBuilder.Entity<Cita>()
                .HasIndex(c => c.CodigoConfirmacion).IsUnique();
            modelBuilder.Entity<Negocio>()
                .HasIndex(n => n.Slug).IsUnique();
            modelBuilder.Entity<Cliente>()
                .HasIndex(c => new { c.NegocioId, c.Telefono });
            modelBuilder.Entity<Cliente>()
                .HasIndex(c => new { c.NegocioId, c.Email });
            modelBuilder.Entity<Cita>()
                .HasIndex(c => new { c.NegocioId, c.InicioEn });
            modelBuilder.Entity<Cita>()
                .HasIndex(c => new { c.EmpleadoId, c.InicioEn });

            // ListaEspera
            modelBuilder.Entity<ListaEspera>()
                .HasOne(le => le.Negocio)
                .WithMany()
                .HasForeignKey(le => le.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ListaEspera>()
                .HasOne(le => le.Servicio)
                .WithMany()
                .HasForeignKey(le => le.ServicioId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<ListaEspera>()
                .HasOne(le => le.Empleado)
                .WithMany()
                .HasForeignKey(le => le.EmpleadoId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<ListaEspera>()
                .HasIndex(le => new { le.NegocioId, le.Estado });

            // CampoIntake
            modelBuilder.Entity<CampoIntake>()
                .HasOne(ci => ci.Negocio)
                .WithMany()
                .HasForeignKey(ci => ci.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<CampoIntake>()
                .HasOne(ci => ci.Servicio)
                .WithMany()
                .HasForeignKey(ci => ci.ServicioId)
                .OnDelete(DeleteBehavior.NoAction);

            // RespuestaIntake
            modelBuilder.Entity<RespuestaIntake>()
                .HasOne(ri => ri.Cita)
                .WithMany()
                .HasForeignKey(ri => ri.CitaId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<RespuestaIntake>()
                .HasOne(ri => ri.Campo)
                .WithMany()
                .HasForeignKey(ri => ri.CampoIntakeId)
                .OnDelete(DeleteBehavior.NoAction);

            // Descuento
            modelBuilder.Entity<Descuento>()
                .HasOne(d => d.Negocio)
                .WithMany()
                .HasForeignKey(d => d.NegocioId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Descuento>()
                .HasIndex(d => new { d.NegocioId, d.Codigo })
                .IsUnique();

            modelBuilder.Entity<EmailLog>(e =>
            {
                e.HasOne(x => x.Negocio)
                 .WithMany()
                 .HasForeignKey(x => x.NegocioId)
                 .OnDelete(DeleteBehavior.Cascade);
                e.HasIndex(x => new { x.NegocioId, x.EnviadoEn });
            });
        }
    }
}
