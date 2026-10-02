import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../../lib/utils";

interface FiltroBusquedaProps {
  /** Término ya aplicado. Lo que se está tecleando vive dentro del componente. */
  valor: string;
  /** Se dispara al confirmar (botón "Buscar" o Enter) y al vaciar el campo. */
  onChange: (valor: string) => void;
  /**
   * Id del `<form>`. El botón de envío se renderiza fuera, al final de la fila,
   * y se asocia con `form={formId}` (ver `FiltroBotonBuscar`).
   */
  formId: string;
  /** Etiqueta accesible; se muestra solo a lectores de pantalla. */
  etiqueta?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Campo de búsqueda de la barra de filtros.
 *
 * La búsqueda se confirma, no se teclea: el borrador es estado interno y solo
 * sale por `onChange` al enviar. Antes convivían dos mecanismos —un debounce de
 * 400ms en unas páginas y un botón en otras— y juntos se estorban: el debounce
 * ya disparó la consulta antes de que nadie alcance el botón, así que el botón
 * parece no hacer nada. Con una sola vía el control dice la verdad y de paso
 * desaparece la petición por tecla.
 *
 * Vaciar es la excepción y se aplica solo, sin confirmar: obligar a pulsar
 * "Buscar" para volver a ver la lista completa se siente roto.
 *
 * El tamaño de fuente es `text-base` (16px) hasta `lg`: Safari en iOS hace zoom
 * sobre cualquier input enfocado con fuente menor a 16px, y varias páginas lo
 * disparaban con `text-xs`. En escritorio sí baja a 14px.
 *
 * Aquí solo vive el campo: el botón de envío es `FiltroBotonBuscar` y lo coloca
 * `FiltroBarra` al final de la fila, asociado por `form={formId}`.
 */
export default function FiltroBusqueda({
  valor,
  onChange,
  formId,
  etiqueta = "Buscar",
  placeholder = "Buscar...",
  className,
}: FiltroBusquedaProps) {
  const id = useId();
  const [texto, setTexto] = useState(valor);

  // El padre puede reponer el término desde fuera ("Limpiar filtros", cambio de
  // pestaña); el borrador tiene que seguirlo o el campo miente.
  useEffect(() => { setTexto(valor); }, [valor]);

  const escribir = (v: string) => {
    setTexto(v);
    if (v === "") onChange("");
  };

  return (
    <form
      id={formId}
      role="search"
      onSubmit={(e) => { e.preventDefault(); onChange(texto); }}
      className={cn("flex items-center", className)}
    >
      <div className="relative flex-1 min-w-0">
        <label htmlFor={id} className="sr-only">{etiqueta}</label>
        <Search
          size={16}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none"
        />
        <input
          id={id}
          type="search"
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full min-h-[44px] pl-9 pr-9 py-2 rounded-xl border shadow-sm transition-colors",
            "text-base lg:text-sm",
            "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100",
            "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500",
            "placeholder:text-gray-400 dark:placeholder:text-slate-500",
            "focus:outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/20",
            "dark:focus:border-slate-400 dark:focus:ring-slate-400/20",
            // Safari dibuja su propia X en `type=search`; usamos la nuestra.
            "[&::-webkit-search-cancel-button]:appearance-none"
          )}
        />
        {texto && (
          <button
            type="button"
            onClick={() => escribir("")}
            aria-label={`Borrar ${etiqueta.toLowerCase()}`}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px]",
              "flex items-center justify-center rounded-lg transition-colors",
              "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40"
            )}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Botón de envío de la búsqueda.
 *
 * Vive fuera del `<form>` para poder quedar al final de la fila, después de los
 * demás filtros: el atributo `form` es la vía estándar para que un botón de
 * envío siga perteneciendo a su formulario estando fuera de él. Así "Buscar" y
 * Enter siguen siendo la misma acción —ambos disparan el `submit` del form— sin
 * meter los filtros dentro del landmark `search` ni duplicar el handler.
 */
export function FiltroBotonBuscar({ formId, className }: { formId: string; className?: string }) {
  return (
    <button
      type="submit"
      form={formId}
      className={cn(
        // `grow` hasta `sm`: al quedar al final de la fila puede caer solo en
        // su línea en móvil, y ahí un botón pequeño alineado a la izquierda se
        // lee como un resto. En pantallas anchas se ajusta a su contenido.
        "shrink-0 grow sm:grow-0 min-h-[44px] px-4 rounded-xl text-sm font-medium shadow-sm transition-colors",
        "bg-slate-700 hover:bg-slate-800 text-white",
        "dark:bg-slate-600 dark:hover:bg-slate-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40",
        className
      )}
    >
      Buscar
    </button>
  );
}
