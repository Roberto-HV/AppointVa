using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddSectorToNegocio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Sector",
                table: "Negocios",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "belleza");

            migrationBuilder.Sql("ALTER TABLE \"Negocios\" ADD CONSTRAINT \"CK_Negocios_Sector\" CHECK (\"Sector\" IN ('belleza', 'salud'));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Negocios\" DROP CONSTRAINT IF EXISTS \"CK_Negocios_Sector\";");

            migrationBuilder.DropColumn(
                name: "Sector",
                table: "Negocios");
        }
    }
}
