import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { MARGEN_POPOVER, posicionPopover, type PosicionPopover } from "../../lib/posicionPopover";

// ── Diálogo anclado (popover) ────────────────────────────────────────────────
//
// En escritorio, un menú que sale de un botón "⋯" o de un bloque del calendario
// se espera junto a ese botón, no centrado en la pantalla (M8). Por dentro es
// un Dialog de Radix —foco atrapado, Escape, clic fuera y foco de vuelta al
// disparador— sin velo oscuro y con coordenadas `fixed` junto al ancla.
//
// No reemplaza a `Modal`: quien lo usa decide cuándo (en el teléfono se sigue
// usando `Modal`).

const MARGEN = MARGEN_POPOVER;
type Posicion = PosicionPopover;

interface Props {
  ancla: HTMLElement;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Ancho deseado en px; se recorta si no cabe. */
  ancho?: number;
}

/** Rectángulo visible de un contenedor: borde del área que recorta a sus hijos. */
interface Recorte { top: number; bottom: number; left: number; right: number }

const RECORTA = /(auto|scroll|hidden|clip)/;

/**
 * Áreas que recortan al ancla: cada ancestro con desplazamiento u `overflow`
 * oculto, y la ventana. Si el ancla queda fuera de cualquiera, ya no se ve.
 */
function recortesDe(el: HTMLElement): Recorte[] {
  const recortes: Recorte[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (RECORTA.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) recortes.push(p.getBoundingClientRect());
  }
  recortes.push({ top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth });
  return recortes;
}

/**
 * El ancla ya no está o no se ve: la desmontó un refresco, la escondió el "+N"
 * del calendario o se desplazó fuera de su contenedor. Comparación estricta:
 * un ancla sin medidas (0×0 en jsdom) no cuenta como fuera de vista.
 */
function anclaPerdida(ancla: HTMLElement): boolean {
  if (!ancla.isConnected) return true;
  const r = ancla.getBoundingClientRect();
  return recortesDe(ancla).some((c) => r.bottom < c.top || r.top > c.bottom || r.right < c.left || r.left > c.right);
}

export default function PopoverDialogo({ ancla, titulo, onCerrar, children, ancho = 360 }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Posicion | null>(null);
  // Sin el ancla, el panel saltaba a (0,0) o flotaba sobre otra cosa: se cierra.
  // Por ref para no rehacer los listeners si el padre pasa otra función.
  const onCerrarRef = useRef(onCerrar);
  const cerrado = useRef(false);
  // Antes que el efecto de `recalcular`: los efectos corren en orden.
  useLayoutEffect(() => {
    onCerrarRef.current = onCerrar;
  });
  useLayoutEffect(() => {
    cerrado.current = false;
  }, [ancla]);

  const recalcular = useCallback(() => {
    if (cerrado.current) return;
    if (anclaPerdida(ancla)) {
      cerrado.current = true;
      onCerrarRef.current();
      return;
    }
    const vista = { ancho: document.documentElement.clientWidth, alto: document.documentElement.clientHeight };
    // Alto natural (cabecera + todo el cuerpo), no el ya recortado por `maxHeight`:
    // así el panel vuelve a crecer cuando el contenido crece.
    const panel = panelRef.current;
    const cabecera = panel?.firstElementChild as HTMLElement | null;
    const cuerpo = panel?.lastElementChild as HTMLElement | null;
    const alto = (cabecera?.offsetHeight ?? 0) + (cuerpo?.scrollHeight ?? 0) + 2;
    const sig = posicionPopover(ancla.getBoundingClientRect(), { ancho, alto }, vista);
    setPos((prev) => prev && prev.top === sig.top && prev.left === sig.left && prev.maxHeight === sig.maxHeight ? prev : sig);
  }, [ancla, ancho]);

  // Sin deps: el contenido cambia de alto al pasar de menú a "Reagendar"; la
  // segunda pasada converge porque `setPos` conserva el objeto si no cambió.
  useLayoutEffect(recalcular);

  useEffect(() => {
    window.addEventListener("resize", recalcular);
    window.addEventListener("scroll", recalcular, true);
    // El ancla puede desaparecer sin que este componente vuelva a renderizar
    // (p. ej. el sondeo del Gantt redibuja sus bloques): se vigila el DOM.
    const observador = new MutationObserver(() => {
      if (!ancla.isConnected) recalcular();
    });
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", recalcular);
      window.removeEventListener("scroll", recalcular, true);
      observador.disconnect();
    };
  }, [recalcular, ancla]);

  return (
    // No modal, como un popover: la página no queda oculta para el lector de
    // pantalla ni bloqueada; un clic fuera o Escape lo cierran.
    <DialogPrimitive.Root open modal={false} onOpenChange={(open) => { if (!open) onCerrar(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={panelRef}
          aria-describedby={undefined}
          // Un clic en el propio disparador no lo cierra para volver a abrirlo.
          onInteractOutside={(e) => { if (ancla.contains(e.target as Node)) e.preventDefault(); }}
          data-popover=""
          className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl outline-none"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            width: Math.min(ancho, typeof window !== "undefined" ? window.innerWidth - MARGEN * 2 : ancho),
            maxHeight: pos?.maxHeight,
            visibility: pos ? "visible" : "hidden",
          }}
        >
          <div className="flex items-center justify-between gap-2 pl-4 pr-2 py-2 border-b border-slate-100 dark:border-slate-700">
            <DialogPrimitive.Title className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {titulo}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Cerrar"
            >
              <X size={16} aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 text-foreground">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
