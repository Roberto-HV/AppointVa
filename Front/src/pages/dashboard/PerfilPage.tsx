import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Copy, Check, Download } from "lucide-react";
import { Tooltip } from "../../components/ui/Tooltip";
import { QRCodeCanvas } from "qrcode.react";
import Modal from "../../components/ui/Modal";
import { negociosApi } from "../../api/negocios";
import { authApi } from "../../api/auth";
import { useToastStore } from "../../store/toastStore";
import { Skeleton } from "../../components/ui/Skeleton";
import type { ActualizarNegocioDto, HorarioDto } from "../../types";

const ZONAS_HORARIAS = [
  { valor: "America/Mexico_City",     texto: "Ciudad de México (CST/CDT)" },
  { valor: "America/Monterrey",       texto: "Monterrey (CST/CDT)" },
  { valor: "America/Tijuana",         texto: "Tijuana (PST/PDT)" },
  { valor: "America/Hermosillo",      texto: "Hermosillo (MST)" },
  { valor: "America/Cancun",          texto: "Cancún (EST)" },
  { valor: "America/Bogota",          texto: "Bogotá (COT)" },
  { valor: "America/Lima",            texto: "Lima (PET)" },
  { valor: "America/Santiago",        texto: "Santiago (CLT/CLST)" },
  { valor: "America/Buenos_Aires",    texto: "Buenos Aires (ART)" },
  { valor: "America/New_York",        texto: "Nueva York (EST/EDT)" },
  { valor: "America/Los_Angeles",     texto: "Los Ángeles (PST/PDT)" },
  { valor: "UTC",                     texto: "UTC" },
];

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const schemaPassword = z
  .object({
    passwordActual: z.string().min(1, "Requerido"),
    passwordNuevo: z.string().min(6, "Mínimo 6 caracteres"),
    confirmar: z.string(),
  })
  .refine((v) => v.passwordNuevo === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
type PasswordForm = z.infer<typeof schemaPassword>;

const HORAS_RECORDATORIO = [
  { valor: 2,  texto: "2 horas antes" },
  { valor: 4,  texto: "4 horas antes" },
  { valor: 12, texto: "12 horas antes" },
  { valor: 24, texto: "24 horas antes (1 día)" },
  { valor: 48, texto: "48 horas antes (2 días)" },
];

const HORAS_CANCELACION = [
  { valor: 0,  texto: "Sin restricción" },
  { valor: 1,  texto: "1 hora antes" },
  { valor: 2,  texto: "2 horas antes" },
  { valor: 4,  texto: "4 horas antes" },
  { valor: 12, texto: "12 horas antes" },
  { valor: 24, texto: "24 horas antes (1 día)" },
  { valor: 48, texto: "48 horas antes (2 días)" },
];

const schema = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
  descripcion: z.string().max(500).optional(),
  zonaHoraria: z.string().optional(),
  horasRecordatorio: z.coerce.number().optional(),
  horasCancelacion: z.coerce.number().optional(),
  autoConfirmar: z.boolean().optional(),
});
type PerfilForm = z.infer<typeof schema>;

function WidgetEmbebido({ bookingUrl }: { bookingUrl: string }) {
  const [copiado, setCopiado] = useState(false);
  const [vista, setVista] = useState<"iframe" | "boton">("iframe");

  const codigoIframe = `<iframe
  src="${bookingUrl}"
  width="100%"
  height="680"
  frameborder="0"
  style="border-radius:12px;border:1px solid #e5e7eb;"
></iframe>`;

  const codigoBoton = `<a
  href="${bookingUrl}"
  target="_blank"
  style="display:inline-block;background:#C8A961;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;"
>
  Reservar cita
</a>`;

  const codigo = vista === "iframe" ? codigoIframe : codigoBoton;

  const copiar = () => {
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Widget para tu sitio web</h2>
      <p className="text-xs text-gray-400 mb-4">
        Pega este código en tu sitio web para que tus clientes reserven directamente desde él.
      </p>
      <div className="flex gap-2 mb-3">
        {(["iframe", "boton"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
              vista === v ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {v === "iframe" ? "Formulario embebido" : "Botón de reserva"}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed font-mono">
          {codigo}
        </pre>
        <button
          onClick={copiar}
          className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition"
        >
          {copiado ? <Check size={12} /> : <Copy size={12} />}
          {copiado ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export default function PerfilPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const logoRef = useRef<HTMLInputElement>(null);
  const portadaRef = useRef<HTMLInputElement>(null);

  const { data: negocio, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<PerfilForm>({
    resolver: zodResolver(schema) as Resolver<PerfilForm>,
  });

  useEffect(() => {
    if (negocio) {
      reset({
        nombre: negocio.nombre, telefono: negocio.telefono ?? "",
        email: negocio.email ?? "", direccion: negocio.direccion ?? "",
        descripcion: negocio.descripcion ?? "", zonaHoraria: negocio.zonaHoraria ?? "",
        horasRecordatorio: negocio.horasRecordatorio ?? 24,
        horasCancelacion: negocio.horasCancelacion ?? 0,
        autoConfirmar: negocio.autoConfirmar ?? true,
      });
    }
  }, [negocio, reset]);

  const { mutate: guardar } = useMutation({
    mutationFn: (dto: ActualizarNegocioDto) => negociosApi.actualizarPerfil(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Cambios guardados"); },
  });

  const { mutate: subirLogo, isPending: subiendoLogo } = useMutation({
    mutationFn: (file: File) => negociosApi.subirLogo(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Logo actualizado"); },
  });

  const { mutate: subirPortada, isPending: subiendoPortada } = useMutation({
    mutationFn: (file: File) => negociosApi.subirPortada(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Portada actualizada"); },
  });

  const onSubmit = (data: PerfilForm) => {
    guardar({ ...data, email: data.email || undefined, telefono: data.telefono || undefined });
  };

  const [urlCopiada, setUrlCopiada] = useState(false);
  const [modalConfirmarGuardar, setModalConfirmarGuardar] = useState(false);

  const [horarios, setHorarios] = useState<HorarioDto[]>([]);
  const [horariosDirty, setHorariosDirty] = useState(false);

  const { data: horariosData } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: negociosApi.obtenerHorarios,
    enabled: !!negocio,
  });

  useEffect(() => {
    if (horariosData) {
      setHorarios(horariosData);
      setHorariosDirty(false);
    }
  }, [horariosData]);

  const { mutate: guardarHorarios, isPending: guardandoHorarios } = useMutation({
    mutationFn: () => negociosApi.actualizarHorarios(horarios),
    onSuccess: (data) => {
      setHorarios(data);
      setHorariosDirty(false);
      qc.invalidateQueries({ queryKey: ["horarios-negocio"] });
      toast("Horarios guardados");
    },
  });

  const actualizarHorario = (dia: number, campo: keyof HorarioDto, valor: string | boolean) => {
    setHorarios(prev => prev.map(h => h.diaSemana === dia ? { ...h, [campo]: valor } : h));
    setHorariosDirty(true);
  };

  const bookingUrl = negocio ? `${window.location.origin}/b/${negocio.slug}` : "";

  const copiarUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    setUrlCopiada(true);
    setTimeout(() => setUrlCopiada(false), 2000);
  };

  const descargarQR = () => {
    const canvas = document.getElementById("qr-reservas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${negocio?.slug ?? "reservas"}.png`;
    a.click();
  };

  // ── Días bloqueados ───────────────────────────────────────────────────────
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoMotivo, setNuevoMotivo] = useState("");

  const { data: diasBloqueados = [] } = useQuery({
    queryKey: ["dias-bloqueados"],
    queryFn: negociosApi.obtenerDiasBloqueados,
    enabled: !!negocio,
  });

  const { mutate: bloquearDia, isPending: bloqueando } = useMutation({
    mutationFn: () => negociosApi.bloquearDia(nuevaFecha, nuevoMotivo || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dias-bloqueados"] });
      setNuevaFecha("");
      setNuevoMotivo("");
      toast("Día bloqueado");
    },
    onError: () => toast("Ese día ya está bloqueado"),
  });

  const { mutate: desbloquear } = useMutation({
    mutationFn: (id: string) => negociosApi.desbloquearDia(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dias-bloqueados"] });
      toast("Día desbloqueado");
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mensajePassword, setMensajePassword] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const formPassword = useForm<PasswordForm>({ resolver: zodResolver(schemaPassword) });

  const { mutate: cambiarPassword, isPending: cambiandoPassword } = useMutation({
    mutationFn: (d: PasswordForm) => authApi.cambiarPassword(d.passwordActual, d.passwordNuevo),
    onSuccess: (resp) => {
      setMensajePassword({ tipo: "ok", texto: resp.mensaje });
      formPassword.reset();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { errores?: string[] } } })?.response?.data?.errores?.[0]
        ?? "No se pudo cambiar la contraseña.";
      setMensajePassword({ tipo: "error", texto: msg });
    },
  });

  if (isLoading) return (
    <div className="p-4 sm:p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <Skeleton className="h-4 w-36 mb-3" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex gap-6">
          <Skeleton className="w-20 h-20 rounded-xl" />
          <Skeleton className="w-40 h-20 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Mi negocio</h1>

      {/* Enlace de reservas */}
      {negocio && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Tu página de reservas</h2>
          <div className="flex items-center gap-2">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-primary font-mono truncate hover:underline"
            >
              {bookingUrl}
            </a>
            <button
              onClick={copiarUrl}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition whitespace-nowrap"
            >
              {urlCopiada ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {urlCopiada ? "¡Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* QR de reservas */}
      {negocio && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Código QR de reservas</h2>
          <div className="flex items-start gap-6 flex-wrap">
            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm inline-block">
              <QRCodeCanvas
                id="qr-reservas"
                value={bookingUrl}
                size={148}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#1a1a1a"
              />
            </div>
            <div className="flex flex-col justify-center gap-3">
              <p className="text-sm text-gray-500 max-w-xs">
                Comparte este código QR en tu negocio para que los clientes reserven escaneándolo con su celular.
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={descargarQR}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition"
                >
                  <Download size={14} />
                  Descargar PNG
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition"
                >
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget embebido */}
      {negocio && (
        <WidgetEmbebido bookingUrl={`${window.location.origin}/b/${negocio.slug}`} />
      )}

      {/* Imágenes */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Imágenes</h2>
        <div className="flex gap-6 flex-wrap">
          {/* Logo */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden mb-2 mx-auto flex items-center justify-center">
              {negocio?.logoUrl
                ? <img src={negocio.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold text-gray-300">{negocio?.nombre?.charAt(0)}</span>
              }
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); }} />
            <button onClick={() => logoRef.current?.click()} disabled={subiendoLogo}
              className="text-xs text-primary hover:underline disabled:opacity-50">
              {subiendoLogo ? "Subiendo..." : "Cambiar logo"}
            </button>
          </div>

          {/* Portada */}
          <div className="text-center">
            <div className="w-40 h-20 rounded-xl bg-gray-100 overflow-hidden mb-2 mx-auto flex items-center justify-center">
              {negocio?.portadaUrl
                ? <img src={negocio.portadaUrl} alt="Portada" className="w-full h-full object-cover" />
                : <span className="text-xs text-gray-400">Sin portada</span>
              }
            </div>
            <input ref={portadaRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirPortada(f); }} />
            <button onClick={() => portadaRef.current?.click()} disabled={subiendoPortada}
              className="text-xs text-primary hover:underline disabled:opacity-50">
              {subiendoPortada ? "Subiendo..." : "Cambiar portada"}
            </button>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Información del negocio</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio *</label>
            <input {...register("nombre")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`} />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input {...register("telefono")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo de contacto</label>
            <input type="email" {...register("email")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`} />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input {...register("direccion")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary" />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea rows={3} maxLength={500} {...register("descripcion")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none" />
            <p className="text-xs text-gray-400 text-right mt-0.5">{(watch("descripcion") ?? "").length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zona horaria</label>
            <Select {...register("zonaHoraria")} value={watch("zonaHoraria") ?? ""} className="w-full">
              <option value="">Seleccionar...</option>
              {ZONAS_HORARIAS.map((z) => (
                <option key={z.valor} value={z.valor}>{z.texto}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recordatorio al cliente</label>
            <Select {...register("horasRecordatorio")} value={watch("horasRecordatorio") ?? ""} className="w-full">
              {HORAS_RECORDATORIO.map((h) => (
                <option key={h.valor} value={h.valor}>{h.texto}</option>
              ))}
            </Select>
            <p className="text-xs text-gray-400 mt-1">Cuánto tiempo antes se envía el recordatorio por email.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Política de cancelación</label>
            <Select {...register("horasCancelacion")} value={watch("horasCancelacion") ?? ""} className="w-full">
              {HORAS_CANCELACION.map((h) => (
                <option key={h.valor} value={h.valor}>{h.texto}</option>
              ))}
            </Select>
            <p className="text-xs text-gray-400 mt-1">Tiempo mínimo de anticipación para cancelar una cita.</p>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Confirmación automática de citas</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Activado: las reservas quedan confirmadas de inmediato.<br />
                  Desactivado: quedan pendientes y debes confirmarlas manualmente.
                </p>
              </div>
              <div
                onClick={() => setValue("autoConfirmar", !(watch("autoConfirmar") ?? true), { shouldDirty: true })}
                className={`shrink-0 w-11 h-6 rounded-full transition relative cursor-pointer ${
                  watch("autoConfirmar") ?? true ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  watch("autoConfirmar") ?? true ? "left-6" : "left-1"
                }`} />
              </div>
            </div>
          </div>

          {negocio?.planNombre && (
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan activo</label>
              <p className="px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-600">{negocio.planNombre}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isSubmitting || !isDirty}
          onClick={() => setModalConfirmarGuardar(true)}
          className="bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
        >
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Horarios de atención */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Horarios de atención</h2>
        <div className="space-y-2">
          {horarios.map((h) => (
            <div key={h.diaSemana} className="flex items-center gap-3">
              <div className="w-36 shrink-0">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => actualizarHorario(h.diaSemana!, "activo", !h.activo)}
                    className={`w-9 h-5 rounded-full transition relative cursor-pointer ${h.activo ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.activo ? "left-4" : "left-0.5"}`} />
                  </div>
                  <span className="text-sm text-gray-700">{DIAS[h.diaSemana ?? 0]}</span>
                </label>
              </div>
              {h.activo ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={h.horaInicio}
                    onChange={(e) => actualizarHorario(h.diaSemana!, "horaInicio", e.target.value)}
                    className="px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
                  />
                  <span className="text-gray-400 text-sm">—</span>
                  <input
                    type="time"
                    value={h.horaFin}
                    onChange={(e) => actualizarHorario(h.diaSemana!, "horaFin", e.target.value)}
                    className="px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">Cerrado</span>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => guardarHorarios()}
          disabled={guardandoHorarios || !horariosDirty}
          className="mt-4 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
        >
          {guardandoHorarios ? "Guardando..." : "Guardar horarios"}
        </button>
      </div>

      {/* Días bloqueados */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Días sin atención</h2>
        <p className="text-xs text-gray-400 mb-4">Bloquea días donde el negocio no trabajará (feriados, vacaciones). Los clientes no podrán reservar esos días.</p>

        <div className="flex gap-2 mb-4 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha</label>
            <input
              type="date"
              value={nuevaFecha}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">Motivo <span className="text-gray-400">(opcional)</span></label>
            <input
              type="text"
              value={nuevoMotivo}
              onChange={(e) => setNuevoMotivo(e.target.value)}
              placeholder="Ej: Día festivo, Vacaciones..."
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => nuevaFecha && bloquearDia()}
            disabled={!nuevaFecha || bloqueando}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition"
          >
            {bloqueando ? "Guardando..." : "+ Bloquear día"}
          </button>
        </div>

        {diasBloqueados.length === 0 ? (
          <p className="text-sm text-gray-400">No hay días bloqueados próximos.</p>
        ) : (
          <div className="space-y-2">
            {diasBloqueados.map((b) => {
              const fecha = new Date(b.fecha + "T12:00:00");
              return (
                <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-red-700 capitalize">
                      {fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/\bDe\b/g, "de")}
                    </span>
                    {b.motivo && <span className="text-xs text-red-500 ml-2">— {b.motivo}</span>}
                  </div>
                  <button
                    onClick={() => desbloquear(b.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cambiar contraseña */}
      <form
        onSubmit={formPassword.handleSubmit((d) => { setMensajePassword(null); cambiarPassword(d); })}
        className="bg-white rounded-xl border border-gray-100 p-5 space-y-4 mt-6"
      >
        <h2 className="text-sm font-semibold text-gray-700">Cambiar contraseña</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Contraseña actual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
            <div className="relative">
              <input
                type={mostrarActual ? "text" : "password"}
                {...formPassword.register("passwordActual")}
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-primary
                  ${formPassword.formState.errors.passwordActual ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              />
              <Tooltip text={mostrarActual ? "Ocultar contraseña" : "Mostrar contraseña"}>
                <button type="button" onClick={() => setMostrarActual(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {mostrarActual ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </Tooltip>
            </div>
            {formPassword.formState.errors.passwordActual && (
              <p className="text-red-500 text-xs mt-1">{formPassword.formState.errors.passwordActual.message}</p>
            )}
          </div>

          {/* Nueva contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={mostrarNueva ? "text" : "password"}
                {...formPassword.register("passwordNuevo")}
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-primary
                  ${formPassword.formState.errors.passwordNuevo ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                placeholder="Mínimo 6 caracteres"
              />
              <Tooltip text={mostrarNueva ? "Ocultar contraseña" : "Mostrar contraseña"}>
                <button type="button" onClick={() => setMostrarNueva(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </Tooltip>
            </div>
            {formPassword.formState.errors.passwordNuevo && (
              <p className="text-red-500 text-xs mt-1">{formPassword.formState.errors.passwordNuevo.message}</p>
            )}
          </div>

          {/* Confirmar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              {...formPassword.register("confirmar")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${formPassword.formState.errors.confirmar ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formPassword.formState.errors.confirmar && (
              <p className="text-red-500 text-xs mt-1">{formPassword.formState.errors.confirmar.message}</p>
            )}
          </div>
        </div>

        {mensajePassword && (
          <div className={`text-sm rounded-lg px-4 py-3 ${
            mensajePassword.tipo === "ok"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}>
            {mensajePassword.texto}
          </div>
        )}

        <button
          type="submit"
          disabled={cambiandoPassword}
          className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
        >
          {cambiandoPassword ? "Actualizando..." : "Cambiar contraseña"}
        </button>
      </form>

      {/* Modal confirmar guardar perfil */}
      <Modal
        abierto={modalConfirmarGuardar}
        onCerrar={() => setModalConfirmarGuardar(false)}
        titulo="Guardar cambios"
        ancho="sm"
      >
        <p className="text-sm text-gray-600 mb-1">
          ¿Estás seguro de que deseas guardar los cambios en tu perfil de negocio?
        </p>
        <p className="text-xs text-gray-400 mb-6">Esta acción actualizará la información visible para tus clientes.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setModalConfirmarGuardar(false)}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => { setModalConfirmarGuardar(false); handleSubmit(onSubmit)(); }}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition"
          >
            Sí, guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
