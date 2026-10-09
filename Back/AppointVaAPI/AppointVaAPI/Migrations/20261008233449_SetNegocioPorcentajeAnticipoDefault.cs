using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AppointVaAPI.Migrations
{
    /// <inheritdoc />
    public partial class SetNegocioPorcentajeAnticipoDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // La columna nacía en 0, un valor fuera de su propio rango: el panel sólo
            // permite elegir entre 10% y 80%. Ese 0 heredado hacía que el formulario de
            // perfil se rechazara por completo en cualquier negocio que nunca activó
            // anticipos. Se alinea el default con el piso del deslizador.
            migrationBuilder.Sql("ALTER TABLE \"Negocios\" ALTER COLUMN \"PorcentajeAnticipo\" SET DEFAULT 10;");

            // Se corrigen las filas ya guardadas con el default ilegal. Con anticipos
            // apagados el valor es inerte; con anticipos encendidos la configuración ya
            // era inválida (0% de anticipo no cobra nada) y 10% es el mínimo del panel.
            migrationBuilder.Sql("UPDATE \"Negocios\" SET \"PorcentajeAnticipo\" = 10 WHERE \"PorcentajeAnticipo\" = 0;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Negocios\" ALTER COLUMN \"PorcentajeAnticipo\" SET DEFAULT 0;");

            // Las filas no se revierten: un 10 corregido es indistinguible de un 10
            // elegido por el negocio, y devolverlas a 0 reintroduciría el valor ilegal.
        }
    }
}
