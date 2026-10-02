import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import Select from "../Select";
import FiltroBusqueda from "./FiltroBusqueda";
import FiltroPills from "./FiltroPills";
import FiltroRangoFechas from "./FiltroRangoFechas";
import { campoActivo, type CampoFiltro } from "./tipos";

interface BusquedaProps {
  /** Término ya aplicado; `FiltroBusqueda` lleva el borrador por dentro. */
  valor: string;
  /** Se dispara al confirmar la búsqueda o al vaciar el campo, no al teclear. */
  onChange: (valor: string) => void;
  etiqueta?: string;
  placeholder?: string;
}

interface FiltroBarraProps {
  /** Campo de texto: permanece visible siempre, también con el panel colapsado. */
  busqueda?: BusquedaProps;
  /** Control extra en la fila de búsqueda, junto al campo y antes del toggle. */
  accion?: ReactNode;
  /** Declaración de los filtros; la barra decide cómo y cuándo mostrarlos. */
  campos: CampoFiltro[];
  /** Restablece todo. La barra solo muestra el botón cuando hay algo que limpiar. */
  onLimpiar: () => void;
  /** Nombre accesible de la región de filtros. */
  etiqueta?: string;
  className?: string;
}

/**
 * Barra de filtros compartida del dashboard.
 *
 * Las páginas declaran qué filtros tienen; la barra es dueña del layout
 * responsivo, del conteo de filtros activos y del botón de limpiar. Así ninguna
 * página reimplementa el colapso ni el contador.
 *
 * Móvil: la búsqueda queda fija y el resto se colapsa tras el botón "Filtros".
 * Escritorio (lg+): fila horizontal que envuelve y dimensiona cada control a su
 * contenido. Nunca es una columna vertical, que era lo que hacía el `grid
 * grid-cols-2` con todo en `col-span-2`: a 1440px se apilaba y se comía la
 * altura de la pantalla antes de la tabla.
 */
export default function FiltroBarra({
  busqueda,
  accion,
  campos,
  onLimpiar,
  etiqueta = "Filtros",
  className,
}: FiltroBarraProps) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();
  const idBase = useId();

  // El badge cuenta lo que queda oculto tras el toggle; la búsqueda se ve sola.
  const activosColapsados = campos.filter(campoActivo).length;
  const hayAlgoQueLimpiar = activosColapsados > 0 || Boolean(busqueda?.valor);

  const limpiar = () => {
    onLimpiar();
    setAbierto(false);
  };

  return (
    <section aria-label={etiqueta} className={cn("mb-6", className)}>
      {/* `items-end` y no `items-center`: la acción puede traer su propio label
          encima (el desplegable de Clientes) y lo que debe alinearse son los
          controles, no las etiquetas. `flex-wrap` deja que una acción `w-full`
          baje sola de línea en móvil sin arrastrar el toggle de filtros. */}
      <div className="flex flex-wrap items-end gap-2">
        {busqueda && (
          <FiltroBusqueda
            valor={busqueda.valor}
            onChange={busqueda.onChange}
            etiqueta={busqueda.etiqueta}
            placeholder={busqueda.placeholder}
            // `basis-64` es el umbral de salto: con el toggle "Filtros" al lado
            // no cabe en 390px, así que la búsqueda se queda sola en su línea en
            // vez de encogerse hasta que el placeholder no se lee.
            className="grow basis-64 min-w-0 lg:max-w-md"
          />
        )}
        {accion}

        {campos.length > 0 && (
          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            aria-controls={idPanel}
            className={cn(
              "lg:hidden shrink-0 min-h-[44px] px-3.5 inline-flex items-center gap-2",
              "rounded-xl border text-sm font-medium shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40",
              activosColapsados > 0
                ? "bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600"
                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600"
            )}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Filtros</span>
            {activosColapsados > 0 && (
              <span
                className="min-w-[20px] h-5 px-1 inline-flex items-center justify-center rounded-full bg-white/25 text-xs tabular-nums"
                aria-label={`${activosColapsados} filtros activos`}
              >
                {activosColapsados}
              </span>
            )}
          </button>
        )}
      </div>

      {campos.length > 0 && (
        <div
          id={idPanel}
          className={cn(
            abierto ? "flex" : "hidden",
            "flex-col gap-4 mt-3",
            // `lg:flex` gana sobre `hidden`: en escritorio el panel nunca colapsa.
            // Alineado arriba, no abajo: cada campo lleva su label encima y con
            // `items-end` las etiquetas quedaban a distinta altura según el alto
            // del control.
            "lg:flex lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-5 lg:gap-y-3 lg:mt-3"
          )}
        >
          {campos.map((campo) => {
            const idLabel = `${idBase}-${campo.id}`;
            return (
              <div key={campo.id} className="w-full lg:w-auto min-w-0">
                <span
                  id={idLabel}
                  className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5"
                >
                  {campo.etiqueta}
                </span>
                {renderCampo(campo, idLabel)}
              </div>
            );
          })}

          {/* `lg:mt-6` compensa el label que sí tienen los campos, para que el
              botón quede a la altura de los controles y no de las etiquetas. */}
          {hayAlgoQueLimpiar && (
            <div className="w-full lg:w-auto lg:mt-6">
              <button
                type="button"
                onClick={limpiar}
                className={cn(
                  "min-h-[44px] lg:min-h-[36px] px-3 inline-flex items-center gap-1.5 rounded-lg",
                  "text-sm font-medium transition-colors",
                  "text-slate-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
                )}
              >
                <X size={14} aria-hidden="true" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function renderCampo(campo: CampoFiltro, idLabel: string) {
  switch (campo.tipo) {
    case "select": {
      const valorNeutro = campo.valorNeutro ?? "";
      return (
        <Select
          value={campo.valor}
          onChange={(e) => campo.onChange(e.target.value)}
          aria-labelledby={idLabel}
          className="w-full lg:w-52"
        >
          <option value={valorNeutro}>{campo.etiquetaNeutra ?? "Todos"}</option>
          {campo.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
          ))}
        </Select>
      );
    }
    case "pills": {
      const valorNeutro = campo.valorNeutro ?? "";
      const opciones = campo.etiquetaNeutra
        ? [{ valor: valorNeutro, etiqueta: campo.etiquetaNeutra }, ...campo.opciones]
        : campo.opciones;
      return (
        <FiltroPills
          labelId={idLabel}
          valor={campo.valor}
          onChange={campo.onChange}
          opciones={opciones}
        />
      );
    }
    case "rangoFechas":
      return (
        <FiltroRangoFechas
          labelId={idLabel}
          etiqueta={campo.etiqueta}
          desde={campo.desde}
          hasta={campo.hasta}
          onChange={campo.onChange}
          presets={campo.presets}
        />
      );
    case "personalizado":
      return campo.contenido;
  }
}
