using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAnticipoFieldsToCita : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "HorasCancelacionConReembolso",
                table: "Negocios",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 24);

            migrationBuilder.AddColumn<bool>(
                name: "AnticipoRecibido",
                table: "Citas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "AnticipoRecibidoEn",
                table: "Citas",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AnticipoRecibidoPorId",
                table: "Citas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AnticipoRecibidoPorNombre",
                table: "Citas",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AnticipoRequerido",
                table: "Citas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "MontoAnticipo",
                table: "Citas",
                type: "numeric(10,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnticipoRecibido",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "AnticipoRecibidoEn",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "AnticipoRecibidoPorId",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "AnticipoRecibidoPorNombre",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "AnticipoRequerido",
                table: "Citas");

            migrationBuilder.DropColumn(
                name: "MontoAnticipo",
                table: "Citas");

            migrationBuilder.AlterColumn<int>(
                name: "HorasCancelacionConReembolso",
                table: "Negocios",
                type: "integer",
                nullable: false,
                defaultValue: 24,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
