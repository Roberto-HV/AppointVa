import type { EmpleadoPublico } from "../../types";
import { Star } from "lucide-react";

export const SIN_PREFERENCIA_ID = "sin-preferencia";

export const SIN_PREFERENCIA: EmpleadoPublico = {
  id: SIN_PREFERENCIA_ID,
  nombre: "Sin preferencia",
  servicioIds: [],
  promedioResenas: 0,
  totalResenas: 0,
};

function Estrellas({ promedio, total }: { promedio: number; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-center gap-0.5 mt-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={10}
          className={promedio >= s ? "text-amber-400" : "text-slate-200"}
          fill={promedio >= s ? "currentColor" : "none"}
        />
      ))}
      <span className="text-[10px] text-slate-400 ml-0.5">({total})</span>
    </div>
  );
}

interface Props {
  empleados: EmpleadoPublico[];
  servicioId: string;
  seleccionado: EmpleadoPublico | null;
  onSeleccionar: (e: EmpleadoPublico) => void;
  color?: string;
}

export default function PasoEmpleado({ empleados, servicioId, seleccionado, onSeleccionar, color = "#334155" }: Props) {
  const disponibles = empleados.filter((e) => e.servicioIds.includes(servicioId));

  if (disponibles.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-8">
        No hay profesionales disponibles para este servicio.
      </p>
    );
  }

  const activoSinPreferencia = seleccionado?.id === SIN_PREFERENCIA_ID;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">¿Con quién?</h2>
      <p className="text-sm text-slate-500 mb-5">Elige un profesional o deja que asignemos el más disponible</p>

      {/* Opción sin preferencia */}
      <button
        onClick={() => onSeleccionar(SIN_PREFERENCIA)}
        className="w-full mb-3 p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left bg-white"
        style={activoSinPreferencia ? { borderColor: color, background: `${color}0D` } : { borderColor: "#f1f5f9" }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition"
          style={{ background: activoSinPreferencia ? `${color}1A` : "#f1f5f9" }}
        >
          <svg
            className="w-5 h-5"
            style={{ color: activoSinPreferencia ? color : "#94a3b8" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.196-3.793M9 20H4v-2a4 4 0 015.196-3.793M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: activoSinPreferencia ? color : "#1e293b" }}>
            Sin preferencia
          </p>
          <p className="text-xs text-slate-400">Muestra todos los horarios disponibles</p>
        </div>
        {activoSinPreferencia && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
              <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        {disponibles.map((emp) => {
          const activo = seleccionado?.id === emp.id;
          return (
            <button
              key={emp.id}
              onClick={() => onSeleccionar(emp)}
              className="p-4 rounded-2xl border-2 text-center transition-all bg-white"
              style={activo
                ? { borderColor: color, background: `${color}0D`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }
                : { borderColor: "#f1f5f9" }}
            >
              <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden bg-slate-100 flex items-center justify-center">
                {emp.fotoUrl ? (
                  <img
                    src={emp.fotoUrl}
                    alt={emp.nombre}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const span = document.createElement("span");
                        span.className = "text-2xl font-bold text-slate-300";
                        span.textContent = emp.nombre.charAt(0);
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span className="text-2xl font-bold text-slate-300">{emp.nombre.charAt(0)}</span>
                )}
              </div>
              <p className="text-sm font-semibold" style={{ color: activo ? color : "#1e293b" }}>
                {emp.nombre}
              </p>
              <Estrellas promedio={emp.promedioResenas} total={emp.totalResenas} />
              {emp.biografia && (
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{emp.biografia}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
