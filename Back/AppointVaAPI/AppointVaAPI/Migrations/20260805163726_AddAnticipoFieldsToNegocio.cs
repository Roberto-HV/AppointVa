using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAnticipoFieldsToNegocio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HorasCancelacionConReembolso",
                table: "Negocios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PoliticaCancelacionAnticipo",
                table: "Negocios",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "PorcentajeAnticipo",
                table: "Negocios",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HorasCancelacionConReembolso",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "PoliticaCancelacionAnticipo",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "PorcentajeAnticipo",
                table: "Negocios");
        }
    }
}
