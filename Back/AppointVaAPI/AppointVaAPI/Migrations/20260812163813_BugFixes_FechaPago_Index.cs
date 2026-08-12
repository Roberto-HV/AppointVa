using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class BugFixes_FechaPago_Index : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Citas_FechaPago",
                table: "Citas",
                column: "FechaPago");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Citas_FechaPago",
                table: "Citas");
        }
    }
}
