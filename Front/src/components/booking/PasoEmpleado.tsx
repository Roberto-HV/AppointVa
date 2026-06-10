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

export default function PasoEmpleado({ empleados, servicioId, seleccionado, onSeleccionar }: Props) {
  const disponibles = empleados.filter((e) => e.servicioIds.includes(servicioId));

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
        className={`w-full mb-3 p-3 rounded-xl border-2 flex items-center gap-3 transition text-left
          ${activoSinPreferencia ? "border-primary bg-primary/5" : "border-gray-100 hover:border-gray-300 bg-white"}`}
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
          <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <div className="grid grid-cols-2 gap-3">
        {disponibles.map((emp) => {
          const activo = seleccionado?.id === emp.id;
          return (
            <button
              key={emp.id}
              onClick={() => onSeleccionar(emp)}
              className={`p-4 rounded-xl border-2 text-center transition
                ${activo ? "border-primary bg-primary/5" : "border-gray-100 hover:border-gray-300 bg-white"}`}
            >
              <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden bg-gray-100 flex items-center justify-center">
                {emp.fotoUrl ? (
                  <img
                    src={emp.fotoUrl}
                    alt={emp.nombre}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement!.innerHTML = `<span class="text-2xl font-bold text-gray-300">${emp.nombre.charAt(0)}</span>`;
                    }}
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-300">
                    {emp.nombre.charAt(0)}
                  </span>
                )}
              </div>
              <p className={`text-sm font-semibold ${activo ? "text-primary" : "text-gray-800"}`}>
                {emp.nombre}
              </p>
              {emp.biografia && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{emp.biografia}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
