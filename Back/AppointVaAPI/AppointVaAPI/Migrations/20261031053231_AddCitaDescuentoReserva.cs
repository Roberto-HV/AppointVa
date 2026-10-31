using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddCitaDescuentoReserva : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodigoDescuento",
                table: "Citas",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DescuentoPorcentaje",
                table: "Citas",
                type: "numeric(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrecioLista",
                table: "Citas",
                type: "numeric(10,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CodigoDescuento",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "DescuentoPorcentaje",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "PrecioLista",
                table: "Citas");
        }
    }
}
