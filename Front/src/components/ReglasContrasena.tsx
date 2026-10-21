import { Check, Circle } from "lucide-react";
import { REGLAS_CONTRASENA } from "../utils/contrasena";

interface Props {
  valor: string;
  id?: string;
}

/**
 * Lista de reglas siempre visible bajo el campo de contraseña. Cada regla se
 * marca al cumplirse, sin esperar al envío (AP-12). Las mismas reglas que el
 * servidor: ver `utils/contrasena.ts`.
 */
export default function ReglasContrasena({ valor, id }: Props) {
  return (
    <ul id={id} aria-label="Requisitos de la contraseña" aria-live="polite" className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
      {REGLAS_CONTRASENA.map((regla) => {
        const cumple = regla.cumple(valor);
        return (
          <li
            key={regla.id}
            data-cumple={cumple}
            className={`flex items-center gap-1.5 text-xs ${cumple ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
          >
            {cumple ? <Check size={12} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
            <span>
              {regla.texto}
              <span className="sr-only">{cumple ? ": cumplido" : ": pendiente"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
