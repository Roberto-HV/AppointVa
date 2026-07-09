import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { negociosApi } from "../../api/negocios";
import type { CitaDto } from "../../types";

const EMP_COLORS = [
  "#4F46E5", "#7C3AED", "#0891B2", "#059669",
  "#D97706", "#DC2626", "#DB2777", "#0F766E",
];

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function fechaLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function estaEnProgreso(cita: CitaDto): boolean {
  if (["Completada", "Cancelada", "Inasistencia"].includes(cita.estadoTexto)) return false;
  const ahora = Date.now();
  const inicio = new Date(cita.inicioEn).getTime();
  const fin = new Date(cita.finEn).getTime();
  return ahora >= inicio && ahora < fin;
}

export default function KioskPage() {
  const [ahora, setAhora] = useState(new Date());
  const today = fechaLocalStr(ahora);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data } = useQuery({
    queryKey: ["citas-kiosk", today],
    queryFn: () => citasApi.obtenerTodas({ desde: today, hasta: today, tamano: 200 }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const citas = data?.datos ?? [];

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil-layout"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 5,
  });

  const activos = empleados.filter((e) => e.activo);
  const conCitas = activos.filter((e) => citas.some((c) => c.empleadoId === e.id));
  const emps = conCitas.length > 0 ? conCitas : activos;

  const porEmp = new Map<string, CitaDto[]>(emps.map((e) => [e.id, []]));
  citas
    .filter((c) => c.estadoTexto !== "Cancelada" && c.estadoTexto !== "Inasistencia")
    .sort((a, b) => new Date(a.inicioEn).getTime() - new Date(b.inicioEn).getTime())
    .forEach((c) => {
      const arr = porEmp.get(c.empleadoId);
      if (arr) arr.push(c);
    });

  const citasValidas = citas.filter((c) => c.estadoTexto !== "Cancelada" && c.estadoTexto !== "Inasistencia");
  const completadas = citas.filter((c) => c.estadoTexto === "Completada").length;
  const revenue = citas.filter((c) => c.pagada).reduce((s, c) => s + c.precio, 0);

  const horaStr = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
  const fechaStr = ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-[#060C1A] text-white flex flex-col select-none overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div>
          <div className="text-lg font-extrabold tracking-tight leading-none">
            {perfil?.nombre ?? "Mi Negocio"}
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">
            Modo recepción
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tracking-tighter tabular-nums leading-none">
            {horaStr}
          </div>
          <div className="text-xs text-white/30 mt-1 capitalize">{fechaStr}</div>
        </div>
      </div>

      {/* Employee columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div
          className="flex h-full"
          style={{ minWidth: Math.max(480, emps.length * 220) }}
        >
          {emps.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/25 text-sm">
              No hay empleados activos
            </div>
          ) : (
            emps.map((emp, i) => {
              const empCitas = porEmp.get(emp.id) ?? [];
              const color = EMP_COLORS[i % EMP_COLORS.length];
              const ocupado = empCitas.some(estaEnProgreso);

              return (
                <div
                  key={emp.id}
                  className="flex-1 flex flex-col border-r border-white/[0.06] last:border-r-0"
                  style={{ minWidth: 200 }}
                >
                  {/* Employee header */}
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06] flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: color }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate leading-tight">{emp.nombre}</div>
                      <div className="text-xs text-white/35 mt-0.5">
                        {empCitas.length} cita{empCitas.length !== 1 ? "s" : ""} hoy
                      </div>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        ocupado
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
                          : "bg-white/15"
                      }`}
                    />
                  </div>

                  {/* Citas list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {empCitas.length === 0 ? (
                      <div className="h-full min-h-[80px] flex items-center justify-center">
                        <p className="text-white/20 text-xs">Sin citas</p>
                      </div>
                    ) : (
                      empCitas.map((cita) => {
                        const enProgreso = estaEnProgreso(cita);
                        const completada = cita.estadoTexto === "Completada";
                        const pasada = new Date(cita.finEn).getTime() < Date.now() && !completada;

                        const inicio = new Date(cita.inicioEn).getTime();
                        const fin = new Date(cita.finEn).getTime();
                        const progresoPct = enProgreso
                          ? Math.min(100, ((Date.now() - inicio) / (fin - inicio)) * 100)
                          : 0;

                        return (
                          <div
                            key={cita.id}
                            className={`rounded-xl p-3 transition-all ${
                              enProgreso
                                ? "bg-white/10 border border-indigo-400/30 shadow-lg shadow-indigo-500/10"
                                : completada
                                ? "bg-white/[0.03] opacity-45"
                                : pasada
                                ? "bg-white/[0.04] opacity-55"
                                : "bg-white/[0.06]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span
                                className={`text-xs font-black tabular-nums leading-none ${
                                  enProgreso ? "text-indigo-300" : "text-white/45"
                                }`}
                              >
                                {horaCorta(cita.inicioEn)}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none ${
                                  enProgreso
                                    ? "bg-indigo-500/30 text-indigo-300"
                                    : completada
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-white/[0.08] text-white/35"
                                }`}
                              >
                                {enProgreso ? "● En curso" : completada ? "✓ Lista" : cita.estadoTexto}
                              </span>
                            </div>
                            <div
                              className="text-sm font-semibold leading-tight mb-0.5 truncate"
                              style={{ color: enProgreso ? "white" : "rgba(255,255,255,.68)" }}
                            >
                              {cita.nombreCliente}
                            </div>
                            <div className="text-xs text-white/35 truncate">
                              {cita.nombreServicio} · {cita.duracionMinutos} min
                            </div>
                            {enProgreso && (
                              <div className="mt-2.5 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-400 rounded-full transition-all duration-1000"
                                  style={{ width: `${progresoPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-6 text-xs text-white/30">
          <span>{citasValidas.length} citas hoy</span>
          <span>{completadas} completadas</span>
          {revenue > 0 && (
            <span className="text-emerald-400/80">
              ${revenue.toLocaleString("es-MX")} generado
            </span>
          )}
        </div>
        <Link
          to="/dashboard/citas"
          className="text-xs text-white/25 hover:text-white/55 transition flex items-center gap-1"
        >
          ← Salir del modo pantalla
        </Link>
      </div>

    </div>
  );
}
