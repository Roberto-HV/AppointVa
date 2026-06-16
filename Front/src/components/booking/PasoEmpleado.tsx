import { useState } from "react";
import type { EmpleadoPublico } from "../../types";

export const SIN_PREFERENCIA_ID = "sin-preferencia";

export const SIN_PREFERENCIA: EmpleadoPublico = {
  id: SIN_PREFERENCIA_ID,
  nombre: "Sin preferencia",
  servicioIds: [],
};

interface Props {
  empleados: EmpleadoPublico[];
  servicioId: string;
  seleccionado: EmpleadoPublico | null;
  onSeleccionar: (e: EmpleadoPublico) => void;
}

function Avatar({ emp, size = "md" }: { emp: EmpleadoPublico; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === "lg" ? "w-20 h-20 text-2xl" : size === "md" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm";
  return (
    <div className={`${dim} rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shrink-0`}>
      {emp.fotoUrl && !imgError ? (
        <img
          src={emp.fotoUrl}
          alt={emp.nombre}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-bold text-gray-300">{emp.nombre.charAt(0)}</span>
      )}
    </div>
  );
}

export default function PasoEmpleado({ empleados, servicioId, seleccionado, onSeleccionar }: Props) {
  const disponibles = empleados.filter((e) => e.servicioIds.includes(servicioId));
  const [expandido, setExpandido] = useState<string | null>(null);

  if (disponibles.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-8">
        No hay profesionales disponibles para este servicio.
      </p>
    );
  }

  const activoSinPreferencia = seleccionado?.id === SIN_PREFERENCIA_ID;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">¿Con quién quieres tu cita?</h2>

      {/* Opción sin preferencia */}
      <button
        onClick={() => onSeleccionar(SIN_PREFERENCIA)}
        className={`w-full mb-4 p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all text-left
          ${activoSinPreferencia ? "border-primary bg-primary/5 shadow-sm" : "border-gray-100 hover:border-primary/30 bg-white"}`}
      >
        <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.196-3.793M9 20H4v-2a4 4 0 015.196-3.793M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${activoSinPreferencia ? "text-primary" : "text-gray-800"}`}>
            Sin preferencia
          </p>
          <p className="text-xs text-gray-400">Ver todos los horarios disponibles</p>
        </div>
        {activoSinPreferencia && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </button>

      <div className="space-y-2">
        {disponibles.map((emp) => {
          const activo = seleccionado?.id === emp.id;
          const verBio = expandido === emp.id;
          return (
            <div
              key={emp.id}
              className={`rounded-2xl border-2 transition-all overflow-hidden
                ${activo ? "border-primary shadow-sm" : "border-gray-100 hover:border-primary/30"}`}
            >
              <button
                onClick={() => onSeleccionar(emp)}
                className={`w-full p-4 flex items-center gap-4 text-left transition
                  ${activo ? "bg-primary/5" : "bg-white hover:bg-gray-50"}`}
              >
                <div className="relative shrink-0">
                  <Avatar emp={emp} size="md" />
                  {activo && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary border-2 border-white flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${activo ? "text-primary" : "text-gray-800"}`}>
                    {emp.nombre}
                  </p>
                  {emp.biografia && (
                    <p className={`text-xs text-gray-500 mt-0.5 ${verBio ? "" : "line-clamp-1"}`}>
                      {emp.biografia}
                    </p>
                  )}
                </div>
                {emp.biografia && emp.biografia.length > 60 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandido(verBio ? null : emp.id); }}
                    className="text-xs text-gray-400 hover:text-primary shrink-0 transition"
                  >
                    {verBio ? "menos" : "más"}
                  </button>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
