import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Eye, EyeOff, Loader2, Trash2, Plus } from "lucide-react";
import { authApi } from "../../api/auth";
import { meApi } from "../../api/me";
import { empleadosApi } from "../../api/empleados";
import { negociosApi } from "../../api/negocios";
import { citasApi } from "../../api/citas";
import { DatePicker, TimePicker, citasABusySlots } from "../../components/ui/DateTimePicker";
import type { BloqueoDto, HorarioDiaDto } from "../../types";
import { mensajeError } from "../../utils/errores";
import { comoUtc } from "../../utils/fechas";
import { Link } from "react-router-dom";

import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import ReglasContrasena from "../../components/ReglasContrasena";
import { esquemaContrasena } from "../../utils/contrasena";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { useAuthStore } from "../../store/authStore";
import { usePermisos } from "../../hooks/usePermisos";
import { useToastStore } from "../../store/toastStore";
import { NotificacionPerfilSection } from "../../components/ui/NotificacionBanner";
import { hoy as hoyLocal } from "../../utils/fechas";
import { useSubirImagen } from "../../hooks/useSubirImagen";
import { ACCEPT_IMAGEN } from "../../lib/imagenes";
import AvisoDosFactores from "../../components/dashboard/AvisoDosFactores";

const schemaPwd = z
  .object({
    passwordActual: z.string().min(1, "Requerido"),
    passwordNuevo: esquemaContrasena,
    confirmar: z.string(),
  })
  .refine((v) => v.passwordNuevo === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

const schemaBloqueo = z
  .object({
    fechaInicio: z.string().min(1, "Selecciona una fecha"),
    horaInicio:  z.string().min(1, "Selecciona una hora"),
    fechaFin:    z.string().min(1, "Selecciona una fecha"),
    horaFin:     z.string().min(1, "Selecciona una hora"),
    motivo:      z.string().optional(),
  })
  .refine(
    (d) => {
      if (!d.fechaInicio || !d.horaInicio || !d.fechaFin || !d.horaFin) return true;
      const inicio = new Date(`${d.fechaInicio}T${d.horaInicio}`);
      const fin    = new Date(`${d.fechaFin}T${d.horaFin}`);
      return fin.getTime() - inicio.getTime() >= 60 * 60 * 1000;
    },
    { message: "El bloqueo debe durar al menos 1 hora", path: ["horaFin"] },
  );

type PwdForm     = z.infer<typeof schemaPwd>;
type BloqueoForm = z.infer<typeof schemaBloqueo>;

interface CampoContrasenaProps {
  id: string;
  etiqueta: string;
  autoComplete: string;
  placeholder?: string;
  visible: boolean;
  onAlternar: () => void;
  error?: string;
  registro: UseFormRegisterReturn;
}

/**
 * Contraseña con etiqueta, error ligado (`aria-describedby`) y botón de
 * mostrar/ocultar alcanzable con teclado (antes `tabIndex={-1}` y sin nombre).
 */
function CampoContrasena({ id, etiqueta, autoComplete, placeholder, visible, onAlternar, error, registro }: CampoContrasenaProps) {
  const idError = `${id}-error`;
  return (
    <>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? idError : undefined}
          {...registro}
          className={`w-full min-h-[44px] lg:min-h-[36px] px-3 py-2 pr-12 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${error ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-600"}`}
        />
        <button
          type="button"
          onClick={onAlternar}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? `Ocultar ${etiqueta.toLowerCase()}` : `Mostrar ${etiqueta.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={idError} className="text-red-700 dark:text-red-400 text-xs mt-1">{error}</p>}
    </>
  );
}

export default function MiPerfilPage() {
  const usuario        = useAuthStore((s) => s.usuario);
  const actualizarFoto = useAuthStore((s) => s.actualizarFoto);
  const { toast }      = useToastStore();
  const qc             = useQueryClient();
  const fotoInputRef   = useRef<HTMLInputElement>(null);
  const { esEmpleado, esPropietario } = usePermisos();

  const [mostrarActual,    setMostrarActual]    = useState(false);
  const [mostrarNueva,     setMostrarNueva]     = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [mensaje,          setMensaje]          = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [mostrarForm,      setMostrarForm]      = useState(false);

  // ── Contraseña ─────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PwdForm>({
    resolver: zodResolver(schemaPwd),
  });
  const nuevaValor = watch("passwordNuevo", "");

  const { mutate: cambiarPassword, isPending } = useMutation({
    mutationFn: (d: PwdForm) => authApi.cambiarPassword(d.passwordActual, d.passwordNuevo),
    onSuccess: (resp) => { setMensaje({ tipo: "ok", texto: resp.mensaje }); reset(); toast("Contraseña actualizada"); },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { errores?: string[] } } })?.response?.data?.errores?.[0]
        ?? "No se pudo cambiar la contraseña.";
      setMensaje({ tipo: "error", texto: msg });
    },
  });

  // Misma regla que los demás subidores (tipo y tamaño antes de subir, error
  // del servidor si lo hay): antes cualquier archivo llegaba al backend.
  const foto = useSubirImagen({
    subir: (archivo) => authApi.subirFotoPerfil(archivo),
    onExito: ({ fotoUrl }) => { actualizarFoto(fotoUrl); toast("Foto actualizada"); },
    mensajeFallo: "No se pudo subir la foto. Intenta de nuevo.",
  });
  const subiendoFoto = foto.subiendo;

  // ── Bloqueos (solo empleados) ───────────────────────────────────────────────
  // Valores por defecto vacíos: sin ellos `watch()` da `undefined` y `.length` fallaba
  // en cuanto llegaba el id del empleado.
  const formB   = useForm<BloqueoForm>({
    resolver: zodResolver(schemaBloqueo),
    defaultValues: { fechaInicio: "", horaInicio: "", fechaFin: "", horaFin: "", motivo: "" },
  });
  const fInicio = formB.watch("fechaInicio");
  const fFin    = formB.watch("fechaFin");

  const { data: miEmpleado } = useQuery({
    queryKey: ["mi-empleado"],
    queryFn:  meApi.obtenerMiEmpleado,
    enabled:  esEmpleado,
  });
  const empleadoId = miEmpleado?.empleadoId;

  const { data: bloqueos = [] } = useQuery({
    queryKey: ["bloqueos", empleadoId],
    queryFn:  () => empleadosApi.obtenerBloqueos(empleadoId!),
    enabled:  !!empleadoId,
  });

  const { data: horariosNegocio = [] } = useQuery<HorarioDiaDto[]>({
    queryKey: ["horarios-negocio"],
    queryFn:  negociosApi.obtenerHorarios,
    enabled:  esEmpleado,
  });

  const { data: citasDiaInicio = [] } = useQuery({
    queryKey: ["citas-dia", empleadoId, fInicio],
    queryFn: () => citasApi.obtenerTodas({
      empleadoId: empleadoId!,
      desde: fInicio,
      hasta: fInicio,
      tamano: 50,
    }).then((r) => r.datos),
    enabled: !!empleadoId && fInicio.length > 0,
  });

  const { data: citasDiaFin = [] } = useQuery({
    queryKey: ["citas-dia", empleadoId, fFin],
    queryFn: () => citasApi.obtenerTodas({
      empleadoId: empleadoId!,
      desde: fFin,
      hasta: fFin,
      tamano: 50,
    }).then((r) => r.datos),
    enabled: !!empleadoId && fFin.length > 0 && fFin !== fInicio,
  });

  const busySlotsInicio = citasABusySlots(citasDiaInicio);
  const busySlotsFin    = citasABusySlots(fFin === fInicio ? citasDiaInicio : citasDiaFin);

  const ahoraMin = (): string => {
    const n   = new Date();
    const tot = n.getHours() * 60 + n.getMinutes();
    const sig = Math.ceil(tot / 30) * 30;
    return `${String(Math.floor(sig / 60) % 24).padStart(2, "0")}:${String(sig % 60).padStart(2, "0")}`;
  };

  const rangoHorario = (fecha: string): { min: string; max: string } | null => {
    if (!fecha) return null;
    const dia = new Date(fecha + "T12:00").getDay();
    const h   = horariosNegocio.find((x) => x.diaSemana === dia);
    const hoy = hoyLocal();
    const firstIv = h?.activo && h.intervalos.length > 0 ? h.intervalos[0] : null;
    const lastIv  = h?.activo && h.intervalos.length > 0 ? h.intervalos[h.intervalos.length - 1] : null;
    const minNeg = firstIv?.horaInicio ?? "00:00";
    const maxNeg = lastIv?.horaFin    ?? "23:30";
    const minEfe = fecha === hoy ? (ahoraMin() > minNeg ? ahoraMin() : minNeg) : minNeg;
    return { min: minEfe, max: maxNeg };
  };

  const { mutate: crearBloqueo, isPending: creando } = useMutation({
    mutationFn: (d: BloqueoForm) =>
      empleadosApi.crearBloqueo(empleadoId!, {
        inicioEn: new Date(`${d.fechaInicio}T${d.horaInicio}:00`).toISOString(),
        finEn:    new Date(`${d.fechaFin}T${d.horaFin}:00`).toISOString(),
        motivo:   d.motivo || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bloqueos", empleadoId] });
      formB.reset();
      setMostrarForm(false);
      toast("Bloqueo agregado");
    },
    onError: () => toast("No se pudo guardar el bloqueo", "error"),
  });

  // Deshacer = volver a crear el mismo bloqueo (mismo inicio, fin y motivo).
  // El backend guarda en UTC y lo devuelve sin zona: se reenvía marcado como UTC
  // para que no se desplace según la zona del servidor.
  const { mutate: restaurarBloqueo } = useMutation({
    mutationFn: (b: BloqueoDto) =>
      empleadosApi.crearBloqueo(empleadoId!, { inicioEn: comoUtc(b.inicioEn), finEn: comoUtc(b.finEn), motivo: b.motivo }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bloqueos", empleadoId] }); toast("Bloqueo restaurado"); },
    onError: (err) => toast(mensajeError(err, "No se pudo restaurar el bloqueo"), "error"),
  });

  // Sin confirmación: borrar reabre el horario para reservas, así que el aviso
  // ofrece "Deshacer" durante unos segundos.
  const { mutate: eliminarBloqueo, isPending: eliminando, variables: bloqueoEliminando } = useMutation({
    mutationFn: (b: BloqueoDto) => empleadosApi.eliminarBloqueo(empleadoId!, b.id!),
    onSuccess: (_, b) => {
      qc.invalidateQueries({ queryKey: ["bloqueos", empleadoId] });
      toast("Bloqueo eliminado", "exito", { accion: { etiqueta: "Deshacer", onClick: () => restaurarBloqueo(b) } });
    },
    onError: () => toast("No se pudo eliminar el bloqueo", "error"),
  });

  const iniciales = usuario?.nombreCompleto
    ?.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() ?? "?";

  const fmtBloqueo = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo="Mi perfil"
        subtitulo={
          esEmpleado
            ? "Tus datos, notificaciones y bloqueos de horario"
            : "Tus datos de acceso y preferencias de notificación"
        }
      />

      {esPropietario && usuario && <AvisoDosFactores usuarioId={usuario.id} />}

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Columna izquierda: identidad ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 flex flex-col items-center text-center gap-3 w-full lg:w-64 shrink-0">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
              {usuario?.fotoUrl
                ? <img src={usuario.fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-slate-600 dark:text-slate-400">{iniciales}</span>
              }
            </div>
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={subiendoFoto}
              className="absolute -bottom-1 -right-1 w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-50 group"
              title="Cambiar foto"
              aria-label="Cambiar foto de perfil"
            >
              <span className="w-8 h-8 rounded-full bg-slate-800 border-2 border-white dark:border-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition">
              {subiendoFoto
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <Camera size={13} className="text-white" />
              }
              </span>
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept={ACCEPT_IMAGEN}
              className="hidden"
              onChange={(e) => foto.alElegir(e)}
            />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">{usuario?.nombreCompleto}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{usuario?.email}</p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-semibold px-3 py-1 rounded-full">
            {usuario?.rol}
          </span>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Haz clic en el ícono de cámara para cambiar tu foto</p>
        </div>

        {/* ── Columna derecha: contraseña ── */}
        <div className="flex-1 min-w-0">
          <form
            onSubmit={handleSubmit((d) => { setMensaje(null); cambiarPassword(d); })}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4"
          >
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Cambiar contraseña</h2>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Usa una contraseña segura con mayúsculas y números</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <CampoContrasena
                  id="pwd-actual"
                  etiqueta="Contraseña actual"
                  autoComplete="current-password"
                  visible={mostrarActual}
                  onAlternar={() => setMostrarActual((v) => !v)}
                  error={errors.passwordActual?.message}
                  registro={register("passwordActual")}
                />
              </div>

              <div>
                <CampoContrasena
                  id="pwd-nueva"
                  etiqueta="Nueva contraseña"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  visible={mostrarNueva}
                  onAlternar={() => setMostrarNueva((v) => !v)}
                  error={errors.passwordNuevo?.message}
                  registro={register("passwordNuevo")}
                />
                <ReglasContrasena valor={nuevaValor ?? ""} />
                <PasswordStrengthBar password={nuevaValor} />
              </div>

              <div>
                <CampoContrasena
                  id="pwd-confirmar"
                  etiqueta="Confirmar contraseña"
                  autoComplete="new-password"
                  visible={mostrarConfirmar}
                  onAlternar={() => setMostrarConfirmar((v) => !v)}
                  error={errors.confirmar?.message}
                  registro={register("confirmar")}
                />
              </div>
            </div>

            {mensaje && (
              <div role={mensaje.tipo === "ok" ? "status" : "alert"} className={`text-sm rounded-lg px-4 py-3 ${mensaje.tipo === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300" : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"}`}>
                {mensaje.texto}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {isPending ? "Actualizando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>

      </div>

      {/* ── Seguridad: antes los empleados no tenían forma de llegar a la verificación en dos pasos ── */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Seguridad</h2>
          <p className="text-sm text-muted-foreground">Verificación en dos pasos para proteger tu cuenta.</p>
        </div>
        <Link
          to="/dashboard/seguridad"
          className="inline-flex items-center justify-center min-h-[44px] lg:min-h-[36px] px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Configurar verificación en dos pasos
        </Link>
      </div>

      {/* ── Notificaciones push ── */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">Notificaciones</h2>
        <NotificacionPerfilSection />
      </div>

      {/* ── Bloqueos de horario (solo empleados) ── */}
      {esEmpleado && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Mis bloqueos de horario</h2>
            {!mostrarForm && (
              <button
                type="button"
                onClick={() => setMostrarForm(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={14} />
                Agregar
              </button>
            )}
          </div>

          {/* Formulario nuevo bloqueo */}
          {mostrarForm && (
            <form
              onSubmit={formB.handleSubmit((d) => crearBloqueo(d))}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-4 space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nuevo bloqueo</h3>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Inicio</p>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    label="Fecha"
                    value={formB.watch("fechaInicio") ?? ""}
                    onChange={(v) => {
                      formB.setValue("fechaInicio", v, { shouldValidate: true });
                      formB.setValue("horaInicio", "", { shouldValidate: false });
                    }}
                    error={formB.formState.errors.fechaInicio?.message}
                  />
                  <TimePicker
                    label="Hora"
                    value={formB.watch("horaInicio") ?? ""}
                    onChange={(v) => formB.setValue("horaInicio", v, { shouldValidate: true })}
                    minTime={rangoHorario(fInicio)?.min}
                    maxTime={rangoHorario(fInicio)?.max}
                    busySlots={busySlotsInicio}
                    error={formB.formState.errors.horaInicio?.message}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Fin</p>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    label="Fecha"
                    value={formB.watch("fechaFin") ?? ""}
                    onChange={(v) => {
                      formB.setValue("fechaFin", v, { shouldValidate: true });
                      formB.setValue("horaFin", "", { shouldValidate: false });
                    }}
                    error={formB.formState.errors.fechaFin?.message}
                  />
                  <TimePicker
                    label="Hora"
                    value={formB.watch("horaFin") ?? ""}
                    onChange={(v) => formB.setValue("horaFin", v, { shouldValidate: true })}
                    minTime={rangoHorario(fFin)?.min}
                    maxTime={rangoHorario(fFin)?.max}
                    busySlots={busySlotsFin}
                    error={formB.formState.errors.horaFin?.message}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bloqueo-motivo" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo (opcional)</label>
                <input
                  id="bloqueo-motivo"
                  {...formB.register("motivo")}
                  placeholder="Cita médica, día personal..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-slate-700"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creando}
                  className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2 rounded-xl transition text-sm"
                >
                  {creando ? "Guardando..." : "Guardar bloqueo"}
                </button>
                <button
                  type="button"
                  onClick={() => { setMostrarForm(false); formB.reset(); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de bloqueos */}
          {bloqueos.length === 0 && !mostrarForm ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 text-center text-sm text-slate-400 dark:text-slate-500">
              Sin bloqueos. Usa <strong>Agregar</strong> para registrar uno.
            </div>
          ) : bloqueos.length > 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
              {bloqueos.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                      {fmtBloqueo(b.inicioEn)} — {fmtBloqueo(b.finEn)}
                    </p>
                    {b.motivo && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{b.motivo}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (b.id) eliminarBloqueo(b); }}
                    disabled={eliminando && bloqueoEliminando?.id === b.id}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] rounded-lg text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Eliminar bloqueo del ${fmtBloqueo(b.inicioEn)}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
}
