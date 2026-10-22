import { useState } from "react";
import { Copy, Download, KeyRound } from "lucide-react";
import { descargarCodigosRecuperacion, textoCodigosRecuperacion } from "../../utils/codigosRecuperacion";

interface Props {
  codigos: string[];
  cuenta?: string;
  /** "Ya los guardé": la pantalla los oculta y no se pueden volver a ver. */
  onListo: () => void;
}

/**
 * Muestra los códigos de recuperación recién generados (B8). Es la única vez que
 * se ven: el servidor solo guarda su huella. Copiar y descargar no usan la red.
 */
export default function CodigosRecuperacion({ codigos, cuenta, onListo }: Props) {
  const [copiado, setCopiado] = useState<"si" | "error" | null>(null);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoCodigosRecuperacion(codigos, cuenta));
      setCopiado("si");
    } catch {
      setCopiado("error");
    }
  };

  return (
    <section
      aria-labelledby="codigos-recuperacion-titulo"
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 space-y-4 text-left"
    >
      <div className="flex items-start gap-3">
        <KeyRound size={20} className="mt-0.5 shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />
        <div>
          <h2 id="codigos-recuperacion-titulo" className="font-semibold text-foreground">
            Guarda tus códigos de recuperación
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Si pierdes el teléfono, cada código te deja entrar una vez. No se volverán a mostrar.
          </p>
        </div>
      </div>

      <ul aria-label="Códigos de recuperación" className="grid grid-cols-2 gap-2 font-mono text-sm tabular-nums">
        {codigos.map((c) => (
          <li key={c} className="rounded-lg bg-white dark:bg-slate-800 border border-border px-3 py-1.5 text-center select-all text-foreground">
            {c}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copiar}
          className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-lg border border-border bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Copy size={14} aria-hidden="true" /> Copiar
        </button>
        <button
          type="button"
          onClick={() => descargarCodigosRecuperacion(codigos, cuenta)}
          className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-lg border border-border bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download size={14} aria-hidden="true" /> Descargar .txt
        </button>
        <button
          type="button"
          onClick={onListo}
          className="inline-flex min-h-[44px] lg:min-h-[36px] items-center rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 px-3.5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:ml-auto"
        >
          Ya los guardé
        </button>
      </div>
      <p role="status" className="text-xs text-muted-foreground min-h-[1rem]">
        {copiado === "si" && "Códigos copiados al portapapeles."}
        {copiado === "error" && "No se pudo copiar. Descarga el archivo o anótalos."}
      </p>
    </section>
  );
}
