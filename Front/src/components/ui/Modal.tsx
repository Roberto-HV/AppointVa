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

export default function Modal({ abierto, onCerrar, titulo, children, ancho = "md" }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) onCerrar(); }}>
      <DialogContent className={`${anchos[ancho]} max-h-[90vh] flex flex-col p-0 gap-0 bg-white`}>
        <DialogHeader className="px-6 py-4 border-b border-gray-100">
          <DialogTitle className="text-base font-semibold text-gray-800">{titulo}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
