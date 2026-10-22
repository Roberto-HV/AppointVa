import { useState } from "react";
import { Check, Link as IconoEnlace } from "lucide-react";
import { useCopiarAlPortapapeles } from "../../hooks/useCopiarAlPortapapeles";

interface Props {
  url: string;
  etiqueta?: string;
  className?: string;
}

/**
 * Respaldo cuando el portapapeles falla: el enlace queda a la vista, y se
 * selecciona entero al enfocarlo, para copiarlo a mano.
 */
export function CampoEnlaceManual({ url, etiqueta = "Enlace de reservas para copiar a mano" }: { url: string; etiqueta?: string }) {
  return (
    <input
      readOnly
      aria-label={etiqueta}
      value={url}
      onFocus={(e) => e.currentTarget.select()}
      className="mt-2 block w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground"
    />
  );
}

/**
 * Copia el enlace de reservas. Si el portapapeles falla, deja el enlace a la
 * vista para copiarlo a mano en lugar de fallar en silencio.
 */
export default function BotonCopiarEnlace({ url, etiqueta = "Copiar enlace de reservas", className = "" }: Props) {
  const { copiado, copiar } = useCopiarAlPortapapeles();
  const [fallo, setFallo] = useState(false);

  if (!url) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={async () => setFallo(!(await copiar(url)))}
        className="min-h-[44px] lg:min-h-[36px] inline-flex items-center gap-2 px-3.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
      >
        {copiado
          ? <Check size={15} className="text-status-confirmed-fg" aria-hidden="true" />
          : <IconoEnlace size={15} aria-hidden="true" />}
        <span aria-live="polite">{copiado ? "¡Enlace copiado!" : etiqueta}</span>
      </button>
      {fallo && <CampoEnlaceManual url={url} />}
    </div>
  );
}
