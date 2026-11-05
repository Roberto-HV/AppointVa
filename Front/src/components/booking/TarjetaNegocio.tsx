import type { ReactNode } from "react";
import { Star, MapPin, Phone, Clock, ChevronDown } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { NegocioPublico } from "../../types";
import { estadoDeHoy } from "../../utils/calendarioNegocio";
import { telefonoWhatsApp } from "../../utils/whatsapp";

type DatosNegocio = Pick<
  NegocioPublico,
  "nombre" | "promedioResenas" | "totalResenas" | "direccion" | "telefono" | "telefonoWhatsApp" | "horario" | "diasCerrados" | "zonaHoraria"
>;

interface Props {
  negocio: DatosNegocio;
  /** Botones del paso: los mismos que el resumen, para que el «Continuar» no cambie de sitio. */
  acciones?: ReactNode;
  /** Solo para pruebas: el «ahora» con el que se calcula si está abierto. */
  ahora?: Date;
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** La semana empieza en lunes, como en el calendario del paso de fecha. */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const ENLACE = "inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline";

function turnos(intervalos: { horaInicio: string; horaFin: string }[]): string {
  return intervalos.map((h) => `${h.horaInicio} – ${h.horaFin}`).join(" · ");
}

/**
 * La columna derecha antes de elegir servicio, como la ficha del negocio en Fresha
 * o Booksy: calificación, si está abierto, dónde está y cómo contactarlo. Al elegir
 * un servicio la reemplaza el resumen de la reserva. Solo usa lo que ya trae la
 * página pública del negocio; un dato que no esté simplemente no se muestra.
 */
export default function TarjetaNegocio({ negocio, acciones, ahora }: Props) {
  const totalResenas = negocio.totalResenas ?? 0;
  // Sin horario publicado (API antigua o negocio sin configurar) no se afirma nada.
  const horario = negocio.horario?.length ? negocio.horario : null;
  const hoy = horario
    ? estadoDeHoy({ horario, diasCerrados: negocio.diasCerrados, zonaHoraria: negocio.zonaHoraria }, ahora)
    : null;
  const mapa = negocio.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.direccion)}`
    : null;

  return (
    <aside aria-label="Información del negocio" className="tarjeta p-5">
      <p className="text-lg font-semibold leading-snug text-slate-900 break-words">{negocio.nombre}</p>

      {totalResenas > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          <Star size={15} strokeWidth={0} className="fill-rating text-rating" aria-hidden="true" />
          <span className="font-semibold text-slate-900 tabular-nums">{(negocio.promedioResenas ?? 0).toFixed(1)}</span>
          <span className="text-slate-500">{`(${totalResenas} ${totalResenas === 1 ? "reseña" : "reseñas"})`}</span>
        </p>
      )}

      {hoy && horario && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {hoy.abiertoAhora ? (
              <span className="rounded-full bg-status-confirmed-bg px-2 py-0.5 text-xs font-semibold text-status-confirmed-fg">
                Abierto ahora
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {hoy.abreA ? "Cerrado ahora" : hoy.intervalos.length > 0 ? "Cerrado por hoy" : "Cerrado hoy"}
              </span>
            )}
            {hoy.cierraA && <span className="text-slate-600 tabular-nums">{`Cierra a las ${hoy.cierraA}`}</span>}
            {hoy.abreA && <span className="text-slate-600 tabular-nums">{`Abre a las ${hoy.abreA}`}</span>}
          </p>
          {hoy.intervalos.length > 0 && (
            <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
              <Clock size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="tabular-nums">{`Hoy: ${turnos(hoy.intervalos)}`}</span>
            </p>
          )}
          {/* El horario de la semana, plegado: <details> ya es operable con teclado. */}
          <details className="group mt-1">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
              Horario de la semana
              <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <dl className="mb-1 space-y-1 text-sm">
              {ORDEN_SEMANA.map((dia) => {
                const delDia = horario
                  .filter((h) => h.diaSemana === dia)
                  .sort((x, y) => x.horaInicio.localeCompare(y.horaInicio));
                const esHoy = dia === hoy.diaSemana;
                return (
                  <div key={dia} className={`flex justify-between gap-3 ${esHoy ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                    <dt>{DIAS[dia]}</dt>
                    <dd className="text-right tabular-nums">{delDia.length ? turnos(delDia) : "Cerrado"}</dd>
                  </div>
                );
              })}
            </dl>
          </details>
        </div>
      )}

      {(negocio.direccion || negocio.telefono || negocio.telefonoWhatsApp) && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {negocio.direccion && mapa && (
            <div className="py-1">
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="break-words">{negocio.direccion}</span>
              </p>
              <a href={mapa} target="_blank" rel="noopener noreferrer" className={`${ENLACE} pl-[23px]`}>
                Ver en el mapa
                <span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            </div>
          )}
          {negocio.telefono && (
            <a href={`tel:${negocio.telefono.replace(/[^\d+]/g, "")}`} className={ENLACE}>
              <Phone size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Llamar al </span>
              <span className="tabular-nums">{negocio.telefono}</span>
            </a>
          )}
          {negocio.telefonoWhatsApp && (
            <a
              href={`https://wa.me/${telefonoWhatsApp(negocio.telefonoWhatsApp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${ENLACE} ${negocio.telefono ? "ml-5" : ""}`}
            >
              <SiWhatsapp size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
              WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-500">Elige un servicio para continuar.</p>
        {acciones && <div className="mt-3 space-y-2">{acciones}</div>}
      </div>
    </aside>
  );
}
