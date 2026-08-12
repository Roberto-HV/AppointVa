using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class BugFixes_HangfireJobId_Indexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Negocios_Slug",
                table: "Negocios");

            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes");

            migrationBuilder.AddColumn<string>(
                name: "HangfireJobId",
                table: "Citas",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Negocios_Slug",
                table: "Negocios",
                column: "Slug",
                unique: true,
                filter: "\"FechaEliminacion\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes",
                columns: new[] { "NegocioId", "Telefono" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Negocios_Slug",
                table: "Negocios");

            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes");

            migrationBuilder.DropColumn(
                name: "HangfireJobId",
                table: "Citas");

            migrationBuilder.CreateIndex(
                name: "IX_Negocios_Slug",
                table: "Negocios",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes",
                columns: new[] { "NegocioId", "Telefono" });
        }
    }
}
