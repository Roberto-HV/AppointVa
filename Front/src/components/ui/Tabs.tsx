import { cn } from "../../lib/utils";

export interface OpcionTab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  opciones: OpcionTab<T>[];
  valor: T;
  onChange: (id: T) => void;
  /** Nombre accesible del grupo. */
  etiqueta: string;
  className?: string;
}

/**
 * Bandeja de pestañas del dashboard.
 *
 * Reemplaza las cinco variantes del mismo `flex … rounded-lg p-1` que había una
 * por página. El activo usa `bg-primary`, el mismo relleno que la pill activa de
 * `FiltroPills`, para que pestaña y filtro se lean como un solo sistema.
 *
 * Se quedan como botones normales en vez de `role="tab"`: la semántica completa
 * de tabs exige `tabpanel`, `aria-controls` y navegación con flechas en las
 * cuatro páginas, y sin eso `role="tab"` solo empeora lo que anuncia el lector.
 *
 * `overflow-x-auto` y pestañas que no se comprimen: la tira de 5 de Reportes y
 * la de 3 de Citas se cortaban a 390px porque `flex-1` las encogía por debajo
 * de su texto. Ahora se desplazan en horizontal y conservan su ancho.
 *
 * La bandeja se dimensiona a su contenido (`w-fit`) y las pestañas no crecen:
 * con `grow` y ancho completo, dos pestañas a 1600px quedaban como dos botones
 * gigantes de 800px cada uno.
 */
export default function Tabs<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  className,
}: TabsProps<T>) {
  return (
    <nav
      aria-label={etiqueta}
      className={cn(
        "flex w-fit max-w-full gap-1 p-1 rounded-lg bg-gray-100 dark:bg-slate-700",
        "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            aria-current={activo ? "page" : undefined}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-[44px] lg:min-h-[36px] px-3 sm:px-4 shrink-0",
              "rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40",
              activo
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </nav>
  );
}
