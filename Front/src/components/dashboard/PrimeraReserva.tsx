import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Share2, X } from "lucide-react";
import { brandSolid, brandTint, DEFAULT_COLOR } from "../../lib/colorUtils";
import type { Celebracion } from "../../lib/primeraReserva";
import { useCopiarAlPortapapeles } from "../../hooks/useCopiarAlPortapapeles";
import { CampoEnlaceManual } from "./BotonCopiarEnlace";

// Tarjeta de "¡Tu primera reserva!". Cuándo se muestra lo decide
// `usePrimeraReserva` (lib/primeraReserva.ts).
// ── Confeti: 18 papelitos del color del negocio, una vez, menos de 1 s ───────
const PAPELITOS = Array.from({ length: 18 }, (_, i) => {
  // Pseudoaleatorio fijo por índice: sin Math.random en el render.
  const giro = (i * 137.5) % 360;
  const rad = (giro * Math.PI) / 180;
  const alcance = 70 + ((i * 53) % 60);
  return {
    x: Math.cos(rad) * alcance * 1.6,
    y: Math.sin(rad) * alcance * 0.7 - 30,
    rotar: ((i * 97) % 360) - 180,
    tono: i % 3,
    ancho: 6 + (i % 3) * 2,
  };
});

function Confeti({ color }: { color: string }) {
  const colores = useMemo(() => [brandSolid(color), color, brandTint(color, 78)], [color]);
  return (
    <div aria-hidden="true" data-testid="confeti" className="pointer-events-none absolute left-1/2 top-8 h-0 w-0">
      {PAPELITOS.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block h-2 rounded-[2px]"
          style={{ width: p.ancho, background: colores[p.tono] }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 40], rotate: p.rotar, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], times: [0, 0.55, 1] }}
        />
      ))}
    </div>
  );
}

interface Props {
  celebracion: Celebracion;
  conConfeti: boolean;
  color?: string;
  nombreNegocio?: string;
  bookingUrl: string;
  onCerrar: () => void;
}

export default function TarjetaPrimeraReserva({ celebracion, conConfeti, color, nombreNegocio, bookingUrl, onCerrar }: Props) {
  const reducirMovimiento = useReducedMotion();
  const { copiado, copiar } = useCopiarAlPortapapeles(2500);
  // Sin hoja de compartir y sin portapapeles: el enlace queda a la vista.
  const [copiaManual, setCopiaManual] = useState(false);
  const nombre = celebracion.cliente.trim().split(/\s+/)[0] || "Un cliente";
  const colorMarca = color || DEFAULT_COLOR;

  const compartir = async () => {
    const texto = nombreNegocio ? `Ya puedes reservar en ${nombreNegocio} en línea:` : "Ya puedes reservar en línea:";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: nombreNegocio, text: texto, url: bookingUrl });
        return;
      } catch (e) {
        // Cancelar la hoja de compartir no es un error que haya que tapar con otra cosa.
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    setCopiaManual(!(await copiar(bookingUrl)));
  };

  return (
    <section
      aria-labelledby="titulo-primera-reserva"
      className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card px-5 py-5 sm:px-6"
    >
      {conConfeti && !reducirMovimiento && <Confeti color={colorMarca} />}
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso de primera reserva"
        className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <h2 id="titulo-primera-reserva" className="pr-10 text-lg font-semibold text-foreground">
        ¡Tu primera reserva!
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{nombre}</span> reservó{" "}
        <span className="font-medium text-foreground">{celebracion.servicio}</span>. Así empieza una agenda llena.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={compartir}
          className="min-h-[44px] lg:min-h-[36px] inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Share2 size={15} aria-hidden="true" />
          Compártelo en tus redes
        </button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {copiado ? "Enlace copiado: pégalo en tu publicación." : ""}
        </span>
      </div>
      {copiaManual && <CampoEnlaceManual url={bookingUrl} />}
    </section>
  );
}
