import type { ReactNode } from "react";
import type { CitaDto } from "../../types";
import { fraseDeHoy, saludoConNombre, type ProximaFrase, type TerminosFrase } from "../../lib/fraseHoy";
import { useAhora } from "../../hooks/useAhora";
import LineaTiempoHoy from "./LineaTiempoHoy";
import BotonCopiarEnlace from "./BotonCopiarEnlace";

interface Props {
  nombre: string;
  /** Citas de hoy; `undefined` mientras cargan o si fallaron. */
  citasHoy?: CitaDto[];
  terminos: TerminosFrase;
  bookingUrl: string;
  /** Próximas citas del resumen: si hoy ya no queda nada, se anuncia la de mañana (≤ 24 h). */
  proximasCitas?: ProximaFrase[];
  /** Para pruebas; sin él, la hora se renueva cada minuto (frase y línea de tiempo a la vez). */
  ahora?: Date;
  /** Algo que va junto al nombre del negocio (p. ej. "Ver guía de inicio"). */
  pie?: ReactNode;
  nombreNegocio?: string;
}

/**
 * Encabezado del Inicio: una oración compuesta con el saludo y el día, y debajo
 * la tira de tiempo de hoy (o, en un día libre, el enlace para compartir).
 * La oración usa la cara display (salud la vuelve Inter desde index.css).
 */
export default function EncabezadoHoy({ nombre, citasHoy, proximasCitas, terminos, bookingUrl, ahora, pie, nombreNegocio }: Props) {
  // Un solo reloj para la oración y la aguja: nunca dicen horas distintas.
  const momento = useAhora(ahora);
  const trozos = citasHoy ? fraseDeHoy(citasHoy, momento, terminos, proximasCitas) : [];
  const diaLibre = !!citasHoy && citasHoy.every((c) => c.estadoTexto === "Cancelada");

  return (
    <header className="mb-6">
      <h1 className="font-display text-2xl sm:text-[1.75rem] leading-snug font-normal tracking-[-0.015em] text-foreground max-w-3xl text-pretty">
        <span>{saludoConNombre(nombre, momento)}</span>
        {trozos.length > 0 && " "}
        {trozos.map((t, i) =>
          t.enfasis
            ? <strong key={i} className="font-semibold">{t.texto}</strong>
            : <span key={i}>{t.texto}</span>
        )}
      </h1>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground">{nombreNegocio ?? "Tu negocio"}</p>
        {pie}
      </div>

      {diaLibre ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-foreground">Comparte tu enlace y llénala.</p>
          <BotonCopiarEnlace url={bookingUrl} />
        </div>
      ) : citasHoy ? (
        <LineaTiempoHoy citas={citasHoy} ahora={momento} />
      ) : null}
    </header>
  );
}
