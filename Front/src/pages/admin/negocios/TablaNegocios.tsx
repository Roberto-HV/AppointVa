import type { MouseEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, CreditCard, Eye, MailCheck, Palette, Power, Trash2, UserPlus, ExternalLink } from "lucide-react";
import type { NegocioMetricasDto, SuscripcionResumenDto } from "../../../api/admin";
import MenuAcciones from "../../../components/ui/MenuAcciones";
import { formatFechaCorta } from "../../../utils/formatters";
import { nombrePlan, type ColumnaNegocios, type DireccionOrden } from "../../../utils/negociosAdmin";
import { rutaNegocioAdmin } from "../../../layouts/rutasAdmin";
import BadgeSuscripcion from "./BadgeSuscripcion";
import LogoNegocio from "./LogoNegocio";
import { EstadoNegocio } from "./TarjetaNegocio";
import { textoVence } from "./formatoSuscripcion";
import type { AccionesNegocio } from "./useAccionesNegocio";

// Padding horizontal corto: con diez columnas, 1440px con el menú lateral deja
// unos 1,130px y la columna de "⋯" no debe quedar fuera.
const TH = "px-2.5 first:pl-4 last:pr-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap";
const TD = "px-2.5 first:pl-4 last:pr-4 py-2 align-middle";

/**
 * Lista de negocios como tabla densa (lote 4, I1), la vista de escritorio. Una
 * fila mide unos 52px contra los ~500px de una tarjeta: con 30 negocios la
 * página pasa de ~3,100px a caber en una pantalla. Las columnas con dato
 * comparable se ordenan; la fila entera lleva a la ficha, y las acciones van en
 * "⋯", las mismas de la tarjeta.
 */
export default function TablaNegocios({
  negocios,
  suscripcionDe,
  columna,
  direccion,
  onOrdenar,
  acciones,
  pie,
}: {
  negocios: NegocioMetricasDto[];
  suscripcionDe: (id: string) => SuscripcionResumenDto | undefined;
  /** Columna de orden, o null con el orden de siempre (pendientes primero). */
  columna: ColumnaNegocios | null;
  direccion: DireccionOrden;
  onOrdenar: (columna: ColumnaNegocios) => void;
  acciones: AccionesNegocio;
  pie?: ReactNode;
}) {
  const navigate = useNavigate();

  /** `visible` acorta el rótulo a la vista; `texto` sigue siendo el nombre accesible. */
  const encabezado = (id: ColumnaNegocios, texto: string, alinear: "left" | "right" = "left", visible = texto) => {
    const activa = columna === id;
    const Icono = !activa ? ArrowUpDown : direccion === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={activa ? (direccion === "asc" ? "ascending" : "descending") : "none"}
        // El encabezado nombra la columna de cada celda: con rótulo corto, el completo.
        aria-label={visible !== texto ? texto : undefined}
        className={`${TH} ${alinear === "right" ? "text-right" : "text-left"}`}
      >
        <button
          type="button"
          aria-label={visible !== texto ? texto : undefined}
          title={visible !== texto ? texto : undefined}
          onClick={() => onOrdenar(id)}
          className={`inline-flex items-center gap-1 -mx-1.5 px-1.5 min-h-[32px] rounded-md hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 ${
            activa ? "text-slate-900 dark:text-slate-100" : ""
          } ${alinear === "right" ? "flex-row-reverse" : ""}`}
        >
          {visible}
          <Icono size={12} aria-hidden="true" className={activa ? "" : "opacity-40"} />
        </button>
      </th>
    );
  };

  // La fila entera abre la ficha; los enlaces y botones de dentro hacen lo suyo.
  const alPulsarFila = (e: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((e.target as HTMLElement).closest("a, button, input, [role='dialog']")) return;
    navigate(rutaNegocioAdmin(id));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Negocios. Las columnas con botón se pueden ordenar.</caption>
          <thead className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700">
            <tr>
              {encabezado("nombre", "Negocio")}
              {encabezado("propietario", "Propietario")}
              {encabezado("plan", "Plan")}
              {encabezado("suscripcion", "Suscripción")}
              {encabezado("vence", "Vence")}
              {encabezado("citas", "Citas del mes", "right", "Citas")}
              {encabezado("empleados", "Empleados", "right", "Emp.")}
              {encabezado("estado", "Estado")}
              {encabezado("alta", "Alta")}
              <th scope="col" className={TH}><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {negocios.map((n) => {
              const s = suscripcionDe(n.id);
              const vence = s ? textoVence(s) : "—";
              return (
                <tr
                  key={n.id}
                  onClick={(e) => alPulsarFila(e, n.id)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <td className={TD}>
                    <div className="flex items-center gap-2.5 min-w-[11rem]">
                      <LogoNegocio negocio={n} tamano="sm" />
                      <div className="min-w-0">
                        <Link
                          to={rutaNegocioAdmin(n.id)}
                          className="block max-w-[16rem] truncate font-medium text-slate-900 dark:text-slate-100 hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
                        >
                          {n.nombre}
                        </Link>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="truncate max-w-[12rem]">{n.slug}</span>
                          {n.esTester && (
                            <span className="text-[10px] font-semibold px-1.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">Tester</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={TD}>
                    {n.propietarioEmail ? (
                      <div className="min-w-0 max-w-[12rem]">
                        {n.propietarioNombre && (
                          <p className="truncate text-slate-800 dark:text-slate-200">{n.propietarioNombre}</p>
                        )}
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={n.propietarioEmail}>
                          {n.propietarioEmail}
                        </p>
                        {n.emailConfirmado === false && (
                          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Correo sin verificar</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">Sin propietario</span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-slate-700 dark:text-slate-300`}>
                    {n.planNombre ? nombrePlan(n.planNombre) : <span className="text-slate-400 dark:text-slate-500">Sin plan</span>}
                  </td>
                  <td className={TD}>
                    {s ? (
                      <BadgeSuscripcion estado={s.estado} dias={s.diasRestantes} vence={s.fechaVencimiento} conPlan={!!s.planNombre} />
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400`}>{vence}</td>
                  <td className={`${TD} text-right whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300`}>
                    {n.citasMes}
                    {n.maxCitasMes > 0 && <span className="text-xs text-slate-400 dark:text-slate-500"> / {n.maxCitasMes}</span>}
                  </td>
                  <td className={`${TD} text-right whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300`}>
                    {n.empleadosActivos}
                    {n.maxEmpleados > 0 && <span className="text-xs text-slate-400 dark:text-slate-500"> / {n.maxEmpleados}</span>}
                  </td>
                  <td className={TD}><EstadoNegocio negocio={n} corto /></td>
                  <td className={`${TD} whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400`}>
                    {n.fechaCreacion ? formatFechaCorta(n.fechaCreacion) : "—"}
                  </td>
                  <td className={`${TD} text-right`}>
                    <MenuAcciones
                      etiqueta={`Acciones de ${n.nombre}`}
                      acciones={accionesDeFila(n, acciones, () => navigate(rutaNegocioAdmin(n.id)))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pie}
    </div>
  );
}

/** Las acciones de la tarjeta, en el "⋯" de la fila, más "Ver ficha" al principio. */
function accionesDeFila(n: NegocioMetricasDto, acciones: AccionesNegocio, verFicha: () => void) {
  const esActivo = n.activo === 1;
  const cambiando = acciones.cambiandoEstado(n.id);
  return [
    { id: "ficha", etiqueta: "Ver ficha", Icono: Eye, onSelect: verFicha },
    { id: "suscripcion", etiqueta: "Suscripción", Icono: CreditCard, onSelect: () => acciones.abrirSuscripcion(n) },
    { id: "propietario", etiqueta: "Propietario", Icono: UserPlus, onSelect: () => acciones.abrirPropietario(n) },
    {
      id: "estado",
      etiqueta: cambiando ? "Guardando…" : esActivo ? "Desactivar" : "Activar",
      Icono: Power,
      deshabilitada: cambiando,
      onSelect: () => (esActivo ? acciones.pedirDesactivar(n) : acciones.activar(n)),
    },
    ...(n.emailConfirmado === false
      ? [{ id: "confirmar-correo", etiqueta: "Confirmar correo", Icono: MailCheck, onSelect: () => acciones.pedirConfirmarCorreo(n) }]
      : []),
    { id: "colores", etiqueta: "Colores", Icono: Palette, onSelect: () => acciones.abrirColores(n) },
    {
      id: "ver-pagina", etiqueta: "Ver página de reservas", Icono: ExternalLink,
      onSelect: () => window.open(`/b/${n.slug}`, "_blank", "noopener,noreferrer"),
    },
    { id: "eliminar", etiqueta: "Eliminar negocio", Icono: Trash2, destructiva: true, onSelect: () => acciones.abrirEliminar(n) },
  ];
}
