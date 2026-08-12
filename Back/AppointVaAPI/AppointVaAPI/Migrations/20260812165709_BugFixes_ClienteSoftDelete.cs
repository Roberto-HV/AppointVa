using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class BugFixes_ClienteSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Email",
                table: "Clientes");

            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes");

            migrationBuilder.AddColumn<DateTime>(
                name: "FechaEliminacion",
                table: "Clientes",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Email",
                table: "Clientes",
                columns: new[] { "NegocioId", "Email" },
                filter: "\"FechaEliminacion\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes",
                columns: new[] { "NegocioId", "Telefono" },
                unique: true,
                filter: "\"FechaEliminacion\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Email",
                table: "Clientes");

            migrationBuilder.DropIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes");

            migrationBuilder.DropColumn(
                name: "FechaEliminacion",
                table: "Clientes");

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Email",
                table: "Clientes",
                columns: new[] { "NegocioId", "Email" });

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_NegocioId_Telefono",
                table: "Clientes",
                columns: new[] { "NegocioId", "Telefono" },
                unique: true);
        }
    }
}
