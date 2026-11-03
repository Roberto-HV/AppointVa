import { AlertTriangle } from "lucide-react";
import { MOTIVOS_ATENCION, type MotivoAtencion } from "../../../utils/negociosAdmin";

/** Tono del contador: rojo lo que ya se perdió (vencidas), ámbar lo que espera. */
const TONO: Record<MotivoAtencion, string> = {
  vencidas: "text-red-700 dark:text-red-400",
  pendientes: "text-amber-700 dark:text-amber-400",
  porVencer: "text-amber-700 dark:text-amber-400",
  sinPago: "text-amber-700 dark:text-amber-400",
  correoSinVerificar: "text-slate-700 dark:text-slate-300",
};

/**
 * "Requiere atención" (lote 4, I7): lo que el SuperAdmin tiene que resolver hoy,
 * con un contador por motivo. Cada contador filtra la lista; pulsarlo otra vez
 * quita el filtro. Solo aparecen los motivos con algo pendiente, y si no hay
 * nada la franja no ocupa lugar: un "0" en ámbar no es un aviso.
 */
export default function FranjaAtencion({
  conteos,
  activo,
  onCambiar,
}: {
  conteos: Record<MotivoAtencion, number>;
  activo: MotivoAtencion | "";
  onCambiar: (motivo: MotivoAtencion | "") => void;
}) {
  const visibles = MOTIVOS_ATENCION.filter((m) => conteos[m.id] > 0 || m.id === activo);
  if (visibles.length === 0) return null;

  return (
    <section
      aria-labelledby="titulo-requiere-atencion"
      className="mb-4 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/60 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
    >
      <h2 id="titulo-requiere-atencion" className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 shrink-0 sm:pr-1">
        <AlertTriangle size={14} aria-hidden="true" /> Requiere atención
      </h2>
      {/* En el teléfono, una fila que se desliza de lado: envueltos, cinco
          contadores de 44px ocupaban más que la primera tarjeta. */}
      <ul className="flex gap-1.5 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibles.map((m) => {
          const pulsado = activo === m.id;
          return (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={pulsado}
                title={m.descripcion}
                onClick={() => onCambiar(pulsado ? "" : m.id)}
                className={`inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[32px] px-3 rounded-full border text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 ${
                  pulsado
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
                }`}
              >
                <span className={`font-bold tabular-nums ${pulsado ? "" : TONO[m.id]}`}>{conteos[m.id]}</span>
                {/* El espacio separa cifra y motivo para el lector ("3 Por vencer"). */}
                {" "}{m.etiqueta}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
