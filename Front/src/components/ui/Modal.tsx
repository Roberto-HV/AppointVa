import { useEffect, useId, type ReactNode } from "react";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: "sm" | "md" | "lg";
}

const anchos = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

export default function Modal({ abierto, onCerrar, titulo, children, ancho = "md" }: Props) {
  const tituloId = useId();

  useEffect(() => {
    if (abierto) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} aria-hidden="true" />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${anchos[ancho]} max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id={tituloId} className="text-base font-semibold text-gray-800">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
