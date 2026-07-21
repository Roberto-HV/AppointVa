import type { ServicioPublico } from "../../types";
import { formatPrecio } from "../../utils/formatters";
import { Clock } from "lucide-react";

interface Props {
  servicios: ServicioPublico[];
  seleccionado: ServicioPublico | null;
  onSeleccionar: (s: ServicioPublico) => void;
  color?: string;
}

export default function PasoServicio({ servicios, seleccionado, onSeleccionar, color = "#334155" }: Props) {
  const categorias = Array.from(new Set(servicios.map((s) => s.categoriaNombre ?? "Servicios")));

  const masPopularId = servicios.length > 0
    ? servicios.reduce((a, b) => a.orden <= b.orden ? a : b).id
    : null;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">¿Qué servicio necesitas?</h2>
      <p className="text-sm text-slate-500 mb-5">Selecciona un servicio para continuar</p>

      <div className="space-y-5">
        {categorias.map((cat) => (
          <div key={cat}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">{cat}</p>
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
                      className={`w-full text-left rounded-2xl border-2 transition-all duration-200 flex items-start gap-4 p-3.5 relative
                        ${activo
                          ? "shadow-sm"
                          : "border-slate-100 hover:border-slate-300 bg-white hover:shadow-sm"
                        }`}
                      style={activo ? {
                        borderColor: color,
                        background: `${color}0D`,
                        boxShadow: `inset 4px 0 0 ${color}`,
                      } : undefined}
                    >
                      {servicio.imagenUrl && (
                        <img
                          src={servicio.imagenUrl}
                          alt={servicio.nombre}
                          className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100 mt-0.5"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p
                            className="font-semibold text-sm"
                            style={{ color: activo ? color : undefined }}
                          >
                            {servicio.nombre}
                          </p>
                          {esPopular && (
                            <span className="inline-flex items-center text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                              ★ Popular
                            </span>
                          )}
                        </div>
                        {servicio.descripcion && (
                          <p
                            className="text-xs text-slate-400 mb-1"
                            style={activo ? {
                              display: "block",
                              overflow: "visible",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              overflowWrap: "break-word",
                            } : {
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 1,
                            }}
                          >
                            {servicio.descripcion}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1">
                          <Clock size={9} />
                          {servicio.duracionMinutos} min
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="text-base font-bold"
                          style={{ color: activo ? color : undefined }}
                        >
                          {formatPrecio(servicio.precio)}
                        </span>
                      </div>
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
