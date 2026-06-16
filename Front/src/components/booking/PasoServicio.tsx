import { useState } from "react";
import { Search } from "lucide-react";
import type { ServicioPublico } from "../../types";

interface Props {
  servicios: ServicioPublico[];
  seleccionado: ServicioPublico | null;
  onSeleccionar: (s: ServicioPublico) => void;
}

function formatPrecio(precio: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(precio);
}

function formatDuracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function PasoServicio({ servicios, seleccionado, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = busqueda.trim()
    ? servicios.filter(
        (s) =>
          s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          s.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : servicios;

  const categorias = Array.from(new Set(filtrados.map((s) => s.categoriaNombre ?? "Servicios")));
  const mostPopular = servicios.reduce<ServicioPublico | null>(
    (prev, cur) => (!prev || cur.orden < prev.orden ? cur : prev),
    null
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">¿Qué servicio deseas?</h2>

      {servicios.length > 4 && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar servicio…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>
      )}

      {filtrados.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No se encontraron servicios con "{busqueda}"
        </p>
      )}

      <div className="space-y-5">
        {categorias.map((cat) => (
          <div key={cat}>
            {categorias.length > 1 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
            )}
            <div className="space-y-2">
              {filtrados
                .filter((s) => (s.categoriaNombre ?? "Servicios") === cat)
                .map((servicio) => {
                  const activo = seleccionado?.id === servicio.id;
                  const esMasPopular = mostPopular?.id === servicio.id && servicios.length > 2;
                  return (
                    <button
                      key={servicio.id}
                      onClick={() => onSeleccionar(servicio)}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3 group
                        ${activo
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-gray-100 hover:border-primary/40 hover:shadow-sm bg-white"
                        }`}
                    >
                      {servicio.imagenUrl ? (
                        <img
                          src={servicio.imagenUrl}
                          alt={servicio.nombre}
                          className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-100"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-xl shrink-0 flex items-center justify-center text-xl font-bold
                          ${activo ? "bg-primary/20 text-primary" : "bg-gray-100 text-gray-400"}`}>
                          {servicio.nombre.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold text-sm ${activo ? "text-primary" : "text-gray-800"}`}>
                            {servicio.nombre}
                          </p>
                          {esMasPopular && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              Popular
                            </span>
                          )}
                        </div>
                        {servicio.descripcion && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{servicio.descripcion}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{formatDuracion(servicio.duracionMinutos)}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-sm font-bold ${activo ? "text-primary" : "text-gray-700"}`}>
                          {formatPrecio(servicio.precio)}
                        </span>
                        {activo && (
                          <div className="mt-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center mx-auto">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
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
