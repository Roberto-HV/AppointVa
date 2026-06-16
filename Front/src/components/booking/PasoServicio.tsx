import type { ServicioPublico } from "../../types";

interface Props {
  servicios: ServicioPublico[];
  seleccionado: ServicioPublico | null;
  onSeleccionar: (s: ServicioPublico) => void;
}

function formatPrecio(precio: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(precio);
}

export default function PasoServicio({ servicios, seleccionado, onSeleccionar }: Props) {
  const categorias = Array.from(new Set(servicios.map((s) => s.categoriaNombre ?? "Servicios")));

  // El servicio con menor orden es el que el dueño puso primero = más destacado
  const masPopularId = servicios.length > 0
    ? servicios.reduce((a, b) => a.orden <= b.orden ? a : b).id
    : null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">¿Qué servicio deseas?</h2>
      <div className="space-y-6">
        {categorias.map((cat) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
            <div className="space-y-2">
              {servicios
                .filter((s) => (s.categoriaNombre ?? "Servicios") === cat)
                .map((servicio) => {
                  const activo = seleccionado?.id === servicio.id;
                  const esPopular = servicio.id === masPopularId;
                  return (
                    <button
                      key={servicio.id}
                      onClick={() => onSeleccionar(servicio)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition flex items-center gap-3
                        ${activo ? "border-primary bg-primary/5" : "border-gray-100 hover:border-gray-300 bg-white"}`}
                    >
                      {servicio.imagenUrl && (
                        <img
                          src={servicio.imagenUrl}
                          alt={servicio.nombre}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`font-medium text-sm ${activo ? "text-primary" : "text-gray-800"}`}>
                            {servicio.nombre}
                          </p>
                          {esPopular && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                              ★ Más popular
                            </span>
                          )}
                        </div>
                        {servicio.descripcion && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{servicio.descripcion}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{servicio.duracionMinutos} min</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${activo ? "text-primary" : "text-gray-700"}`}>
                        {formatPrecio(servicio.precio)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
