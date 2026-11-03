import { Link } from "react-router-dom";
import { CreditCard, Trash2, Palette, UserPlus, MailCheck, ExternalLink, Power } from "lucide-react";
import type { NegocioMetricasDto, SuscripcionResumenDto } from "../../../api/admin";
import BarraProgreso from "../../../components/ui/BarraProgreso";
import MenuAcciones from "../../../components/ui/MenuAcciones";
import { formatFecha } from "../../../utils/formatters";
import { esClavePlan, NOMBRES_PLANES } from "../../../lib/precios";
import { esPendienteActivacion, nombrePlan } from "../../../utils/negociosAdmin";
import { rutaNegocioAdmin } from "../../../layouts/rutasAdmin";
import BadgeSuscripcion from "./BadgeSuscripcion";
import InterruptorNegocio from "./InterruptorNegocio";
import LogoNegocio from "./LogoNegocio";
import { ACCION_TARJETA, TINTE_ACTIVAR, TINTE_DESACTIVAR, TINTE_PROPIETARIO, TINTE_SUSCRIPCION } from "./estilos";

/** Estado de alta del negocio: la misma insignia en la tarjeta, la tabla y la ficha. */
export function EstadoNegocio({ negocio, corto = false }: {
  negocio: NegocioMetricasDto;
  /** En la tabla, "Pendiente" a secas (el nombre completo va en `title`): la columna no cabe con el rótulo largo. */
  corto?: boolean;
}) {
  const esActivo = negocio.activo === 1;
  const pendiente = esPendienteActivacion(negocio);
  if (corto && pendiente) {
    return (
      <span
        title="Pendiente de activación"
        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        Pendiente<span className="sr-only"> de activación</span>
      </span>
    );
  }
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
        esActivo
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : pendiente
          ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
      }`}
    >
      {esActivo ? "Activo" : pendiente ? "Pendiente de activación" : "Inactivo"}
    </span>
  );
}

export function TarjetaNegocio({
  negocio,
  suscripcion,
  onActivar,
  onDesactivar,
  onConfirmarEmail,
  onCrearPropietario,
  onColores,
  onSuscripcion,
  onTogglePagos,
  onToggleTester,
  onEliminar,
  isToggling,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  onActivar: () => void;
  onDesactivar: () => void;
  onConfirmarEmail: () => void;
  onCrearPropietario: () => void;
  onColores: () => void;
  onSuscripcion: () => void;
  onTogglePagos: (habilitado: boolean) => void;
  onToggleTester: () => void;
  onEliminar: () => void;
  isToggling?: boolean;
}) {
  const esActivo = negocio.activo === 1;
  const pendiente = esPendienteActivacion(negocio);

  return (
    // Borde y sin sombra, como `.tarjeta`: elevación por borde O sombra, no ambas.
    <article aria-label={negocio.nombre} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
      {/* Header: logo, nombre y slug llevan a la ficha del negocio (lote 4). */}
      <div className="p-4 flex items-center gap-3">
        <Link
          to={rutaNegocioAdmin(negocio.id)}
          aria-label={`Ver ficha de ${negocio.nombre}`}
          className="group flex-1 min-w-0 flex items-center gap-3 -m-1 p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
        >
          <LogoNegocio negocio={negocio} />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-slate-900 dark:text-white text-sm truncate group-hover:underline underline-offset-2">{negocio.nombre}</span>
            <span className="block text-xs text-slate-400 truncate">{negocio.slug}</span>
          </span>
        </Link>
        <EstadoNegocio negocio={negocio} />
      </div>

      {/* Plan + suscripción */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
          {negocio.planNombre ? nombrePlan(negocio.planNombre) : "Sin plan"}
        </span>
        {suscripcion && (
          <BadgeSuscripcion
            estado={suscripcion.estado}
            dias={suscripcion.diasRestantes}
            vence={suscripcion.fechaVencimiento}
            conPlan={!!suscripcion.planNombre}
          />
        )}
        {suscripcion && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              suscripcion.sector === 'salud'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                : 'bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300'
            }`}
          >
            {suscripcion.sector === 'salud' ? 'Salud' : 'Belleza'}
          </span>
        )}
        {negocio.esTester && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            Tester
          </span>
        )}
      </div>

      {/* Registro (B23): cuándo se dio de alta y si el propietario verificó su
          correo, lo que necesita el SuperAdmin para decidir la activación. */}
      {(negocio.fechaCreacion || negocio.emailConfirmado != null || (pendiente && esClavePlan(negocio.planSolicitado))) && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap text-[11px]">
          {negocio.fechaCreacion && (
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">Registrado el {formatFecha(negocio.fechaCreacion)}</span>
          )}
          {negocio.emailConfirmado != null && (
            <span
              className={`font-semibold px-2 py-0.5 rounded-full ${
                negocio.emailConfirmado
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {negocio.emailConfirmado ? "Correo verificado" : "Correo sin verificar"}
            </span>
          )}
          {pendiente && esClavePlan(negocio.planSolicitado) && (
            <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Eligió el plan {NOMBRES_PLANES[negocio.planSolicitado]}
            </span>
          )}
        </div>
      )}

      {/* Métricas */}
      <div className="px-4 pb-4 flex-1">
        {negocio.maxCitasMes > 0 && (
          <BarraProgreso valor={negocio.citasMes} maximo={negocio.maxCitasMes} label="Citas este mes" />
        )}
        {negocio.maxEmpleados > 0 && (
          <BarraProgreso valor={negocio.empleadosActivos} maximo={negocio.maxEmpleados} label="Empleados" />
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-slate-400">Emails este mes:</span>
          <span
            className={`text-xs font-semibold ${
              negocio.emailsMes > 200
                ? "text-red-600 dark:text-red-400"
                : negocio.emailsMes > 100
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {negocio.emailsMes}
          </span>
        </div>
      </div>

      {/* Acciones
          Siete acciones no pesan lo mismo. Las tres del trabajo diario
          —suscripción, alta/baja y propietario— quedan a la vista; lo ocasional
          (confirmar correo, colores, ver la página) y "Eliminar", la única
          irreversible, van detrás de "⋯", como en las tarjetas de Empleados.
          Eliminar queda al final del menú, en rojo y tras una línea, y sigue
          pidiendo el nombre del negocio antes de borrar.
          Dos renglones y no uno: con tres botones y "⋯" en una sola fila, una
          tarjeta de la rejilla de tres columnas (unos 290px) los recortaba. */}
      <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onSuscripcion}
            className={`${ACCION_TARJETA} ${TINTE_SUSCRIPCION}`}
          >
            <CreditCard size={12} aria-hidden="true" /> Suscripción
          </button>
          <button
            onClick={esActivo ? onDesactivar : onActivar}
            disabled={isToggling}
            className={`${ACCION_TARJETA} ${esActivo ? TINTE_DESACTIVAR : TINTE_ACTIVAR}`}
          >
            <Power size={12} aria-hidden="true" />
            {isToggling ? "Guardando…" : esActivo ? "Desactivar" : "Activar"}
          </button>
          <div className="col-span-2 flex gap-1.5">
            <button
              onClick={onCrearPropietario}
              className={`${ACCION_TARJETA} flex-1 ${TINTE_PROPIETARIO}`}
            >
              <UserPlus size={12} aria-hidden="true" /> Propietario
            </button>
            <MenuAcciones
              className="shrink-0"
              etiqueta={`Más acciones de ${negocio.nombre}`}
              acciones={accionesSecundarias(negocio, { onConfirmarEmail, onColores, onEliminar })}
            />
          </div>
        </div>
      </div>

      {/* Interruptores: una sola fila en vez de dos renglones con borde cada uno. */}
      <div className="grid grid-cols-2 gap-x-3 px-4 py-2 border-t border-slate-100 dark:border-slate-700">
        <InterruptorNegocio
          etiqueta="Módulo pagos"
          activo={!!negocio.moduloPagosHabilitado}
          onToggle={() => onTogglePagos(!negocio.moduloPagosHabilitado)}
          colorActivo="bg-emerald-500"
          anillo="focus-visible:ring-emerald-500"
        />
        <InterruptorNegocio
          etiqueta="Tester"
          activo={!!negocio.esTester}
          onToggle={onToggleTester}
          colorActivo="bg-purple-500"
          anillo="focus-visible:ring-purple-500"
        />
      </div>
    </article>
  );
}

/**
 * Lo ocasional de un negocio, detrás de "⋯": el mismo menú en la tarjeta y en
 * la ficha.
 */
export function accionesSecundarias(
  negocio: NegocioMetricasDto,
  { onConfirmarEmail, onColores, onEliminar }: { onConfirmarEmail: () => void; onColores: () => void; onEliminar: () => void },
) {
  return [
    // Solo cuando hay un propietario con el correo sin verificar: con
    // "Correo verificado" al lado, la acción era un clic que no hacía nada.
    ...(negocio.emailConfirmado === false
      ? [{ id: "confirmar-correo", etiqueta: "Confirmar correo", Icono: MailCheck, onSelect: onConfirmarEmail }]
      : []),
    { id: "colores", etiqueta: "Colores", Icono: Palette, onSelect: onColores },
    {
      id: "ver-pagina", etiqueta: "Ver página de reservas", Icono: ExternalLink,
      onSelect: () => window.open(`/b/${negocio.slug}`, "_blank", "noopener,noreferrer"),
    },
    { id: "eliminar", etiqueta: "Eliminar negocio", Icono: Trash2, destructiva: true, onSelect: onEliminar },
  ];
}
