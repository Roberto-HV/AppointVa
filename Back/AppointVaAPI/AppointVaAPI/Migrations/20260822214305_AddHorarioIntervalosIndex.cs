using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddHorarioIntervalosIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_HorariosNegocios_NegocioId",
                table: "HorariosNegocios");

            migrationBuilder.DropIndex(
                name: "IX_HorariosEmpleados_EmpleadoId",
                table: "HorariosEmpleados");

            migrationBuilder.CreateIndex(
                name: "IX_HorariosNegocios_NegocioId_DiaSemana",
                table: "HorariosNegocios",
                columns: new[] { "NegocioId", "DiaSemana" });

            migrationBuilder.CreateIndex(
                name: "IX_HorariosEmpleados_EmpleadoId_DiaSemana",
                table: "HorariosEmpleados",
                columns: new[] { "EmpleadoId", "DiaSemana" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_HorariosNegocios_NegocioId_DiaSemana",
                table: "HorariosNegocios");

            migrationBuilder.DropIndex(
                name: "IX_HorariosEmpleados_EmpleadoId_DiaSemana",
                table: "HorariosEmpleados");

            migrationBuilder.CreateIndex(
                name: "IX_HorariosNegocios_NegocioId",
                table: "HorariosNegocios",
                column: "NegocioId");

            migrationBuilder.CreateIndex(
                name: "IX_HorariosEmpleados_EmpleadoId",
                table: "HorariosEmpleados",
                column: "EmpleadoId");
        }
    }
}
