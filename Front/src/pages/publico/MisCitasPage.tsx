import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/axios";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import type { SlotDisponible } from "../../types";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, X, CheckCircle2, LogOut } from "lucide-react";
import { formatPrecio, formatFechaHoraResumen as formatFecha } from "../../utils/formatters";
import PublicFooter from "../../components/PublicFooter";

const TAMANO = 10;
const SESSION_KEY = "mcs_session";
const API_URL = import.meta.env.VITE_API_URL as string;

interface MiCita {
  id: string;
  codigoConfirmacion: string;
  nombreNegocio: string;
  negocioSlug: string;
  nombreServicio: string;
  nombreEmpleado: string;
  servicioId: string;
  empleadoId: string;
  inicioEn: string;
  finEn: string;
  precio: number;
  estado: number;
  estadoTexto: string;
}

interface Session {
  email: string;
  telefono: string;
}

const ESTADO_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  Pendiente:    { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400" },
  Confirmada:   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  Completada:   { bg: "bg-slate-100", text: "text-slate-600",   dot: "bg-slate-400" },
  Cancelada:    { bg: "bg-red-50",    text: "text-red-600",     dot: "bg-red-400" },
  Inasistencia: { bg: "bg-slate-50",  text: "text-slate-500",   dot: "bg-slate-300" },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-300" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {estado}
    </span>
  );
}

function buildGoogleCalUrl(cita: MiCita): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const titulo = encodeURIComponent(`${cita.nombreServicio} — ${cita.nombreEmpleado}`);
  const detalles = encodeURIComponent(`Negocio: ${cita.nombreNegocio}\nCódigo: ${cita.codigoConfirmacion}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${fmt(new Date(cita.inicioEn))}/${fmt(new Date(cita.finEn))}&details=${detalles}`;
}

function getIcalUrl(cita: MiCita): string {
  return `${API_URL}/publico/citas/${cita.codigoConfirmacion}/ical`;
}

export default function MisCitasPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); }
    catch { return null; }
  });

  const [email, setEmail] = useState(session?.email ?? "");
  const [telefono, setTelefono] = useState(session?.telefono ?? "");
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [errorCancelacion, setErrorCancelacion] = useState("");
  const [buscado, setBuscado] = useState<Session | null>(session);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);

  const [reagendando, setReagendando] = useState<MiCita | null>(null);
  const [slotNuevo, setSlotNuevo] = useState<SlotDisponible | null>(null);
  const [guardandoReagenda, setGuardandoReagenda] = useState(false);
  const [errorReagenda, setErrorReagenda] = useState("");
  const [exitoReagenda, setExitoReagenda] = useState("");

  useEffect(() => {
    if (session && !buscado) setBuscado(session);
  }, []);

  const { data: citas, isLoading, error } = useQuery<MiCita[]>({
    queryKey: ["mis-citas", slug, buscado?.email, buscado?.telefono, pagina],
    queryFn: async () => {
      const { data, headers } = await api.get("/publico/mis-citas", {
        params: { slug, email: buscado!.email, telefono: buscado!.telefono, pagina, tamano: TAMANO },
      });
      setTotal(parseInt(headers["x-total-count"] ?? "0", 10));
      return data;
    },
    enabled: !!buscado && !!slug,
    retry: false,
  });

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO));

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !telefono.trim()) return;
    const s = { email: email.trim(), telefono: telefono.trim() };
    setPagina(1);
    setBuscado(s);
    setSession(s);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  };

  const cerrarSesion = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setBuscado(null);
    setEmail("");
    setTelefono("");
  };

  const cancelarCita = async (codigo: string) => {
    if (!buscado?.email) return;
    if (!confirm("¿Seguro que deseas cancelar esta cita? Esta acción no se puede deshacer.")) return;
    setCancelando(codigo);
    setErrorCancelacion("");
    try {
      await api.delete(`/publico/citas/${codigo}`, { params: { email: buscado.email } });
      qc.invalidateQueries({ queryKey: ["mis-citas", slug, buscado.email, buscado.telefono] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "No se pudo cancelar la cita.";
      setErrorCancelacion(msg);
    } finally {
      setCancelando(null);
    }
  };

  const confirmarReagenda = async () => {
    if (!reagendando || !slotNuevo || !buscado?.email) return;
    setGuardandoReagenda(true);
    setErrorReagenda("");
    try {
      await api.patch(
        `/publico/citas/${reagendando.codigoConfirmacion}/reagendar`,
        { inicioEn: slotNuevo.inicio },
        { params: { email: buscado.email } }
      );
      setExitoReagenda("¡Cita reagendada exitosamente!");
      qc.invalidateQueries({ queryKey: ["mis-citas", slug, buscado.email, buscado.telefono] });
      setTimeout(() => { setReagendando(null); setSlotNuevo(null); setExitoReagenda(""); }, 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "No se pudo reagendar la cita.";
      setErrorReagenda(msg);
    } finally {
      setGuardandoReagenda(false);
    }
  };

  const now = new Date();
  const proximas = (citas ?? []).filter(
    (c) => (c.estado === 1 || c.estado === 2) && new Date(c.inicioEn) >= now
  );
  const historial = (citas ?? []).filter(
    (c) => !((c.estado === 1 || c.estado === 2) && new Date(c.inicioEn) >= now)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                <CalendarDays size={18} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Mis citas</h1>
            </div>
            {buscado && (
              <button
                onClick={cerrarSesion}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
              >
                <LogOut size={13} />
                Cambiar cuenta
              </button>
            )}
          </div>
          {buscado ? (
            <p className="text-sm text-slate-500 ml-[52px]">{buscado.email}</p>
          ) : (
            <p className="text-sm text-slate-500 ml-[52px]">Ingresa tu correo y teléfono para ver tus reservas</p>
          )}
        </div>

        {/* Formulario de acceso */}
        {!buscado && (
          <form onSubmit={buscar} className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Teléfono
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="10 dígitos"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={!email.trim() || !telefono.trim() || isLoading}
              className="w-full py-3.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-bold rounded-2xl transition"
            >
              {isLoading ? "Buscando…" : "Ver mis citas"}
            </button>
          </form>
        )}

        {/* Resultados */}
        {buscado && (
          <>
            {isLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-sm text-red-600">
                No se pudo buscar las citas. Verifica tu información e intenta de nuevo.
              </div>
            )}

            {!isLoading && !error && citas && citas.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-sm">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CalendarDays size={20} className="text-slate-400" />
                </div>
                <p className="text-slate-700 font-semibold text-sm mb-1">Sin citas registradas</p>
                <p className="text-slate-400 text-xs mb-5">No encontramos reservas asociadas a este correo.</p>
                <Link
                  to={`/b/${slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 px-5 py-2.5 rounded-xl transition"
                >
                  + Nueva reserva
                </Link>
              </div>
            )}

            {!isLoading && citas && citas.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    {total} cita{total !== 1 ? "s" : ""}
                    {totalPaginas > 1 && ` — p. ${pagina}/${totalPaginas}`}
                  </p>
                  <Link to={`/b/${slug}`} className="text-xs font-semibold text-slate-700 hover:underline">
                    + Nueva reserva
                  </Link>
                </div>

                {/* Próximas */}
                {proximas.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-1 mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Próximas</span>
                      <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{proximas.length}</span>
                    </div>
                    {proximas.map((c) => (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm">{c.nombreServicio}</p>
                            <p className="text-xs text-slate-400 mt-0.5">con {c.nombreEmpleado}</p>
                          </div>
                          <EstadoBadge estado={c.estadoTexto} />
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">{formatFecha(c.inicioEn)}</p>
                          <p className="text-sm font-bold text-slate-800">{formatPrecio(c.precio)}</p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg tracking-wider">
                            {c.codigoConfirmacion}
                          </span>
                          <div className="flex items-center gap-3">
                            {(c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada") && (
                              <>
                                <button
                                  onClick={() => { setReagendando(c); setSlotNuevo(null); setErrorReagenda(""); }}
                                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                                >
                                  Reagendar
                                </button>
                                <button
                                  onClick={() => cancelarCita(c.codigoConfirmacion)}
                                  disabled={cancelando === c.codigoConfirmacion}
                                  className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-40 transition"
                                >
                                  {cancelando === c.codigoConfirmacion ? "Cancelando…" : "Cancelar"}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() =>
                                navigate(`/b/${c.negocioSlug}?servicioId=${c.servicioId}&empleadoId=${c.empleadoId}`)
                              }
                              className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition"
                            >
                              Repetir
                            </button>
                            <button
                              onClick={() => navigate(`/cita/${c.codigoConfirmacion}`)}
                              className="text-xs font-bold text-slate-700 hover:underline"
                            >
                              Ver →
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          <a
                            href={buildGoogleCalUrl(c)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition"
                          >
                            <CalendarPlus size={12} />
                            Google Calendar
                          </a>
                          <a
                            href={getIcalUrl(c)}
                            download
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition"
                          >
                            <ExternalLink size={12} />
                            iCal / Apple
                          </a>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Divider */}
                {proximas.length > 0 && historial.length > 0 && (
                  <div className="border-t border-slate-100 my-4" />
                )}

                {/* Historial */}
                {historial.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-1 mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Historial</span>
                      <span className="text-xs bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">{historial.length}</span>
                    </div>
                    {historial.map((c) => (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm">{c.nombreServicio}</p>
                            <p className="text-xs text-slate-400 mt-0.5">con {c.nombreEmpleado}</p>
                          </div>
                          <EstadoBadge estado={c.estadoTexto} />
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">{formatFecha(c.inicioEn)}</p>
                          <p className="text-sm font-bold text-slate-800">{formatPrecio(c.precio)}</p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg tracking-wider">
                            {c.codigoConfirmacion}
                          </span>
                          <div className="flex items-center gap-3">
                            {(c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada") && new Date(c.inicioEn) >= now && (
                              <>
                                <button
                                  onClick={() => { setReagendando(c); setSlotNuevo(null); setErrorReagenda(""); }}
                                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                                >
                                  Reagendar
                                </button>
                                <button
                                  onClick={() => cancelarCita(c.codigoConfirmacion)}
                                  disabled={cancelando === c.codigoConfirmacion}
                                  className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-40 transition"
                                >
                                  {cancelando === c.codigoConfirmacion ? "Cancelando…" : "Cancelar"}
                                </button>
                              </>
                            )}
                            <button
                              onClick={() =>
                                navigate(`/b/${c.negocioSlug}?servicioId=${c.servicioId}&empleadoId=${c.empleadoId}`)
                              }
                              className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition"
                            >
                              Repetir
                            </button>
                            {c.estadoTexto === "Completada" && (
                              <button
                                onClick={() => navigate(`/cita/${c.codigoConfirmacion}`)}
                                className="text-xs font-semibold text-amber-500 hover:text-amber-700 transition"
                              >
                                Reseña →
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/cita/${c.codigoConfirmacion}`)}
                              className="text-xs font-bold text-slate-700 hover:underline"
                            >
                              Ver →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {errorCancelacion && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 text-center">
                    {errorCancelacion}
                  </div>
                )}

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    <button
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={pagina === 1 || isLoading}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
                      .reduce<(number | "...")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === "..." ? (
                          <span key={`dots-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setPagina(item as number)}
                            disabled={isLoading}
                            className={`w-9 h-9 rounded-xl text-sm font-semibold transition ${
                              pagina === item
                                ? "bg-slate-700 text-white shadow-sm"
                                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      disabled={pagina === totalPaginas || isLoading}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        <PublicFooter />
      </div>

      {/* Modal reagendar — bottom sheet en mobile */}
      {reagendando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Reagendar cita</h2>
                <p className="text-xs text-slate-400 mt-0.5">{reagendando.nombreServicio} · {reagendando.nombreEmpleado}</p>
              </div>
              <button
                onClick={() => { setReagendando(null); setSlotNuevo(null); setErrorReagenda(""); }}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5">
              {exitoReagenda ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <CheckCircle2 size={48} className="text-emerald-500" />
                  <p className="text-slate-800 font-semibold">{exitoReagenda}</p>
                </div>
              ) : (
                <>
                  <PasoFechaHora
                    servicioId={reagendando.servicioId}
                    empleadoId={reagendando.empleadoId}
                    seleccionado={slotNuevo}
                    onSeleccionar={setSlotNuevo}
                  />

                  {errorReagenda && (
                    <p className="mt-3 text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                      {errorReagenda}
                    </p>
                  )}

                  <button
                    onClick={confirmarReagenda}
                    disabled={!slotNuevo || guardandoReagenda}
                    className="mt-5 w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition text-sm"
                  >
                    {guardandoReagenda ? "Guardando…" : "Confirmar nuevo horario"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
