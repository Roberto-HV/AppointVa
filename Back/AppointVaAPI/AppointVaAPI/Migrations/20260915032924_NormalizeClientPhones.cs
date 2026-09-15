using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeClientPhones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Los clientes creados antes de normalizar el teléfono pueden tenerlo con
            // espacios o guiones. La búsqueda compara por igualdad, así que una fila
            // guardada como "55 1234 5678" no se encuentra al enviar "5512345678" y se
            // crea un cliente duplicado. Se normaliza a sólo dígitos.
            //
            // Se omite cualquier fila cuya normalización chocaría con otro cliente activo
            // del mismo negocio: el índice único (NegocioId, Telefono) lo rechazaría, y
            // fusionar clientes con citas e historial no es decisión de una migración.
            migrationBuilder.Sql(@"
                UPDATE ""Clientes"" c
                SET ""Telefono"" = regexp_replace(c.""Telefono"", '[^0-9]', '', 'g')
                WHERE c.""Telefono"" IS NOT NULL
                  AND c.""FechaEliminacion"" IS NULL
                  AND c.""Telefono"" <> regexp_replace(c.""Telefono"", '[^0-9]', '', 'g')
                  AND regexp_replace(c.""Telefono"", '[^0-9]', '', 'g') <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM ""Clientes"" o
                      WHERE o.""NegocioId"" = c.""NegocioId""
                        AND o.""Id"" <> c.""Id""
                        AND o.""FechaEliminacion"" IS NULL
                        AND regexp_replace(COALESCE(o.""Telefono"", ''), '[^0-9]', '', 'g')
                            = regexp_replace(c.""Telefono"", '[^0-9]', '', 'g')
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // El formato original no se conserva, así que no hay vuelta atrás. Los
            // teléfonos sólo-dígitos siguen siendo válidos para el esquema anterior.
        }
    }
}
