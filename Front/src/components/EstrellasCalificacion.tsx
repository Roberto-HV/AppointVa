import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { ETIQUETAS_CALIFICACION } from "../lib/calificacion";

interface Props {
  valor: number;
  onCambiar: (valor: number) => void;
  /** id del texto que nombra al grupo ("¿Cómo calificarías…?"). */
  etiquetadoPor?: string;
}

/**
 * Calificación de 1 a 5 como grupo de radio (AP-05): cada estrella tiene
 * nombre ("3 de 5: Regular") y estado, y las flechas cambian el valor como en
 * un grupo de radio nativo. Color: token `rating`, nunca el dorado de marca.
 */
export default function EstrellasCalificacion({ valor, onCambiar, etiquetadoPor }: Props) {
  const [hover, setHover] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const visible = hover || valor;
  // Sin valor, la primera estrella recibe el foco con Tab.
  const enfocable = valor || 1;

  const mover = (nuevo: number) => {
    const v = Math.min(5, Math.max(1, nuevo));
    onCambiar(v);
    refs.current[v - 1]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, estrella: number) => {
    const actual = valor || estrella;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        mover(valor ? actual + 1 : estrella);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        mover(valor ? actual - 1 : estrella);
        break;
      case "Home":
        e.preventDefault();
        mover(1);
        break;
      case "End":
        e.preventDefault();
        mover(5);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        onCambiar(estrella);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={etiquetadoPor}
      aria-label={etiquetadoPor ? undefined : "Calificación"}
      className="flex justify-center gap-1"
      onPointerLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((estrella) => {
        const llena = visible >= estrella;
        return (
          <button
            key={estrella}
            ref={(el) => { refs.current[estrella - 1] = el; }}
            type="button"
            role="radio"
            aria-checked={valor === estrella}
            aria-label={`${estrella} de 5: ${ETIQUETAS_CALIFICACION[estrella - 1]}`}
            tabIndex={estrella === enfocable ? 0 : -1}
            onClick={() => onCambiar(estrella)}
            onPointerEnter={() => setHover(estrella)}
            onKeyDown={(e) => onKeyDown(e, estrella)}
            className="p-1.5 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40"
          >
            <Star
              size={36}
              strokeWidth={1.5}
              aria-hidden="true"
              className={`transition-colors ${llena ? "text-rating fill-rating" : "text-slate-300 fill-transparent"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
