using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class FixPlanLimitsAndExtraPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Fix Básico: covers both accent and no-accent variants
            migrationBuilder.Sql("UPDATE \"Planes\" SET \"MaxEmpleados\" = 2, \"PrecioMensual\" = 249 WHERE \"Nombre\" IN ('Básico', 'Basico')");
            // Fix Pro: set correct limits and confirmed price
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
