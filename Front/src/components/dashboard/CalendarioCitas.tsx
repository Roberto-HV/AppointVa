import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
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
  onReagendar?: (cita: CitaDto, nuevoInicio: string) => void;
}

export default function CalendarioCitas({ empleadoId, onCitaClick, onReagendar }: Props) {
  const [vista, setVista] = useState<"semana" | "dia">("semana");
  const [lunes, setLunes] = useState(() => getLunesDeEstaSemana(new Date()));
  const [diaActivo, setDiaActivo] = useState(() => new Date());
  const [arrastrando, setArrastrando] = useState<CitaDto | null>(null);
  const [dropTarget, setDropTarget] = useState<{ colIdx: number; hora: number; minutos: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const domingo = addDias(lunes, 6);
  const hastaApi = addDias(domingo, 1);

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

  const abrirDia = (dia: Date) => {
    setDiaActivo(dia);
    setVista("dia");
    // Si el día está fuera de la semana visible, ajustar el lunes
    const lunesDia = getLunesDeEstaSemana(dia);
    if (lunesDia.toDateString() !== lunes.toDateString()) setLunes(lunesDia);
  };

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
  const diaActivoLabel = `${DIAS_CORTOS[diaActivo.getDay()]}, ${diaActivo.getDate()} de ${MESES[diaActivo.getMonth()]} ${diaActivo.getFullYear()}`;

  const horaActual = hoy.getHours() + hoy.getMinutes() / 60;
  const horaActualTop = (horaActual - HORA_INICIO) * PX_POR_HORA;
  const hoyEnSemana = dias.some((d) => d.toDateString() === hoy.toDateString());
  const indiceDiaHoy = dias.findIndex((d) => d.toDateString() === hoy.toDateString());

  const badgeOcupacion = (count: number) => {
    if (count === 0) return null;
    const color = count >= 7 ? "text-red-500" : count >= 4 ? "text-amber-500" : "text-emerald-600";
    return <span className={`text-[10px] font-semibold mt-0.5 ${color}`}>{count}</span>;
  };

  const renderGridCita = (c: CitaDto, colIdx: number, totalCols = 1) => {
    const top = calcTop(c);
    const height = calcAltura(c);
    const color = COLORES[c.estadoTexto] ?? COLORES.Confirmada;
    const hora = new Date(c.inicioEn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    const puedeMover = onReagendar && (c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada");
    return (
      <button
        key={c.id}
        onClick={() => !arrastrando && onCitaClick(c)}
        title={puedeMover
          ? `Arrastra para reagendar · ${c.nombreCliente} — ${c.nombreServicio} (${hora})`
          : `${c.nombreCliente} — ${c.nombreServicio} (${hora})`}
        draggable={!!puedeMover}
        onDragStart={() => puedeMover && setArrastrando(c)}
        onDragEnd={() => { setArrastrando(null); setDropTarget(null); }}
        className={`absolute inset-x-0.5 rounded text-left px-1.5 py-0.5 text-xs overflow-hidden transition
          ${puedeMover ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
          ${arrastrando?.id === c.id ? "opacity-40" : "hover:brightness-95"}
          ${color}`}
        style={{ top, height }}
      >
        <p className="font-semibold truncate leading-tight">{hora} {c.nombreCliente}</p>
        {height > 30 && <p className="truncate opacity-70 leading-tight">{c.nombreServicio}</p>}
        {totalCols === 1 && height > 52 && (
          <p className="truncate opacity-60 leading-tight">{c.duracionMinutos} min · {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c.precio)}</p>
        )}
      </button>
    );
  };

  return (
    <div>
      {/* Barra superior: navegación + toggle vista */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        {vista === "semana" ? (
          <div className="grid grid-cols-3 items-center gap-2 flex-1">
            <button
              onClick={() => setLunes((d) => addDias(d, -7))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition w-fit"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-semibold text-gray-800 text-center">{semanaLabel}</span>
              <button onClick={() => setLunes(getLunesDeEstaSemana(new Date()))} className="text-xs text-primary hover:underline font-medium">Hoy</button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setLunes((d) => addDias(d, 7))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 items-center gap-2 flex-1">
            <button
              onClick={() => { setDiaActivo((d) => { const nd = addDias(d, -1); abrirDia(nd); return nd; }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition w-fit"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-semibold text-gray-800 text-center capitalize">{diaActivoLabel}</span>
              <button onClick={() => abrirDia(new Date())} className="text-xs text-primary hover:underline font-medium">Hoy</button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setDiaActivo((d) => { const nd = addDias(d, 1); abrirDia(nd); return nd; }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Toggle semana/día */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 shrink-0">
          <button
            onClick={() => setVista("semana")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition ${vista === "semana" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <CalendarDays size={13} />
            <span className="hidden sm:inline">Semana</span>
          </button>
          <button
            onClick={() => { setDiaActivo(hoy); setVista("dia"); }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition ${vista === "dia" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <List size={13} />
            <span className="hidden sm:inline">Día</span>
          </button>
        </div>
      </div>

      {/* Leyenda estados */}
      <div className="flex gap-3 flex-wrap mb-3 text-xs">
        {Object.entries(COLORES).map(([estado, clases]) => (
          <span key={estado} className={`px-2 py-0.5 rounded font-medium ${clases}`}>{estado}</span>
        ))}
      </div>

      {/* ── Vista Semana ── */}
      {vista === "semana" && (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Cabecera días */}
        <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="w-12 shrink-0" />
          {dias.map((dia, i) => {
            const esHoy = dia.toDateString() === hoy.toDateString();
            const count = citasDelDia(dia).length;
            return (
              <button
                key={i}
                onClick={() => abrirDia(dia)}
                className="flex-1 py-2 text-center border-l border-gray-100 hover:bg-gray-50 transition flex flex-col items-center"
              >
                <p className="text-xs text-gray-400 uppercase">{DIAS_CORTOS[dia.getDay()]}</p>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${esHoy ? "bg-primary" : ""}`}>
                  <span className={`text-sm font-semibold ${esHoy ? "text-white" : "text-gray-700"}`}>{dia.getDate()}</span>
                </div>
                {badgeOcupacion(count)}
              </button>
            );
          })}
        </div>

        {/* Grid con scroll */}
        <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: 560 }}>
          {/* Columna de horas */}
          <div className="w-12 shrink-0 relative bg-white" style={{ height: GRID_HEIGHT }}>
            {horas.map((h) => (
              <div key={h} className="absolute w-full pr-1.5" style={{ top: (h - HORA_INICIO) * PX_POR_HORA - 8 }}>
                <span className="text-xs text-gray-400 float-right">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {dias.map((dia, colIdx) => {
            const citasDia = citasDelDia(dia);
            const esDropTarget = dropTarget?.colIdx === colIdx;
            return (
              <div
                key={colIdx}
                className={`flex-1 relative border-l border-gray-100 ${arrastrando && esDropTarget ? "bg-primary/5" : ""}`}
                style={{ height: GRID_HEIGHT }}
                onDragOver={(e) => {
                  if (!arrastrando) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const scrollTop = scrollRef.current?.scrollTop ?? 0;
                  const y = e.clientY - rect.top + scrollTop;
                  const totalMin = Math.round((y / PX_POR_HORA) * 60 / 15) * 15;
                  const hora = Math.min(23, Math.max(HORA_INICIO, Math.floor(totalMin / 60) + HORA_INICIO));
                  setDropTarget({ colIdx, hora, minutos: totalMin % 60 });
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!arrastrando || !dropTarget || dropTarget.colIdx !== colIdx) return;
                  const nuevaFecha = new Date(dia);
                  nuevaFecha.setHours(dropTarget.hora, dropTarget.minutos, 0, 0);
                  onReagendar?.(arrastrando, nuevaFecha.toISOString());
                  setArrastrando(null);
                  setDropTarget(null);
                }}
              >
                {horas.map((h) => (
                  <div key={h} className="absolute w-full border-t border-gray-100" style={{ top: (h - HORA_INICIO) * PX_POR_HORA }} />
                ))}
                {hoyEnSemana && indiceDiaHoy === colIdx && horaActualTop > 0 && horaActualTop < GRID_HEIGHT && (
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: horaActualTop }}>
                    <div className="relative">
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                      <div className="border-t-2 border-red-400 w-full" />
                    </div>
                  </div>
                )}
                {esDropTarget && dropTarget && arrastrando && (
                  <div
                    className="absolute inset-x-0.5 h-1 bg-primary/60 rounded z-30 pointer-events-none"
                    style={{ top: (dropTarget.hora - HORA_INICIO + dropTarget.minutos / 60) * PX_POR_HORA }}
                  />
                )}
                {citasDia.map((c) => renderGridCita(c, colIdx))}
              </div>
            );
          })}
        </div>
      </div>
      )} {/* fin vista semana */}

      {/* ── Vista Día ── */}
      {vista === "dia" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="w-12 shrink-0" />
            <div className="flex-1 py-3 text-center border-l border-gray-100">
              <p className={`text-sm font-semibold capitalize ${diaActivo.toDateString() === hoy.toDateString() ? "text-primary" : "text-gray-800"}`}>
                {diaActivoLabel}
              </p>
              {(() => {
                const n = citasDelDia(diaActivo).length;
                return <p className="text-xs text-gray-400 mt-0.5">{n} {n === 1 ? "cita" : "citas"}</p>;
              })()}
            </div>
          </div>

          <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: 640 }}>
            <div className="w-12 shrink-0 relative bg-white" style={{ height: GRID_HEIGHT }}>
              {horas.map((h) => (
                <div key={h} className="absolute w-full pr-1.5" style={{ top: (h - HORA_INICIO) * PX_POR_HORA - 8 }}>
                  <span className="text-xs text-gray-400 float-right">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative border-l border-gray-100" style={{ height: GRID_HEIGHT }}>
              {horas.map((h) => (
                <div key={h} className="absolute w-full border-t border-gray-100" style={{ top: (h - HORA_INICIO) * PX_POR_HORA }} />
              ))}
              {diaActivo.toDateString() === hoy.toDateString() && horaActualTop > 0 && horaActualTop < GRID_HEIGHT && (
                <div className="absolute w-full z-20 pointer-events-none" style={{ top: horaActualTop }}>
                  <div className="relative">
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                    <div className="border-t-2 border-red-400 w-full" />
                  </div>
                </div>
              )}
              {citasDelDia(diaActivo).map((c) => renderGridCita(c, 0, 1))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
