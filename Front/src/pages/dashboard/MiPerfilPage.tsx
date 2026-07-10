import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Eye, EyeOff, Loader2, Trash2, Plus } from "lucide-react";
import { authApi } from "../../api/auth";
import { meApi } from "../../api/me";
import { empleadosApi } from "../../api/empleados";
import { negociosApi } from "../../api/negocios";
import { citasApi } from "../../api/citas";
import { DatePicker, TimePicker, citasABusySlots } from "../../components/ui/DateTimePicker";
import type { HorarioDto } from "../../types";
import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { NotificacionPerfilSection } from "../../components/ui/NotificacionBanner";

const schemaPwd = z
  .object({
    passwordActual: z.string().min(1, "Requerido"),
    passwordNuevo: z
      .string()
      .min(6, "Mínimo 6 caracteres")
      .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
      .regex(/[0-9]/, "Debe tener al menos un número"),
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

export default function MiPerfilPage() {
  const usuario        = useAuthStore((s) => s.usuario);
  const actualizarFoto = useAuthStore((s) => s.actualizarFoto);
  const { toast }      = useToastStore();
  const qc             = useQueryClient();
  const fotoInputRef   = useRef<HTMLInputElement>(null);
  const esEmpleado     = usuario?.rol === "Empleado";

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

  const { mutate: subirFoto, isPending: subiendoFoto } = useMutation({
    mutationFn: (file: File) => authApi.subirFotoPerfil(file),
    onSuccess: ({ fotoUrl }) => { actualizarFoto(fotoUrl); toast("Foto actualizada"); },
    onError: () => toast("No se pudo subir la foto", "error"),
  });

  // ── Bloqueos (solo empleados) ───────────────────────────────────────────────
  const formB   = useForm<BloqueoForm>({ resolver: zodResolver(schemaBloqueo) });
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

  const { data: horariosNegocio = [] } = useQuery<HorarioDto[]>({
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
    const hoy = new Date().toISOString().slice(0, 10);
    const minNeg = (h?.activo ? h.horaInicio : null) ?? "00:00";
    const maxNeg = (h?.activo ? h.horaFin    : null) ?? "23:30";
    const minEfe = fecha === hoy ? (ahoraMin() > minNeg ? ahoraMin() : minNeg) : minNeg;
    return { min: minEfe, max: maxNeg };
  };

  const { mutate: crearBloqueo, isPending: creando } = useMutation({
    mutationFn: (d: BloqueoForm) =>
      empleadosApi.crearBloqueo(empleadoId!, {
        inicioEn: `${d.fechaInicio}T${d.horaInicio}:00`,
        finEn:    `${d.fechaFin}T${d.horaFin}:00`,
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

  const { mutate: eliminarBloqueo } = useMutation({
    mutationFn: (bloqueoId: string) => empleadosApi.eliminarBloqueo(empleadoId!, bloqueoId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bloqueos", empleadoId] }); toast("Bloqueo eliminado"); },
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Columna izquierda: identidad ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center text-center gap-3 w-full lg:w-64 shrink-0">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
              {usuario?.fotoUrl
                ? <img src={usuario.fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-slate-600">{iniciales}</span>
              }
            </div>
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={subiendoFoto}
              className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center disabled:opacity-50 hover:bg-slate-700 transition"
              title="Cambiar foto"
            >
              {subiendoFoto
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <Camera size={13} className="text-white" />
              }
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }}
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base">{usuario?.nombreCompleto}</p>
            <p className="text-sm text-gray-400 mt-0.5">{usuario?.email}</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-3 py-1 rounded-full">
            {usuario?.rol}
          </span>
          <p className="text-xs text-gray-400 mt-1">Haz clic en el ícono de cámara para cambiar tu foto</p>
        </div>

        {/* ── Columna derecha: contraseña ── */}
        <div className="flex-1 min-w-0">
          <form
            onSubmit={handleSubmit((d) => { setMensaje(null); cambiarPassword(d); })}
            className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4"
          >
            <div>
              <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
              <p className="text-sm text-gray-400 mt-0.5">Usa una contraseña segura con mayúsculas y números</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <div className="relative">
                  <input
                    type={mostrarActual ? "text" : "password"}
                    {...register("passwordActual")}
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700 ${errors.passwordActual ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                  />
                  <button type="button" onClick={() => setMostrarActual((v) => !v)} onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {mostrarActual ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.passwordActual && <p className="text-red-500 text-xs mt-1">{errors.passwordActual.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={mostrarNueva ? "text" : "password"}
                    {...register("passwordNuevo")}
                    placeholder="Mínimo 6 caracteres"
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700 ${errors.passwordNuevo ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                  />
                  <button type="button" onClick={() => setMostrarNueva((v) => !v)} onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.passwordNuevo && <p className="text-red-500 text-xs mt-1">{errors.passwordNuevo.message}</p>}
                <PasswordStrengthBar password={nuevaValor} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={mostrarConfirmar ? "text" : "password"}
                    {...register("confirmar")}
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700 ${errors.confirmar ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                  />
                  <button type="button" onClick={() => setMostrarConfirmar((v) => !v)} onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {mostrarConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmar && <p className="text-red-500 text-xs mt-1">{errors.confirmar.message}</p>}
              </div>
            </div>

            {mensaje && (
              <div className={`text-sm rounded-lg px-4 py-3 ${mensaje.tipo === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
                {mensaje.texto}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {isPending ? "Actualizando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>

      </div>

      {/* ── Notificaciones push ── */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Notificaciones</h2>
        <NotificacionPerfilSection />
      </div>

      {/* ── Bloqueos de horario (solo empleados) ── */}
      {esEmpleado && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">Mis bloqueos de horario</h2>
            {!mostrarForm && (
              <button
                type="button"
                onClick={() => setMostrarForm(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
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
              className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-4"
            >
              <h3 className="text-sm font-semibold text-gray-700">Nuevo bloqueo</h3>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Inicio</p>
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
                <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Fin</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <input
                  {...formB.register("motivo")}
                  placeholder="Cita médica, día personal..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
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
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de bloqueos */}
          {bloqueos.length === 0 && !mostrarForm ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">
              Sin bloqueos. Usa <strong>Agregar</strong> para registrar uno.
            </div>
          ) : bloqueos.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {bloqueos.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-800 font-medium">
                      {fmtBloqueo(b.inicioEn)} — {fmtBloqueo(b.finEn)}
                    </p>
                    {b.motivo && <p className="text-xs text-gray-400 mt-0.5">{b.motivo}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (b.id) eliminarBloqueo(b.id); }}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition shrink-0 mt-0.5"
                    title="Eliminar bloqueo"
                  >
                    <Trash2 size={14} />
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
