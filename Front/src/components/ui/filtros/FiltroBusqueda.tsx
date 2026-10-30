import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../../lib/utils";

/** Pausa al teclear antes de aplicar la búsqueda. */
export const ESPERA_BUSQUEDA_MS = 300;

interface FiltroBusquedaProps {
  /** Término ya aplicado. Lo que se está tecleando vive dentro del componente. */
  valor: string;
  /** Se dispara al dejar de teclear (~300ms), al pulsar Enter y al vaciar el campo. */
  onChange: (valor: string) => void;
  /** Etiqueta accesible; se muestra solo a lectores de pantalla. */
  etiqueta?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Campo de búsqueda de la barra de filtros.
 *
 * La búsqueda es en vivo: el borrador es estado interno y sale por `onChange`
 * cuando la persona deja de teclear unos 300ms. Así se comporta igual que los
 * desplegables de la misma barra, que filtran al momento, y como Fresha, Booksy
 * o Calendly. Antes había un botón "Buscar": era un paso de más y, en el
 * teléfono, un botón oscuro a todo lo ancho que competía con la acción
 * principal de la página.
 *
 * Enter aplica sin esperar la pausa, y vaciar el campo también se aplica al
 * instante: volver a ver la lista completa no debe sentirse lento.
 *
 * El tamaño de fuente es `text-base` (16px) hasta `lg`: Safari en iOS hace zoom
 * sobre cualquier input enfocado con fuente menor a 16px, y varias páginas lo
 * disparaban con `text-xs`. En escritorio sí baja a 14px.
 */
export default function FiltroBusqueda({
  valor,
  onChange,
  etiqueta = "Buscar",
  placeholder = "Buscar...",
  className,
}: FiltroBusquedaProps) {
  const id = useId();
  const [texto, setTexto] = useState(valor);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último término que este campo entregó. Sirve para distinguir el eco de lo
  // que acabamos de aplicar de un cambio que llega de fuera.
  const emitido = useRef(valor);
  // El temporizador debe llamar al `onChange` vigente, no al de cuando empezó a contar.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const cancelarEspera = () => {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  };

  const aplicar = (v: string) => {
    cancelarEspera();
    if (v === emitido.current) return;
    emitido.current = v;
    onChangeRef.current(v);
  };

  // El padre puede reponer el término desde fuera ("Limpiar filtros", cambio de
  // pestaña); el borrador tiene que seguirlo o el campo miente. El eco de lo que
  // este campo aplicó no cuenta: si lo copiáramos, pisaría lo que se siguió
  // tecleando mientras la consulta iba y venía.
  useEffect(() => {
    if (valor === emitido.current) return;
    cancelarEspera();
    emitido.current = valor;
    setTexto(valor);
  }, [valor]);

  useEffect(() => cancelarEspera, []);

  const escribir = (v: string) => {
    setTexto(v);
    if (v === "") {
      aplicar("");
      return;
    }
    cancelarEspera();
    temporizador.current = setTimeout(() => aplicar(v), ESPERA_BUSQUEDA_MS);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); aplicar(texto); }}
      className={cn("flex items-center", className)}
    >
      <div className="relative flex-1 min-w-0">
        <label htmlFor={id} className="sr-only">{etiqueta}</label>
        <Search
          size={16}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
        />
        <input
          id={id}
          type="search"
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          className={cn(
            "w-full min-h-[44px] pl-9 pr-9 py-2 rounded-xl border shadow-sm transition-colors",
            "text-base lg:text-sm",
            "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100",
            "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500",
            "placeholder:text-slate-400 dark:placeholder:text-slate-500",
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
              "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
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
