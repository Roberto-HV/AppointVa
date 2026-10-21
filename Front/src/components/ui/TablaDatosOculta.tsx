interface Props {
  /** Describe la gráfica a la que acompaña, p. ej. "Ingresos por día". */
  titulo: string;
  columnas: [string, string];
  filas: [string, string][];
}

/**
 * Los mismos datos de una gráfica como tabla, solo para lectores de pantalla:
 * las barras no tienen alternativa de texto.
 */
export default function TablaDatosOculta({ titulo, columnas, filas }: Props) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <thead>
        <tr>
          <th scope="col">{columnas[0]}</th>
          <th scope="col">{columnas[1]}</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(([etiqueta, valor], i) => (
          <tr key={`${etiqueta}-${i}`}>
            <th scope="row">{etiqueta}</th>
            <td>{valor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
