import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { intakePublicoApi, type CampoIntake } from "../../api/intake";
import { descuentosPublicoApi, type DescuentoValidado } from "../../api/descuentos";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible, ImagenGaleria, ResenaPublica } from "../../types";
import { getSectorTerms } from "../../hooks/useSectorTerms";
import IndicadorPasos from "../../components/booking/IndicadorPasos";
import PasoServicio from "../../components/booking/PasoServicio";
import PasoEmpleado, { SIN_PREFERENCIA_ID } from "../../components/booking/PasoEmpleado";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import PasoDatosCliente, { type DatosClienteForm } from "../../components/booking/PasoDatosCliente";
import { Star, X, UserCircle, UserCheck, Tag, AlertCircle, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import PublicFooter from "../../components/PublicFooter";

import { hexToChannels, DEFAULT_COLOR } from "../../lib/colorUtils";
import SocialLinks from "../../components/icons/SocialLinks";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import "@splidejs/react-splide/css/core";

function GaleriaSection({ imagenes }: { imagenes: ImagenGaleria[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!imagenes.length) return null;
  const total = imagenes.length;

  // Infinite loop: prepend last clone, append first clone
  const loop = total > 1;
  const extended = loop ? [imagenes[total - 1], ...imagenes, imagenes[0]] : imagenes;

  // Center the slide at position `p` in the extended list
  const centerSlide = (p: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    const slide = el.children[p] as HTMLElement | undefined;
    if (!slide) return;
    const target = slide.offsetLeft + slide.offsetWidth / 2 - el.offsetWidth / 2;
    if (smooth) el.scrollTo({ left: target, behavior: "smooth" });
    else el.scrollLeft = target;
  };

  // Find which extended index is centered right now
  const centeredExtIdx = () => {
    const el = scrollRef.current;
    if (!el) return loop ? 1 : 0;
    const vc = el.scrollLeft + el.offsetWidth / 2;
    let best = 0, bestDist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const ch = c as HTMLElement;
      const d = Math.abs(ch.offsetLeft + ch.offsetWidth / 2 - vc);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  // Scroll to a real image index
  const scrollTo = (index: number) => {
    centerSlide(loop ? index + 1 : index, true);
    setActiveIndex(index);
  };

  // On mount: jump to real first (clone is at position 0)
  useEffect(() => {
    if (!loop) return;
    requestAnimationFrame(() => centerSlide(1, false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || jumpingRef.current) return;

    // Debounce everything: state update + clone jump run once scroll settles
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el2 = scrollRef.current;
      if (!el2 || jumpingRef.current) return;
      const extIdx = centeredExtIdx();
      const realIdx = loop
        ? extIdx === 0 ? total - 1 : extIdx === total + 1 ? 0 : extIdx - 1
        : extIdx;
      setActiveIndex(Math.max(0, Math.min(total - 1, realIdx)));
      if (loop && (extIdx === 0 || extIdx === total + 1)) {
        jumpingRef.current = true;
        centerSlide(extIdx === 0 ? total : 1, false);
        setTimeout(() => { jumpingRef.current = false; }, 80);
      }
    }, 80);
  };

  // Windowed dots — max 5 visible
  const MAX_DOTS = 5;
  const renderDots = () => {
    const dots = total <= MAX_DOTS ? total : MAX_DOTS;
    const start = total <= MAX_DOTS ? 0 : Math.max(0, Math.min(activeIndex - Math.floor(MAX_DOTS / 2), total - MAX_DOTS));
    return Array.from({ length: dots }, (_, j) => {
      const i = start + j;
      const isActive = i === activeIndex;
      const isEdge = total > MAX_DOTS && (j === 0 || j === dots - 1) && !isActive;
      return (
        <button
          key={i}
          onClick={() => scrollTo(i)}
          className="rounded-full transition-all"
          style={{
            width: isActive ? 16 : 6,
            height: isEdge ? 4 : 6,
            background: isActive ? "#334155" : "#cbd5e1",
            opacity: isEdge ? 0.45 : 1,
          }}
        />
      );
    });
  };

  return (
    <>
      <div className="relative -mx-4 mb-1">
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-3 px-5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
          onScroll={handleScroll}
        >
          {extended.map((img, i) => (
            <button
              key={i}
              onClick={() => setLightbox(img.url)}
              className="snap-center shrink-0 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-36 sm:h-72"
              style={{ width: "calc(100% - 40px)" }}
            >
              <img src={img.url} alt={img.descripcion ?? ""} className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              onClick={() => scrollTo((activeIndex - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 transition hover:bg-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollTo((activeIndex + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 transition hover:bg-white"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-2 mb-4">
          {renderDots()}
        </div>
      )}

      {lightbox && createPortal(
        <div
          className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
        </div>,
        document.body
      )}
    </>
  );
}

function GaleriaDesktop({ imagenes, onOpen }: { imagenes: ImagenGaleria[]; onOpen: (idx: number) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thumbsRef = useRef<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const total = imagenes.length;

  useEffect(() => {
    if (mainRef.current && thumbsRef.current?.splide) {
      mainRef.current.sync(thumbsRef.current.splide);
    }
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden shadow-sm">
        <Splide
          ref={mainRef}
          options={{ type: "loop", pagination: false, arrows: false, speed: 300, waitForTransition: false }}
          onMove={(_splide: unknown, index: number) => setCurrentIdx(index)}
        >
          {imagenes.map((img, i) => (
            <SplideSlide key={i}>
              <button onClick={() => onOpen(i)} className="block w-full focus:outline-none">
                <img src={img.url} alt={img.descripcion ?? ""} className="w-full h-[350px] object-cover" draggable={false} />
              </button>
            </SplideSlide>
          ))}
        </Splide>
        {total > 1 && (
          <>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => mainRef.current?.go("<")}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => mainRef.current?.go(">")}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs tabular-nums px-2 py-0.5 rounded-full select-none">
              {currentIdx + 1} de {total}
            </div>
          </>
        )}
      </div>
      {total > 1 && (
        <Splide
          ref={thumbsRef}
          options={{
            type: "slide",
            rewind: true,
            gap: 6,
            pagination: false,
            fixedWidth: 88,
            fixedHeight: 68,
            cover: true,
            isNavigation: true,
            arrows: false,
            focus: "center",
          }}
        >
          {imagenes.map((img, i) => (
            <SplideSlide key={i}>
              <img
                src={img.url}
                alt=""
                className={`w-full h-full object-cover rounded-lg cursor-pointer transition-opacity ${
                  i === currentIdx ? "ring-2 ring-slate-700 opacity-100" : "opacity-50 hover:opacity-80"
                }`}
                draggable={false}
              />
            </SplideSlide>
          ))}
        </Splide>
      )}
    </div>
  );
}

function GaleriaViewer({ imagenes, idx, onChange, onClose }: {
  imagenes: ImagenGaleria[];
  idx: number;
  onChange: (idx: number) => void;
  onClose: () => void;
}) {
  const total = imagenes.length;
  const goPrev = () => onChange((idx - 1 + total) % total);
  const goNext = () => onChange((idx + 1) % total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm tabular-nums select-none">
        {idx + 1} de {total}
      </div>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white transition" onClick={onClose}>
        <X size={26} />
      </button>
      <img
        src={imagenes[idx].url}
        alt={imagenes[idx].descripcion ?? ""}
        className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      {total > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            onClick={e => { e.stopPropagation(); goPrev(); }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            onClick={e => { e.stopPropagation(); goNext(); }}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>,
    document.body
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
  mostrarError,
}: {
  campo: CampoIntake;
  valor: string;
  onChange: (v: string) => void;
  mostrarError?: boolean;
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
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
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
          className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition ${mostrarError ? "border-red-500" : "border-gray-300"}`}
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
          className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition resize-none ${mostrarError ? "border-red-500" : "border-gray-300"}`}
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
        className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition ${mostrarError ? "border-red-500" : "border-gray-300"}`}
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [galeriaViewerIdx, setGaleriaViewerIdx] = useState<number | null>(null);

  // Sub-flujo paso 4: elegir → buscar | listo
  const [modoCliente, setModoCliente] = useState<"elegir" | "buscar" | "listo">("elegir");
  const [tipoBusqueda, setTipoBusqueda] = useState<"email" | "telefono">("email");
  const [emailBusqueda, setEmailBusqueda] = useState("");
  const [telefonoBusqueda, setTelefonoBusqueda] = useState("");
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

  // Slot taken (409) error shown in paso 3
  const [errorSlotTomado, setErrorSlotTomado] = useState("");
  // Intake validation attempt tracker
  const [intentoContinuar, setIntentoContinuar] = useState(false);

  // Pre-selección vía URL params (Repetir cita)
  const [yaPreseleccionado, setYaPreseleccionado] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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

  const { data: camposIntake = [], isLoading: cargandoIntake, isError: intakeError } = useQuery<CampoIntake[]>({
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
      setRespuestasIntake({});
      setIntentoContinuar(false);
      return;
    }
    if (paso === 4 && modoCliente !== "elegir") {
      if (modoCliente === "listo") { setDatosPreRellenos(null); setEmailBusqueda(""); setTelefonoBusqueda(""); }
      setModoCliente("elegir");
      setErrorBusqueda("");
      return;
    }
    setDirection(-1);
    setPaso((p) => p - 1);
    if (paso === 4) { setModoCliente("elegir"); setDatosPreRellenos(null); setEmailBusqueda(""); }
    if (paso === 3) setSlot(null);
    if (paso === 2) { setEmpleado(null); setRespuestasIntake({}); }
  };

  const buscarCliente = async () => {
    if (!slug) return;
    const opts = tipoBusqueda === "email"
      ? { email: emailBusqueda }
      : { telefono: telefonoBusqueda };
    if (!opts.email && !opts.telefono) return;
    setBuscandoCliente(true);
    setErrorBusqueda("");
    try {
      const datos = await publicoApi.buscarClienteDatos(slug, opts);
      if (!mountedRef.current) return;
      setDatosPreRellenos(datos);
      setModoCliente("listo");
    } catch {
      if (!mountedRef.current) return;
      setErrorBusqueda("No encontramos registros con ese dato. Puedes continuar como invitado.");
    } finally {
      if (mountedRef.current) setBuscandoCliente(false);
    }
  };

  const sinPreferencia = empleado?.id === SIN_PREFERENCIA_ID;

  const validarCupon = async () => {
    if (!codigoInput.trim() || !slug) return;
    setValidandoCupon(true);
    setErrorCupon("");
    try {
      const descuento = await descuentosPublicoApi.validar(codigoInput.trim(), slug);
      if (!mountedRef.current) return;
      setDescuentoAplicado(descuento);
      setMostrarCupon(false);
      setCodigoInput("");
    } catch {
      if (!mountedRef.current) return;
      setErrorCupon("Código inválido, expirado o agotado.");
    } finally {
      if (mountedRef.current) setValidandoCupon(false);
    }
  };

  const confirmarCita = async (datos: DatosClienteForm) => {
    if (!negocio || !servicio || !empleado || !slot) return;
    setErrorEnvio("");
    setEnviando(true);
    try {
      const empleadoIdFinal = sinPreferencia ? (slot.empleadoId ?? "") : empleado.id;
      const respuestasIntakeList = Object.entries(respuestasIntake).map(([campoIntakeId, valor]) => ({
        campoIntakeId,
        valor: valor || undefined,
      }));
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
        respuestasIntake: respuestasIntakeList.length > 0 ? respuestasIntakeList : undefined,
      });
      navigate(`/b/${slug}/confirmacion/${cita.codigoConfirmacion}`);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      if (status === 409 || msg?.toLowerCase().includes("disponible") || msg?.toLowerCase().includes("ocupado")) {
        setErrorSlotTomado("Ese horario ya no está disponible, elige otro.");
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
  const terms = getSectorTerms(negocio.sector);

  const textos = negocio.sector === 'salud'
    ? { cta: 'Agenda tu consulta', cita: 'consulta' }
    : { cta: 'Reserva tu cita',    cita: 'cita'     };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header oscuro del negocio */}
      <div
        className="relative overflow-hidden"
        style={{ background: "#0C0C0F" }}
      >
        {/* Portada visible */}
        {negocio.portadaUrl && (
          <img
            src={negocio.portadaUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: 0.5 }}
            loading="lazy"
          />
        )}
        {/* Gradiente: transparente arriba → oscuro abajo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(12,12,15,0.15) 0%, rgba(12,12,15,0.92) 100%)",
          }}
        />
        {/* Glow radial con el color de marca */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 120% at 0% 0%, rgb(${hexToChannels(color)} / 0.20) 0%, transparent 65%)`,
          }}
        />
        {/* Contenido con padding-top para dejar ver la foto arriba */}
        <div className={`relative z-10 px-5 pb-4 ${negocio.portadaUrl ? "pt-44" : "pt-8"}`}>
          {/* Fila: logo + nombre alineados arriba */}
          <div className="flex items-start gap-3.5">
            {/* Logo */}
            <div className="shrink-0">
              {negocio.logoUrl ? (
                <button
                  onClick={() => setLightboxUrl(negocio.logoUrl!)}
                  className="block focus:outline-none"
                  aria-label="Ver logo en pantalla completa"
                >
                  <img
                    src={negocio.logoUrl}
                    alt={negocio.nombre}
                    className="w-14 h-14 rounded-2xl object-cover cursor-zoom-in"
                    style={{
                      border: `1.5px solid rgb(${hexToChannels(color)} / 0.45)`,
                      boxShadow: `0 2px 16px rgb(${hexToChannels(color)} / 0.28)`,
                    }}
                    loading="lazy"
                  />
                </button>
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: `rgb(${hexToChannels(color)} / 0.18)`,
                    border: `1.5px solid rgb(${hexToChannels(color)} / 0.40)`,
                  }}
                >
                  🏪
                </div>
              )}
            </div>
            {/* Nombre, descripción y redes en la misma columna */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-black text-[1.05rem] leading-none tracking-tight">
                  {negocio.nombre}
                </h1>
                <div
                  className="flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Star size={9} fill="#F59E0B" stroke="#F59E0B" strokeWidth={0} />
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {(negocio.totalResenas ?? 0) > 0
                      ? (negocio.promedioResenas ?? 0).toFixed(1)
                      : "Sin reseñas"}
                  </span>
                </div>
              </div>
              {negocio.descripcion && (
                <p className="text-xs mt-1 leading-snug" style={{ color: "rgba(255,255,255,0.62)" }}>
                  {negocio.descripcion}
                </p>
              )}
              {negocio.direccion && (
                <p className="text-xs mt-2 leading-snug" style={{ color: "rgba(255,255,255,0.45)" }}>
                  📍 {negocio.direccion}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                <SocialLinks
                  instagramUrl={negocio.instagramUrl}
                  facebookUrl={negocio.facebookUrl}
                  tiktokUrl={negocio.tiktokUrl}
                  variant="header"
                />
                {negocio.telefonoWhatsApp && (
                  <a
                    href={`https://wa.me/${negocio.telefonoWhatsApp.replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#25D366] hover:opacity-80 transition"
                  >
                    <SiWhatsapp size={12} className="shrink-0" />
                    {negocio.telefonoWhatsApp}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tira de pasos — full width, fondo oscuro */}
      <IndicadorPasos pasoActual={paso} pasos={PASOS} color={color} slug={negocio.slug} />

      {/* Contenido */}
      <div className="lg:max-w-5xl lg:mx-auto lg:px-8 lg:flex lg:gap-8 lg:items-start lg:pt-8 lg:pb-12">

        {/* Left column — galería + reseñas, solo desktop */}
        {negocio.galeria?.length > 0 && (
          <div className="hidden lg:block w-[400px] shrink-0 sticky top-0 h-screen flex flex-col justify-center py-8 overflow-y-auto">
            <GaleriaDesktop imagenes={negocio.galeria} onOpen={setGaleriaViewerIdx} />
            {negocio.resenas?.length > 0 && (
              <div className="mt-6">
                <ResenasSection
                  resenas={negocio.resenas}
                  promedio={negocio.promedioResenas}
                  total={negocio.totalResenas}
                />
              </div>
            )}
          </div>
        )}

        {/* Right column — flujo de reserva */}
        <div className="px-4 pt-5 pb-10 lg:flex-1 lg:px-0 lg:pt-0 lg:pb-0">

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
            <p className="text-sm font-medium text-slate-400 mb-4">{textos.cta}</p>
            {/* Galería */}
            {negocio.galeria?.length > 0 && (
              <div className="lg:hidden">
                <GaleriaSection imagenes={negocio.galeria} />
              </div>
            )}

            <PasoServicio
              servicios={negocio.servicios}
              seleccionado={servicio}
              onSeleccionar={setServicio}
              color={color}
              sector={negocio.sector}
            />
            <button
              onClick={irSiguiente}
              disabled={!servicio}
              className="mt-6 w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition text-sm tracking-wide hover:opacity-90"
              style={{ background: color }}
            >
              Continuar
            </button>

            {/* Reseñas — solo mobile; en desktop aparecen en la columna izquierda */}
            {negocio.resenas?.length > 0 && (
              <div className="lg:hidden">
                <ResenasSection
                  resenas={negocio.resenas}
                  promedio={negocio.promedioResenas}
                  total={negocio.totalResenas}
                />
              </div>
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
              sector={negocio.sector}
            />
            <div className="mt-6 flex gap-3">
              <button onClick={irAtras} className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition inline-flex items-center justify-center gap-1.5">
                <ChevronLeft size={15} />
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
        {paso === 3 && servicio && empleado && !mostrarIntake && (
          <>
            {errorSlotTomado && (
              <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm font-semibold text-red-700">{errorSlotTomado}</p>
              </div>
            )}
            <PasoFechaHora
              servicioId={servicio.id}
              empleadoId={sinPreferencia ? null : empleado.id}
              seleccionado={slot}
              onSeleccionar={setSlot}
              onLimpiarSlot={() => setSlot(null)}
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
                  {`antes de la ${terms.cita.toLowerCase()}.`}
                </span>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={irAtras} className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition inline-flex items-center justify-center gap-1.5">
                <ChevronLeft size={15} />
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={!slot || cargandoIntake || intakeError}
                className="flex-1 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition text-sm hover:opacity-90"
                style={{ background: color }}
              >
                {cargandoIntake ? "Cargando..." : "Continuar"}
              </button>
            </div>
            {intakeError && (
              <p className="text-xs text-red-500 text-center mt-2">
                No se pudo cargar el formulario adicional. Recarga la página e intenta de nuevo.
              </p>
            )}
            {negocio.listaEsperaActiva === true && (
              <div className="mt-4 text-center">
                <a
                  href={`/b/${negocio.slug}/espera?servicioId=${servicio.id}`}
                  className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition"
                >
                  ¿Sin disponibilidad? Únete a la lista de espera
                </a>
              </div>
            )}
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
                  mostrarError={intentoContinuar && campo.requerido && !respuestasIntake[campo.id]?.trim()}
                />
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={irAtras}
                className="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition inline-flex items-center justify-center gap-1.5"
              >
                <ChevronLeft size={15} />
                Atrás
              </button>
              <button
                onClick={() => {
                  setIntentoContinuar(true);
                  const hayFaltantes = camposIntake
                    .filter((c) => c.requerido)
                    .some((c) => !respuestasIntake[c.id]?.trim());
                  if (!hayFaltantes) {
                    irSiguiente();
                  }
                }}
                className="flex-1 text-white font-bold py-3 rounded-2xl transition text-sm hover:opacity-90"
                style={{ background: color }}
              >
                Continuar
              </button>
            </div>
            {intentoContinuar && camposIntake.filter((c) => c.requerido).some((c) => !respuestasIntake[c.id]?.trim()) && (
              <p className="text-xs text-red-500 text-center mt-2">Completa los campos obligatorios para continuar</p>
            )}
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
                className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition group hover:opacity-90"
                style={{ background: color }}
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
            <button onClick={irAtras} className="mt-5 w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition inline-flex items-center justify-center gap-1.5">
              <ChevronLeft size={15} />
              Atrás
            </button>
          </div>
        )}

        {/* Paso 4 — buscar datos */}
        {paso === 4 && modoCliente === "buscar" && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Buscar mis datos</h2>
            <p className="text-sm text-slate-500 mb-4">Busca con tu correo o número de teléfono.</p>

            {/* Toggle email / teléfono */}
            <div className="flex gap-2 mb-4 bg-slate-100 rounded-xl p-1">
              {(["email", "telefono"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTipoBusqueda(t); setErrorBusqueda(""); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                    tipoBusqueda === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {t === "email" ? "Correo electrónico" : "Teléfono"}
                </button>
              ))}
            </div>

            <div>
              {tipoBusqueda === "email" ? (
                <input
                  type="email"
                  value={emailBusqueda}
                  onChange={(e) => { setEmailBusqueda(e.target.value); setErrorBusqueda(""); }}
                  onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white"
                  autoFocus
                />
              ) : (
                <input
                  type="tel"
                  value={telefonoBusqueda}
                  onChange={(e) => { setTelefonoBusqueda(e.target.value); setErrorBusqueda(""); }}
                  onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                  placeholder="55 1234 5678"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white"
                  autoFocus
                />
              )}
              {errorBusqueda && <p className="text-red-600 text-xs mt-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{errorBusqueda}</p>}
            </div>

            <button
              onClick={buscarCliente}
              disabled={buscandoCliente || (tipoBusqueda === "email" ? !emailBusqueda.includes("@") : telefonoBusqueda.replace(/\D/g, "").length < 8)}
              className="mt-4 w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition text-sm hover:opacity-90"
              style={{ background: color }}
            >
              {buscandoCliente ? "Buscando…" : "Buscar mis datos"}
            </button>
            <button onClick={irAtras} className="mt-3 w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition inline-flex items-center justify-center gap-1.5">
              <ChevronLeft size={15} />
              Atrás
            </button>
          </div>
        )}

        {/* Paso 4 — formulario (invitado o datos pre-rellenos) */}
        {paso === 4 && modoCliente === "listo" && servicio && empleado && slot && (
          <>
            {/* Banner: datos pre-rellenos */}
            {datosPreRellenos && (
              <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-700 font-medium">¡Datos encontrados! Verifica que sean correctos.</p>
              </div>
            )}

            {/* Confirmación pendiente */}
            {negocio && !negocio.autoConfirmar && (
              <div className="mb-4 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="shrink-0 text-slate-400" />
                <span>Tu {textos.cita} quedará <strong>pendiente de confirmación</strong> por el negocio.</span>
              </div>
            )}

            {/* Aviso de privacidad */}
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

            {/* Formulario — el error aparece dentro, justo antes del submit */}
            <PasoDatosCliente
              servicio={servicio}
              empleado={empleado}
              slot={slot}
              enviando={enviando}
              datosIniciales={datosPreRellenos ?? undefined}
              onEnviar={confirmarCita}
              color={color}
              notasLabel={negocio.sector === 'salud' ? 'Motivo de consulta' : undefined}
              error={errorEnvio || undefined}
            />

            {/* Código de descuento — después del resumen para que el usuario vea el precio primero */}
            <div className="mt-4">
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
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
                    />
                    <button
                      onClick={validarCupon}
                      disabled={validandoCupon || !codigoInput.trim()}
                      className="px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition"
                      style={{ background: color }}
                    >
                      {validandoCupon ? "Aplicando…" : "Aplicar"}
                    </button>
                  </div>
                  {errorCupon && <p className="text-red-500 text-xs">{errorCupon}</p>}
                  <button
                    onClick={() => { setMostrarCupon(false); setCodigoInput(""); setErrorCupon(""); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarCupon(true)}
                  className="text-sm text-slate-500 font-medium hover:underline"
                >
                  ¿Tienes un código de descuento?
                </button>
              )}
            </div>

            <button onClick={irAtras} className="mt-4 w-full py-3 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 transition inline-flex items-center justify-center gap-1.5">
              <ChevronLeft size={15} />
              Atrás
            </button>
          </>
        )}

        </motion.div>
        </AnimatePresence>
          <PublicFooter />
        </div>
      </div>

      {/* Galería viewer — fuera de cualquier sticky/transform para evitar stacking context */}
      {galeriaViewerIdx !== null && negocio.galeria?.length > 0 && (
        <GaleriaViewer
          imagenes={negocio.galeria}
          idx={galeriaViewerIdx}
          onChange={setGaleriaViewerIdx}
          onClose={() => setGaleriaViewerIdx(null)}
        />
      )}

      {/* Lightbox logo */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition"
            onClick={() => setLightboxUrl(null)}
            aria-label="Cerrar"
          >
            <X size={28} />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-[88vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
