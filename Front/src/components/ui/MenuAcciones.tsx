import { Fragment, useRef, useState, type ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";
import Modal from "./Modal";
import PopoverDialogo from "./PopoverDialogo";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";

// ── Menú "⋯" ─────────────────────────────────────────────────────────────────
//
// Acciones secundarias de una tarjeta o una fila (I9, I10): lo que no se usa a
// diario y lo destructivo sale de la vista y se agrupa detrás de "⋯", como en los
// tipos de evento de Calendly. Mismo patrón que las acciones de la cita: en
// escritorio un popover junto al botón (`PopoverDialogo`), en el teléfono la hoja
// inferior de `Modal`. Las destructivas van al final, en rojo y tras una línea;
// su confirmación sigue siendo cosa de quien las usa.

export interface AccionMenu {
  id: string;
  etiqueta: string;
  Icono?: ComponentType<{ size?: number; className?: string }>;
  onSelect: () => void;
  destructiva?: boolean;
  deshabilitada?: boolean;
}

const ITEM =
  "w-full min-h-[44px] flex items-center gap-3 px-3 rounded-xl text-left text-sm font-medium transition " +
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

interface Props {
  acciones: AccionMenu[];
  /** Nombre accesible del botón y título del menú, p. ej. "Más acciones de Sofía". */
  etiqueta: string;
  className?: string;
}

export default function MenuAcciones({ acciones, etiqueta, className = "" }: Props) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const esMovil = useMediaQuery(CONSULTA_MOVIL);

  const normales = acciones.filter((a) => !a.destructiva);
  const destructivas = acciones.filter((a) => a.destructiva);
  const cerrar = () => setAbierto(false);

  const lista = (
    // Botones normales dentro de un diálogo, como la hoja de la cita: `role="menu"`
    // exigiría navegación con flechas y anunciaría algo que no es.
    <div className="space-y-1">
      {[normales, destructivas].filter((g) => g.length > 0).map((grupo, i) => (
        <Fragment key={i}>
          {i > 0 && <div role="separator" className="h-px bg-border my-2" />}
          {grupo.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={a.deshabilitada}
              // Primero se cierra el menú: la acción suele abrir otro diálogo
              // (confirmar, editar) y dos diálogos modales no conviven.
              onClick={() => { cerrar(); a.onSelect(); }}
              className={`${ITEM} ${a.destructiva ? "text-red-700 dark:text-red-400" : "text-foreground"}`}
            >
              {a.Icono && <a.Icono size={17} className={`shrink-0 ${a.destructiva ? "" : "text-muted-foreground"}`} />}
              {a.etiqueta}
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] rounded-xl border border-border dark:border-slate-600
          text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {abierto && (esMovil || !botonRef.current ? (
        <Modal abierto onCerrar={cerrar} titulo={etiqueta} ancho="sm">{lista}</Modal>
      ) : (
        <PopoverDialogo ancla={botonRef.current} titulo={etiqueta} onCerrar={cerrar} ancho={260}>
          {lista}
        </PopoverDialogo>
      ))}
    </>
  );
}
