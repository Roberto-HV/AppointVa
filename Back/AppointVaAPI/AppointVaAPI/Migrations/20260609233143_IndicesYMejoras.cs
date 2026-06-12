using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class IndicesYMejoras : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId",
                table: "Clientes");

            migrationBuilder.DropIndex(
                name: "IX_Citas_EmpleadoId",
                table: "Citas");

            migrationBuilder.DropIndex(
                name: "IX_Citas_NegocioId",
                table: "Citas");

            migrationBuilder.CreateIndex(
                name: "IX_Negocios_Slug",
                table: "Negocios",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Email",
                table: "Clientes",
                columns: new[] { "NegocioId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes",
                columns: new[] { "NegocioId", "Telefono" });

            migrationBuilder.CreateIndex(
                name: "IX_Citas_CodigoConfirmacion",
                table: "Citas",
                column: "CodigoConfirmacion",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Citas_EmpleadoId_InicioEn",
                table: "Citas",
                columns: new[] { "EmpleadoId", "InicioEn" });

            migrationBuilder.CreateIndex(
                name: "IX_Citas_NegocioId_InicioEn",
                table: "Citas",
                columns: new[] { "NegocioId", "InicioEn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Negocios_Slug",
                table: "Negocios");

            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Email",
                table: "Clientes");

            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes");

            migrationBuilder.DropIndex(
                name: "IX_Citas_CodigoConfirmacion",
                table: "Citas");

            migrationBuilder.DropIndex(
                name: "IX_Citas_EmpleadoId_InicioEn",
                table: "Citas");

            migrationBuilder.DropIndex(
                name: "IX_Citas_NegocioId_InicioEn",
                table: "Citas");

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId",
                table: "Clientes",
                column: "NegocioId");

            migrationBuilder.CreateIndex(
                name: "IX_Citas_EmpleadoId",
                table: "Citas",
                column: "EmpleadoId");

            migrationBuilder.CreateIndex(
                name: "IX_Citas_NegocioId",
                table: "Citas",
                column: "NegocioId");
        }
    }
}
