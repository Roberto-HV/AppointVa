import type { ReactNode } from "react";
import { Check } from "lucide-react";
import {
  FAMILIAS_PORTADA,
  fondoPortada,
  normalizarPresetPortada,
  presetsPorFamilia,
  veloPortada,
} from "../../lib/portadaPresets";

interface Props {
  /** Clave del preset elegido, o `null` si no hay ninguno. Una clave desconocida cuenta como ninguno. */
  valor: string | null;
  onCambiar: (clave: string | null) => void;
  color: string;
  portadaUrl?: string;
  portadaObjectPosition?: string;
}

const CLASES_TARJETA =
  "relative block w-full rounded-xl overflow-hidden border-2 cursor-pointer transition " +
  "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-accent-brand " +
  "dark:peer-focus-visible:ring-offset-slate-800";

function Tarjeta({
  seleccionado,
  nombre,
  onSeleccionar,
  grupo,
  children,
}: {
  seleccionado: boolean;
  nombre: string;
  onSeleccionar: () => void;
  grupo: string;
  children: ReactNode;
}) {
  return (
    // `relative` no es decorativo: `sr-only` vuelve absoluto al radio, y sin un
    // ancestro posicionado su bloque contenedor sería el inicial. El radio queda
    // anclado al documento —fuera del `h-dvh overflow-hidden` del dashboard—,
    // estira el scroll de la página y al enfocarlo el navegador desplaza la
    // ventana entera en vez del contenedor del contenido.
    <label className="relative block">
      <input
        type="radio"
        name={grupo}
        className="sr-only peer"
        checked={seleccionado}
        onChange={onSeleccionar}
      />
      <span
        className={`${CLASES_TARJETA} ${
          seleccionado
            ? "border-slate-800 dark:border-slate-200"
            : "border-transparent hover:border-slate-300 dark:hover:border-slate-500"
        }`}
      >
        <span className="block aspect-[2/1] relative">
          {children}
          {/* Marca de selección: forma, no solo color, para quien no distingue el borde. */}
          {seleccionado && (
            <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow">
              <Check className="w-3.5 h-3.5 text-slate-800 dark:text-slate-100" strokeWidth={3} />
            </span>
          )}
        </span>
      </span>
      <span
        className={`block text-[11px] mt-1 text-center ${
          seleccionado
            ? "font-semibold text-slate-800 dark:text-slate-100"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {nombre}
      </span>
    </label>
  );
}

// Los mismos velos que la portada real pone bajo el texto (ver `veloPortada`).
const VELOS_MUESTRA = {
  fuerte: "linear-gradient(to top, rgba(12,12,15,0.8) 0%, rgba(12,12,15,0.55) 40%, rgba(12,12,15,0) 75%)",
  suave: "linear-gradient(to top, rgba(12,12,15,0.55) 0%, rgba(12,12,15,0.3) 40%, rgba(12,12,15,0) 75%)",
};

/**
 * Muestra blanco sobre el fondo, para juzgar la legibilidad antes de publicar.
 * Con `velo`, la portada real oscurece el pie bajo el texto: la muestra lo
 * enseña para no prometer un blanco sobre blanco que el cliente nunca verá.
 */
function MuestraTexto({ velo = "ninguno" }: { velo?: "fuerte" | "suave" | "ninguno" }) {
  return (
    <span
      className="absolute inset-0 flex flex-col justify-end p-2 gap-1"
      style={velo !== "ninguno" ? { background: VELOS_MUESTRA[velo] } : undefined}
    >
      <span
        className="block h-1.5 w-2/3 rounded-full"
        style={{ background: "rgba(255,255,255,0.92)" }}
      />
      <span
        className="block h-1 w-1/2 rounded-full"
        style={{ background: "rgba(255,255,255,0.55)" }}
      />
    </span>
  );
}

export default function SelectorFondoPortada({
  valor,
  onCambiar,
  color,
  portadaUrl,
  portadaObjectPosition,
}: Props) {
  const grupo = "fondo-portada";
  const vigente = normalizarPresetPortada(valor);
  const usandoFoto = !vigente && !!portadaUrl;

  return (
    <div role="group" aria-label="Fondo de portada">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-5">
        {portadaUrl && (
          <Tarjeta
            grupo={grupo}
            nombre="Tu foto"
            seleccionado={usandoFoto}
            onSeleccionar={() => onCambiar(null)}
          >
            <img
              src={portadaUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: portadaObjectPosition ?? "center" }}
            />
            <MuestraTexto velo="fuerte" />
          </Tarjeta>
        )}
        {!portadaUrl && (
          <Tarjeta
            grupo={grupo}
            nombre="Color de marca"
            seleccionado={!vigente}
            onSeleccionar={() => onCambiar(null)}
          >
            <span className="absolute inset-0" style={fondoPortada(null, color)} />
            <MuestraTexto />
          </Tarjeta>
        )}
      </div>

      {FAMILIAS_PORTADA.map((familia) => (
        <div key={familia.familia} className="mb-5 last:mb-0">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{familia.titulo}</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">{familia.descripcion}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {presetsPorFamilia(familia.familia).map((preset) => (
              <Tarjeta
                key={preset.clave}
                grupo={grupo}
                nombre={preset.nombre}
                seleccionado={vigente === preset.clave}
                onSeleccionar={() => onCambiar(preset.clave)}
              >
                <span className="absolute inset-0" style={fondoPortada(preset.clave, color)} />
                <MuestraTexto velo={veloPortada(preset.clave)} />
              </Tarjeta>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
