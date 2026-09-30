import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible } from "../../types";
import { SIN_PREFERENCIA_ID } from "./PasoEmpleado";
import { publicoApi } from "../../api/publico";
import { formatPrecio, formatFechaLarga as formatFecha } from "../../utils/formatters";
import { CalendarDays, User, Clock, Tag, Info, ChevronDown, ChevronUp, UserCheck, Check } from "lucide-react";

const schema = z.object({
  nombreCliente: z.string().min(2, "Ingresa tu nombre completo"),
  telefonoCliente: z.string().min(10, "Ingresa un teléfono válido de 10 dígitos").max(15).regex(/^\+?[\d\s\-().]+$/, "Solo dígitos, +, - o espacios"),
  emailCliente: z.string().email("Correo inválido").optional().or(z.literal("")),
  notas: z.string().max(300).optional(),
});

export type DatosClienteForm = z.infer<typeof schema>;

/** Mínimo de dígitos con el que vale la pena consultar; coincide con el mínimo del esquema. */
const DIGITOS_MINIMOS = 10;

const soloDigitos = (valor: string) => valor.replace(/\D/g, "");

interface Props {
  servicio: ServicioPublico;
  empleado: EmpleadoPublico;
  slot: SlotDisponible;
  /** El botón de envío vive en la barra de acción del wizard y se asocia por este id. */
  formId: string;
  /** Slug del negocio: la búsqueda de cliente conocido está acotada a un solo negocio. */
  slug: string;
  politicasAceptadas: boolean;
  onPoliticasAceptadasChange: (aceptadas: boolean) => void;
  onEnviar: (datos: DatosClienteForm) => void;
  /**
   * El visitante confirmó que el teléfono es suyo. El padre lo necesita para enviar
   * `confirmarClienteExistente` y evitar el 409 de nombre distinto.
   */
  onClienteReconocidoChange?: (reconocido: boolean) => void;
  notasLabel?: string;
  error?: string;
  politicasUrl?: string;
  color?: string;
}

export default function PasoDatosCliente({ servicio, empleado, slot, formId, slug, politicasAceptadas, onPoliticasAceptadasChange, onEnviar, onClienteReconocidoChange, notasLabel = 'Notas (opcional)', error, politicasUrl, color = "#334155" }: Props) {
  const [politicasAbiertas, setPoliticasAbiertas] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<DatosClienteForm>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });
  const [emailTocado, setEmailTocado] = useState(false);
  const emailValue = watch("emailCliente");
  const emailReg = register("emailCliente");

  // ── Cliente conocido ──────────────────────────────────────────────────────
  const [buscando, setBuscando] = useState(false);
  const [sugerencia, setSugerencia] = useState<{ nombre: string; email: string | null } | null>(null);
  const [nombreConfirmado, setNombreConfirmado] = useState<string | null>(null);
  // Evita repetir la consulta cuando el campo se desenfoca varias veces con el mismo número.
  const ultimoTelefonoRef = useRef<string | null>(null);
  // Descarta respuestas de consultas que quedaron atrás si el visitante corrigió el número.
  const consultaVigenteRef = useRef(0);
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const telefonoReg = register("telefonoCliente");
  const nombreValue = watch("nombreCliente");

  // Si el visitante retoca el nombre tras confirmar, la confirmación deja de valer:
  // la cita ya no es necesariamente para la persona registrada con ese teléfono.
  useEffect(() => {
    if (nombreConfirmado === null) return;
    if (nombreValue !== nombreConfirmado) {
      setNombreConfirmado(null);
      onClienteReconocidoChange?.(false);
    }
  }, [nombreValue, nombreConfirmado, onClienteReconocidoChange]);

  const buscarCliente = async (valor: string) => {
    const digitos = soloDigitos(valor);
    if (digitos.length < DIGITOS_MINIMOS) return;
    if (digitos === ultimoTelefonoRef.current) return;
    ultimoTelefonoRef.current = digitos;

    const consulta = ++consultaVigenteRef.current;
    setSugerencia(null);
    setNombreConfirmado(null);
    onClienteReconocidoChange?.(false);
    setBuscando(true);
    try {
      const cliente = await publicoApi.buscarClienteDatos(slug, digitos);
      if (!montadoRef.current || consulta !== consultaVigenteRef.current) return;
      setSugerencia({ nombre: cliente.nombreCliente, email: cliente.emailCliente ?? null });
    } catch {
      // 404 (teléfono nuevo) o fallo de red: se degrada en silencio y el visitante
      // llena el formulario a mano. Nunca es motivo para bloquear la reserva.
      if (montadoRef.current && consulta === consultaVigenteRef.current) setSugerencia(null);
    } finally {
      if (montadoRef.current && consulta === consultaVigenteRef.current) setBuscando(false);
    }
  };

  const aceptarSugerencia = () => {
    if (!sugerencia) return;
    setValue("nombreCliente", sugerencia.nombre, { shouldValidate: true });
    if (sugerencia.email) setValue("emailCliente", sugerencia.email, { shouldValidate: true });
    setNombreConfirmado(sugerencia.nombre);
    setSugerencia(null);
    onClienteReconocidoChange?.(true);
  };

  const rechazarSugerencia = () => {
    setSugerencia(null);
    setNombreConfirmado(null);
    onClienteReconocidoChange?.(false);
  };

  const nombreEmpleado = empleado.id === SIN_PREFERENCIA_ID
    ? (slot.empleadoNombre ?? "Cualquier disponible")
    : empleado.nombre;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-5">Tus datos</h2>

      {/* handleSubmit pasa el evento como 2º argumento; se descarta para no filtrarlo al padre. */}
      <form id={formId} onSubmit={handleSubmit((datos) => onEnviar(datos))} className="space-y-4">
        {/* El teléfono va primero: es la llave con la que reconocemos al cliente, y
            preguntarlo después del nombre haría inútil el autocompletado. */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Teléfono *
          </label>
          <input
            {...telefonoReg}
            onBlur={(e) => {
              telefonoReg.onBlur(e);
              void buscarCliente(e.target.value);
            }}
            type="tel"
            placeholder="55 1234 5678"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition bg-white
              focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700
              ${errors.telefonoCliente ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.telefonoCliente && (
            <p className="text-red-500 text-xs mt-1.5">{errors.telefonoCliente.message}</p>
          )}

          <div role="status" aria-live="polite">
            {buscando && (
              <p className="text-slate-400 text-xs mt-1.5">Buscando tus datos…</p>
            )}
            {sugerencia && (
              <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <UserCheck size={16} className="shrink-0 mt-0.5 text-slate-400" />
                  <span>
                    Encontramos tu cuenta: <strong className="font-semibold text-slate-900">{sugerencia.nombre}</strong>. ¿Eres tú?
                  </span>
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={aceptarSugerencia}
                    className="min-h-[40px] flex-1 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: color }}
                  >
                    Sí, soy yo
                  </button>
                  <button
                    type="button"
                    onClick={rechazarSugerencia}
                    className="min-h-[40px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300"
                  >
                    No, no soy yo
                  </button>
                </div>
              </div>
            )}
            {nombreConfirmado && (
              <p className="mt-2 flex items-start gap-2 text-xs text-emerald-700">
                <Check size={14} className="shrink-0 mt-0.5" />
                <span>
                  Listo, {nombreConfirmado}. Llenamos tu nombre y tu correo; puedes corregirlos si cambiaron.
                </span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Nombre completo *
          </label>
          <input
            {...register("nombreCliente")}
            placeholder="Tu nombre completo"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition bg-white
              focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700
              ${errors.nombreCliente ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.nombreCliente && (
            <p className="text-red-500 text-xs mt-1.5">{errors.nombreCliente.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Correo electrónico <span className="text-slate-400 font-normal normal-case">(opcional)</span>
          </label>
          <input
            {...emailReg}
            onBlur={(e) => {
              emailReg.onBlur(e);
              setEmailTocado(true);
            }}
            type="email"
            placeholder="correo@ejemplo.com"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white
              ${errors.emailCliente ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.emailCliente ? (
            <p className="text-red-500 text-xs mt-1.5">{errors.emailCliente.message}</p>
          ) : emailTocado && !emailValue ? (
            <p className="text-amber-600 text-xs mt-1.5 flex items-center gap-1">
              <Info size={16} className="shrink-0" />
              Sin correo no recibirás confirmación por email. Guarda el enlace de tu cita al finalizar.
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {notasLabel}
          </label>
          <textarea
            {...register("notas")}
            rows={2}
            placeholder="Alguna indicación especial..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition resize-none bg-white"
          />
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">No se pudo agendar la cita</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}
        {/* Políticas del negocio — collapsible + checkbox */}
        {politicasUrl && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setPoliticasAbiertas((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <span>Políticas del negocio</span>
              {politicasAbiertas ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {politicasAbiertas && (
              <div className="px-4 pb-4">
                <img
                  src={politicasUrl}
                  alt="Políticas del negocio"
                  className="w-full max-h-[500px] object-contain rounded-xl"
                />
              </div>
            )}
            <label className="flex items-start gap-3 px-4 py-3 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition">
              <input
                type="checkbox"
                checked={politicasAceptadas}
                onChange={(e) => onPoliticasAceptadasChange(e.target.checked)}
                className="mt-0.5 accent-slate-700 w-4 h-4 shrink-0"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                He leído y acepto las políticas del negocio
              </span>
            </label>
          </div>
        )}

        {/* Resumen visual de la cita */}
        <div className="bg-slate-900 text-white rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Resumen de tu cita</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Tag size={13} className="text-white/70" />
              </div>
              <div>
                <p className="text-sm font-semibold">{servicio.nombre}</p>
                <p className="text-xs text-slate-400">{servicio.duracionMinutos} min</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <User size={13} className="text-white/70" />
              </div>
              <p className="text-sm font-medium text-slate-200">{nombreEmpleado}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <CalendarDays size={13} className="text-white/70" />
              </div>
              <p className="text-sm font-medium text-slate-200">{formatFecha(slot.inicio)}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Clock size={13} className="text-white/70" />
              </div>
              <p className="text-sm font-medium text-slate-200">{slot.horaTexto}</p>
            </div>
            <div className="border-t border-white/10 pt-2.5 flex justify-between items-center">
              <span className="text-sm text-slate-400">Total a pagar</span>
              <span className="text-lg font-bold text-white">{formatPrecio(servicio.precio)}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
