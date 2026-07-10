import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { intakePublicoApi, type CampoIntake } from "../../api/intake";
import { descuentosPublicoApi, type DescuentoValidado } from "../../api/descuentos";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible, ImagenGaleria, ResenaPublica } from "../../types";
import IndicadorPasos from "../../components/booking/IndicadorPasos";
import PasoServicio from "../../components/booking/PasoServicio";
import PasoEmpleado, { SIN_PREFERENCIA_ID } from "../../components/booking/PasoEmpleado";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import PasoDatosCliente, { type DatosClienteForm } from "../../components/booking/PasoDatosCliente";
import { Star, X, UserCircle, UserCheck, Tag, AlertCircle, ChevronRight, Lock } from "lucide-react";
import WhatsAppIcon from "../../components/icons/WhatsAppIcon";
import PublicFooter from "../../components/PublicFooter";

const DEFAULT_COLOR = "#334155"; // slate-700

function hexToChannels(hex: string): string {
  const h = (hex ?? DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
function adjustHex(hex: string, factor: number): string {
  const h = (hex ?? DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  return "#" + [0, 2, 4]
    .map((i) => Math.min(255, Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * factor)))
      .toString(16).padStart(2, "0"))
    .join("");
}

function GaleriaSection({ imagenes }: { imagenes: ImagenGaleria[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!imagenes.length) return null;
  return (
    <>
      <div className="overflow-x-auto pb-2 -mx-4 px-4 mb-5">
        <div className="flex gap-2" style={{ width: "max-content" }}>
          {imagenes.map((img) => (
            <button
              key={img.id}
              onClick={() => setLightbox(img.url)}
              className="shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-gray-100 hover:opacity-90 transition"
            >
              <img src={img.url} alt={img.descripcion ?? ""} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </>
  );
}

function ResenasSection({ resenas, promedio, total }: { resenas: ResenaPublica[]; promedio: number; total: number }) {
  if (!resenas.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} size={14} fill={promedio >= s ? "#C8A961" : "none"} stroke="#C8A961" strokeWidth={1.5} />
          ))}
        </div>
        <span className="text-sm font-semibold text-gray-700">{promedio.toFixed(1)}</span>
        <span className="text-xs text-gray-400">({total} reseñas)</span>
      </div>
      <div className="space-y-3">
        {resenas.slice(0, 5).map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-800">{r.nombreCliente}</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={11} fill={r.rating >= s ? "#C8A961" : "none"} stroke="#C8A961" strokeWidth={1.5} />
                ))}
              </div>
            </div>
            {r.comentario && <p className="text-xs text-gray-500 leading-relaxed">{r.comentario}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

const PASOS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos"];

function IntakeCampoInput({
  campo,
  valor,
  onChange,
}: {
  campo: CampoIntake;
  valor: string;
  onChange: (v: string) => void;
}) {
  const label = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {campo.etiqueta}
      {campo.requerido && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  if (campo.tipo === "Checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={valor === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="accent-slate-700 w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            {campo.etiqueta}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </span>
        </label>
      </div>
    );
  }

  if (campo.tipo === "Seleccion") {
    let opciones: string[] = [];
    try {
      const raw = campo.opciones ?? "";
      opciones = raw.includes("[")
        ? JSON.parse(raw)
        : raw.split(",").map((o) => o.trim()).filter(Boolean);
    } catch { /* keep empty */ }
    return (
      <div>
        {label}
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
        >
          <option value="">Selecciona una opción</option>
          {opciones.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
    );
  }

  if (campo.tipo === "MultilineTexto") {
    return (
      <div>
        {label}
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition resize-none"
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
      />
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [paso, setPaso] = useState(1);
  const [servicio, setServicio] = useState<ServicioPublico | null>(null);
  const [empleado, setEmpleado] = useState<EmpleadoPublico | null>(null);
  const [slot, setSlot] = useState<SlotDisponible | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  // Sub-flujo paso 4: elegir → buscar | listo
  const [modoCliente, setModoCliente] = useState<"elegir" | "buscar" | "listo">("elegir");
  const [emailBusqueda, setEmailBusqueda] = useState("");
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [datosPreRellenos, setDatosPreRellenos] = useState<Partial<DatosClienteForm> | null>(null);

  // Intake sub-step (between paso 3 and paso 4)
  const [mostrarIntake, setMostrarIntake] = useState(false);
  const [respuestasIntake, setRespuestasIntake] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1);

  // Promo code
  const [mostrarCupon, setMostrarCupon] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoValidado | null>(null);
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState("");

  // Pre-selección vía URL params (Repetir cita)
  const [yaPreseleccionado, setYaPreseleccionado] = useState(false);

  const { data: negocio, isLoading, isError, error } = useQuery({
    queryKey: ["negocio", slug],
    queryFn: () => publicoApi.obtenerNegocio(slug!),
    enabled: !!slug,
    retry: (count, err) => {
      // No reintentar si el negocio no existe o está inactivo (404)
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return count < 1;
    },
  });

  const { data: camposIntake = [] } = useQuery<CampoIntake[]>({
    queryKey: ["intake-publico", slug, servicio?.id],
    queryFn: () => intakePublicoApi.getCampos(slug!, servicio?.id),
    enabled: !!slug && !!servicio,
  });

  // SEO + Open Graph dinámico
  useEffect(() => {
    if (!negocio) return;
    const titulo = `Reservar en ${negocio.nombre} — AppointVa`;
    document.title = titulo;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const desc = negocio.descripcion?.trim() || `Agenda tu cita en ${negocio.nombre} en línea, rápido y sin llamadas.`;
    setMeta("og:title", titulo);
    setMeta("og:description", desc);
    setMeta("og:type", "website");
    setMeta("og:url", window.location.href);
    if (negocio.portadaUrl || negocio.logoUrl)
      setMeta("og:image", (negocio.portadaUrl || negocio.logoUrl)!);

    return () => { document.title = "AppointVa"; };
  }, [negocio]);

  // Pre-seleccionar servicio y empleado desde URL params (flujo "Repetir cita")
  useEffect(() => {
    if (!negocio || yaPreseleccionado) return;
    const paramServicioId = searchParams.get("servicioId");
    const paramEmpleadoId = searchParams.get("empleadoId");
    if (!paramServicioId) return;

    const svc = negocio.servicios.find((s) => s.id === paramServicioId);
    if (!svc) return;

    setServicio(svc);
    setYaPreseleccionado(true);

    if (paramEmpleadoId) {
      const emp = negocio.empleados.find((e) => e.id === paramEmpleadoId);
      if (emp) {
        setEmpleado(emp);
        setDirection(1);
        setPaso(3);
        return;
      }
    }
    setDirection(1);
    setPaso(2);
  }, [negocio, searchParams, yaPreseleccionado]);

  const irSiguiente = () => {
    (document.activeElement as HTMLElement)?.blur();
    if (paso === 3 && slot && camposIntake.length > 0 && !mostrarIntake) {
      setDirection(1);
      setMostrarIntake(true);
      return;
    }
    setDirection(1);
    setMostrarIntake(false);
    setPaso((p) => Math.min(p + 1, 4));
    setModoCliente("elegir");
  };

  const irAtras = () => {
    (document.activeElement as HTMLElement)?.blur();
    if (mostrarIntake) {
      setDirection(-1);
      setMostrarIntake(false);
      return;
    }
    if (paso === 4 && modoCliente !== "elegir") {
      if (modoCliente === "listo") { setDatosPreRellenos(null); setEmailBusqueda(""); }
      setModoCliente("elegir");
      setErrorBusqueda("");
      return;
    }
    setDirection(-1);
    setPaso((p) => p - 1);
    if (paso === 4) { setModoCliente("elegir"); setDatosPreRellenos(null); setEmailBusqueda(""); }
    if (paso === 3) setSlot(null);
    if (paso === 2) setEmpleado(null);
  };

  const buscarCliente = async () => {
    if (!emailBusqueda || !slug) return;
    setBuscandoCliente(true);
    setErrorBusqueda("");
    try {
      const datos = await publicoApi.buscarClienteDatos(emailBusqueda, slug);
      setDatosPreRellenos(datos);
      setModoCliente("listo");
    } catch {
      setErrorBusqueda("No encontramos citas con ese correo. Puedes continuar como invitado.");
    } finally {
      setBuscandoCliente(false);
    }
  };

  const sinPreferencia = empleado?.id === SIN_PREFERENCIA_ID;

  const validarCupon = async () => {
    if (!codigoInput.trim() || !slug) return;
    setValidandoCupon(true);
    setErrorCupon("");
    try {
      const descuento = await descuentosPublicoApi.validar(codigoInput.trim(), slug);
      setDescuentoAplicado(descuento);
      setMostrarCupon(false);
      setCodigoInput("");
    } catch {
      setErrorCupon("Código inválido, expirado o agotado.");
    } finally {
      setValidandoCupon(false);
    }
  };

  const confirmarCita = async (datos: DatosClienteForm) => {
    if (!negocio || !servicio || !empleado || !slot) return;
    setErrorEnvio("");
    setEnviando(true);
    try {
      const empleadoIdFinal = sinPreferencia ? (slot.empleadoId ?? "") : empleado.id;
      const cita = await publicoApi.crearCita({
        negocioSlug: slug!,
        servicioId: servicio.id,
        empleadoId: empleadoIdFinal,
        inicioEn: slot.inicio,
        nombreCliente: datos.nombreCliente,
        telefonoCliente: datos.telefonoCliente,
        emailCliente: datos.emailCliente || undefined,
        notas: datos.notas || undefined,
        codigoDescuento: descuentoAplicado?.codigo,
      });
      if (Object.keys(respuestasIntake).length > 0) {
        const resps = Object.entries(respuestasIntake).map(([campoIntakeId, valor]) => ({
          campoIntakeId,
          valor,
        }));
        try {
          await intakePublicoApi.guardarRespuestas(cita.id, resps);
        } catch {
          // intake save failure is non-blocking
        }
      }
      navigate(`/b/${slug}/confirmacion/${cita.codigoConfirmacion}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      if (status === 409 || msg?.toLowerCase().includes("disponible") || msg?.toLowerCase().includes("ocupado")) {
        setErrorEnvio("Este horario ya fue reservado por alguien más. Por favor elige otra fecha u hora.");
        setPaso(3);
        setSlot(null);
        setMostrarIntake(false);
      } else if (status === 402) {
        setErrorEnvio(msg ?? "Este negocio ha alcanzado su límite de citas para este mes. Por favor contáctalo directamente para más información.");
      } else {
        setErrorEnvio(msg ?? "No se pudo confirmar la cita. Intenta de nuevo.");
      }
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-48 bg-slate-200 animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="h-1.5 bg-slate-200 rounded-full animate-pulse w-full" />
          {[1,2,3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const esInactivo = status === 404;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${esInactivo ? "bg-amber-100" : "bg-red-100"}`}>
            {esInactivo ? (
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>
          <p className="text-slate-700 font-semibold mb-1">
            {esInactivo ? "Este negocio no está disponible" : "No se pudo cargar la página"}
          </p>
          <p className="text-slate-400 text-sm mb-5">
            {esInactivo
              ? "La página de reservas de este negocio no está activa por el momento. Contacta directamente al negocio para más información."
              : "Verifica tu conexión e intenta de nuevo."}
          </p>
          {!esInactivo && (
            <button
              onClick={() => window.location.reload()}
              className="text-sm bg-slate-700 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-700 font-semibold">Negocio no encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Verifica el enlace e intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  const color = negocio.colorPrimario ?? DEFAULT_COLOR;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header oscuro del negocio — Estilo C */}
      <div
        className="relative h-48 overflow-hidden flex flex-col items-center justify-center gap-1"
        style={{ background: "#0C0C0F", paddingTop: "18px" }}
      >
        {/* Portada como textura muy sutil si existe */}
        {negocio.portadaUrl && (
          <img
            src={negocio.portadaUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
            loading="lazy"
          />
        )}
        {/* Glow radial con el color de marca */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 65% 70% at 50% 0%, rgb(${hexToChannels(color)} / 0.25) 0%, transparent 100%)`,
          }}
        />
        {/* Logo */}
        <div className="relative z-10">
          {negocio.logoUrl ? (
            <img
              src={negocio.logoUrl}
              alt={negocio.nombre}
              className="w-12 h-12 rounded-2xl object-cover"
              style={{
                border: `1.5px solid rgb(${hexToChannels(color)} / 0.38)`,
                boxShadow: `0 2px 14px rgb(${hexToChannels(color)} / 0.20)`,
              }}
              loading="lazy"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{
                background: `rgb(${hexToChannels(color)} / 0.15)`,
                border: `1.5px solid rgb(${hexToChannels(color)} / 0.35)`,
              }}
            >
              🏪
            </div>
          )}
        </div>
        {/* Nombre y descripción */}
        <div className="relative z-10 text-center px-6">
          <h1 className="text-white font-black text-[1.05rem] leading-tight tracking-tight">
            {negocio.nombre}
          </h1>
          {negocio.descripcion && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              {negocio.descripcion}
            </p>
          )}
        </div>
        {/* Rating pill */}
        {(negocio.totalResenas ?? 0) > 0 && (
          <div
            className="relative z-10 flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <Star size={10} fill="#F59E0B" stroke="#F59E0B" strokeWidth={0} />
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              {(negocio.promedioResenas ?? 0).toFixed(1)} · {negocio.totalResenas} reseñas
            </span>
          </div>
        )}
        {/* Redes sociales */}
        {(negocio.instagramUrl || negocio.facebookUrl || negocio.tiktokUrl) && (
          <div className="relative z-10 flex gap-2">
            {negocio.instagramUrl && (
              <a href={negocio.instagramUrl} target="_blank" rel="noreferrer"
                className="w-6 h-6 rounded-full flex items-center justify-center transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.12)" }}>
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            )}
            {negocio.facebookUrl && (
              <a href={negocio.facebookUrl} target="_blank" rel="noreferrer"
                className="w-6 h-6 rounded-full flex items-center justify-center transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.12)" }}>
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            )}
            {negocio.tiktokUrl && (
              <a href={negocio.tiktokUrl} target="_blank" rel="noreferrer"
                className="w-6 h-6 rounded-full flex items-center justify-center transition hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.12)" }}>
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Tira de pasos — full width, fondo oscuro */}
      <IndicadorPasos pasoActual={paso} pasos={PASOS} color={color} />

      {/* Sub-header: acciones del negocio */}
      <div className="bg-white border-b border-slate-100 px-5 py-2.5 flex items-center justify-between">
        {(negocio.telefonoWhatsApp || negocio.telefono) ? (
          <a
            href={`https://wa.me/${(negocio.telefonoWhatsApp || negocio.telefono || "").replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#25D366] hover:opacity-80 transition"
          >
            <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
            {negocio.telefonoWhatsApp || negocio.telefono}
          </a>
        ) : <span />}
        <a
          href={`/b/${negocio.slug}/mis-citas`}
          className="text-xs font-medium text-slate-400 hover:text-slate-600 transition"
        >
          Mis citas →
        </a>
      </div>

      {/* Contenido */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">

        {/* Mini-resumen breadcrumb */}
        {paso >= 2 && (servicio || empleado) && (
          <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-100 rounded-xl px-3 py-2 mb-4 flex-wrap shadow-sm">
            {servicio && (
              <span className="font-semibold text-slate-700">{servicio.nombre}</span>
            )}
            {servicio && empleado && paso >= 3 && <span className="text-slate-300">›</span>}
            {empleado && paso >= 3 && (
              <span className="text-slate-500">
                {sinPreferencia
                  ? (slot?.empleadoNombre ?? "Cualquier disponible")
                  : empleado.nombre}
              </span>
            )}
          </div>
        )}

        {/* Pasos — wrapper con animación de transición */}
        <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={`${paso}-${mostrarIntake ? "intake" : modoCliente}`}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ opacity: 0, x: dir * 30 }),
            center: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
            exit: (dir: number) => ({ opacity: 0, x: dir * -30, transition: { duration: 0.15, ease: "easeIn" } }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
        >

        {/* Paso 1 */}
        {paso === 1 && (
          <>
            {/* Galería */}
            {negocio.galeria?.length > 0 && <GaleriaSection imagenes={negocio.galeria} />}

            <PasoServicio
              servicios={negocio.servicios}
              seleccionado={servicio}
              onSeleccionar={setServicio}
              color={color}
            />
            <button
              onClick={irSiguiente}
              disabled={!servicio}
              className="mt-6 w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition text-sm tracking-wide hover:opacity-90"
              style={{ background: color }}
            >
              Continuar
            </button>

            {/* Reseñas */}
            {negocio.resenas?.length > 0 && (
              <ResenasSection
                resenas={negocio.resenas}
                promedio={negocio.promedioResenas}
                total={negocio.totalResenas}
              />
            )}
          </>
        )}

        {/* Paso 2 */}
        {paso === 2 && servicio && (
          <>
            <PasoEmpleado
              empleados={negocio.empleados}
              servicioId={servicio.id}
              seleccionado={empleado}
              onSeleccionar={setEmpleado}
              color={color}
            />
            <div className="mt-6 flex gap-3">
              <button onClick={irAtras} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition">
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={!empleado}
                className="flex-1 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition text-sm hover:opacity-90"
                style={{ background: color }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Paso 3 */}
        {paso === 3 && servicio && empleado && (
          <>
            <PasoFechaHora
              servicioId={servicio.id}
              empleadoId={sinPreferencia ? null : empleado.id}
              seleccionado={slot}
              onSeleccionar={setSlot}
              color={color}
            />
            {slot && (negocio.horasCancelacion ?? 0) > 0 && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 text-slate-400" />
                <span>
                  Cancelación gratuita hasta{" "}
                  <strong>
                    {negocio.horasCancelacion} hora{negocio.horasCancelacion !== 1 ? "s" : ""}
                  </strong>{" "}
                  antes de la cita.
                </span>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={irAtras} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition">
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={!slot}
                className="flex-1 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition text-sm hover:opacity-90"
                style={{ background: color }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Paso 3 — Intake (sub-paso entre hora y datos) */}
        {paso === 3 && mostrarIntake && camposIntake.length > 0 && (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Antes de continuar…</h2>
              <p className="text-sm text-slate-500 mt-1">
                Por favor responde estas preguntas adicionales para tu cita.
              </p>
            </div>
            <div className="space-y-4">
              {camposIntake.map((campo) => (
                <IntakeCampoInput
                  key={campo.id}
                  campo={campo}
                  valor={respuestasIntake[campo.id] ?? ""}
                  onChange={(v) =>
                    setRespuestasIntake((prev) => ({ ...prev, [campo.id]: v }))
                  }
                />
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={irAtras}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition"
              >
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={camposIntake
                  .filter((c) => c.requerido)
                  .some((c) => !respuestasIntake[c.id]?.trim())}
                className="flex-1 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition text-sm hover:opacity-90"
                style={{ background: color }}
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Paso 4 — elegir modo */}
        {paso === 4 && modoCliente === "elegir" && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">¿Ya has reservado antes?</h2>
            <p className="text-sm text-slate-500 mb-6">Busca tus datos o continúa como nuevo cliente.</p>
            <div className="space-y-3">
              {/* Opción 1 — Cliente recurrente (Klarna-style card) */}
              <button
                onClick={() => setModoCliente("buscar")}
                className="w-full flex items-center gap-4 bg-white border-2 border-slate-100 hover:border-slate-300 rounded-2xl p-4 text-left transition hover:shadow-sm group"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <UserCircle size={20} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">Soy cliente recurrente</p>
                  <p className="text-xs text-slate-400 mt-0.5">Busca tus datos con tu correo</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition shrink-0" />
              </button>

              {/* Separador "o" */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs font-medium text-slate-300 uppercase tracking-widest">o</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Opción 2 — Invitado */}
              <button
                onClick={() => setModoCliente("listo")}
                className="w-full flex items-center gap-4 bg-slate-900 hover:bg-slate-800 rounded-2xl p-4 text-left transition group"
              >
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <UserCheck size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">Continuar como invitado</p>
                  <p className="text-xs text-white/50 mt-0.5">Ingresa tus datos manualmente</p>
                </div>
                <ChevronRight size={16} className="text-white/30 group-hover:text-white/50 transition shrink-0" />
              </button>
            </div>
            <button onClick={irAtras} className="mt-5 w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition">
              ← Atrás
            </button>
          </div>
        )}

        {/* Paso 4 — buscar datos */}
        {paso === 4 && modoCliente === "buscar" && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Buscar mis datos</h2>
            <p className="text-sm text-slate-500 mb-5">Ingresa el correo con el que reservaste anteriormente.</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={emailBusqueda}
                onChange={(e) => { setEmailBusqueda(e.target.value); setErrorBusqueda(""); }}
                onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white"
              />
              {errorBusqueda && <p className="text-slate-500 text-xs mt-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{errorBusqueda}</p>}
            </div>
            <button
              onClick={buscarCliente}
              disabled={buscandoCliente || !emailBusqueda.includes("@")}
              className="mt-4 w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition text-sm hover:opacity-90"
              style={{ background: color }}
            >
              {buscandoCliente ? "Buscando…" : "Buscar mis datos"}
            </button>
            <button onClick={irAtras} className="mt-3 w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition">
              ← Atrás
            </button>
          </div>
        )}

        {/* Paso 4 — formulario (invitado o datos pre-rellenos) */}
        {paso === 4 && modoCliente === "listo" && servicio && empleado && slot && (
          <>
            {datosPreRellenos && (
              <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-700 font-medium">¡Datos encontrados! Verifica que sean correctos.</p>
              </div>
            )}
            {/* Código de descuento */}
            <div className="mb-4">
              {descuentoAplicado ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag size={15} className="text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-700">
                        Código <span className="font-mono">{descuentoAplicado.codigo}</span> aplicado
                      </p>
                      <p className="text-xs text-green-600">
                        {descuentoAplicado.tipo === "Porcentaje"
                          ? `${descuentoAplicado.valor}% de descuento`
                          : `$${descuentoAplicado.valor} de descuento`}
                        {servicio && (
                          <span>
                            {" — precio final: $"}
                            {descuentoAplicado.tipo === "Porcentaje"
                              ? (servicio.precio * (1 - descuentoAplicado.valor / 100)).toFixed(2)
                              : Math.max(0, servicio.precio - descuentoAplicado.valor).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDescuentoAplicado(null)}
                    className="text-green-500 hover:text-green-700 ml-3 shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : mostrarCupon ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={codigoInput}
                      onChange={(e) => { setCodigoInput(e.target.value.toUpperCase()); setErrorCupon(""); }}
                      onKeyDown={(e) => e.key === "Enter" && validarCupon()}
                      placeholder="PROMO20"
                      maxLength={50}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
                    />
                    <button
                      onClick={validarCupon}
                      disabled={validandoCupon || !codigoInput.trim()}
                      className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:opacity-90 transition"
                      style={{ background: color }}
                    >
                      {validandoCupon ? "..." : "Aplicar"}
                    </button>
                  </div>
                  {errorCupon && <p className="text-red-500 text-xs">{errorCupon}</p>}
                  <button
                    onClick={() => { setMostrarCupon(false); setCodigoInput(""); setErrorCupon(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarCupon(true)}
                  className="text-sm text-slate-700 font-medium hover:underline"
                >
                  ¿Tienes un código de descuento?
                </button>
              )}
            </div>

            {/* Confirmación pendiente */}
            {negocio && !negocio.autoConfirmar && (
              <div className="mb-4 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 text-slate-400" />
                <span>Tu cita quedará <strong>pendiente de confirmación</strong> por el negocio.</span>
              </div>
            )}

            <div className="mb-4 flex items-start gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
              <Lock size={12} className="shrink-0 mt-0.5 text-slate-300" />
              <span>
                Tus datos serán compartidos únicamente con{" "}
                <strong className="text-slate-500">{negocio.nombre}</strong> para gestionar tu cita,
                de acuerdo con nuestra{" "}
                <a href="/privacidad" target="_blank" rel="noreferrer" className="underline hover:text-slate-600 transition">
                  política de privacidad
                </a>.
              </span>
            </div>
            <PasoDatosCliente
              servicio={servicio}
              empleado={empleado}
              slot={slot}
              enviando={enviando}
              datosIniciales={datosPreRellenos ?? undefined}
              onEnviar={confirmarCita}
              color={color}
            />
            {errorEnvio && (
              <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-700">No se pudo agendar la cita</p>
                  <p className="text-sm text-red-600 mt-0.5">{errorEnvio}</p>
                </div>
              </div>
            )}
            <button onClick={irAtras} className="mt-3 w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition">
              ← Atrás
            </button>
          </>
        )}

        </motion.div>
        </AnimatePresence>
        <PublicFooter />
      </div>
    </div>
  );
}
