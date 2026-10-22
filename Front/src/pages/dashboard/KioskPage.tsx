import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { negociosApi } from "../../api/negocios";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { ArrowLeft, Check } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { usePulsacionLarga } from "../../hooks/usePulsacionLarga";
import { verificarContrasena } from "../../lib/reautenticacion";
import {
  formatoCuentaAtras,
  leerBloqueoSalida,
  limpiarBloqueoSalida,
  MAX_INTENTOS_SALIDA,
  registrarFalloSalida,
} from "../../lib/bloqueoSalidaKiosco";
import { useToastStore } from "../../store/toastStore";
import { mensajeError } from "../../utils/errores";
import { colorCategoria, TEXTO_SOBRE_CATEGORIA } from "../../lib/temaGraficas";
import { useAuthStore } from "../../store/authStore";
import type { CitaDto } from "../../types";
import { estiloEstadoCita } from "../../lib/estadoCita";
import { capitalizarPrimera, formatPrecio, nombreConInicial } from "../../utils/formatters";

/** Cada cuánto se vuelven a pedir citas y empleados (también tras un fallo). */
const INTERVALO_SONDEO_MS = 30_000;


function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "numeric", minute: "2-digit", hour12: true,
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
  const terms = useSectorTerms();
  const usuario = useAuthStore((s) => s.usuario);
  const esEmpleado = usuario?.rol === "Empleado";

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, isError, dataUpdatedAt, refetch: reintentarCitas, isFetching: actualizandoCitas } = useQuery({
    queryKey: ["citas-kiosk", today],
    queryFn: () => citasApi.obtenerTodas({ desde: today, hasta: today, tamano: 200 }),
    staleTime: 0,
    refetchInterval: INTERVALO_SONDEO_MS,
  });
  const citas = data?.datos ?? [];

  // Los empleados también se sondean al mismo ritmo: sin esto un fallo dejaba el
  // aviso "reintentando" fijo para siempre, porque nada volvía a pedirlos.
  const {
    data: datosEmpleados, isLoading: cargandoEmpleados, isError: errorEmpleados,
    refetch: reintentarEmpleados, isFetching: actualizandoEmpleados,
  } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: INTERVALO_SONDEO_MS,
  });
  const empleados = datosEmpleados ?? [];

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

  // Un fallo de red no debe parecer un día vacío: se avisa y se sigue mostrando
  // lo último que llegó, con su hora (la consulta reintenta cada 30s).
  const sinConexion = isError || errorEmpleados;
  const cargando = (isLoading || cargandoEmpleados) && !sinConexion;
  // Sin nada cargado, esperar 30s no basta: se ofrece reintentar a mano.
  const nadaCargado = !data || !datosEmpleados;
  const reintentando = actualizandoCitas || actualizandoEmpleados;
  const reintentar = () => {
    if (isError) reintentarCitas();
    if (errorEmpleados) reintentarEmpleados();
  };
  const actualizado = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  const horaStr = ahora.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
  const fechaStr = capitalizarPrimera(ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }));

  return (
    // `dark` en la raíz: el modo recepción siempre es oscuro, así que los tokens
    // --status-* toman sus valores oscuros aunque el resto del panel esté en claro.
    <div className="dark min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
        <div>
          <div className="text-lg font-bold tracking-tight leading-none">
            {perfil?.nombre ?? "Mi Negocio"}
          </div>
          <div className="text-xs text-white/60 uppercase tracking-widest mt-1">
            Modo recepción
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tracking-tighter tabular-nums leading-none">
            {horaStr}
          </div>
          <div className="text-sm text-white/70 mt-1">{fechaStr}</div>
        </div>
      </div>

      {sinConexion && (
        <div role="alert" className="px-6 py-2 bg-amber-500/15 border-b border-amber-400/30 text-sm text-amber-200 flex-shrink-0 flex flex-wrap items-center justify-between gap-2">
          <span>{`Sin conexión · reintentando${actualizado ? ` · última actualización ${actualizado}` : ""}`}</span>
          {nadaCargado && (
            <button
              type="button"
              onClick={reintentar}
              disabled={reintentando}
              className="min-h-[44px] px-4 rounded-lg border border-amber-300/40 font-medium text-amber-100 hover:bg-white/10 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              {reintentando ? "Reintentando…" : "Reintentar"}
            </button>
          )}
        </div>
      )}

      {/* Employee columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div
          className="flex h-full"
          style={{ minWidth: Math.max(480, emps.length * 220) }}
        >
          {cargando ? (
            <div className="flex-1 flex items-center justify-center text-white/70 text-sm" role="status">
              {`Cargando ${terms.citas.toLowerCase()} de hoy…`}
            </div>
          ) : emps.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/70 text-sm">
              {sinConexion ? "No se pudo cargar la agenda de hoy." : "No hay empleados activos"}
            </div>
          ) : (
            emps.map((emp, i) => {
              const empCitas = porEmp.get(emp.id) ?? [];
              const color = colorCategoria(i);
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
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${TEXTO_SOBRE_CATEGORIA}`}
                      style={{ background: color }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate leading-tight">{emp.nombre}</div>
                      <div className="text-xs text-white/60 mt-0.5">
                        {`${empCitas.length} ${empCitas.length === 1 ? terms.cita.toLowerCase() : terms.citas.toLowerCase()} hoy`}
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
                        <p className="text-white/60 text-xs">{`Sin ${terms.citas.toLowerCase()}`}</p>
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
                                // Terminó y sigue abierta: trabajo pendiente, no se atenúa.
                                ? "bg-white/[0.06] border border-amber-400/30"
                                : "bg-white/[0.06]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span
                                className={`text-xs font-bold tabular-nums leading-none ${
                                  enProgreso ? "text-indigo-300" : "text-white/70"
                                }`}
                              >
                                {horaCorta(cita.inicioEn)}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full leading-none ${
                                  enProgreso
                                    ? "bg-indigo-500/30 text-indigo-300"
                                    : estiloEstadoCita(cita.estadoTexto).badge
                                }`}
                              >
                                {enProgreso && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
                                {completada && !enProgreso && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                                {enProgreso ? "En curso" : completada ? "Lista" : cita.estadoTexto}
                              </span>
                            </div>
                            <div
                              className="text-sm font-semibold leading-tight mb-0.5 truncate"
                              style={{ color: enProgreso ? "white" : "rgba(255,255,255,.85)" }}
                            >
                              {/* Solo nombre e inicial: la pantalla se ve desde la sala (DC-28). */}
                              {nombreConInicial(cita.nombreCliente)}
                            </div>
                            <div className="text-xs text-white/60 truncate">
                              {cita.nombreServicio} · {cita.duracionMinutos} min
                            </div>
                            {enProgreso && (
                              <div
                                role="progressbar"
                                aria-valuenow={Math.round(progresoPct)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="mt-2.5 h-1 bg-white/10 rounded-full overflow-hidden"
                              >
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
        <div className="flex items-center gap-6 text-sm text-white/60">
          <span>{`${citasValidas.length} ${terms.citas.toLowerCase()} hoy`}</span>
          <span>{completadas} completadas</span>
          {revenue > 0 && !esEmpleado && (
            <span className="text-emerald-400/80">
              {formatPrecio(revenue)} generado
            </span>
          )}
        </div>
        <SalidaProtegida email={usuario?.email ?? ""} />
      </div>

    </div>
  );
}

// ── Salida protegida (decisión 3, DC-13) ──────────────────────────────────────
// Salir pide la contraseña de la cuenta con la que se abrió el modo recepción.
// El control se mantiene pulsado 1.5 s (dedo, ratón, o Enter/Espacio con el
// botón enfocado) para que un cliente no lo active por accidente. Tras
// `MAX_INTENTOS_SALIDA` contraseñas incorrectas se bloquea unos minutos para no
// bloquear la cuenta del dueño (ver `bloqueoSalidaKiosco.ts`; solución real: B9).
function SalidaProtegida({ email }: { email: string }) {
  const navigate = useNavigate();
  const { toast } = useToastStore();
  const [abierto, setAbierto] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(() => leerBloqueoSalida().bloqueadoHasta);
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  const idPista = useId();
  const idError = useId();
  const idBloqueo = useId();
  const pulsacion = usePulsacionLarga(() => setAbierto(true));
  const restanteMs = bloqueadoHasta - ahoraMs;
  const bloqueado = restanteMs > 0;

  // Cuenta atrás visible mientras dure el bloqueo.
  useEffect(() => {
    if (!bloqueadoHasta) return;
    const id = setInterval(() => {
      const ahora = Date.now();
      setAhoraMs(ahora);
      if (ahora >= bloqueadoHasta) {
        setBloqueadoHasta(leerBloqueoSalida(ahora).bloqueadoHasta);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [bloqueadoHasta]);

  const cerrar = () => {
    setAbierto(false);
    setContrasena("");
    setError("");
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!contrasena || verificando || bloqueado) return;
    setVerificando(true);
    setError("");
    try {
      const resultado = await verificarContrasena(email, contrasena);
      if (resultado.correcta) {
        limpiarBloqueoSalida();
        if (!resultado.sesionExtraRevocada) {
          toast("No se pudo cerrar la sesión de verificación", "info");
        }
        navigate("/dashboard/citas");
        return;
      }
      const estado = registrarFalloSalida();
      setContrasena("");
      if (estado.bloqueadoHasta) {
        setAhoraMs(Date.now());
        setBloqueadoHasta(estado.bloqueadoHasta);
        return;
      }
      const quedan = MAX_INTENTOS_SALIDA - estado.intentos;
      setError(`Contraseña incorrecta. ${quedan === 1 ? "Queda 1 intento" : `Quedan ${quedan} intentos`} antes de bloquear la salida unos minutos.`);
    } catch (err) {
      setError(mensajeError(err, "No se pudo verificar la contraseña. Intenta de nuevo."));
    } finally {
      setVerificando(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-end">
        <button
          type="button"
          {...pulsacion.props}
          aria-describedby={idPista}
          className="relative overflow-hidden text-xs text-white/40 hover:text-white/70 focus-visible:text-white/85 transition flex items-center gap-1 min-h-[44px] px-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 touch-none select-none"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Salir del modo pantalla
          <span
            aria-hidden="true"
            className={`absolute left-0 bottom-0 h-0.5 bg-white/70 ${pulsacion.presionando ? "w-full transition-[width] duration-[1500ms] ease-linear" : "w-0"}`}
          />
        </button>
        <span id={idPista} className="text-[11px] text-white/40">
          Mantén presionado para salir
        </span>
      </div>

      <Modal abierto={abierto} onCerrar={cerrar} titulo="Salir del modo recepción" ancho="sm">
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">
            Escribe la contraseña de <strong className="text-foreground">{email}</strong> para volver al panel.
          </p>
          {bloqueado && (
            <p id={idBloqueo} role="alert" className="rounded-lg border border-status-pending-dot bg-status-pending-bg px-3 py-2 text-sm text-status-pending-fg">
              {"Demasiados intentos incorrectos. Podrás volver a intentarlo en "}
              <span className="font-semibold tabular-nums">{formatoCuentaAtras(restanteMs)}</span>.
            </p>
          )}
          <div>
            <label htmlFor="kiosko-contrasena" className="block text-sm font-medium text-foreground mb-1">
              Contraseña
            </label>
            <input
              id="kiosko-contrasena"
              type="password"
              autoComplete="current-password"
              autoFocus
              disabled={bloqueado}
              value={contrasena}
              onChange={(e) => { setContrasena(e.target.value); setError(""); }}
              aria-invalid={!!error}
              aria-describedby={bloqueado ? idBloqueo : error ? idError : undefined}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
            />
            {error && (
              <p id={idError} role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-400">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="min-h-[44px] px-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-foreground hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!contrasena || verificando || bloqueado}
              className="min-h-[44px] px-4 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-sm font-semibold text-white disabled:opacity-40 transition"
            >
              {verificando ? "Verificando…" : "Salir"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
