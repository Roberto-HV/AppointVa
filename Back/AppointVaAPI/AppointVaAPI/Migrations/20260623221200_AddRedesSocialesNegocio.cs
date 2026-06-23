using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddRedesSocialesNegocio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FacebookUrl",
                table: "Negocios",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InstagramUrl",
                table: "Negocios",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TiktokUrl",
                table: "Negocios",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FacebookUrl",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "InstagramUrl",
                table: "Negocios");

            migrationBuilder.DropColumn(
                name: "TiktokUrl",
                table: "Negocios");
        }
    }
}
