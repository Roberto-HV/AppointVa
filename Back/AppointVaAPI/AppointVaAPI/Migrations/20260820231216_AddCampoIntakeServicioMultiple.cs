using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddCampoIntakeServicioMultiple : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CampoIntakeServicios",
                columns: table => new
                {
                    CampoIntakeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServicioId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampoIntakeServicios", x => new { x.CampoIntakeId, x.ServicioId });
                    table.ForeignKey(
                        name: "FK_CampoIntakeServicios_CamposIntake_CampoIntakeId",
                        column: x => x.CampoIntakeId,
                        principalTable: "CamposIntake",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CampoIntakeServicios_Servicios_ServicioId",
                        column: x => x.ServicioId,
                        principalTable: "Servicios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampoIntakeServicios_ServicioId",
                table: "CampoIntakeServicios",
                column: "ServicioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampoIntakeServicios");
        }
    }
}
