import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: "sm" | "md" | "lg";
}

const anchos = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

/**
 * Diálogo del dashboard. Cabecera y cuerpo comparten el mismo relleno
 * horizontal (px-5 sm:px-6) para que título, campos y botones queden en la
 * misma vertical. La cabecera queda fija y solo el cuerpo hace scroll.
 */
export default function Modal({ abierto, onCerrar, titulo, children, ancho = "md" }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) onCerrar(); }}>
      <DialogContent className={`${anchos[ancho]} max-h-[90dvh] flex flex-col overflow-hidden p-0 gap-0 bg-white dark:bg-slate-800`}>
        <DialogHeader className="px-5 sm:px-6 py-4 pr-12 sm:pr-12 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-base font-semibold leading-6 text-slate-800 dark:text-slate-100">{titulo}</DialogTitle>
        </DialogHeader>
        {/* text-foreground por defecto: el contenido sin color propio no queda
            negro sobre el fondo oscuro del modal en dark mode. min-h-0: sin él
            el cuerpo no encoge dentro de la columna flex y no hace scroll. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6 py-5 text-foreground">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
