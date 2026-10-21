// ── Logo de AppointVa (páginas públicas, acceso y cabecera de admin) ─────────
//
// `MasterLogo.png` pesa 488 KB (2172×724). Aquí se usan copias generadas
// del mismo archivo (AP-11):
// - `logo-appointva.png`    576×192, ≈10 KB: cubre hasta h-24 (96 px) a 2×.
// - `logo-appointva-sm.png` 144×48,  ≈2 KB: marca pequeña del pie de página.
// - `logo-appointva-oscuro.png` 576×192, ≈10 KB: texto blanco para fondos
//   oscuros (sidebar de admin en dark mode), sacado de `MaterLogoOscuro.png`
//   (490 KB).
// `width`/`height` reservan el espacio antes de que cargue; la clase fija la
// altura y `w-auto` mantiene la proporción 3:1.

const VARIANTES = {
  normal: { src: "/logo-appointva.png", ancho: 576, alto: 192 },
  pequeno: { src: "/logo-appointva-sm.png", ancho: 144, alto: 48 },
  oscuro: { src: "/logo-appointva-oscuro.png", ancho: 576, alto: 192 },
} as const;

interface Props {
  /** Debe incluir la altura (p. ej. `h-20`). */
  className?: string;
  variante?: keyof typeof VARIANTES;
  /** Logo visible al cargar la página: se pide con prioridad y sin lazy. */
  prioridad?: boolean;
}

export default function LogoMarca({ className = "", variante = "normal", prioridad = false }: Props) {
  const { src, ancho, alto } = VARIANTES[variante];
  return (
    <img
      src={src}
      alt="AppointVa"
      width={ancho}
      height={alto}
      decoding="async"
      loading={prioridad ? "eager" : "lazy"}
      fetchPriority={prioridad ? "high" : "auto"}
      className={`w-auto object-contain ${className}`}
    />
  );
}
