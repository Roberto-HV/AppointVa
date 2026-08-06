using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddEmpleadosExtraToNegocio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EmpleadosExtra",
                table: "Negocios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                "UPDATE \"Planes\" SET \"PrecioMensual\" = 249, \"MaxEmpleados\" = 2 WHERE \"Nombre\" = 'Básico'");
            migrationBuilder.Sql(
                "UPDATE \"Planes\" SET \"PrecioMensual\" = 449, \"MaxEmpleados\" = 3 WHERE \"Nombre\" = 'Pro'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmpleadosExtra",
                table: "Negocios");
        }
    }
}
