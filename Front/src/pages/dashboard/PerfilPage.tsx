import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Check, Download, Mail, Trash2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { negociosApi } from "../../api/negocios";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
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
  metodoNotificacion: z.enum(["Correo", "WhatsApp", "Ambos"]).optional(),
  telefonoWhatsApp: z.string().max(30).optional(),
  requiereAnticipo: z.boolean().optional(),
  montoAnticipo: z.coerce.number().min(0).optional(),
  instruccionesAnticipo: z.string().max(500).optional(),
  instagramUrl: z.string().max(200).optional(),
  facebookUrl: z.string().max(200).optional(),
  tiktokUrl: z.string().max(200).optional(),
});
type PerfilForm = z.infer<typeof schema>;

type Tab = "perfil" | "configuracion" | "horarios";

export default function PerfilPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const navigate = useNavigate();
  const { refreshToken, cerrarSesion } = useAuthStore();
  const logoRef = useRef<HTMLInputElement>(null);
  const portadaRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("perfil");
  const [urlCopiada, setUrlCopiada] = useState(false);
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
        email: negocio.email ?? "", direccion: negocio.direccion ?? "",
        descripcion: negocio.descripcion ?? "", zonaHoraria: negocio.zonaHoraria ?? "",
        horasRecordatorio: negocio.horasRecordatorio ?? 24,
        horasCancelacion: negocio.horasCancelacion ?? 0,
        autoConfirmar: negocio.autoConfirmar ?? true,
        metodoNotificacion: (negocio.metodoNotificacion as "Correo" | "WhatsApp" | "Ambos") ?? "Correo",
        telefonoWhatsApp: negocio.telefonoWhatsApp ?? "",
        requiereAnticipo: negocio.requiereAnticipo ?? false,
        montoAnticipo: negocio.montoAnticipo ?? 0,
        instruccionesAnticipo: negocio.instruccionesAnticipo ?? "",
        instagramUrl: negocio.instagramUrl ?? "",
        facebookUrl: negocio.facebookUrl ?? "",
        tiktokUrl: negocio.tiktokUrl ?? "",
      });
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
    guardar({ ...data, email: data.email || undefined, telefono: data.telefono || undefined });
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
    onError: () => toast("Ese día ya está bloqueado"),
  });

  const { mutate: desbloquear } = useMutation({
    mutationFn: (id: string) => negociosApi.desbloquearDia(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dias-bloqueados"] }); toast("Día desbloqueado"); },
    onError: () => toast("No se pudo desbloquear el día. Intenta de nuevo.", "error"),
  });

  // ── URL de reservas ───────────────────────────────────────────────────────
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
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <Skeleton className="h-4 w-36 mb-3" /><Skeleton className="h-10 rounded-lg" />
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi negocio</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {(["perfil", "configuracion", "horarios"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "perfil" ? "Perfil" : t === "configuracion" ? "Configuración" : "Horarios"}
          </button>
        ))}
      </div>

      {/* ── TAB: PERFIL ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={tab !== "perfil" ? "hidden" : "space-y-6"}>

          {/* URL + QR */}
          {negocio && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Tu página de reservas</h2>
              <div className="flex items-center gap-2 mb-5">
                <a href={bookingUrl} target="_blank" rel="noreferrer"
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-slate-700 font-mono truncate hover:underline">
                  {bookingUrl}
                </a>
                <button onClick={copiarUrl}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
                  {urlCopiada ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {urlCopiada ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Código QR</h2>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm inline-block shrink-0">
                  <QRCodeCanvas id="qr-reservas" value={bookingUrl} size={120} level="M"
                    includeMargin={false} bgColor="#ffffff" fgColor="#1a1a1a" />
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <p className="text-sm text-gray-500 max-w-xs">
                    Comparte este código en tu negocio para que los clientes reserven escaneándolo.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={descargarQR}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition">
                      <Download size={14} /> Descargar PNG
                    </button>
                    <button type="button" onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition">
                      Imprimir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Imágenes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Imágenes</h2>
            <div className="flex gap-6 flex-wrap">
              <div className="text-center">
                <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden mb-2 mx-auto flex items-center justify-center">
                  {negocio?.logoUrl
                    ? <img src={negocio.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : <span className="text-2xl font-bold text-gray-300">{negocio?.nombre?.charAt(0)}</span>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); }} />
                <button type="button" onClick={() => logoRef.current?.click()} disabled={subiendoLogo}
                  className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                  {subiendoLogo ? "Subiendo..." : "Cambiar logo"}
                </button>
              </div>
              <div className="text-center">
                <div className="w-40 h-20 rounded-xl bg-gray-100 overflow-hidden mb-2 mx-auto flex items-center justify-center">
                  {negocio?.portadaUrl
                    ? <img src={negocio.portadaUrl} alt="Portada" className="w-full h-full object-cover" />
                    : <span className="text-xs text-gray-400">Sin portada</span>}
                </div>
                <input ref={portadaRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirPortada(f); }} />
                <button type="button" onClick={() => portadaRef.current?.click()} disabled={subiendoPortada}
                  className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                  {subiendoPortada ? "Subiendo..." : "Cambiar portada"}
                </button>
              </div>
            </div>
          </div>

          {/* Redes sociales */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Redes sociales</h2>
            <p className="text-xs text-gray-400 mb-4">Se muestran en tu página de reservas para que los clientes te sigan.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)" }}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </div>
                <input {...register("instagramUrl")} placeholder="https://instagram.com/tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <input {...register("facebookUrl")} placeholder="https://facebook.com/tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>
                </div>
                <input {...register("tiktokUrl")} placeholder="https://tiktok.com/@tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Pega la URL completa. Deja vacío si no usas esa red.</p>
          </div>

          {/* Información básica */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Información del negocio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio *</label>
                <input {...register("nombre")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700
                    ${errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`} />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input {...register("telefono")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo de contacto</label>
                <input type="email" {...register("email")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700
                    ${errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input {...register("direccion")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea rows={3} maxLength={500} {...register("descripcion")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none" />
                <p className="text-xs text-gray-400 text-right mt-0.5">{(watch("descripcion") ?? "").length}/500</p>
              </div>
            </div>
          </div>

          {btnGuardar}
        </div>

        {/* ── TAB: CONFIGURACIÓN ──────────────────────────────────────────────── */}
        <div className={tab !== "configuracion" ? "hidden" : "space-y-6"}>
          {/* Tarjeta de suscripción */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Tu suscripción</p>
            <p className="text-base font-bold text-slate-800">
              {negocio?.planNombre ?? "Sin plan asignado"}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              ¿Quieres cambiar de plan?{" "}
              <a
                href="https://wa.me/521XXXXXXXXXX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 font-semibold underline"
              >
                Contáctanos por WhatsApp
              </a>
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700">Ajustes de citas</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <p className="text-xs text-gray-400 mt-1">Cuánto antes se envía el recordatorio por email.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Política de cancelación</label>
                <Select {...register("horasCancelacion")} value={watch("horasCancelacion") ?? ""} className="w-full">
                  {HORAS_CANCELACION.map((h) => (
                    <option key={h.valor} value={h.valor}>{h.texto}</option>
                  ))}
                </Select>
                <p className="text-xs text-gray-400 mt-1">Anticipación mínima para que el cliente cancele.</p>
              </div>
              {negocio?.planNombre && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan activo</label>
                  <p className="px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-600">{negocio.planNombre}</p>
                </div>
              )}
            </div>

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
                  watch("autoConfirmar") ?? true ? "bg-slate-700" : "bg-gray-300"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  watch("autoConfirmar") ?? true ? "left-6" : "left-1"
                }`} />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Canal de notificaciones al cliente</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <button type="button"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-white">
                  <Mail size={13} /> Correo
                </button>
              </div>
              <p className="text-xs text-gray-400">Los clientes reciben confirmaciones, recordatorios y cancelaciones por correo electrónico.</p>
            </div>
          </div>

          {/* Anticipo */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Anticipo / Depósito</h2>
            <label className="flex items-center justify-between cursor-pointer select-none mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Requerir anticipo al reservar</p>
                <p className="text-xs text-gray-400">El cliente recibe instrucciones de pago y la cita queda pendiente hasta que confirmes el depósito</p>
              </div>
              <button type="button"
                onClick={() => setValue("requiereAnticipo", !(watch("requiereAnticipo") ?? false), { shouldDirty: true })}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4 ${watch("requiereAnticipo") ? "bg-slate-700" : "bg-gray-300"}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${watch("requiereAnticipo") ? "left-7" : "left-1"}`} />
              </button>
            </label>
            {watch("requiereAnticipo") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monto del anticipo ($)</label>
                  <input {...register("montoAnticipo")} type="number" min="0" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
                  <p className="text-xs text-gray-400 mt-1">Cantidad que el cliente debe pagar por adelantado</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Instrucciones de pago</label>
                  <textarea {...register("instruccionesAnticipo")} rows={3} maxLength={500}
                    placeholder={"CLABE: 012345678901234567\nBanco: BBVA\nNombre: Nombre del negocio"}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none" />
                  <p className="text-xs text-gray-400 mt-1">El cliente verá esto al confirmar su reserva</p>
                </div>
              </div>
            )}
          </div>

          {btnGuardar}

          {/* Zona de peligro */}
          <div className="border border-red-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-2">
              <Trash2 size={15} /> Zona de peligro
            </h2>
            <p className="text-xs text-gray-500 mb-4">
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
      </form>

      {/* ── Modal: eliminar cuenta ─────────────────────────────────────────── */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">¿Eliminar tu cuenta?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Esta acción es irreversible. Ingresa tu contraseña actual para confirmar.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Contraseña actual"
              value={contrasenaEliminar}
              onChange={(e) => setContrasenaEliminar(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-red-400 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalEliminar(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
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

      {/* ── TAB: HORARIOS ───────────────────────────────────────────────────── */}
      {tab === "horarios" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Horarios de atención</h2>
            <div className="space-y-3">
              {horarios.map((h) => (
                <div key={h.diaSemana} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-2 border-b border-gray-50 last:border-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none sm:w-28 sm:shrink-0">
                    <div onClick={() => actualizarHorario(h.diaSemana!, "activo", !h.activo)}
                      className={`w-9 h-5 rounded-full transition relative cursor-pointer shrink-0 ${h.activo ? "bg-slate-700" : "bg-gray-300"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.activo ? "left-4" : "left-0.5"}`} />
                    </div>
                    <span className="text-sm text-gray-700">{DIAS[h.diaSemana ?? 0]}</span>
                  </label>
                  {h.activo ? (
                    <div className="flex items-center gap-2 pl-11 sm:pl-0">
                      <input type="time" value={h.horaInicio}
                        onChange={(e) => actualizarHorario(h.diaSemana!, "horaInicio", e.target.value)}
                        className="flex-1 min-w-0 sm:w-32 sm:flex-none px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
                      <span className="text-gray-400 text-sm shrink-0">—</span>
                      <input type="time" value={h.horaFin}
                        onChange={(e) => actualizarHorario(h.diaSemana!, "horaFin", e.target.value)}
                        className="flex-1 min-w-0 sm:w-32 sm:flex-none px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 pl-11 sm:pl-0">Cerrado</span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => guardarHorarios()} disabled={guardandoHorarios || !horariosDirty}
              className="mt-4 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm">
              {guardandoHorarios ? "Guardando..." : "Guardar horarios"}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Días sin atención</h2>
            <p className="text-xs text-gray-400 mb-4">Bloquea días donde el negocio no trabajará (feriados, vacaciones). Los clientes no podrán reservar esos días.</p>
            <div className="flex gap-2 mb-4 flex-wrap items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input type="date" value={nuevaFecha} min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-gray-500 mb-1">Motivo <span className="text-gray-400">(opcional)</span></label>
                <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)}
                  placeholder="Ej: Día festivo, Vacaciones..." maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
              </div>
              <button onClick={() => nuevaFecha && bloquearDia()} disabled={!nuevaFecha || bloqueando}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition">
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
