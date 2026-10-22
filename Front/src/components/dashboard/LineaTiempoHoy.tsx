import type { CitaDto } from "../../types";
import { citaAbierta, estiloEstadoCita } from "../../lib/estadoCita";
import { formatHoraDe } from "../../utils/formatters";
import { HORA_MS, asignarCarriles, rangoLinea } from "../../lib/lineaTiempo";

type CitaLinea = Pick<CitaDto, "id" | "inicioEn" | "finEn" | "estadoTexto" | "nombreServicio" | "nombreCliente">;

interface Props {
  citas: CitaLinea[];
  /** La hora actual; la da quien la renderiza (EncabezadoHoy) para que la frase y la aguja coincidan. */
  ahora: Date;
}

/** Alto de un sub-carril y separación entre carriles, en px. */
const ALTO_CARRIL = 28;
const SEPARACION = 2;
const RELLENO = 4;

/** Etiqueta corta del eje: "9", "12", "5" (12 h, sin a. m./p. m.). */
function etiquetaEje(t: number): string {
  const h = new Date(t).getHours() % 12;
  return String(h === 0 ? 12 : h);
}

/**
 * Tira horizontal del día con la hora actual como aguja. Las citas que se
 * traslapan van en sub-carriles (hasta 3; más allá, un "+N"). Cada cita es un
 * elemento de la lista con su texto completo para lectores de pantalla, aun las
 * que no caben a la vista; la tira visual (eje y aguja) va oculta para ellos.
 */
export default function LineaTiempoHoy({ citas, ahora }: Props) {
  const visibles = citas.filter((c) => c.estadoTexto !== "Cancelada");
  const rango = rangoLinea(visibles);
  if (!rango) return null;

  const { asignadas, carriles, ocultas } = asignarCarriles(visibles);
  const altoTira = RELLENO * 2 + carriles * ALTO_CARRIL + (carriles - 1) * SEPARACION;
  const span = rango.fin - rango.inicio;
  const pct = (t: number) => ((t - rango.inicio) / span) * 100;
  const horas: number[] = [];
  const paso = span > 8 * HORA_MS ? 2 * HORA_MS : HORA_MS;
  for (let t = rango.inicio; t <= rango.fin; t += paso) horas.push(t);
  const tAhora = ahora.getTime();
  const agujaVisible = tAhora >= rango.inicio && tAhora <= rango.fin;
  const primeraOculta = asignadas.find((a) => a.carril === null)?.cita;

  return (
    <section aria-label="Línea de tiempo de hoy" className="mt-5">
      <div className="relative">
        <ol className="relative rounded-lg bg-muted" style={{ height: altoTira }} aria-label="Citas de hoy en orden">
          {asignadas.map(({ cita: c, carril }) => {
            const inicio = new Date(c.inicioEn);
            const fin = new Date(c.finEn);
            const estilo = estiloEstadoCita(c.estadoTexto);
            const textoLector = `${formatHoraDe(inicio)} a ${formatHoraDe(fin)}: ${c.nombreServicio}${c.nombreCliente ? ` con ${c.nombreCliente}` : ""}, ${estilo.etiqueta.toLowerCase()}`;
            // Sin carril: no cabe a la vista, pero sigue en la lista para lectores.
            if (carril === null) {
              return (
                <li key={c.id} data-testid="bloque-linea" data-carril="oculto" className="sr-only">
                  {textoLector}
                </li>
              );
            }
            const pasada = fin.getTime() <= tAhora && !citaAbierta(c.estadoTexto);
            const izquierda = pct(inicio.getTime());
            const ancho = Math.max(pct(fin.getTime()) - izquierda, 1.5);
            return (
              <li
                key={c.id}
                data-testid="bloque-linea"
                data-carril={carril}
                className={`absolute rounded-md overflow-hidden ring-1 ring-card ${estilo.bloque} ${pasada ? "opacity-60" : ""}`}
                style={{
                  left: `${izquierda}%`,
                  width: `${ancho}%`,
                  top: RELLENO + carril * (ALTO_CARRIL + SEPARACION),
                  height: ALTO_CARRIL,
                }}
              >
                <span aria-hidden="true" className="block truncate px-1.5 text-[11px] font-medium leading-7">
                  {c.nombreServicio}
                </span>
                <span className="sr-only">{textoLector}</span>
              </li>
            );
          })}
        </ol>

        {ocultas > 0 && primeraOculta && (
          <span
            data-testid="mas-citas"
            aria-hidden="true"
            className="absolute -translate-x-1/2 rounded-full bg-card px-1.5 text-[11px] font-semibold leading-4 text-foreground shadow-card tabular-nums"
            style={{ left: `${Math.min(pct(new Date(primeraOculta.inicioEn).getTime()), 96)}%`, top: -8 }}
          >
            +{ocultas}
          </span>
        )}

        {agujaVisible && (
          <div
            data-testid="aguja-ahora"
            aria-hidden="true"
            className="pointer-events-none absolute -top-1.5 -bottom-1.5 w-0.5 -translate-x-1/2 rounded-full bg-accent-brand"
            style={{ left: `${pct(tAhora)}%` }}
          >
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent-brand" />
          </div>
        )}
      </div>

      <div aria-hidden="true" className="relative mt-1.5 h-4 text-[11px] text-muted-foreground tabular-nums">
        {horas.map((t, i) => (
          <span
            key={t}
            className={`absolute ${i === 0 ? "" : i === horas.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${pct(t)}%` }}
          >
            {etiquetaEje(t)}
          </span>
        ))}
      </div>
      {agujaVisible && <p className="sr-only">{`Ahora son las ${formatHoraDe(ahora)}.`}</p>}
    </section>
  );
}
