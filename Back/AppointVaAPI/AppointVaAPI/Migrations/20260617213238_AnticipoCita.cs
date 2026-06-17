using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AnticipoCita : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InstruccionesAnticipo",
                table: "Negocios",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MontoAnticipo",
                table: "Negocios",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "RequiereAnticipo",
                table: "Negocios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ComprobanteUrl",
                table: "Citas",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InstruccionesAnticipo",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "MontoAnticipo",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "RequiereAnticipo",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "ComprobanteUrl",
                table: "Citas");
        }
    }
}
