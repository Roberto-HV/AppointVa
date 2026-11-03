import type { NegocioMetricasDto } from "../../../api/admin";
import ErrorCarga from "../../../components/ui/ErrorCarga";
import { SkeletonKpis } from "../../../components/ui/Skeleton";
import { formatPrecio } from "../../../utils/formatters";
import type { ResumenFacturacion } from "../../../utils/negociosAdmin";

/**
 * Tira de KPIs de Negocios y de Facturación. Mientras carga, el skeleton ocupa
 * su lugar para que la página no salte al llegar los datos (I5); si falla, el
 * error con "Reintentar" en vez de cifras en cero.
 */
export default function KpisNegocios({
  metricas,
  resumen,
  error,
  cargando,
  reintentando,
  onReintentar,
}: {
  metricas: NegocioMetricasDto[];
  resumen: ResumenFacturacion;
  error: boolean;
  cargando: boolean;
  reintentando: boolean;
  onReintentar: () => void;
}) {
  if (error) {
    return (
      <ErrorCarga
        className="mb-5 py-6"
        mensaje="No se pudieron cargar las métricas del panel."
        onReintentar={onReintentar}
        reintentando={reintentando}
      />
    );
  }
  if (cargando) return <div className="mb-5"><SkeletonKpis /></div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {[
        { label: "Total", value: String(metricas.length), color: "text-slate-700 dark:text-slate-200" },
        { label: "Activos", value: String(metricas.filter(n => n.activo === 1).length), color: "text-emerald-600 dark:text-emerald-400" },
        // Plan asignado ≠ suscripción pagada (G3): la cifra es la que paga, y
        // el pie dice cuántos tienen plan, para que "Pro" sin pago no se
        // lea como ingreso.
        {
          label: "Con suscripción vigente",
          value: String(resumen.conSuscripcionVigente),
          nota: `de ${resumen.conPlanAsignado} con plan asignado`,
          color: "text-amber-600 dark:text-amber-400",
        },
        {
          label: "Ingreso mensual",
          value: formatPrecio(resumen.ingresoMensual) + "/mes",
          nota: "solo suscripciones vigentes",
          color: "text-slate-900 dark:text-slate-100",
        },
      ].map(({ label, value, nota, color }) => (
        <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3 min-w-0">
          <p className="text-xs text-slate-400 dark:text-slate-400 mb-0.5 truncate">{label}</p>
          <p className={`text-lg font-bold truncate tabular-nums ${color}`}>{value}</p>
          {nota && <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 tabular-nums">{nota}</p>}
        </div>
      ))}
    </div>
  );
}
