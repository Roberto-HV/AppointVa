using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class Phase3_ListaEspera_Intake : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CamposIntake",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NegocioId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServicioId = table.Column<Guid>(type: "uuid", nullable: true),
                    Etiqueta = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Opciones = table.Column<string>(type: "text", nullable: true),
                    Requerido = table.Column<bool>(type: "boolean", nullable: false),
                    Orden = table.Column<int>(type: "integer", nullable: false),
                    Activo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CamposIntake", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CamposIntake_Negocios_NegocioId",
                        column: x => x.NegocioId,
                        principalTable: "Negocios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CamposIntake_Servicios_ServicioId",
                        column: x => x.ServicioId,
                        principalTable: "Servicios",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ListaEspera",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NegocioId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServicioId = table.Column<Guid>(type: "uuid", nullable: true),
                    EmpleadoId = table.Column<Guid>(type: "uuid", nullable: true),
                    NombreCliente = table.Column<string>(type: "text", nullable: false),
                    TelefonoCliente = table.Column<string>(type: "text", nullable: false),
                    EmailCliente = table.Column<string>(type: "text", nullable: true),
                    FechaPreferida = table.Column<DateTime>(type: "timestamp without time zone", nullable: true),
                    Estado = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FechaCreacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    FechaNotificacion = table.Column<DateTime>(type: "timestamp without time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListaEspera", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListaEspera_Empleados_EmpleadoId",
                        column: x => x.EmpleadoId,
                        principalTable: "Empleados",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ListaEspera_Negocios_NegocioId",
                        column: x => x.NegocioId,
                        principalTable: "Negocios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ListaEspera_Servicios_ServicioId",
                        column: x => x.ServicioId,
                        principalTable: "Servicios",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "RespuestasIntake",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CitaId = table.Column<Guid>(type: "uuid", nullable: false),
                    CampoIntakeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Valor = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RespuestasIntake", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RespuestasIntake_CamposIntake_CampoIntakeId",
                        column: x => x.CampoIntakeId,
                        principalTable: "CamposIntake",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RespuestasIntake_Citas_CitaId",
                        column: x => x.CitaId,
                        principalTable: "Citas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CamposIntake_NegocioId",
                table: "CamposIntake",
                column: "NegocioId");

            migrationBuilder.CreateIndex(
                name: "IX_CamposIntake_ServicioId",
                table: "CamposIntake",
                column: "ServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_ListaEspera_EmpleadoId",
                table: "ListaEspera",
                column: "EmpleadoId");

            migrationBuilder.CreateIndex(
                name: "IX_ListaEspera_NegocioId_Estado",
                table: "ListaEspera",
                columns: new[] { "NegocioId", "Estado" });

            migrationBuilder.CreateIndex(
                name: "IX_ListaEspera_ServicioId",
                table: "ListaEspera",
                column: "ServicioId");

            migrationBuilder.CreateIndex(
                name: "IX_RespuestasIntake_CampoIntakeId",
                table: "RespuestasIntake",
                column: "CampoIntakeId");

            migrationBuilder.CreateIndex(
                name: "IX_RespuestasIntake_CitaId",
                table: "RespuestasIntake",
                column: "CitaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListaEspera");

            migrationBuilder.DropTable(
                name: "RespuestasIntake");

            migrationBuilder.DropTable(
                name: "CamposIntake");
        }
    }
}
