import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import type { EmpleadoPublico } from "../../types";
import { getSectorTerms } from "../../hooks/useSectorTerms";
import { brandAccent, brandTint, DEFAULT_COLOR } from "../../lib/colorUtils";
import FilaSeleccion from "./FilaSeleccion";

export const SIN_PREFERENCIA_ID = "sin-preferencia";

export const SIN_PREFERENCIA: EmpleadoPublico = {
  id: SIN_PREFERENCIA_ID,
  nombre: "Sin preferencia",
  servicioIds: [],
  promedioResenas: 0,
  totalResenas: 0,
};

interface Props {
  empleados: EmpleadoPublico[];
  servicioId: string;
  seleccionado: EmpleadoPublico | null;
  onSeleccionar: (e: EmpleadoPublico) => void;
  color?: string;
  sector?: string;
}

/** Foto del empleado o, si no hay (o no carga), su inicial. */
function Avatar({ empleado }: { empleado: EmpleadoPublico }) {
  const [fallo, setFallo] = useState(false);
  return (
    <span className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0" aria-hidden="true">
      {empleado.fotoUrl && !fallo ? (
        <img src={empleado.fotoUrl} alt="" className="w-full h-full object-cover" onError={() => setFallo(true)} />
      ) : (
        <span className="text-lg font-bold text-slate-500">{empleado.nombre.charAt(0)}</span>
      )}
    </span>
  );
}

/**
 * Mismo patrón de selección que el paso de servicio (BF-23): filas
 * `FilaSeleccion` con anillo interior y marca de verificación, el avatar en el
 * slot inicial. Antes este paso tenía dos tarjetas propias con hex sueltos.
 */
export default function PasoEmpleado({ empleados, servicioId, seleccionado, onSeleccionar, color = DEFAULT_COLOR, sector }: Props) {
  const terms = getSectorTerms(sector);
  const disponibles = empleados.filter((e) => e.servicioIds.includes(servicioId));
  // Derivados del color de marca: el hex crudo a baja opacidad es invisible en tonos
  // claros y estridente en saturados, y como texto no alcanza contraste legible.
  const acento = useMemo(() => brandAccent(color), [color]);
  const tinte = useMemo(() => brandTint(color), [color]);

  // Auto-select sin preferencia when no employees are assigned to this service
  useEffect(() => {
    if (disponibles.length === 0) onSeleccionar(SIN_PREFERENCIA);
  }, [disponibles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h2 tabIndex={-1} className="text-xl font-bold text-slate-900 mb-1 outline-none">¿Con quién?</h2>
      <p className="text-sm text-slate-500 mb-5">{`Elige un ${terms.empleado.toLowerCase()} o deja que asignemos el más disponible`}</p>

      {disponibles.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4">
          {`No hay ${terms.empleados.toLowerCase()} asignados a este ${terms.servicio.toLowerCase()}.`}
        </p>
      ) : (
        <div className="space-y-2">
          <FilaSeleccion
            activo={seleccionado?.id === SIN_PREFERENCIA_ID}
            onSeleccionar={() => onSeleccionar(SIN_PREFERENCIA)}
            acento={acento}
            tinte={tinte}
            titulo="Sin preferencia"
            descripcion="Muestra todos los horarios disponibles"
            inicio={
              <span className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0" aria-hidden="true">
                <Users size={20} className="text-slate-500" />
              </span>
            }
          />
          {disponibles.map((emp) => (
            <FilaSeleccion
              key={emp.id}
              activo={seleccionado?.id === emp.id}
              onSeleccionar={() => onSeleccionar(emp)}
              acento={acento}
              tinte={tinte}
              titulo={emp.nombre}
              descripcion={emp.biografia}
              inicio={<Avatar empleado={emp} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
