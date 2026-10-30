import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from "./dialog";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { VarianteModalContext, type VarianteModal } from "./varianteModal";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: "sm" | "md" | "lg";
}

const anchos = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

/** Arrastre hacia abajo, en px, a partir del cual soltar la hoja la cierra. */
const UMBRAL_CIERRE = 96;

/**
 * Alto que el teclado virtual le quita a la ventana. En iOS y en Chrome para
 * Android (desde la 108) el teclado no encoge el viewport de layout, así que una
 * hoja con `bottom: 0` quedaba detrás de él: se sube lo que mide el teclado.
 */
function useTecladoVirtual(activo: boolean): number {
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!activo || !vv) return;
    const medir = () => setAlto(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
      setAlto(0);
    };
  }, [activo]);
  return alto;
}

/**
 * Diálogo del dashboard. Cabecera y cuerpo comparten el mismo relleno
 * horizontal (px-5 sm:px-6) para que título, campos y botones queden en la
 * misma vertical. La cabecera queda fija y solo el cuerpo hace scroll.
 *
 * Por debajo de `sm` (640px) es una hoja inferior (I13), como en Booksy Biz y
 * Fresha: pegada al borde de abajo, con el asa para cerrarla arrastrando y el
 * pie de `ModalAcciones` fijo al alcance del pulgar. En escritorio sigue siendo
 * el diálogo centrado. Las dos variantes son el mismo Dialog de Radix: foco
 * atrapado, Escape y clic fuera cierran, y el foco vuelve al disparador.
 */
export default function Modal({ abierto, onCerrar, titulo, children, ancho = "md" }: Props) {
  const esMovil = useMediaQuery(CONSULTA_MOVIL);
  const variante: VarianteModal = esMovil ? "hoja" : "dialogo";

  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) onCerrar(); }}>
      <VarianteModalContext.Provider value={variante}>
        {variante === "hoja" ? (
          <HojaInferior titulo={titulo} onCerrar={onCerrar}>{children}</HojaInferior>
        ) : (
          <DialogContent
            data-variante="dialogo"
            className={`${anchos[ancho]} max-h-[90dvh] flex flex-col overflow-hidden p-0 gap-0 bg-white dark:bg-slate-800`}
          >
            <DialogHeader className="px-5 sm:px-6 py-4 pr-12 sm:pr-12 border-b border-slate-100 dark:border-slate-700">
              <DialogTitle className="text-base font-semibold leading-6 text-slate-800 dark:text-slate-100">{titulo}</DialogTitle>
            </DialogHeader>
            {/* text-foreground por defecto: el contenido sin color propio no queda
                negro sobre el fondo oscuro del modal en dark mode. min-h-0: sin él
                el cuerpo no encoge dentro de la columna flex y no hace scroll. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6 py-5 text-foreground">{children}</div>
          </DialogContent>
        )}
      </VarianteModalContext.Provider>
    </Dialog>
  );
}

function HojaInferior({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const teclado = useTecladoVirtual(true);
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);

  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    // Solo el asa y la cabecera arrastran; el botón de cerrar sigue siendo un botón.
    if ((e.target as HTMLElement).closest("button")) return;
    inicio.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    if (inicio.current === null) return;
    setArrastre(Math.max(0, e.clientY - inicio.current));
  };
  const alSoltar = () => {
    if (inicio.current === null) return;
    inicio.current = null;
    const cerrar = arrastre > UMBRAL_CIERRE;
    setArrastre(0);
    if (cerrar) onCerrar();
  };

  // Con el teclado abierto, el campo enfocado puede quedar bajo el pie fijo: se
  // trae a la vista cuando el teclado termina de salir.
  const cuerpoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cuerpo = cuerpoRef.current;
    if (!cuerpo) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const alEnfocar = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!el.matches("input, textarea, select, [contenteditable='true']")) return;
      clearTimeout(t);
      t = setTimeout(() => el.scrollIntoView?.({ block: "nearest" }), 300);
    };
    cuerpo.addEventListener("focusin", alEnfocar);
    return () => { clearTimeout(t); cuerpo.removeEventListener("focusin", alEnfocar); };
  }, []);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-variante="hoja"
        aria-describedby={undefined}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl border-t border-border
          bg-white dark:bg-slate-800 shadow-xl outline-none
          data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom
          duration-calma ease-calma motion-reduce:animate-none"
        style={{
          bottom: teclado,
          maxHeight: teclado ? `calc(100dvh - ${teclado}px - 1rem)` : "92dvh",
          transform: arrastre ? `translateY(${arrastre}px)` : undefined,
          transition: arrastre ? "none" : undefined,
        }}
      >
        <div
          data-testid="asa-hoja"
          className="shrink-0 touch-none cursor-grab active:cursor-grabbing select-none border-b border-slate-100 dark:border-slate-700"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="flex items-center gap-2 pl-5 pr-2 py-2">
            <DialogPrimitive.Title className="flex-1 min-w-0 text-base font-semibold leading-6 text-slate-800 dark:text-slate-100">
              {titulo}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={18} aria-hidden="true" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          </div>
        </div>
        {/* overscroll-contain: el scroll del formulario no arrastra la página de
            atrás. El relleno inferior suma la zona segura del iPhone. */}
        <div
          ref={cuerpoRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground"
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
