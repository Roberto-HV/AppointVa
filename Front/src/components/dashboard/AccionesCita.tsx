import { useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiWhatsapp } from "react-icons/si";
import {
  CheckCircle2, CheckCheck, CalendarClock, XCircle, UserX, MoreHorizontal, ExternalLink, History,
} from "lucide-react";
import Modal from "../ui/Modal";
import EstadoBadge from "../ui/EstadoBadge";
import { DatePicker } from "../ui/DateTimePicker";
import { api } from "../../api/axios";
import { ESTADOS } from "../../api/citas";
import { intakeApi } from "../../api/intake";
import { useAuthStore } from "../../store/authStore";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { useCambiarEstadoCita, useReagendarCita } from "../../hooks/useMutacionesCita";
import { citaAbierta } from "../../lib/estadoCita";
import { hoy } from "../../utils/fechas";
import { formatFechaHoraCorta } from "../../utils/formatters";
import { urlRecordatorioWhatsApp } from "../../utils/whatsapp";
import type { CitaDto, SlotDisponible } from "../../types";

// ── Acciones de una cita ──────────────────────────────────────────────────────
//
// Una sola hoja de acciones para la lista (también por debajo de 640px), el
// calendario, el Gantt, el inicio y el detalle. Antes, en el teléfono solo se
// llegaba a un modal de estados sin "Reagendar", y el calendario solo movía
// citas arrastrando, cosa que no existe en pantallas táctiles.
//
// `HojaAccionesCita` es la hoja controlada (la abre quien quiera: un bloque del
// calendario, una fila). `AccionesCita` es el grupo de botones de una fila:
// WhatsApp, la acción principal del estado y "Acciones", que abre la hoja.

type IconoAccion = ComponentType<{ size?: number; className?: string }>;

export interface AccionExtraCita {
  id: string;
  etiqueta: string;
  Icono: IconoAccion;
  /** Se llama después de cerrar la hoja (p. ej. para abrir el modal de notas). */
  onSelect?: () => void;
  /** Si se indica, la acción es un enlace externo. */
  href?: string;
  /** Punto junto al icono (p. ej. "ya tiene nota"). */
  marcador?: boolean;
  /** La acción no se puede usar ahora (p. ej. su petición sigue en curso). */
  deshabilitada?: boolean;
}

export type VistaHoja = "menu" | "reagendar" | "completar" | "cancelar" | "inasistencia";

interface HojaProps {
  cita: CitaDto | null;
  onCerrar: () => void;
  vistaInicial?: VistaHoja;
  accionesExtra?: AccionExtraCita[];
  nombreNegocio?: string | null;
  /** Enlace "Ver detalle". Falso en la propia página de detalle. */
  mostrarDetalle?: boolean;
}

const ITEM =
  "w-full min-h-[44px] flex items-center gap-3 px-3 rounded-xl text-left text-sm font-medium transition " +
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const ITEM_NORMAL = `${ITEM} text-foreground`;
const ITEM_DESTRUCTIVO = `${ITEM} text-red-700 dark:text-red-400`;

const BOTON_SECUNDARIO =
  "min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl border border-border text-sm font-medium text-foreground " +
  "hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const BOTON_PRIMARIO =
  "min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground " +
  "hover:opacity-90 disabled:opacity-40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const BOTON_DESTRUCTIVO =
  "min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-800 text-white " +
  "disabled:opacity-40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Hoja de acciones controlada. Se monta de nuevo por cada cita, así vuelve siempre al menú. */
export function HojaAccionesCita({ cita, ...resto }: HojaProps) {
  if (!cita) return null;
  return <HojaAbierta key={`${cita.id}-${resto.vistaInicial ?? "menu"}`} cita={cita} {...resto} />;
}

function HojaAbierta({
  cita, onCerrar, vistaInicial = "menu", accionesExtra = [], nombreNegocio, mostrarDetalle = true,
}: HojaProps & { cita: CitaDto }) {
  const terms = useSectorTerms();
  const cita1 = terms.cita.toLowerCase();
  const esEmpleado = useAuthStore((s) => s.usuario?.rol) === "Empleado";
  const [vista, setVista] = useState<VistaHoja>(vistaInicial);
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState("");
  const [slot, setSlot] = useState("");

  const cambiarEstado = useCambiarEstadoCita();
  const reagendar = useReagendarCita();

  const { data: intake = [] } = useQuery({
    queryKey: ["intake-respuestas", cita.id],
    queryFn: () => intakeApi.getRespuestas(cita.id),
    enabled: vista === "menu",
  });

  const { data: slots = [], isFetching: cargandoSlots, isError: errorSlots } = useQuery({
    queryKey: ["slots-reag", cita.id, fecha],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: cita.servicioId, empleadoId: cita.empleadoId, fecha },
      });
      return data;
    },
    enabled: vista === "reagendar" && !!fecha,
  });

  const aplicarEstado = (estado: number, conMotivo = false) =>
    cambiarEstado.mutate(
      { id: cita.id, estado, motivo: conMotivo ? motivo.trim() : undefined },
      { onSuccess: onCerrar },
    );

  const titulos: Record<VistaHoja, string> = {
    menu: `${terms.cita} de ${cita.nombreCliente}`,
    reagendar: `Reagendar ${cita1}`,
    completar: "Marcar como completada",
    cancelar: `Cancelar ${cita1}`,
    inasistencia: "Marcar inasistencia",
  };

  const resumen = (
    <div className="rounded-xl bg-muted p-3 text-sm space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground">{cita.nombreCliente}</p>
        <EstadoBadge estado={cita.estadoTexto} />
      </div>
      <p className="text-muted-foreground">{cita.nombreServicio} · {cita.nombreEmpleado}</p>
      <p className="text-muted-foreground capitalize">{formatFechaHoraCorta(cita.inicioEn)}</p>
    </div>
  );

  const pendiente = cita.estadoTexto === "Pendiente";
  const confirmada = cita.estadoTexto === "Confirmada";
  const abierta = citaAbierta(cita.estadoTexto);

  return (
    <Modal abierto onCerrar={onCerrar} titulo={titulos[vista]} ancho="sm">
      {vista === "menu" && (
        <div className="space-y-4">
          {resumen}

          {intake.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preguntas de intake</p>
              {intake.map((r, i) => (
                <p key={i}>
                  <span className="text-muted-foreground">{r.etiqueta}:</span>{" "}
                  <span className="font-medium">{r.valor ?? "—"}</span>
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1" role="group" aria-label={`Acciones de la ${cita1}`}>
            {pendiente && (
              <button
                type="button"
                className={ITEM_NORMAL}
                disabled={cambiarEstado.isPending}
                onClick={() => aplicarEstado(ESTADOS.Confirmada)}
              >
                <CheckCircle2 size={18} className="text-status-confirmed-fg shrink-0" aria-hidden="true" />
                {cambiarEstado.isPending ? "Confirmando…" : `Confirmar ${cita1}`}
              </button>
            )}
            {confirmada && (
              <button type="button" className={ITEM_NORMAL} onClick={() => setVista("completar")}>
                <CheckCheck size={18} className="text-status-completed-fg shrink-0" aria-hidden="true" />
                Marcar como completada
              </button>
            )}
            {abierta && (
              <button type="button" className={ITEM_NORMAL} onClick={() => setVista("reagendar")}>
                <CalendarClock size={18} className="text-muted-foreground shrink-0" aria-hidden="true" />
                Reagendar
              </button>
            )}
            {confirmada && (
              <button type="button" className={ITEM_NORMAL} onClick={() => setVista("inasistencia")}>
                <UserX size={18} className="text-muted-foreground shrink-0" aria-hidden="true" />
                Marcar inasistencia
              </button>
            )}
            {abierta && (
              <button type="button" className={ITEM_DESTRUCTIVO} onClick={() => setVista("cancelar")}>
                <XCircle size={18} className="shrink-0" aria-hidden="true" />
                {`Cancelar ${cita1}`}
              </button>
            )}

            {(abierta) && (cita.telefonoCliente || accionesExtra.length > 0) && (
              <div className="h-px bg-border my-2" role="separator" />
            )}

            {cita.telefonoCliente && (
              <a
                href={urlRecordatorioWhatsApp(cita, nombreNegocio)}
                target="_blank"
                rel="noreferrer"
                className={ITEM_NORMAL}
              >
                <SiWhatsapp size={17} className="text-[#128C7E] dark:text-[#25D366] shrink-0" aria-hidden="true" />
                Enviar recordatorio por WhatsApp
              </a>
            )}

            {accionesExtra.map((a) =>
              a.href ? (
                <a key={a.id} href={a.href} target="_blank" rel="noreferrer" className={ITEM_NORMAL}>
                  <a.Icono size={17} className="text-muted-foreground shrink-0" />
                  {a.etiqueta}
                </a>
              ) : (
                <button
                  key={a.id}
                  type="button"
                  className={ITEM_NORMAL}
                  disabled={a.deshabilitada}
                  aria-busy={a.deshabilitada || undefined}
                  onClick={() => { if (a.deshabilitada) return; onCerrar(); a.onSelect?.(); }}
                >
                  <span className="relative shrink-0">
                    <a.Icono size={17} className="text-muted-foreground" />
                    {a.marcador && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-status-pending-dot" />}
                  </span>
                  {a.etiqueta}
                </button>
              )
            )}

            {(mostrarDetalle || !esEmpleado) && <div className="h-px bg-border my-2" role="separator" />}
            {mostrarDetalle && (
              <Link to={`/dashboard/citas/${cita.id}`} onClick={onCerrar} className={ITEM_NORMAL}>
                <ExternalLink size={17} className="text-muted-foreground shrink-0" aria-hidden="true" />
                Ver detalle
              </Link>
            )}
            {!esEmpleado && cita.clienteId && (
              <Link to={`/dashboard/clientes?clienteId=${cita.clienteId}`} onClick={onCerrar} className={ITEM_NORMAL}>
                <History size={17} className="text-muted-foreground shrink-0" aria-hidden="true" />
                {`Ver historial del ${terms.cliente.toLowerCase()}`}
              </Link>
            )}
          </div>

          {!abierta && (
            <p className="text-xs text-muted-foreground">
              {`Esta ${cita1} ya no admite cambios de estado.`}
            </p>
          )}
        </div>
      )}

      {vista === "reagendar" && (
        <div className="space-y-4">
          {resumen}
          <DatePicker
            label="Nueva fecha"
            value={fecha}
            minDate={hoy()}
            onChange={(v) => { setFecha(v); setSlot(""); }}
          />
          {fecha && (
            <div>
              <p className="block text-sm font-medium text-foreground mb-2" id={`horario-${cita.id}`}>Nuevo horario</p>
              {cargandoSlots ? (
                <p className="text-sm text-muted-foreground" role="status">Cargando horarios disponibles…</p>
              ) : errorSlots ? (
                <p className="text-sm text-red-700 dark:text-red-400" role="alert">No se pudieron cargar los horarios. Intenta de nuevo.</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin horarios disponibles para esta fecha</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1" role="group" aria-labelledby={`horario-${cita.id}`}>
                  {slots.map((s) => (
                    <button
                      key={s.inicio}
                      type="button"
                      aria-pressed={slot === s.inicio}
                      onClick={() => setSlot(s.inicio)}
                      className={`min-h-[44px] lg:min-h-[36px] text-sm rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        slot === s.inicio
                          ? "bg-primary text-primary-foreground border-transparent"
                          : "border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {s.horaTexto}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" className={BOTON_SECUNDARIO} onClick={() => setVista("menu")}>Volver</button>
            <button
              type="button"
              className={BOTON_PRIMARIO}
              disabled={!slot || reagendar.isPending}
              onClick={() => reagendar.mutate({ id: cita.id, inicioEn: slot }, { onSuccess: onCerrar })}
            >
              {reagendar.isPending ? "Reagendando…" : "Confirmar nuevo horario"}
            </button>
          </div>
        </div>
      )}

      {vista === "completar" && (
        <div className="space-y-4">
          {resumen}
          <p className="text-sm text-muted-foreground">
            {`¿Confirmas que esta ${cita1} fue atendida y deseas marcarla como completada?`}
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" className={BOTON_SECUNDARIO} onClick={() => setVista("menu")}>Volver</button>
            <button
              type="button"
              className={BOTON_PRIMARIO}
              disabled={cambiarEstado.isPending}
              onClick={() => aplicarEstado(ESTADOS.Completada)}
            >
              {cambiarEstado.isPending ? "Guardando…" : "Marcar como completada"}
            </button>
          </div>
        </div>
      )}

      {(vista === "cancelar" || vista === "inasistencia") && (
        <div className="space-y-4">
          {resumen}
          <div>
            <label htmlFor={`motivo-${cita.id}`} className="block text-sm font-medium text-foreground mb-1">
              Motivo <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <textarea
              id={`motivo-${cita.id}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder={vista === "cancelar" ? "Motivo de la cancelación…" : "Detalle de la inasistencia…"}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" className={BOTON_SECUNDARIO} onClick={() => setVista("menu")}>Volver</button>
            <button
              type="button"
              className={vista === "cancelar" ? BOTON_DESTRUCTIVO : BOTON_PRIMARIO}
              disabled={cambiarEstado.isPending}
              onClick={() => aplicarEstado(vista === "cancelar" ? ESTADOS.Cancelada : ESTADOS.Inasistencia, true)}
            >
              {cambiarEstado.isPending ? "Guardando…" : vista === "cancelar" ? `Cancelar ${cita1}` : "Marcar inasistencia"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Botones de una fila ───────────────────────────────────────────────────────

interface Props {
  cita: CitaDto;
  accionesExtra?: AccionExtraCita[];
  nombreNegocio?: string | null;
  mostrarDetalle?: boolean;
  /** Botón de WhatsApp visible en la fila (además de dentro de la hoja). */
  whatsapp?: boolean;
  /** Botón de la acción principal del estado: Confirmar (Pendiente) o Completar (Confirmada). */
  primaria?: boolean;
  /** Muestra el texto "Acciones" junto al icono (p. ej. en la página de detalle). */
  conEtiqueta?: boolean;
  className?: string;
}

const BOTON_ICONO =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] rounded-lg " +
  "text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

export default function AccionesCita({
  cita, accionesExtra, nombreNegocio, mostrarDetalle = true, whatsapp = true, primaria = true,
  conEtiqueta = false, className = "",
}: Props) {
  const terms = useSectorTerms();
  const cita1 = terms.cita.toLowerCase();
  const [vistaAbierta, setVistaAbierta] = useState<VistaHoja | null>(null);
  const cambiarEstado = useCambiarEstadoCita();

  return (
    <div className={`flex items-center justify-end gap-1 ${className}`}>
      {whatsapp && cita.telefonoCliente && (
        <a
          href={urlRecordatorioWhatsApp(cita, nombreNegocio)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Enviar recordatorio por WhatsApp a ${cita.nombreCliente}`}
          className={`${BOTON_ICONO} text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/10`}
        >
          <SiWhatsapp size={16} aria-hidden="true" />
        </a>
      )}

      {primaria && cita.estadoTexto === "Pendiente" && (
        <button
          type="button"
          aria-label={`Confirmar ${cita1} de ${cita.nombreCliente}`}
          disabled={cambiarEstado.isPending}
          onClick={() => cambiarEstado.mutate({ id: cita.id, estado: ESTADOS.Confirmada })}
          className={`${BOTON_ICONO} sm:px-2.5 bg-status-confirmed-bg text-status-confirmed-fg hover:opacity-80`}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Confirmar</span>
        </button>
      )}

      {primaria && cita.estadoTexto === "Confirmada" && (
        <button
          type="button"
          aria-label={`Completar ${cita1} de ${cita.nombreCliente}`}
          onClick={() => setVistaAbierta("completar")}
          className={`${BOTON_ICONO} sm:px-2.5 bg-status-completed-bg text-status-completed-fg hover:opacity-80`}
        >
          <CheckCheck size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Completar</span>
        </button>
      )}

      <button
        type="button"
        aria-label={`Acciones de la ${cita1} de ${cita.nombreCliente}`}
        aria-haspopup="dialog"
        onClick={() => setVistaAbierta("menu")}
        className={`${BOTON_ICONO} text-muted-foreground hover:bg-muted hover:text-foreground ${
          conEtiqueta ? "px-3 border border-border text-foreground" : ""
        }`}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        {conEtiqueta && <span>Acciones</span>}
      </button>

      <HojaAccionesCita
        cita={vistaAbierta ? cita : null}
        vistaInicial={vistaAbierta ?? "menu"}
        onCerrar={() => setVistaAbierta(null)}
        accionesExtra={accionesExtra}
        nombreNegocio={nombreNegocio}
        mostrarDetalle={mostrarDetalle}
      />
    </div>
  );
}
