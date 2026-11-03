import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { SuscripcionResumenDto } from "../../../api/admin";
import { formatFecha } from "../../../utils/formatters";
import { DIAS_DE_POR_VIDA, formatVigencia } from "./formatoSuscripcion";

export default function BadgeSuscripcion({
  estado,
  dias,
  vence,
  conPlan = false,
}: {
  estado: SuscripcionResumenDto["estado"];
  dias: number | null;
  /** Fecha de vencimiento ISO; alimenta el `title` con el dato exacto. */
  vence?: string | null;
  /**
   * Tiene un plan asignado. Sin pago, "Pro" junto a "Sin suscripción" no dejaba
   * claro si el negocio paga (G3): se dice "Sin pago registrado", en ámbar.
   */
  conPlan?: boolean;
}) {
  const titulo = vence ? `Vence el ${formatFecha(vence)}` : undefined;

  if (estado === "Activa") {
    const permanente = dias !== null && dias >= DIAS_DE_POR_VIDA;
    return (
      <span
        title={permanente ? "Acceso permanente — sin vencimiento" : titulo}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        <CheckCircle size={10} aria-hidden="true" />
        {permanente ? "De por vida" : `Activa${dias !== null ? ` · ${formatVigencia(dias)}` : ""}`}
      </span>
    );
  }
  if (estado === "PorVencer") {
    return (
      <span
        title={titulo}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <AlertTriangle size={10} aria-hidden="true" />
        {dias !== null && dias <= 0 ? "Vence hoy" : `Vence en ${dias} d`}
      </span>
    );
  }
  if (estado === "Vencida") {
    return (
      <span
        title={titulo}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
      >
        <XCircle size={10} aria-hidden="true" /> Vencida
      </span>
    );
  }
  if (conPlan) {
    return (
      <span
        title="Tiene un plan asignado, pero no hay un pago que lo cubra: no cuenta en el ingreso"
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <Clock size={10} aria-hidden="true" /> Sin pago registrado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      <Clock size={10} aria-hidden="true" /> Sin suscripción
    </span>
  );
}
