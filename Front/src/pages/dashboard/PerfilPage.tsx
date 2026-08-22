import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, Mail, Trash2 } from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
import { QRCodeCanvas } from "qrcode.react";
import { negociosApi } from "../../api/negocios";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { Skeleton } from "../../components/ui/Skeleton";
import { TimePicker, DatePicker } from "../../components/ui/DateTimePicker";
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
  listaEsperaActiva: z.boolean().optional(),
  metodoNotificacion: z.enum(["Correo", "WhatsApp", "Ambos"]).optional(),
  telefonoWhatsApp: z.string().max(30).optional(),
  requiereAnticipo: z.boolean().optional(),
  montoAnticipo: z.coerce.number().min(0).optional(),
  instruccionesAnticipo: z.string().max(500).optional(),
  porcentajeAnticipo: z.number().int().min(1).max(100).default(10),
  horasCancelacionConReembolso: z.number().int().min(0).default(24),
  politicaCancelacionAnticipo: z.string().max(500).default(''),
  instagramUrl: z.string().max(200).optional(),
  facebookUrl: z.string().max(200).optional(),
  tiktokUrl: z.string().max(200).optional(),
});
type PerfilForm = z.infer<typeof schema>;

type Tab = "perfil" | "citas" | "anticipos" | "horarios" | "cuenta";

export default function PerfilPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const navigate = useNavigate();
  const { refreshToken, cerrarSesion, usuario } = useAuthStore();
  const logoRef = useRef<HTMLInputElement>(null);
  const portadaRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = searchParams.get("tab");
  const tab: Tab = (["perfil", "citas", "anticipos", "horarios", "cuenta"] as Tab[]).includes(tabRaw as Tab)
    ? (tabRaw as Tab)
    : "perfil";
  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });
  const [modalEliminar, setModalEliminar] = useState(false);
  const [contrasenaEliminar, setContrasenaEliminar] = useState("");

  const { data: negocio, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<PerfilForm>({
    resolver: zodResolver(schema) as Resolver<PerfilForm>,
  });

  useUnsavedChanges(isDirty);

  useEffect(() => {
    if (negocio) {
      reset({
        nombre: negocio.nombre, telefono: negocio.telefono ?? "",
        email: negocio.email || usuario?.email || "", direccion: negocio.direccion ?? "",
        descripcion: negocio.descripcion ?? "", zonaHoraria: negocio.zonaHoraria ?? "",
        horasRecordatorio: negocio.horasRecordatorio ?? 24,
        horasCancelacion: negocio.horasCancelacion ?? 0,
        autoConfirmar: negocio.autoConfirmar ?? true,
        listaEsperaActiva: negocio.listaEsperaActiva ?? false,
        metodoNotificacion: (negocio.metodoNotificacion as "Correo" | "WhatsApp" | "Ambos") ?? "Correo",
        telefonoWhatsApp: negocio.telefonoWhatsApp ?? "",
        requiereAnticipo: negocio.requiereAnticipo ?? false,
        montoAnticipo: negocio.montoAnticipo ?? 0,
        instruccionesAnticipo: negocio.instruccionesAnticipo ?? "",
        porcentajeAnticipo: negocio.porcentajeAnticipo ?? 10,
        horasCancelacionConReembolso: negocio.horasCancelacionConReembolso ?? 24,
        politicaCancelacionAnticipo: negocio.politicaCancelacionAnticipo ?? '',
        instagramUrl: negocio.instagramUrl ?? "",
        facebookUrl: negocio.facebookUrl ?? "",
        tiktokUrl: negocio.tiktokUrl ?? "",
      });
      const c = negocio.colorPrimario ?? "#334155";
      setColorPrimario(c);
      setColorGuardado(c);
      setPortadaObjectPosition(negocio.portadaObjectPosition ?? "center");
    }
  }, [negocio, reset]);

  const { mutate: guardar } = useMutation({
    mutationFn: (dto: ActualizarNegocioDto) => negociosApi.actualizarPerfil(dto),
    onSuccess: (_, variables) => {
      reset(variables as unknown as PerfilForm);
      qc.invalidateQueries({ queryKey: ["negocio-perfil"] });
      toast("Cambios guardados");
    },
    onError: () => toast("No se pudieron guardar los cambios. Intenta de nuevo.", "error"),
  });

  const { mutate: subirLogo, isPending: subiendoLogo } = useMutation({
    mutationFn: (file: File) => negociosApi.subirLogo(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Logo actualizado"); },
    onError: () => toast("No se pudo subir el logo. Intenta de nuevo.", "error"),
  });

  const { mutate: subirPortada, isPending: subiendoPortada } = useMutation({
    mutationFn: (file: File) => negociosApi.subirPortada(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Portada actualizada"); },
    onError: () => toast("No se pudo subir la portada. Intenta de nuevo.", "error"),
  });

  const onSubmit = (data: PerfilForm) => {
    if (data.requiereAnticipo && (data.porcentajeAnticipo < 1 || data.porcentajeAnticipo > 100)) {
      toast("El porcentaje de anticipo debe estar entre 1% y 100%.", "error");
      return;
    }
    guardar({ ...data, email: data.email || undefined, telefono: data.telefono || undefined, portadaObjectPosition });
  };

  const { mutate: eliminarCuenta, isPending: eliminando } = useMutation({
    mutationFn: () => authApi.eliminarCuenta(contrasenaEliminar),
    onSuccess: async () => {
      try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignored */ }
      cerrarSesion();
      navigate("/login");
    },
    onError: () => toast("Contraseña incorrecta o no se pudo eliminar la cuenta.", "error"),
  });

  // ── Horarios ─────────────────────────────────────────────────────────────
  const [portadaObjectPosition, setPortadaObjectPosition] = useState<string>("center");
  const [colorPrimario, setColorPrimario] = useState("#334155");
  const [colorGuardado, setColorGuardado] = useState("#334155");

  const { mutate: guardarColores, isPending: guardandoColores } = useMutation({
    mutationFn: () => negociosApi.actualizarColores(colorPrimario),
    onSuccess: () => {
      setColorGuardado(colorPrimario);
      qc.invalidateQueries({ queryKey: ["negocio-perfil"] });
      toast("Color actualizado");
    },
    onError: () => toast("No se pudo guardar el color. Intenta de nuevo.", "error"),
  });

  const [horarios, setHorarios] = useState<HorarioDto[]>([]);
  const [horariosDirty, setHorariosDirty] = useState(false);

  const { data: horariosData } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: negociosApi.obtenerHorarios,
    enabled: !!negocio,
  });

  useEffect(() => {
    if (horariosData) { setHorarios(horariosData); setHorariosDirty(false); }
  }, [horariosData]);

  useEffect(() => {
    if (horariosDirty) {
      window.onbeforeunload = () => "Tienes cambios sin guardar en el horario.";
    } else {
      window.onbeforeunload = null;
    }
    return () => { window.onbeforeunload = null; };
  }, [horariosDirty]);

  const { mutate: guardarHorarios, isPending: guardandoHorarios } = useMutation({
    mutationFn: () => negociosApi.actualizarHorarios(horarios),
    onSuccess: (data) => {
      setHorarios(data); setHorariosDirty(false);
      qc.invalidateQueries({ queryKey: ["horarios-negocio"] });
      toast("Horarios guardados");
    },
    onError: () => toast("No se pudieron guardar los horarios. Intenta de nuevo.", "error"),
  });

  const actualizarHorario = (dia: number, campo: keyof HorarioDto, valor: string | boolean) => {
    setHorarios(prev => prev.map(h => h.diaSemana === dia ? { ...h, [campo]: valor } : h));
    setHorariosDirty(true);
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
      setNuevaFecha(""); setNuevoMotivo(""); toast("Día bloqueado");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.mensaje ?? "No se pudo bloquear el día. Intenta de nuevo.";
      toast(msg, "error");
    },
  });

  const { mutate: desbloquear } = useMutation({
    mutationFn: (id: string) => negociosApi.desbloquearDia(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dias-bloqueados"] }); toast("Día desbloqueado"); },
    onError: () => toast("No se pudo desbloquear el día. Intenta de nuevo.", "error"),
  });

  // ── URL de reservas ───────────────────────────────────────────────────────
  const bookingUrl = negocio ? `${window.location.origin}/b/${negocio.slug}` : "";

  const descargarQR = () => {
    const canvas = document.getElementById("qr-reservas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `qr-${negocio?.slug ?? "reservas"}.png`; a.click();
  };

  // ── Botón guardar compartido ─────────────────────────────────────────────
  const btnGuardar = (
    <button
      type="submit"
      disabled={isSubmitting}
      className="bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
    >
      {isSubmitting ? "Guardando..." : "Guardar cambios"}
    </button>
  );

  if (isLoading) return (
    <div className="p-4 sm:p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <Skeleton className="h-4 w-36 mb-3" /><Skeleton className="h-10 rounded-lg" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Mi negocio</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 mb-6 overflow-x-auto">
        {([
          { id: "perfil", label: "Perfil" },
          { id: "citas", label: "Citas" },
          { id: "anticipos", label: "Anticipos" },
          { id: "horarios", label: "Horarios" },
          { id: "cuenta", label: "Cuenta" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap py-2 px-2 sm:px-3 text-xs sm:text-sm font-medium rounded-lg transition ${
              tab === t.id
                ? "bg-white dark:bg-slate-800 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PERFIL ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={tab !== "perfil" ? "hidden" : "space-y-6"}>

          {/* Información del negocio */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Información del negocio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del negocio *</label>
                <input {...register("nombre")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100
                    ${errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200 dark:border-slate-600"}`} />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                <input {...register("telefono")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo de contacto</label>
                <input type="email" {...register("email")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100
                    ${errors.email ? "border-red-400 bg-red-50" : "border-gray-200 dark:border-slate-600"}`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                <input {...register("direccion")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea rows={3} maxLength={500} {...register("descripcion")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 resize-none" />
                <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-0.5">{(watch("descripcion") ?? "").length}/500</p>
              </div>
            </div>
          </div>

          {/* Imágenes */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Imágenes</h2>
            <div className="flex gap-6 flex-wrap">
              <div className="text-center">
                <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden mb-2 mx-auto flex items-center justify-center">
                  {negocio?.logoUrl
                    ? <img src={negocio.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">{negocio?.nombre?.charAt(0)}</span>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); }} />
                <button type="button" onClick={() => logoRef.current?.click()} disabled={subiendoLogo}
                  className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                  {subiendoLogo ? "Subiendo..." : "Cambiar logo"}
                </button>
              </div>
              <div className="text-center">
                <div className="w-40 h-20 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden mb-2 mx-auto flex items-center justify-center">
                  {negocio?.portadaUrl
                    ? <img src={negocio.portadaUrl} alt="Portada" className="w-full h-full object-cover" />
                    : <span className="text-xs text-gray-400 dark:text-gray-500">Sin portada</span>}
                </div>
                <input ref={portadaRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirPortada(f); }} />
                <button type="button" onClick={() => portadaRef.current?.click()} disabled={subiendoPortada}
                  className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                  {subiendoPortada ? "Subiendo..." : "Cambiar portada"}
                </button>
                {negocio?.portadaUrl && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 text-center">Posición</p>
                    <div className="flex gap-1 justify-center">
                      {(["top", "center", "bottom"] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setPortadaObjectPosition(pos)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                            portadaObjectPosition === pos
                              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                              : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                          }`}
                        >
                          {pos === "top" ? "Arriba" : pos === "center" ? "Centro" : "Abajo"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Color del booking */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Color de tu página de reservas</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Se usa en botones, selección de servicios, fechas y el encabezado de tu página.</p>
            <div className="flex gap-3 items-center mb-4">
              <input
                type="color"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200 dark:border-slate-600 p-0.5 shrink-0"
              />
              <input
                type="text"
                value={colorPrimario}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColorPrimario(v);
                }}
                className="w-32 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 font-mono uppercase"
                maxLength={7}
                placeholder="#334155"
              />
            </div>
            {/* Vista previa del header del booking */}
            <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 mb-4">
              <div className="px-4 pt-3 pb-3 flex items-start gap-3 relative"
                style={{ background: "#0C0C0F" }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse 80% 120% at 0% 0%, ${colorPrimario}38 0%, transparent 70%)` }} />
                <div className="w-10 h-10 rounded-xl shrink-0 relative z-10"
                  style={{ background: `${colorPrimario}28`, border: `1.5px solid ${colorPrimario}60` }} />
                <div className="relative z-10">
                  <div className="text-white text-sm font-bold leading-tight">Tu negocio</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Descripción breve...</div>
                </div>
              </div>
              <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#18181B" }}>
                {[1,2,3,4].map((i) => (
                  <div key={i} style={{
                    height: "3px", borderRadius: "2px",
                    width: i === 1 ? "34px" : "22px",
                    background: i === 1 ? colorPrimario : "rgba(255,255,255,0.1)",
                  }} />
                ))}
              </div>
              <div className="bg-white px-4 py-3">
                <div className="h-2.5 w-3/4 rounded bg-slate-100 mb-1.5" />
                <div className="h-2 w-1/2 rounded bg-slate-50 mb-3" />
                <div className="rounded-xl border-2 px-3 py-2.5 flex items-center gap-3"
                  style={{ borderColor: colorPrimario, background: `${colorPrimario}0D` }}>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />
                  <div className="flex-1">
                    <div className="h-2.5 w-24 rounded mb-1" style={{ background: colorPrimario, opacity: 0.8 }} />
                    <div className="h-2 w-16 rounded bg-slate-100" />
                  </div>
                  <div className="h-3 w-12 rounded font-bold text-xs" style={{ background: colorPrimario, opacity: 0.8 }} />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => guardarColores()}
              disabled={guardandoColores || colorPrimario === colorGuardado || colorPrimario.length < 4}
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-semibold transition"
            >
              {guardandoColores ? "Guardando..." : "Guardar color"}
            </button>
          </div>

          {/* Redes sociales */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Redes sociales</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Se muestran en tu página de reservas para que los clientes te sigan.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)" }}>
                  <SiInstagram className="w-4 h-4 text-white" />
                </div>
                <input {...register("instagramUrl")} placeholder="https://instagram.com/tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                  <SiFacebook className="w-4 h-4 text-white" />
                </div>
                <input {...register("facebookUrl")} placeholder="https://facebook.com/tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                  <SiTiktok className="w-4 h-4 text-white" />
                </div>
                <input {...register("tiktokUrl")} placeholder="https://tiktok.com/@tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Pega la URL completa. Deja vacío si no usas esa red.</p>
          </div>

          {/* QR */}
          {negocio && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Código QR de reservas</h2>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm inline-block shrink-0">
                  <QRCodeCanvas id="qr-reservas" value={bookingUrl} size={120} level="M"
                    includeMargin={false} bgColor="#ffffff" fgColor="#1a1a1a" />
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                    Comparte este código en tu negocio para que los clientes reserven escaneándolo.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={descargarQR}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition">
                      <Download size={14} /> Descargar PNG
                    </button>
                    <button type="button" onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition">
                      Imprimir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {btnGuardar}
        </div>

        {/* ── TAB: CITAS ──────────────────────────────────────────────────────── */}
        {tab === "citas" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ajustes de citas</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zona horaria</label>
                  <Select {...register("zonaHoraria")} value={watch("zonaHoraria") ?? ""} className="w-full">
                    <option value="">Seleccionar...</option>
                    {ZONAS_HORARIAS.map((z) => (
                      <option key={z.valor} value={z.valor}>{z.texto}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recordatorio al cliente</label>
                  <Select {...register("horasRecordatorio")} value={watch("horasRecordatorio") ?? ""} className="w-full">
                    {HORAS_RECORDATORIO.map((h) => (
                      <option key={h.valor} value={h.valor}>{h.texto}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cuánto antes se envía el recordatorio por email.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Política de cancelación</label>
                  <Select {...register("horasCancelacion")} value={watch("horasCancelacion") ?? ""} className="w-full">
                    {HORAS_CANCELACION.map((h) => (
                      <option key={h.valor} value={h.valor}>{h.texto}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Anticipación mínima para que el cliente cancele.</p>
                </div>
                {negocio?.planNombre && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan activo</label>
                    <p className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-sm text-gray-600 dark:text-gray-400">{negocio.planNombre}</p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmación automática de citas</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Activado: las reservas quedan confirmadas de inmediato.<br />
                    Desactivado: quedan pendientes y debes confirmarlas manualmente.
                  </p>
                </div>
                <div
                  onClick={() => setValue("autoConfirmar", !(watch("autoConfirmar") ?? true), { shouldDirty: true })}
                  className={`shrink-0 w-11 h-6 rounded-full transition relative cursor-pointer ${
                    watch("autoConfirmar") ?? true ? "bg-slate-700" : "bg-gray-300"
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    watch("autoConfirmar") ?? true ? "left-6" : "left-1"
                  }`} />
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lista de espera</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Activado: cuando canceles una cita se notificará automáticamente al primer cliente en espera.<br />
                    Desactivado: la lista de espera no genera notificaciones automáticas.
                  </p>
                </div>
                <div
                  onClick={() => setValue("listaEsperaActiva", !(watch("listaEsperaActiva") ?? false), { shouldDirty: true })}
                  className={`shrink-0 w-11 h-6 rounded-full transition relative cursor-pointer ${
                    watch("listaEsperaActiva") ? "bg-slate-700" : "bg-gray-300"
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    watch("listaEsperaActiva") ? "left-6" : "left-1"
                  }`} />
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Canal de notificaciones al cliente</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button type="button"
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-white">
                    <Mail size={13} /> Correo
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Los clientes reciben confirmaciones, recordatorios y cancelaciones por correo electrónico.</p>
              </div>
            </div>

            {btnGuardar}
          </div>
        )}

        {/* ── TAB: ANTICIPOS ──────────────────────────────────────────────────── */}
        {tab === "anticipos" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Anticipo al reservar</h3>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Requerir anticipo al reservar</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">El cliente deberá pagar un anticipo antes de confirmar su cita</p>
                </div>
                <input type="checkbox" {...register("requiereAnticipo")} className="w-4 h-4 rounded" />
              </div>

              {watch("requiereAnticipo") && (
                <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-slate-700">

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Porcentaje del anticipo
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={80}
                        step={5}
                        {...register("porcentajeAnticipo", { valueAsNumber: true })}
                        className="flex-1 accent-slate-700"
                      />
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-12 text-right">
                        {watch("porcentajeAnticipo")}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Entre 10% y 80% del costo del servicio</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Horas mínimas de anticipación para reembolso
                    </label>
                    <input
                      type="number"
                      min={0}
                      {...register("horasCancelacionConReembolso", { valueAsNumber: true })}
                      className="w-32 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = sin reembolso en ningún caso</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Política de cancelación <span className="text-gray-400">(visible para el cliente)</span>
                    </label>
                    <textarea
                      maxLength={500}
                      rows={3}
                      placeholder="Ej: El anticipo es reembolsable si cancelas con al menos 24 horas de anticipación..."
                      {...register("politicaCancelacionAnticipo")}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {(watch("politicaCancelacionAnticipo") ?? '').length}/500 caracteres
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Instrucciones de pago del anticipo <span className="text-gray-400">(visible para el cliente)</span>
                    </label>
                    <textarea
                      maxLength={500}
                      rows={3}
                      placeholder="Ej: Transferir a la cuenta CLABE 012345678901234567 a nombre de..."
                      {...register("instruccionesAnticipo")}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {btnGuardar}
          </div>
        )}
      </form>

      {/* ── Modal: eliminar cuenta ─────────────────────────────────────────── */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">¿Eliminar tu cuenta?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Esta acción es irreversible. Ingresa tu contraseña actual para confirmar.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Contraseña actual"
              value={contrasenaEliminar}
              onChange={(e) => setContrasenaEliminar(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-red-400 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalEliminar(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!contrasenaEliminar || eliminando}
                onClick={() => eliminarCuenta()}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CUENTA ─────────────────────────────────────────────────────── */}
      {tab === "cuenta" && (
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-1">Tu suscripción</p>
            <p className="text-base font-bold text-slate-800 dark:text-gray-200">
              {negocio?.planNombre ?? "Sin plan asignado"}
            </p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
              ¿Quieres cambiar de plan? Escríbenos a{" "}
              <a
                href="mailto:hola@appointva.com"
                className="text-slate-600 dark:text-gray-400 font-semibold underline"
              >
                hola@appointva.com
              </a>
            </p>
          </div>

          <div className="border border-red-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-2">
              <Trash2 size={15} /> Zona de peligro
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Eliminar tu cuenta es permanente. Todos tus datos personales serán eliminados de forma irreversible. El historial de citas se conservará de forma anonimizada.
            </p>
            <button
              type="button"
              onClick={() => { setContrasenaEliminar(""); setModalEliminar(true); }}
              className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition"
            >
              Eliminar mi cuenta
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: HORARIOS ───────────────────────────────────────────────────── */}
      {tab === "horarios" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Horarios de atención</h2>
            <div className="space-y-3">
              {horarios.map((h) => (
                <div key={h.diaSemana} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none sm:w-28 sm:shrink-0">
                    <div onClick={() => actualizarHorario(h.diaSemana!, "activo", !h.activo)}
                      className={`w-9 h-5 rounded-full transition relative cursor-pointer shrink-0 ${h.activo ? "bg-slate-700" : "bg-gray-300"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.activo ? "left-4" : "left-0.5"}`} />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{DIAS[h.diaSemana ?? 0]}</span>
                  </label>
                  {h.activo ? (
                    <div className="flex items-center gap-2 pl-11 sm:pl-0">
                      <div className="w-32">
                        <TimePicker value={h.horaInicio} onChange={(v) => actualizarHorario(h.diaSemana!, "horaInicio", v)} />
                      </div>
                      <span className="text-gray-400 dark:text-gray-500 text-sm shrink-0">—</span>
                      <div className="w-32">
                        <TimePicker value={h.horaFin} onChange={(v) => actualizarHorario(h.diaSemana!, "horaFin", v)} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500 pl-11 sm:pl-0">Cerrado</span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => guardarHorarios()} disabled={guardandoHorarios || !horariosDirty}
              className="mt-4 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm">
              {guardandoHorarios ? "Guardando..." : "Guardar horarios"}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Días sin atención</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Bloquea días donde el negocio no trabajará (feriados, vacaciones). Los clientes no podrán reservar esos días.</p>
            <div className="flex gap-2 mb-4 flex-wrap items-end">
              <div className="w-48">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
                <DatePicker value={nuevaFecha} onChange={(v) => setNuevaFecha(v)} minDate={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Motivo <span className="text-gray-400 dark:text-gray-500">(opcional)</span></label>
                <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)}
                  placeholder="Ej: Día festivo, Vacaciones..." maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <button onClick={() => nuevaFecha && bloquearDia()} disabled={!nuevaFecha || bloqueando}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition">
                {bloqueando ? "Guardando..." : "+ Bloquear día"}
              </button>
            </div>
            {diasBloqueados.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No hay días bloqueados próximos.</p>
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
                      <button onClick={() => desbloquear(b.id)} className="text-xs text-red-400 hover:text-red-600 transition">
                        Quitar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
