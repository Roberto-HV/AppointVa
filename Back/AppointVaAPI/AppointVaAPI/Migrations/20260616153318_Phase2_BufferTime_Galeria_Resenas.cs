using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class Phase2_BufferTime_Galeria_Resenas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BufferMinutos",
                table: "Servicios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Resenas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NegocioId = table.Column<Guid>(type: "uuid", nullable: false),
                    CitaId = table.Column<Guid>(type: "uuid", nullable: true),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Comentario = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    NombreCliente = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Token = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Respondida = table.Column<bool>(type: "boolean", nullable: false),
                    Aprobada = table.Column<bool>(type: "boolean", nullable: false),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaExpiracion = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Resenas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Resenas_Citas_CitaId",
                        column: x => x.CitaId,
                        principalTable: "Citas",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Resenas_Negocios_NegocioId",
                        column: x => x.NegocioId,
                        principalTable: "Negocios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Resenas_CitaId",
                table: "Resenas",
                column: "CitaId");

            migrationBuilder.CreateIndex(
                name: "IX_Resenas_NegocioId_Aprobada",
                table: "Resenas",
                columns: new[] { "NegocioId", "Aprobada" });

            migrationBuilder.CreateIndex(
                name: "IX_Resenas_Token",
                table: "Resenas",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Resenas");

            migrationBuilder.DropColumn(
                name: "BufferMinutos",
                table: "Servicios");
        }
    }
}
