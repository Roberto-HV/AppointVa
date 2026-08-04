using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddCierreCaja : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CierresCaja",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NegocioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fecha = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    EfectivoInicial = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    EfectivoContado = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    RetirosJson = table.Column<string>(type: "text", nullable: false),
                    CerradoEn = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    CerradoPorId = table.Column<Guid>(type: "uuid", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaActualizacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CierresCaja", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CierresCaja_AspNetUsers_CerradoPorId",
                        column: x => x.CerradoPorId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CierresCaja_Negocios_NegocioId",
                        column: x => x.NegocioId,
                        principalTable: "Negocios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CierresCaja_CerradoPorId",
                table: "CierresCaja",
                column: "CerradoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_CierresCaja_NegocioId_Fecha",
                table: "CierresCaja",
                columns: new[] { "NegocioId", "Fecha" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CierresCaja");
        }
    }
}
