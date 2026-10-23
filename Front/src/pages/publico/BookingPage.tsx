import { useState, useEffect, useRef, useCallback, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { intakePublicoApi, type CampoIntake } from "../../api/intake";
import { descuentosPublicoApi, type DescuentoValidado } from "../../api/descuentos";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible, ImagenGaleria, ResenaPublica } from "../../types";
import { getSectorTerms } from "../../hooks/useSectorTerms";
import { formatPrecio, formatFechaCorta, monogramaNegocio } from "../../utils/formatters";
import { precioConDescuento } from "../../utils/descuentos";
import IndicadorPasos from "../../components/booking/IndicadorPasos";
import PasoServicio from "../../components/booking/PasoServicio";
import PasoEmpleado, { SIN_PREFERENCIA_ID } from "../../components/booking/PasoEmpleado";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import PasoDatosCliente, { type DatosClienteForm } from "../../components/booking/PasoDatosCliente";
import { Star, X, Tag, AlertCircle, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import PublicFooter from "../../components/PublicFooter";
import { useTituloPagina } from "../../hooks/useTituloPagina";

import { hexToChannels, DEFAULT_COLOR, brandSolid } from "../../lib/colorUtils";
import { fondoPortada, normalizarPresetPortada } from "../../lib/portadaPresets";

// El submit del paso 4 vive en la barra de acción, fuera del <form> de PasoDatosCliente.
const ID_FORM_DATOS = "form-datos-cliente";
const ID_HOJA_CONFLICTO = "hoja-cliente-existente";
const ID_TITULO_CONFLICTO = "hoja-cliente-existente-titulo";

const CODIGO_CLIENTE_DISTINTO = "CLIENTE_NOMBRE_DISTINTO";

// El paso vive en la URL (?paso=…) para que el «atrás» del navegador o del sistema
// recorra el wizard en lugar de salir de la página y perder lo elegido.
type ClavePaso = "1" | "2" | "3" | "preguntas" | "4";
const PARAM_PASO = "paso";
const CLAVES_PASO: readonly ClavePaso[] = ["1", "2", "3", "preguntas", "4"];
/** Estado de cada entrada del historial: de qué paso se llegó a ella. */
type EstadoHistorialPaso = { pasoPrevio?: ClavePaso } | null;

function leerPaso(valor: string | null): ClavePaso {
  return CLAVES_PASO.includes(valor as ClavePaso) ? (valor as ClavePaso) : "1";
}

function paramsConPaso(actuales: URLSearchParams, destino: ClavePaso): URLSearchParams {
  const params = new URLSearchParams(actuales);
  if (destino === "1") params.delete(PARAM_PASO);
  else params.set(PARAM_PASO, destino);
  return params;
}

/** Avisa cuando el contenido de un paso ya está en el DOM (tras la animación de salida). */
function AlMontarPaso({ onMontado }: { onMontado: () => void }) {
  useEffect(() => {
    onMontado();
    // Solo al montar: cada paso nuevo monta su propia instancia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
const CODIGO_HORARIO_NO_DISPONIBLE = "HORARIO_NO_DISPONIBLE";

// Piso de legibilidad del texto de la portada: el velo sostiene el contraste en
// conjunto, pero una zona clara aislada de la foto puede colarse bajo una línea.
const SOMBRA_TEXTO_PORTADA = "0 1px 3px rgba(12,12,15,0.65)";

// Velo del bloque de texto sobre una foto. Los tramos están medidos contra una
// portada blanca pura: el nombre cae alrededor del 60% y necesita ~0.80 de negro
// para llegar al 4.5:1 de la WCAG 1.4.3; arriba se desvanece hasta cero.
// Los tramos intermedios no son decorativos: aproximan una curva suave para que el
// borde superior del velo no se lea como una banda sobre una foto plana y clara.
const VELO_TEXTO_PORTADA =
  "linear-gradient(to top, rgba(12,12,15,0.86) 0%, rgba(12,12,15,0.81) 42%, " +
  "rgba(12,12,15,0.70) 60%, rgba(12,12,15,0.50) 74%, rgba(12,12,15,0.28) 85%, " +
  "rgba(12,12,15,0.11) 93%, rgba(12,12,15,0) 100%)";

const BTN_BASE = "min-h-[48px] rounded-2xl text-sm transition inline-flex items-center justify-center gap-1.5";
const BTN_PRIMARIO = `${BTN_BASE} text-white font-bold tracking-wide hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed`;
const BTN_SECUNDARIO = `${BTN_BASE} border-2 border-slate-200 font-medium text-slate-600 hover:border-slate-300`;

// Fija al viewport en móvil (pulgar); en lg vuelve al flujo, bajo la columna de reserva.
const BARRA_ACCION =
  "fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-slate-200 bg-white/95 backdrop-blur px-4 pt-3 " +
  "pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] " +
  "lg:static lg:z-auto lg:mt-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:backdrop-blur-none lg:p-0 lg:shadow-none";

function HojaClienteExistente({
  nombreExistente,
  color,
  onConfirmar,
  onCorregir,
}: {
  nombreExistente: string;
  color: string;
  onConfirmar: () => void;
  onCorregir: () => void;
}) {
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const reducirMovimiento = useReducedMotion();

  useEffect(() => {
    confirmarRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCorregir();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = document.getElementById(ID_HOJA_CONFLICTO);
      const focusables = panel?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusables?.length) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCorregir]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      {/* Sin cierre al tocar: la decisión define a nombre de quién queda la cita. */}
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" />
      <motion.div
        id={ID_HOJA_CONFLICTO}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ID_TITULO_CONFLICTO}
        initial={reducirMovimiento ? { opacity: 0 } : { y: "100%" }}
        animate={reducirMovimiento ? { opacity: 1 } : { y: 0 }}
        transition={reducirMovimiento ? { duration: 0.15 } : { type: "spring", damping: 32, stiffness: 320 }}
        className="relative w-full max-w-lg rounded-t-3xl bg-white px-5 pt-4 shadow-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        <h2 id={ID_TITULO_CONFLICTO} className="text-lg font-bold text-slate-900">
          Encontramos una cuenta con ese teléfono
        </h2>
        <p className="mt-1 text-sm text-slate-500">Ese número ya está registrado a nombre de:</p>
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-xl font-bold text-slate-900">
          {nombreExistente}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Si eres tú, agendaremos la cita con ese nombre.
        </p>
        <button
          ref={confirmarRef}
          type="button"
          onClick={onConfirmar}
          className={`${BTN_PRIMARIO} mt-5 w-full`}
          style={{ background: color }}
        >
          Sí, soy yo
        </button>
        <button
          type="button"
          onClick={onCorregir}
          className={`${BTN_BASE} mt-2 w-full font-semibold text-slate-600 hover:bg-slate-50`}
        >
          Corregir mi teléfono
        </button>
      </motion.div>
    </div>,
    document.body
  );
}

/**
 * Visor de imagen a pantalla completa. Radix aporta el rol de diálogo, la trampa
 * de foco, el cierre con Escape y la devolución del foco a quien lo abrió.
 */
function VisorImagen({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/95" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={onClose}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{titulo}</DialogPrimitive.Title>
          {children}
          <DialogPrimitive.Close
            aria-label="Cerrar"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white transition"
          >
            <X size={26} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function GaleriaSection({ imagenes }: { imagenes: ImagenGaleria[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpingRef = useRef(false);
  const navLockRef = useRef(false);
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

  // Scroll to a real image index — lock prevents freeze from rapid clicks
  const scrollTo = (index: number) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    centerSlide(loop ? index + 1 : index, true);
    setActiveIndex(index);
    setTimeout(() => { navLockRef.current = false; }, 350);
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
        // El punto se ve pequeño, pero el área táctil es de 44px.
        <button
          key={i}
          type="button"
          onClick={() => scrollTo(i)}
          aria-label={`Ir a la imagen ${i + 1}`}
          aria-current={isActive ? "true" : undefined}
          className="min-w-[44px] min-h-[44px] -mx-2 flex items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`rounded-full transition-all ${isActive ? "bg-slate-700" : "bg-slate-300"}`}
            style={{
              width: isActive ? 16 : 6,
              height: isEdge ? 4 : 6,
              opacity: isEdge ? 0.45 : 1,
            }}
          />
        </button>
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
              aria-label={img.descripcion || `Ver imagen ${loop ? ((i - 1 + total) % total) + 1 : i + 1} en pantalla completa`}
              className="snap-center shrink-0 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow aspect-[4/5]"
              style={{ width: "calc(100% - 40px)" }}
            >
              <img src={img.url} alt={img.descripcion ?? ""} className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>

        {total > 1 && (
          <>
            <button
              aria-label="Imagen anterior"
              onClick={() => scrollTo((activeIndex - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 transition hover:bg-white"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Imagen siguiente"
              onClick={() => scrollTo((activeIndex + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 transition hover:bg-white"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-1 mb-2">
          {renderDots()}
        </div>
      )}

      {lightbox && (
        <VisorImagen titulo="Imagen de la galería" onClose={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
        </VisorImagen>
      )}
    </>
  );
}

function GaleriaDesktop({ imagenes, onOpen }: { imagenes: ImagenGaleria[]; onOpen: (idx: number) => void }) {
  const [idx, setIdx] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const total = imagenes.length;

  const goPrev = () => setIdx(i => (i - 1 + total) % total);
  const goNext = () => setIdx(i => (i + 1) % total);

  useEffect(() => {
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [idx]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => onOpen(idx)}
            aria-label={`Ver imagen ${idx + 1} en pantalla completa`}
            className="block w-full focus:outline-none"
          >
            <img
              src={imagenes[idx].url}
              alt={imagenes[idx].descripcion ?? ""}
              className="w-full h-[380px] xl:h-[440px] object-cover"
              draggable={false}
            />
          </button>
        </div>
        {total > 1 && (
          <>
            <button
              aria-label="Imagen anterior"
              onPointerDown={e => e.stopPropagation()}
              onClick={goPrev}
              style={{ touchAction: "manipulation" }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition select-none"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Imagen siguiente"
              onPointerDown={e => e.stopPropagation()}
              onClick={goNext}
              style={{ touchAction: "manipulation" }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 hover:bg-white transition select-none"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs tabular-nums px-2 py-0.5 rounded-full select-none pointer-events-none">
              {idx + 1} de {total}
            </div>
          </>
        )}
      </div>
      {total > 1 && (
        <div
          ref={thumbsRef}
          className="flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {imagenes.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Mostrar imagen ${i + 1}`}
              aria-current={i === idx ? "true" : undefined}
              className={`shrink-0 rounded-lg overflow-hidden transition-opacity ${
                i === idx ? "ring-2 ring-slate-700 opacity-100" : "opacity-50 hover:opacity-80"
              }`}
              style={{ width: 90, height: 68 }}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
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

  // Escape lo resuelve el diálogo; aquí solo las flechas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VisorImagen titulo={`Galería: imagen ${idx + 1} de ${total}`} onClose={onClose}>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums select-none">
        {idx + 1} de {total}
      </div>
      <img
        src={imagenes[idx].url}
        alt={imagenes[idx].descripcion ?? ""}
        className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      {total > 1 && (
        <>
          <button
            aria-label="Imagen anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            onClick={e => { e.stopPropagation(); goPrev(); }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            aria-label="Imagen siguiente"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
            onClick={e => { e.stopPropagation(); goNext(); }}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </VisorImagen>
  );
}

function ResenasSection({ resenas, promedio, total }: { resenas: ResenaPublica[]; promedio: number; total: number }) {
  if (!resenas.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} size={14} strokeWidth={1.5} className={`text-rating ${promedio >= s ? "fill-rating" : "fill-none"}`} />
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
                  <Star key={s} size={11} strokeWidth={1.5} className={`text-rating ${r.rating >= s ? "fill-rating" : "fill-none"}`} />
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
  const idCampo = useId();
  const idError = `${idCampo}-error`;
  const label = (
    <label htmlFor={idCampo} className="block text-sm font-medium text-gray-700 mb-1">
      {campo.etiqueta}
      {campo.requerido && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
    </label>
  );
  const ariaCampo = {
    id: idCampo,
    "aria-required": campo.requerido || undefined,
    "aria-invalid": mostrarError || undefined,
    "aria-describedby": mostrarError ? idError : undefined,
  };
  const mensajeError = mostrarError && (
    <p id={idError} className="text-xs text-red-600 mt-1">Este campo es obligatorio</p>
  );

  if (campo.tipo === "Checkbox") {
    return (
      <div>
        <label className={`flex items-center gap-2 cursor-pointer ${mostrarError ? "text-red-600" : ""}`}>
          <input
            {...ariaCampo}
            type="checkbox"
            checked={valor === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
            className={`w-4 h-4 accent-slate-700 ${mostrarError ? "outline outline-1 outline-red-500 rounded" : ""}`}
          />
          <span className={`text-sm ${mostrarError ? "text-red-600" : "text-gray-700"}`}>
            {campo.etiqueta}
            {campo.requerido && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </span>
        </label>
        {mensajeError}
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
          {...ariaCampo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition ${mostrarError ? "border-red-500" : "border-gray-300"}`}
        >
          <option value="">Selecciona una opción</option>
          {opciones.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        {mensajeError}
      </div>
    );
  }

  if (campo.tipo === "MultilineTexto") {
    return (
      <div>
        {label}
        <textarea
          {...ariaCampo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition resize-none ${mostrarError ? "border-red-500" : "border-gray-300"}`}
        />
        {mensajeError}
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        {...ariaCampo}
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition ${mostrarError ? "border-red-500" : "border-gray-300"}`}
      />
      {mensajeError}
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const reducirMovimiento = useReducedMotion();
  const idCupon = useId();

  const [servicio, setServicio] = useState<ServicioPublico | null>(null);
  const [empleado, setEmpleado] = useState<EmpleadoPublico | null>(null);
  const [slot, setSlot] = useState<SlotDisponible | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [galeriaViewerIdx, setGaleriaViewerIdx] = useState<number | null>(null);
  const [galeriaVisible, setGaleriaVisible] = useState(false);

  // Respuestas del sub-paso de preguntas (entre paso 3 y paso 4)
  const [respuestasIntake, setRespuestasIntake] = useState<Record<string, string>>({});
  // Lo escrito en el paso 4 vive aquí para sobrevivir a ir y volver entre pasos.
  const [datosCliente, setDatosCliente] = useState<Partial<DatosClienteForm>>({});

  // Promo code
  const [mostrarCupon, setMostrarCupon] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoValidado | null>(null);
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState("");

  // Políticas del negocio — vive aquí porque el submit está en la barra de acción
  const [politicasAceptadas, setPoliticasAceptadas] = useState(false);

  // Conflicto: el teléfono ya pertenece a otro cliente del negocio
  const [nombreEnConflicto, setNombreEnConflicto] = useState<string | null>(null);
  // El visitante ya se identificó en el paso 4 ("Sí, soy yo"): no hace falta volver
  // a preguntárselo con la hoja de conflicto al enviar.
  const [clienteReconocido, setClienteReconocido] = useState(false);
  const datosPendientesRef = useRef<DatosClienteForm | null>(null);

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

  const { data: camposIntake = [], isLoading: cargandoIntake, isError: intakeError, refetch: refetchIntake } = useQuery<CampoIntake[]>({
    queryKey: ["intake-publico", slug, servicio?.id],
    queryFn: () => intakePublicoApi.getCampos(slug!, servicio?.id),
    enabled: !!slug && !!servicio,
  });

  // Las preguntas generales (sin servicio) se conocen desde el paso 1: así el total
  // del indicador no salta de «1 de 4» a «1 de 5» al elegir un servicio. Solo puede
  // cambiar si el negocio tiene preguntas exclusivas de algunos servicios.
  const { data: camposIntakeGenerales = [] } = useQuery<CampoIntake[]>({
    queryKey: ["intake-publico", slug, null],
    queryFn: () => intakePublicoApi.getCampos(slug!),
    enabled: !!slug && !servicio,
  });

  const hayIntake = camposIntake.length > 0;
  const faltanCamposIntake = camposIntake
    .filter((c) => c.requerido)
    .some((c) => !respuestasIntake[c.id]?.trim());

  // Un enlace directo o una recarga en un paso posterior, sin los datos que ese paso
  // necesita, cae en el primer paso incompleto.
  const pasoSolicitado = leerPaso(searchParams.get(PARAM_PASO));
  const pasoActual: ClavePaso = (() => {
    if (pasoSolicitado === "1" || !servicio) return "1";
    if (pasoSolicitado === "2" || !empleado) return "2";
    if (pasoSolicitado === "3" || !slot) return "3";
    if (pasoSolicitado === "preguntas") return hayIntake ? "preguntas" : "3";
    return hayIntake && faltanCamposIntake ? "preguntas" : "4";
  })();
  const paso = pasoActual === "preguntas" ? 3 : Number(pasoActual);
  const mostrarIntake = pasoActual === "preguntas";

  // Dirección de la animación y limpieza al cambiar de paso, también cuando el cambio
  // llega por el «atrás» del navegador. Se ajusta durante el render, no en un efecto.
  const indicePaso = CLAVES_PASO.indexOf(pasoActual);
  const [indicePrevio, setIndicePrevio] = useState(indicePaso);
  const [direction, setDirection] = useState(1);
  if (indicePaso !== indicePrevio) {
    setIndicePrevio(indicePaso);
    setDirection(indicePaso > indicePrevio ? 1 : -1);
    if (pasoActual !== "preguntas") setIntentoContinuar(false);
    // La confirmación de «Sí, soy yo» vive en el formulario del paso 4; al salir de él
    // se pierde, así que el padre tampoco debe darla por buena.
    if (pasoActual !== "4") setClienteReconocido(false);
    // El aviso de «horario ya no disponible» solo vale en el paso 3 que lo provocó.
    if (pasoActual !== "3") setErrorSlotTomado("");
  }

  // Corrige la URL cuando pide un paso que todavía no se puede mostrar.
  useEffect(() => {
    if (!negocio || cargandoIntake) return;
    if (searchParams.get("servicioId") && !yaPreseleccionado) return;
    if (pasoActual !== pasoSolicitado) {
      setSearchParams(paramsConPaso(searchParams, pasoActual), { replace: true });
    }
  }, [negocio, cargandoIntake, yaPreseleccionado, pasoActual, pasoSolicitado, searchParams, setSearchParams]);

  const irAPaso = (destino: ClavePaso) => {
    const estado: EstadoHistorialPaso = { pasoPrevio: pasoActual };
    setSearchParams(paramsConPaso(searchParams, destino), { state: estado });
  };

  // Si la entrada anterior del historial es justo ese paso, se vuelve a ella: así el
  // «Atrás» de pantalla y el del navegador recorren la misma pila.
  const volverAPaso = (destino: ClavePaso) => {
    if ((location.state as EstadoHistorialPaso)?.pasoPrevio === destino) navigate(-1);
    else setSearchParams(paramsConPaso(searchParams, destino), { replace: true });
  };

  // Título de la pestaña: el mismo hook (y el mismo título por defecto) que el resto.
  useTituloPagina(negocio ? `Reservar en ${negocio.nombre}` : null);

  // Open Graph dinámico
  useEffect(() => {
    if (!negocio) return;
    const titulo = `Reservar en ${negocio.nombre} · AppointVa`;

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
  }, [negocio]);

  // Pre-seleccionar servicio y empleado desde URL params (flujo "Repetir cita")
  useEffect(() => {
    if (!negocio || yaPreseleccionado) return;
    const paramServicioId = searchParams.get("servicioId");
    const paramEmpleadoId = searchParams.get("empleadoId");
    if (!paramServicioId) return;

    const svc = negocio.servicios.find((s) => s.id === paramServicioId);
    setYaPreseleccionado(true);
    if (!svc) return;

    setServicio(svc);

    if (paramEmpleadoId) {
      const emp = negocio.empleados.find((e) => e.id === paramEmpleadoId);
      if (emp) {
        setEmpleado(emp);
        setSearchParams(paramsConPaso(searchParams, "3"), { replace: true });
        return;
      }
    }
    setSearchParams(paramsConPaso(searchParams, "2"), { replace: true });
  }, [negocio, searchParams, setSearchParams, yaPreseleccionado]);

  const irSiguiente = () => {
    const siguiente: Record<ClavePaso, ClavePaso> = {
      "1": "2",
      "2": "3",
      "3": hayIntake ? "preguntas" : "4",
      preguntas: "4",
      "4": "4",
    };
    irAPaso(siguiente[pasoActual]);
  };

  // Moverse entre pasos no borra nada; solo cambiar una elección invalida las que
  // dependen de ella (ver seleccionarServicio / seleccionarEmpleado).
  const irAtras = () => {
    const anterior: Record<ClavePaso, ClavePaso> = {
      "1": "1",
      "2": "1",
      "3": "2",
      preguntas: "3",
      "4": hayIntake ? "preguntas" : "3",
    };
    volverAPaso(anterior[pasoActual]);
  };

  const seleccionarServicio = (nuevo: ServicioPublico) => {
    if (nuevo.id === servicio?.id) return;
    setServicio(nuevo);
    setEmpleado(null);
    setSlot(null);
    setRespuestasIntake({});
  };

  const seleccionarEmpleado = (nuevo: EmpleadoPublico) => {
    if (nuevo.id === empleado?.id) return;
    setEmpleado(nuevo);
    setSlot(null);
  };

  // Foco y scroll al cambiar de paso (no en la carga inicial).
  const columnaReservaRef = useRef<HTMLDivElement>(null);
  const contenedorPasoRef = useRef<HTMLDivElement>(null);
  const ultimoPasoMostradoRef = useRef<ClavePaso | null>(null);
  const [anuncioPaso, setAnuncioPaso] = useState("");

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

  const confirmarCita = async (datos: DatosClienteForm, confirmarClienteExistente = false) => {
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
        confirmarClienteExistente: confirmarClienteExistente || undefined,
      });
      navigate(`/b/${slug}/confirmacion/${cita.codigoConfirmacion}`);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const respuesta = (err as {
        response?: { status?: number; data?: { mensaje?: string; codigo?: string; nombreExistente?: string } };
      })?.response;
      const status = respuesta?.status;
      const codigo = respuesta?.data?.codigo;
      const msg = respuesta?.data?.mensaje;
      // El código manda: el sniffing por mensaje es solo respaldo para respuestas viejas.
      if (codigo === CODIGO_CLIENTE_DISTINTO) {
        datosPendientesRef.current = datos;
        setNombreEnConflicto(respuesta?.data?.nombreExistente ?? "");
      } else if (
        codigo === CODIGO_HORARIO_NO_DISPONIBLE ||
        status === 409 ||
        msg?.toLowerCase().includes("disponible") ||
        msg?.toLowerCase().includes("ocupado")
      ) {
        setErrorSlotTomado("Ese horario ya no está disponible, elige otro.");
        setSlot(null);
        volverAPaso("3");
      } else if (status === 402) {
        setErrorEnvio(msg ?? "Este negocio ha alcanzado su límite de citas para este mes. Por favor contáctalo directamente para más información.");
      } else {
        setErrorEnvio(msg ?? "No se pudo confirmar la cita. Intenta de nuevo.");
      }
      setEnviando(false);
    }
  };

  const aceptarClienteExistente = () => {
    const datos = datosPendientesRef.current;
    setNombreEnConflicto(null);
    datosPendientesRef.current = null;
    if (datos) confirmarCita(datos, true);
  };

  // Estable: la hoja la usa como dependencia de su efecto de foco/teclado.
  const corregirTelefono = useCallback(() => {
    setNombreEnConflicto(null);
    datosPendientesRef.current = null;
    document.querySelector<HTMLInputElement>(`#${ID_FORM_DATOS} [name="telefonoCliente"]`)?.focus();
  }, []);

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
  // El CTA lleva texto blanco: un dorado o un verde salvia crudos lo dejan ilegible.
  const colorCta = brandSolid(color);
  // Un fondo elegido gana sobre la foto: es la última decisión explícita del
  // negocio y, si no, el selector del dashboard no tendría efecto visible.
  // Una clave retirada (patrones, texturas) cae en su reemplazo o en "sin preset".
  const presetPortada = normalizarPresetPortada(negocio.portadaPreset);
  const mostrarFoto = !presetPortada && !!negocio.portadaUrl;
  const fondoDePortada = fondoPortada(presetPortada, color);
  const terms = getSectorTerms(negocio.sector);
  // Mientras carga la consulta del servicio se mantiene el total que ya se mostraba.
  const intakeEnIndicador = servicio && !cargandoIntake ? hayIntake : camposIntakeGenerales.length > 0;
  const pasos = intakeEnIndicador
    ? ["Servicio", terms.empleado, "Fecha y hora", "Sobre ti", "Tus datos"]
    : ["Servicio", terms.empleado, "Fecha y hora", "Tus datos"];
  const pasoIndicador = intakeEnIndicador
    ? mostrarIntake ? 4 : paso === 4 ? 5 : paso
    : paso;

  const textos = negocio.sector === 'salud'
    ? { cita: 'consulta' }
    : { cita: 'cita' };

  // Código de descuento: vive dentro del formulario del paso 4, justo antes del
  // resumen, para que el total que se ve ya sea el que se paga. Sus botones son
  // type="button" y Enter se intercepta para no enviar la cita por accidente.
  const bloqueDescuento = (
    <div>
      {descuentoAplicado ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl pl-4 pr-1 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Tag size={15} className="text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-700">
                Código <span className="font-mono">{descuentoAplicado.codigo}</span> aplicado
              </p>
              <p className="text-xs text-green-700">
                {descuentoAplicado.tipo === "Porcentaje"
                  ? `${descuentoAplicado.valor}% de descuento`
                  : `${formatPrecio(descuentoAplicado.valor)} de descuento`}
                {servicio && ` — precio final: ${formatPrecio(precioConDescuento(servicio.precio, descuentoAplicado))}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDescuentoAplicado(null)}
            aria-label="Quitar código"
            className="min-w-[44px] min-h-[44px] ml-1 shrink-0 rounded-lg flex items-center justify-center text-green-600 hover:text-green-800 transition"
          >
            <X size={16} />
          </button>
        </div>
      ) : mostrarCupon ? (
        <div className="space-y-2">
          <label htmlFor={idCupon} className="sr-only">Código de descuento</label>
          <div className="flex gap-2">
            <input
              id={idCupon}
              aria-invalid={!!errorCupon || undefined}
              aria-describedby={errorCupon ? `${idCupon}-error` : undefined}
              type="text"
              value={codigoInput}
              onChange={(e) => { setCodigoInput(e.target.value.toUpperCase()); setErrorCupon(""); }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                validarCupon();
              }}
              placeholder="PROMO20"
              maxLength={50}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
            />
            <button
              type="button"
              onClick={validarCupon}
              disabled={validandoCupon || !codigoInput.trim()}
              className="min-h-[44px] px-4 py-2 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition"
              style={{ background: colorCta }}
            >
              {validandoCupon ? "Aplicando…" : "Aplicar"}
            </button>
          </div>
          {errorCupon && <p id={`${idCupon}-error`} className="text-red-600 text-xs">{errorCupon}</p>}
          <button
            type="button"
            onClick={() => { setMostrarCupon(false); setCodigoInput(""); setErrorCupon(""); }}
            className="min-h-[44px] px-1 text-sm text-slate-600 hover:text-slate-800 transition"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarCupon(true)}
          className="min-h-[44px] text-sm text-slate-600 font-medium hover:underline"
        >
          ¿Tienes un código de descuento?
        </button>
      )}
    </div>
  );

  const alMostrarPaso = (clave: ClavePaso) => {
    const anterior = ultimoPasoMostradoRef.current;
    ultimoPasoMostradoRef.current = clave;
    // La carga inicial (y el doble montaje de StrictMode) no mueve el foco.
    if (anterior === null || anterior === clave) return;

    const columna = columnaReservaRef.current;
    const arriba = columna?.getBoundingClientRect().top ?? 0;
    if (arriba < 0) {
      window.scrollTo({ top: window.scrollY + arriba, behavior: reducirMovimiento ? "auto" : "smooth" });
    }
    contenedorPasoRef.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    setAnuncioPaso(`Paso ${pasoIndicador} de ${pasos.length}: ${pasos[pasoIndicador - 1]}`);
  };

  const continuarDesdeIntake = () => {
    setIntentoContinuar(true);
    if (!faltanCamposIntake) irSiguiente();
  };

  const botonAtras = (
    <button onClick={irAtras} className={`${BTN_SECUNDARIO} flex-1`}>
      <ChevronLeft size={15} />
      Atrás
    </button>
  );

  // Una sola barra para todo el wizard: vive fuera del bloque animado porque un
  // `position: fixed/sticky` dentro de un ancestro transformado se ancla al transform.
  const accionesPaso = (() => {
    if (paso === 1) {
      return (
        <>
          {/* Resumen en dos líneas a la izquierda: el nombre del servicio tiene su
              propia línea (hasta dos renglones) y "45 min · $280" va debajo; a 375px
              una sola línea corrida truncaba hasta los nombres cortos.
              El nombre accesible sigue siendo "Continuar"; el resumen va como descripción. */}
          <button
            onClick={irSiguiente}
            disabled={!servicio}
            aria-label={servicio ? "Continuar" : undefined}
            aria-describedby={servicio ? "resumen-servicio-elegido" : undefined}
            className={`${BTN_PRIMARIO} w-full ${servicio ? "!justify-between gap-3 px-4 py-2" : ""}`}
            style={{ background: colorCta }}
          >
            {servicio ? (
              <>
                <span aria-hidden="true" className="min-w-0 flex flex-col text-left leading-tight">
                  <span className="font-semibold tracking-normal line-clamp-2 break-words">{servicio.nombre}</span>
                  <span className="text-xs font-medium tracking-normal tabular-nums opacity-90">
                    {`${servicio.duracionMinutos} min · ${formatPrecio(servicio.precio)}`}
                  </span>
                </span>
                {/* La descripción va en una sola pieza de texto: partida, el cálculo accesible pierde los espacios. */}
                <span id="resumen-servicio-elegido" className="sr-only">
                  {`${servicio.nombre} · ${servicio.duracionMinutos} min · ${formatPrecio(servicio.precio)}`}
                </span>
                <span className="shrink-0 inline-flex items-center gap-1">
                  Continuar
                  <ChevronRight size={16} aria-hidden="true" />
                </span>
              </>
            ) : (
              "Continuar"
            )}
          </button>
        </>
      );
    }

    if (paso === 2 && servicio) {
      return (
        <div className="flex gap-3">
          {botonAtras}
          <button
            onClick={irSiguiente}
            disabled={!empleado}
            className={`${BTN_PRIMARIO} flex-1`}
            style={{ background: colorCta }}
          >
            Continuar
          </button>
        </div>
      );
    }

    if (paso === 3 && servicio && empleado && !mostrarIntake) {
      return (
        <div className="flex gap-3">
          {botonAtras}
          <button
            onClick={irSiguiente}
            disabled={!slot || cargandoIntake}
            className={`${BTN_PRIMARIO} flex-1`}
            style={{ background: colorCta }}
          >
            {cargandoIntake ? "Cargando..." : "Continuar"}
          </button>
        </div>
      );
    }

    if (paso === 3 && mostrarIntake && camposIntake.length > 0) {
      return (
        <div className="flex gap-3">
          {botonAtras}
          <button
            onClick={continuarDesdeIntake}
            className={`${BTN_PRIMARIO} flex-1`}
            style={{ background: colorCta }}
          >
            Continuar
          </button>
        </div>
      );
    }

    if (paso === 4 && servicio && empleado && slot) {
      return (
        <div className="flex gap-3">
          {botonAtras}
          <button
            type="submit"
            form={ID_FORM_DATOS}
            // Sin aceptar las políticas el botón sigue activo: el formulario explica qué falta.
            disabled={enviando}
            className={`${BTN_PRIMARIO} flex-1`}
            style={{ background: colorCta }}
          >
            {enviando ? "Confirmando…" : "Confirmar cita"}
          </button>
        </div>
      );
    }

    return null;
  })();

  return (
    <div data-sector={negocio.sector === "salud" ? "salud" : undefined} className="min-h-screen bg-slate-50">
      {/* Header oscuro del negocio */}
      <div
        data-testid="portada-negocio"
        className={`relative overflow-hidden min-h-[180px] sm:min-h-[260px] lg:min-h-[300px] xl:min-h-[340px] flex flex-col justify-end ${mostrarFoto ? "bg-ink" : ""}`}
        style={mostrarFoto ? undefined : fondoDePortada}
      >
        {/* Portada visible, a opacidad completa: el contraste lo sostiene el velo de abajo */}
        {mostrarFoto && (
          <img
            src={negocio.portadaUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: negocio.portadaObjectPosition ?? "center" }}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        )}
        {/* Glow de marca solo cuando no hay foto ni fondo elegido: los fondos
            generados ya traen su propia luz y un halo encima los ensucia. */}
        {!mostrarFoto && !presetPortada && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 120% at 0% 0%, rgb(${hexToChannels(color)} / 0.20) 0%, transparent 65%)`,
            }}
          />
        )}
        {/* Contenido con padding-top para dejar ver la foto arriba. El inset superior baja
            el contenido bajo la barra de estado; la portada sigue llegando al borde.
            El velo va aquí y no en toda la portada: así se ajusta al bloque de texto
            —crece y encoge con él— y deja la foto intacta por encima. Los fondos
            generados no lo llevan, ya nacen oscuros donde cae el texto. */}
        <div
          className="relative z-10 px-5 sm:px-8 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-4 sm:pb-6"
          style={mostrarFoto ? { background: VELO_TEXTO_PORTADA } : undefined}
        >
          {/* Fila: logo + nombre alineados arriba */}
          <div className="flex items-start gap-3.5 sm:gap-5">
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
                    className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl object-cover cursor-zoom-in"
                    style={{
                      border: `1.5px solid rgb(${hexToChannels(color)} / 0.45)`,
                      boxShadow: `0 2px 16px rgb(${hexToChannels(color)} / 0.28)`,
                    }}
                    loading="eager"
                  />
                </button>
              ) : (
                // Sin logo, la inicial del negocio (como los avatares del equipo), no un emoji (BF-24).
                <div
                  aria-hidden="true"
                  className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center text-2xl sm:text-4xl font-bold text-white"
                  style={{
                    background: `rgb(${hexToChannels(color)} / 0.18)`,
                    border: `1.5px solid rgb(${hexToChannels(color)} / 0.40)`,
                  }}
                >
                  {monogramaNegocio(negocio.nombre)}
                </div>
              )}
            </div>
            {/* Nombre, descripción y redes en la misma columna */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-white font-bold text-xl sm:text-3xl leading-tight"
                  style={{ textShadow: SOMBRA_TEXTO_PORTADA }}
                >
                  {negocio.nombre}
                </h1>
                {/* Sin reseñas no se muestra la píldora: una estrella junto a
                    "Sin reseñas" se lee como una mala nota (BF-25). */}
                {(negocio.totalResenas ?? 0) > 0 && (
                  <div className="flex items-center gap-1 rounded-full px-2 py-0.5 bg-ink/40">
                    <Star size={9} strokeWidth={0} className="fill-rating text-rating" aria-hidden="true" />
                    <span className="text-[10px] sm:text-xs text-white/85">
                      <span className="sr-only">Calificación </span>
                      {(negocio.promedioResenas ?? 0).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              {negocio.descripcion && (
                <p
                  className="text-xs sm:text-sm mt-1 leading-snug"
                  style={{ color: "rgba(255,255,255,0.92)", textShadow: SOMBRA_TEXTO_PORTADA }}
                >
                  {negocio.descripcion}
                </p>
              )}
              {negocio.direccion && (
                <p
                  className="flex items-start gap-1 text-xs sm:text-sm mt-2 leading-snug"
                  style={{ color: "rgba(255,255,255,0.80)", textShadow: SOMBRA_TEXTO_PORTADA }}
                >
                  <MapPin size={14} className="shrink-0 mt-px" aria-hidden="true" />
                  <span>{negocio.direccion}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tira de pasos — full width, fondo oscuro */}
      <IndicadorPasos pasoActual={pasoIndicador} pasos={pasos} slug={negocio.slug} />

      {/* Contenido */}
      <div className="lg:max-w-6xl lg:mx-auto lg:px-8 lg:flex lg:gap-8 lg:items-start lg:pt-8 lg:pb-12">

        {/* Left column — galería + reseñas, solo desktop */}
        {negocio.galeria?.length > 0 && (
          <div className="hidden lg:flex w-[440px] xl:w-[500px] shrink-0 sticky top-0 h-screen flex-col justify-start py-8 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
            <GaleriaDesktop imagenes={negocio.galeria} onOpen={setGaleriaViewerIdx} />
            {negocio.resenas?.length > 0 && (
              <div className="mt-6">
                <ResenasSection
                  resenas={negocio.resenas}
                  promedio={negocio.promedioResenas ?? 0}
                  total={negocio.totalResenas ?? 0}
                />
              </div>
            )}
          </div>
        )}

        {/* Right column — flujo de reserva */}
        {/* pb-32: deja aire bajo el contenido para que la barra fija no tape el final */}
        <div ref={columnaReservaRef} className="px-4 pt-5 pb-32 lg:flex-1 lg:px-0 lg:pt-0 lg:pb-0">

        {/* Anuncia el paso nuevo a lectores de pantalla */}
        <p role="status" aria-live="polite" className="sr-only">{anuncioPaso}</p>

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
            {slot && paso >= 3 && (
              <>
                <span className="text-slate-300">›</span>
                <span className="text-slate-600">{`${formatFechaCorta(slot.inicio)} · ${slot.horaTexto}`}</span>
              </>
            )}
          </div>
        )}

        {/* Pasos — wrapper con animación de transición */}
        <div ref={contenedorPasoRef}>
        <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={pasoActual}
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
        <AlMontarPaso onMontado={() => alMostrarPaso(pasoActual)} />

        {/* Paso 1 */}
        {paso === 1 && (
          <>
            <PasoServicio
              servicios={negocio.servicios}
              seleccionado={servicio}
              onSeleccionar={seleccionarServicio}
              color={color}
              sector={negocio.sector}
            />

            {/* Galería colapsable — solo móvil */}
            {negocio.galeria?.length > 0 && (
              <div className="lg:hidden mt-4">
                <button
                  onClick={() => setGaleriaVisible(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
                >
                  <span>{galeriaVisible ? "Ocultar galería" : "Ver galería de fotos"}</span>
                  <ChevronRight
                    size={16}
                    className="transition-transform duration-200"
                    style={{ transform: galeriaVisible ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                </button>
                {galeriaVisible && <GaleriaSection imagenes={negocio.galeria} />}
              </div>
            )}

            {/* Reseñas — solo mobile; en desktop aparecen en la columna izquierda */}
            {negocio.resenas?.length > 0 && (
              <div className="lg:hidden mt-6">
                <ResenasSection
                  resenas={negocio.resenas}
                  promedio={negocio.promedioResenas ?? 0}
                  total={negocio.totalResenas ?? 0}
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
              onSeleccionar={seleccionarEmpleado}
              color={color}
              sector={negocio.sector}
            />
          </>
        )}

        {/* Paso 3 */}
        {paso === 3 && servicio && empleado && !mostrarIntake && (
          <>
            {errorSlotTomado && (
              <div role="alert" className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
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
              onSeleccionar={(nuevo) => {
                setSlot(nuevo);
                setErrorSlotTomado("");
              }}
              onLimpiarSlot={() => setSlot(null)}
              color={color}
              diasAnticipacionMinima={negocio.diasAnticipacionMinima}
              enlaceListaEspera={
                negocio.listaEsperaActiva === true
                  ? `/b/${negocio.slug}/espera?servicioId=${servicio.id}`
                  : undefined
              }
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
            {intakeError && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <p className="text-xs text-red-500">
                  No se pudo cargar el formulario adicional.
                </p>
                <button
                  onClick={() => refetchIntake()}
                  className="text-xs text-slate-600 font-semibold underline hover:text-slate-800 transition"
                >
                  Reintentar
                </button>
              </div>
            )}
          </>
        )}

        {/* Paso 3 — Intake (sub-paso entre hora y datos) */}
        {paso === 3 && mostrarIntake && camposIntake.length > 0 && (
          <>
            <div className="mb-5">
              <h2 tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">Unas preguntas rápidas</h2>
              <p className="text-sm text-slate-500 mt-1">
                {`Nos ayudan a preparar tu ${textos.cita}.`}
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
            {intentoContinuar && faltanCamposIntake && (
              <p className="text-xs text-red-500 text-center mt-4">Completa los campos obligatorios para continuar</p>
            )}
          </>
        )}

        {/* Paso 4 — formulario */}
        {paso === 4 && servicio && empleado && slot && (
          <>
            {/* Confirmación pendiente */}
            {negocio && !negocio.autoConfirmar && (
              <p className="mb-4 text-xs text-slate-600 flex items-center gap-1.5">
                <AlertCircle size={12} className="shrink-0" />
                Tu {textos.cita} quedará <strong className="text-slate-700">pendiente de confirmación</strong>.
              </p>
            )}

            {/* Formulario — el error aparece dentro, justo antes del submit */}
            <PasoDatosCliente
              servicio={servicio}
              empleado={empleado}
              slot={slot}
              formId={ID_FORM_DATOS}
              slug={negocio.slug}
              politicasAceptadas={politicasAceptadas}
              onPoliticasAceptadasChange={setPoliticasAceptadas}
              onEnviar={(datos) => confirmarCita(datos, clienteReconocido)}
              onClienteReconocidoChange={setClienteReconocido}
              valoresIniciales={datosCliente}
              onValoresChange={setDatosCliente}
              notasLabel={negocio.sector === 'salud' ? 'Motivo de consulta' : undefined}
              error={errorEnvio || undefined}
              politicasUrl={negocio.politicasUrl || undefined}
              color={colorCta}
              descuento={descuentoAplicado}
              bloqueDescuento={bloqueDescuento}
            />
          </>
        )}

        </motion.div>
        </AnimatePresence>
        </div>

        {accionesPaso && <div className={BARRA_ACCION}>{accionesPaso}</div>}

          <PublicFooter />
        </div>
      </div>

      {nombreEnConflicto !== null && (
        <HojaClienteExistente
          nombreExistente={nombreEnConflicto}
          color={colorCta}
          onConfirmar={aceptarClienteExistente}
          onCorregir={corregirTelefono}
        />
      )}

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
        <VisorImagen titulo={`Logo de ${negocio.nombre}`} onClose={() => setLightboxUrl(null)}>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-[88vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </VisorImagen>
      )}
    </div>
  );
}
