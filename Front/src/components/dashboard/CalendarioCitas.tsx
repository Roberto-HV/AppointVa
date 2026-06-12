import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { citasApi } from "../../api/citas";
import type { CitaDto } from "../../types";

const HORA_INICIO = 7;
const HORA_FIN = 21;
const PX_POR_HORA = 64;
const GRID_HEIGHT = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const COLORES: Record<string, string> = {
  Pendiente:   "bg-yellow-100 border-l-[3px] border-yellow-400 text-yellow-800",
  Confirmada:  "bg-green-100  border-l-[3px] border-green-500  text-green-800",
  Completada:  "bg-blue-100   border-l-[3px] border-blue-400   text-blue-700",
  Cancelada:   "bg-gray-100   border-l-[3px] border-gray-300   text-gray-400",
  Inasistencia:"bg-red-50     border-l-[3px] border-red-300    text-red-400",
};

function getLunesDeEstaSemana(date: Date): Date {
  const d = new Date(date);
  const dia = d.getDay();
  d.setDate(d.getDate() - dia + (dia === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDias(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

interface Props {
  empleadoId: string;
  onCitaClick: (cita: CitaDto) => void;
}

export default function CalendarioCitas({ empleadoId, onCitaClick }: Props) {
  const [lunes, setLunes] = useState(() => getLunesDeEstaSemana(new Date()));
  const domingo = addDias(lunes, 6);
  const hastaApi = addDias(domingo, 1); // incluye todo el domingo

  const { data: citas = [] } = useQuery({
    queryKey: ["citas-cal", lunes.toISOString(), empleadoId],
    queryFn: () => citasApi.obtenerTodas({
      desde: lunes.toISOString().slice(0, 10),
      hasta: hastaApi.toISOString().slice(0, 10),
      empleadoId: empleadoId || undefined,
    }),
    select: (p) => p.datos,
  });

  const dias = Array.from({ length: 7 }, (_, i) => addDias(lunes, i));
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const hoy = new Date();

  function calcTop(cita: CitaDto): number {
    const d = new Date(cita.inicioEn);
    return Math.max(0, (d.getHours() + d.getMinutes() / 60 - HORA_INICIO) * PX_POR_HORA);
  }

  function calcAltura(cita: CitaDto): number {
    return Math.max(22, (cita.duracionMinutos / 60) * PX_POR_HORA);
  }

  function citasDelDia(dia: Date): CitaDto[] {
    const dStr = dia.toDateString();
    return citas.filter((c) => new Date(c.inicioEn).toDateString() === dStr);
  }

  const semanaLabel = `${lunes.getDate()} ${MESES[lunes.getMonth()]} — ${domingo.getDate()} ${MESES[domingo.getMonth()]} ${domingo.getFullYear()}`;

  // Línea de "ahora" si hoy está en la semana visible
  const horaActual = hoy.getHours() + hoy.getMinutes() / 60;
  const horaActualTop = (horaActual - HORA_INICIO) * PX_POR_HORA;
  const hoyEnSemana = dias.some((d) => d.toDateString() === hoy.toDateString());
  const indiceDiaHoy = dias.findIndex((d) => d.toDateString() === hoy.toDateString());

  return (
    <div>
      {/* Navegación semana */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button
          onClick={() => setLunes((d) => addDias(d, -7))}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          ← Anterior
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{semanaLabel}</span>
          <button
            onClick={() => setLunes(getLunesDeEstaSemana(new Date()))}
            className="text-xs text-primary hover:underline"
          >
            Hoy
          </button>
        </div>
        <button
          onClick={() => setLunes((d) => addDias(d, 7))}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          Siguiente →
        </button>
      </div>

      {/* Leyenda estados */}
      <div className="flex gap-3 flex-wrap mb-3 text-xs">
        {Object.entries(COLORES).map(([estado, clases]) => (
          <span key={estado} className={`px-2 py-0.5 rounded font-medium ${clases}`}>
            {estado}
          </span>
        ))}
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Cabecera días */}
        <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="w-12 shrink-0" />
          {dias.map((dia, i) => {
            const esHoy = dia.toDateString() === hoy.toDateString();
            return (
              <div key={i} className="flex-1 py-2 text-center border-l border-gray-100">
                <p className="text-xs text-gray-400 uppercase">{DIAS_CORTOS[dia.getDay()]}</p>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto mt-0.5 ${esHoy ? "bg-primary" : ""}`}>
                  <span className={`text-sm font-semibold ${esHoy ? "text-white" : "text-gray-700"}`}>
                    {dia.getDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid con scroll */}
        <div className="flex overflow-y-auto" style={{ maxHeight: 560 }}>
          {/* Columna de horas */}
          <div className="w-12 shrink-0 relative bg-white" style={{ height: GRID_HEIGHT }}>
            {horas.map((h) => (
              <div
                key={h}
                className="absolute w-full pr-1.5"
                style={{ top: (h - HORA_INICIO) * PX_POR_HORA - 8 }}
              >
                <span className="text-xs text-gray-400 float-right">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {dias.map((dia, colIdx) => {
            const citasDia = citasDelDia(dia);
            return (
              <div
                key={colIdx}
                className="flex-1 relative border-l border-gray-100"
                style={{ height: GRID_HEIGHT }}
              >
                {/* Líneas de horas */}
                {horas.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-gray-100"
                    style={{ top: (h - HORA_INICIO) * PX_POR_HORA }}
                  />
                ))}

                {/* Línea "ahora" */}
                {hoyEnSemana && indiceDiaHoy === colIdx && horaActualTop > 0 && horaActualTop < GRID_HEIGHT && (
                  <div
                    className="absolute w-full z-20 pointer-events-none"
                    style={{ top: horaActualTop }}
                  >
                    <div className="relative">
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                      <div className="border-t-2 border-red-400 w-full" />
                    </div>
                  </div>
                )}

                {/* Citas */}
                {citasDia.map((c) => {
                  const top = calcTop(c);
                  const height = calcAltura(c);
                  const color = COLORES[c.estadoTexto] ?? COLORES.Confirmada;
                  const hora = new Date(c.inicioEn).toLocaleTimeString("es-MX", {
                    hour: "2-digit", minute: "2-digit", hour12: false,
                  });
                  return (
                    <button
                      key={c.id}
                      onClick={() => onCitaClick(c)}
                      title={`${c.nombreCliente} — ${c.nombreServicio} (${hora})`}
                      className={`absolute inset-x-0.5 rounded text-left px-1.5 py-0.5 text-xs overflow-hidden hover:brightness-95 transition cursor-pointer ${color}`}
                      style={{ top, height }}
                    >
                      <p className="font-semibold truncate leading-tight">{hora} {c.nombreCliente}</p>
                      {height > 30 && (
                        <p className="truncate opacity-70 leading-tight">{c.nombreServicio}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
