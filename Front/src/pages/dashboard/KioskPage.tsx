import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { kioscoApi, type CitaKiosco } from "../../api/kiosco";
import { getSectorTerms } from "../../hooks/useSectorTerms";
import { ArrowLeft, Check } from "lucide-react";
import Modal from "../../components/ui/Modal";
import ModalAcciones from "../../components/ui/ModalAcciones";
import { BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "../../components/ui/botonesModal";
import { usePulsacionLarga } from "../../hooks/usePulsacionLarga";
import {
  completarSalida2FA,
  entrarAlKiosco,
  restaurarSesion,
  ROL_KIOSCO,
  salirDelKiosco,
} from "../../lib/reautenticacion";
import {
  formatoCuentaAtras,
  leerBloqueoSalida,
  limpiarBloqueoSalida,
  registrarBloqueoSalida,
} from "../../lib/bloqueoSalidaKiosco";
import { estadoHttp, mensajeError } from "../../utils/errores";
import { colorCategoria, TEXTO_SOBRE_CATEGORIA } from "../../lib/temaGraficas";
import { useAuthStore } from "../../store/authStore";
import type { LoginRespuesta } from "../../types";
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

function estaEnProgreso(cita: CitaKiosco): boolean {
  if (["Completada", "Cancelada", "Inasistencia"].includes(cita.estadoTexto)) return false;
  const ahora = Date.now();
  const inicio = new Date(cita.inicioEn).getTime();
  const fin = new Date(cita.finEn).getTime();
  return ahora >= inicio && ahora < fin;
}

export default function KioskPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const esKiosco = usuario?.rol === ROL_KIOSCO;
  const navigate = useNavigate();
  const [errorEntrada, setErrorEntrada] = useState("");
  const [intentoEntrada, setIntentoEntrada] = useState(0);
  // Entrar es explícito: solo si la página se abrió con una sesión normal, y solo
  // hasta que la entrada termina. Al salir, `restaurarSesion` vuelve a pintar esta
  // página con la sesión del dueño antes de que la navegación a Citas se confirme;
  // sin esta marca el efecto volvía a entrar con el refresh token recién emitido
  // (el servidor lo revocaba) y el dispositivo quedaba otra vez en modo recepción.
  const [debeEntrar, setDebeEntrar] = useState(() => !esKiosco);
  const entrando = useRef(false);

  // Abrir la pantalla con la sesión normal la cambia por un token de kiosco (B9):
  // a partir de aquí el dispositivo no guarda nada que devuelva la sesión del dueño.
  useEffect(() => {
    if (!debeEntrar || esKiosco || entrando.current) return;
    entrando.current = true;
    entrarAlKiosco()
      .then(() => setDebeEntrar(false))
      .catch((err) => setErrorEntrada(mensajeError(err, "No se pudo activar el modo recepción.")))
      .finally(() => { entrando.current = false; });
  }, [debeEntrar, esKiosco, intentoEntrada]);

  if (!esKiosco && !debeEntrar) {
    // Saliendo: la sesión normal ya está guardada y la navegación a Citas, en curso.
    // Si esa navegación no llega, el botón la repite; `debeEntrar` sigue en false,
    // así que no vuelve a entrar al modo recepción.
    return (
      <div className="dark min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="status" className="text-sm text-white/70">Volviendo al panel…</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard/citas", { replace: true })}
          className="min-h-[44px] px-4 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Ir al panel
        </button>
      </div>
    );
  }

  if (!esKiosco) {
    return (
      <div className="dark min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        {errorEntrada ? (
          <>
            <p role="alert" className="text-sm text-amber-200">{errorEntrada}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard/citas")}
                className="min-h-[44px] px-4 rounded-lg border border-white/20 text-sm font-medium hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Volver al panel
              </button>
              <button
                type="button"
                onClick={() => { setErrorEntrada(""); setIntentoEntrada((n) => n + 1); }}
                className="min-h-[44px] px-4 rounded-lg bg-white/15 text-sm font-semibold hover:bg-white/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Reintentar
              </button>
            </div>
          </>
        ) : (
          <p role="status" className="text-sm text-white/70">Activando modo recepción…</p>
        )}
      </div>
    );
  }

  return <PantallaRecepcion email={usuario?.email ?? ""} />;
}

function PantallaRecepcion({ email }: { email: string }) {
  const [ahora, setAhora] = useState(new Date());
  const today = fechaLocalStr(ahora);

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Una sola petición: el token de kiosco no puede leer /citas, /empleados ni el
  // perfil del negocio. La fecha va en la clave para volver a pedir al cambiar de día.
  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["kiosco-agenda", today],
    queryFn: kioscoApi.agenda,
    staleTime: 0,
    // Un 403 (p. ej. empleado sin ficha) no se arregla reintentando: se deja de sondear.
    refetchInterval: (query) => (estadoHttp(query.state.error) === 403 ? false : INTERVALO_SONDEO_MS),
  });
  const sinPermiso = estadoHttp(error) === 403;
  const citas = data?.citas ?? [];
  const empleados = data?.empleados ?? [];
  const terms = getSectorTerms(data?.sector);

  const activos = empleados;
  const conCitas = activos.filter((e) => citas.some((c) => c.empleadoId === e.id));
  const emps = conCitas.length > 0 ? conCitas : activos;

  const porEmp = new Map<string, CitaKiosco[]>(emps.map((e) => [e.id, []]));
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
  const sinConexion = isError && !sinPermiso;
  const cargando = isLoading && !sinConexion;
  // Sin nada cargado, esperar 30s no basta: se ofrece reintentar a mano.
  const nadaCargado = !data;
  const reintentando = isFetching;
  const reintentar = () => { refetch(); };
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
            {data?.nombreNegocio ?? "Mi Negocio"}
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

      {sinPermiso && (
        <div role="alert" className="px-6 py-2 bg-amber-500/15 border-b border-amber-400/30 text-sm text-amber-200 flex-shrink-0">
          {mensajeError(error, "Esta cuenta no puede ver la agenda de recepción.")}
        </div>
      )}

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
              {sinConexion || sinPermiso ? "No se pudo cargar la agenda de hoy." : "No hay empleados activos"}
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
          {revenue > 0 && data?.mostrarIngresos && (
            <span className="text-emerald-400/80">
              {formatPrecio(revenue)} generado
            </span>
          )}
        </div>
        <SalidaProtegida email={email} />
      </div>

    </div>
  );
}

// ── Salida protegida (decisión 3, DC-13, B9) ──────────────────────────────────
// Salir pide la contraseña de la cuenta con la que se abrió el modo recepción
// (y el código 2FA si la cuenta lo tiene). El control se mantiene pulsado 1.5 s
// (dedo, ratón, o Enter/Espacio con el botón enfocado) para que un cliente no lo
// active por accidente. El servidor limita los intentos sin tocar el bloqueo de
// la cuenta; su 429 dispara la cuenta atrás (ver `bloqueoSalidaKiosco.ts`).
function SalidaProtegida({ email }: { email: string }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [desafio2FA, setDesafio2FA] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(() => leerBloqueoSalida());
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
        setBloqueadoHasta(leerBloqueoSalida(ahora));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [bloqueadoHasta]);

  const cerrar = () => {
    setAbierto(false);
    setContrasena("");
    setDesafio2FA(null);
    setCodigo("");
    setError("");
  };

  const volverAlPanel = (respuesta: LoginRespuesta) => {
    limpiarBloqueoSalida();
    restaurarSesion(respuesta);
    navigate("/dashboard/citas");
  };

  const bloquear = (esperaMs: number) => {
    const ahora = Date.now();
    setAhoraMs(ahora);
    setBloqueadoHasta(registrarBloqueoSalida(esperaMs, ahora));
  };

  const enviarContrasena = async () => {
    const resultado = await salirDelKiosco(contrasena);
    if (resultado.tipo === "sesion") {
      volverAlPanel(resultado.respuesta);
      return;
    }
    setContrasena("");
    if (resultado.tipo === "requiere2FA") {
      setDesafio2FA(resultado.challengeToken);
    } else if (resultado.tipo === "bloqueada") {
      bloquear(resultado.esperaMs);
    } else {
      const quedan = resultado.intentosRestantes;
      const aviso = quedan === null ? "" : ` ${quedan === 1 ? "Queda 1 intento" : `Quedan ${quedan} intentos`} antes de bloquear la salida unos minutos.`;
      setError(`Contraseña incorrecta.${aviso}`);
    }
  };

  const enviarCodigo = async (challengeToken: string) => {
    try {
      volverAlPanel(await completarSalida2FA(challengeToken, codigo.trim()));
    } catch (err) {
      setCodigo("");
      const estado = isAxiosError(err) ? err.response?.status : undefined;
      if (estado === 401) setError("Código incorrecto o expirado.");
      else if (estado === 429) setError("Demasiados intentos con el código. Espera unos minutos.");
      else throw err;
    }
  };

  const faltaDato = desafio2FA ? !codigo.trim() : !contrasena;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (faltaDato || verificando || bloqueado) return;
    setVerificando(true);
    setError("");
    try {
      if (desafio2FA) await enviarCodigo(desafio2FA);
      else await enviarContrasena();
    } catch (err) {
      setError(mensajeError(err, "No se pudo verificar. Intenta de nuevo."));
    } finally {
      setVerificando(false);
    }
  };

  const claseCampo = "w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40";

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
            {desafio2FA
              ? "Escribe el código de 6 dígitos de tu app de autenticación."
              : <>Escribe la contraseña de <strong className="text-foreground">{email}</strong> para volver al panel.</>}
          </p>
          {bloqueado && (
            <p id={idBloqueo} role="alert" className="rounded-lg border border-status-pending-dot bg-status-pending-bg px-3 py-2 text-sm text-status-pending-fg">
              {"Demasiados intentos incorrectos. Podrás volver a intentarlo en "}
              <span className="font-semibold tabular-nums">{formatoCuentaAtras(restanteMs)}</span>.
            </p>
          )}
          {desafio2FA ? (
            <div>
              <label htmlFor="kiosko-codigo" className="block text-sm font-medium text-foreground mb-1">
                Código de verificación
              </label>
              <input
                id="kiosko-codigo"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
                value={codigo}
                onChange={(e) => { setCodigo(e.target.value); setError(""); }}
                aria-invalid={!!error}
                aria-describedby={error ? idError : undefined}
                className={`${claseCampo} tabular-nums`}
              />
            </div>
          ) : (
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
                className={claseCampo}
              />
            </div>
          )}
          {error && (
            <p id={idError} role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-400">{error}</p>
          )}
          <ModalAcciones>
            <button
              type="button"
              onClick={cerrar}
              className={BOTON_MODAL_SECUNDARIO}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={faltaDato || verificando || bloqueado}
              className={BOTON_MODAL_PRIMARIO}
            >
              {verificando ? "Verificando…" : "Salir"}
            </button>
          </ModalAcciones>
        </form>
      </Modal>
    </>
  );
}
