import { estiloEstadoCita } from "../../lib/estadoCita";

// Colores, icono y etiqueta salen de `src/lib/estadoCita.ts` (tokens --status-*),
// igual que en el detalle, el calendario, el Gantt y el modo recepción.
export default function EstadoBadge({ estado }: { estado: string }) {
  const { badge, Icono, etiqueta } = estiloEstadoCita(estado);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge}`}>
      <Icono size={12} className="shrink-0" aria-hidden="true" />
      {etiqueta}
    </span>
  );
}
