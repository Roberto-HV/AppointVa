using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class FixPlanLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Reemplaza a 20260818000001_FixPlanLimitsAndExtraPrice, que se escribió a mano
            // sin su archivo .Designer.cs: sin el atributo [Migration] EF nunca la descubrió,
            // así que jamás se aplicó y las bases sembradas antes conservan los valores viejos
            // (Básico con 3 empleados, Pro con 6 empleados a 399).
            //
            // El seeder sólo inserta planes cuando la tabla está vacía y no existe endpoint
            // para editarlos, así que estos valores sólo pueden venir de aquí.

            // Básico: cubre la variante con y sin acento.
            migrationBuilder.Sql("UPDATE \"Planes\" SET \"MaxEmpleados\" = 2, \"PrecioMensual\" = 249 WHERE \"Nombre\" IN ('Básico', 'Basico')");
            migrationBuilder.Sql("UPDATE \"Planes\" SET \"MaxEmpleados\" = 4, \"PrecioMensual\" = 449 WHERE \"Nombre\" = 'Pro'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE \"Planes\" SET \"MaxEmpleados\" = 3, \"PrecioMensual\" = 249 WHERE \"Nombre\" IN ('Básico', 'Basico')");
            migrationBuilder.Sql("UPDATE \"Planes\" SET \"MaxEmpleados\" = 6, \"PrecioMensual\" = 399 WHERE \"Nombre\" = 'Pro'");
        }
    }
}
