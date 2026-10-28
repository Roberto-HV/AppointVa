import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check } from "lucide-react";
import {
  FAMILIAS_PORTADA,
  fondoPortada,
  normalizarPresetPortada,
  presetsPorFamilia,
  type FamiliaPortada,
} from "../../lib/portadaPresets";
import { BASE_MATERIALES } from "../../lib/portadaMateriales";
import { VELOS_PORTADA, modoPortada, tintaPortada, type ModoPortada } from "../../lib/portadaVelo";

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

/**
 * Muestra del texto sobre el fondo, para juzgar la legibilidad antes de publicar.
 * Lleva el mismo velo y la misma tinta que la portada real (ver `portadaVelo`):
 * no promete un blanco sobre blanco que el cliente nunca verá, ni tapa un
 * material claro que en la portada se ve entero.
 */
function MuestraTexto({ modo }: { modo: ModoPortada }) {
  const velo = VELOS_PORTADA[modo].muestra;
  const [nombre, descripcion] = tintaPortada(modo).muestra;
  return (
    <span
      data-tinta={tintaPortada(modo).tipo}
      className="absolute inset-0 flex flex-col justify-end p-2 gap-1"
      style={velo ? { background: velo } : undefined}
    >
      <span className={`block h-1.5 w-2/3 rounded-full ${nombre.className ?? ""}`} style={nombre.style} />
      <span className={`block h-1 w-1/2 rounded-full ${descripcion.className ?? ""}`} style={descripcion.style} />
    </span>
  );
}

/**
 * Avisa cuando el elemento entra (o está por entrar) en pantalla. Cada material
 * es un SVG con filtros de ruido que cuesta pintar; el grupo va al final del
 * selector y casi nunca se ve al abrir la pestaña. Sin IntersectionObserver
 * (navegadores viejos) se pinta de inmediato, como antes.
 */
function useVisible<T extends Element>(diferido: boolean): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(
    () => !diferido || typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    if (visible || !ref.current) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, [visible]);
  return [ref, visible];
}

function GrupoFondos({
  familia,
  titulo,
  descripcion,
  diferido,
  children,
}: {
  familia: FamiliaPortada;
  titulo: string;
  descripcion: string;
  diferido: boolean;
  children: (visible: boolean) => ReactNode;
}) {
  const [ref, visible] = useVisible<HTMLDivElement>(diferido);
  return (
    <div ref={ref} data-familia={familia} className="mb-5 last:mb-0">
      <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{titulo}</h3>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">{descripcion}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">{children(visible)}</div>
    </div>
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
            <MuestraTexto modo="foto" />
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
            <MuestraTexto modo="degradado-marca" />
          </Tarjeta>
        )}
      </div>

      {FAMILIAS_PORTADA.map((familia) => (
        <GrupoFondos
          key={familia.familia}
          familia={familia.familia}
          titulo={familia.titulo}
          descripcion={familia.descripcion}
          diferido={familia.familia === "material"}
        >
          {(visible) =>
            presetsPorFamilia(familia.familia).map((preset) => (
              <Tarjeta
                key={preset.clave}
                grupo={grupo}
                nombre={preset.nombre}
                seleccionado={vigente === preset.clave}
                onSeleccionar={() => onCambiar(preset.clave)}
              >
                {/* Hasta que el grupo se ve, un color liso del material: mismo
                    tamaño y tono, sin el costo de los filtros SVG. */}
                <span
                  data-muestra={visible ? "fondo" : "provisional"}
                  className="absolute inset-0"
                  style={
                    visible
                      ? fondoPortada(preset.clave, color)
                      : { background: BASE_MATERIALES[preset.clave] }
                  }
                />
                <MuestraTexto modo={modoPortada(preset.clave, false)} />
              </Tarjeta>
            ))
          }
        </GrupoFondos>
      ))}
    </div>
  );
}
