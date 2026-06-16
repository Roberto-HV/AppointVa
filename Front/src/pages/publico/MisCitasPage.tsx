import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/axios";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import type { SlotDisponible } from "../../types";

const TAMANO = 10;
const SESSION_KEY = "mcs_session";

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

const ESTADO_ESTILOS: Record<string, string> = {
  Pendiente:    "bg-yellow-100 text-yellow-700",
  Confirmada:   "bg-green-100 text-green-700",
  Completada:   "bg-blue-100 text-blue-700",
  Cancelada:    "bg-red-100 text-red-600",
  Inasistencia: "bg-gray-100 text-gray-500",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
}

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default function MisCitasPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Session recordada en localStorage
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

  // Estado reagendar
  const [reagendando, setReagendando] = useState<MiCita | null>(null);
  const [slotNuevo, setSlotNuevo] = useState<SlotDisponible | null>(null);
  const [guardandoReagenda, setGuardandoReagenda] = useState(false);
  const [errorReagenda, setErrorReagenda] = useState("");
  const [exitoReagenda, setExitoReagenda] = useState("");

  // Auto-buscar si hay sesión guardada
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
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo cancelar la cita.";
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
      setExitoReagenda("¡Cita reagendada! Recibirás un correo de confirmación.");
      qc.invalidateQueries({ queryKey: ["mis-citas", slug, buscado.email, buscado.telefono] });
      setTimeout(() => {
        setReagendando(null);
        setSlotNuevo(null);
        setExitoReagenda("");
      }, 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo reagendar la cita.";
      setErrorReagenda(msg);
    } finally {
      setGuardandoReagenda(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xl mb-3">
            A
          </div>
          <h1 className="text-xl font-bold text-gray-900">Mis citas</h1>
          {buscado ? (
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-sm text-gray-500">{buscado.email}</p>
              <button onClick={cerrarSesion} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Cambiar
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Ingresa tu email y teléfono para ver tus reservas</p>
          )}
        </div>

        {/* Formulario (solo si no hay sesión activa) */}
        {!buscado && (
          <form onSubmit={buscar} className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="10 dígitos"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={!email.trim() || !telefono.trim() || isLoading}
              className="w-full py-2 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition"
            >
              {isLoading ? "Buscando..." : "Ver mis citas"}
            </button>
          </form>
        )}

        {/* Resultados */}
        {buscado && (
          <>
            {isLoading && (
              <p className="text-center text-gray-400 text-sm py-4">Buscando citas...</p>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-600">
                No se pudo buscar las citas. Verifica tu email e intenta de nuevo.
              </div>
            )}

            {!isLoading && !error && citas && citas.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                <p className="text-gray-400 text-sm">No encontramos citas para este correo.</p>
                <Link
                  to={`/b/${slug}`}
                  className="inline-block mt-4 text-sm text-primary font-semibold hover:underline"
                >
                  Hacer una reserva →
                </Link>
              </div>
            )}

            {!isLoading && citas && citas.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide px-1">
                  {total} cita{total !== 1 ? "s" : ""} encontrada{total !== 1 ? "s" : ""}
                  {totalPaginas > 1 && ` — página ${pagina} de ${totalPaginas}`}
                </p>
                {citas.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{c.nombreServicio}</p>
                        <p className="text-xs text-gray-500 mt-0.5">con {c.nombreEmpleado}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${ESTADO_ESTILOS[c.estadoTexto] ?? "bg-gray-100 text-gray-500"}`}>
                        {c.estadoTexto}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="capitalize">{formatFecha(c.inicioEn)}</span>
                      <span className="font-semibold text-gray-800">{formatPrecio(c.precio)}</span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                        {c.codigoConfirmacion}
                      </span>
                      <div className="flex items-center gap-3">
                        {(c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada") && (
                          <>
                            <button
                              onClick={() => { setReagendando(c); setSlotNuevo(null); setErrorReagenda(""); }}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium transition"
                            >
                              Reagendar
                            </button>
                            <button
                              onClick={() => cancelarCita(c.codigoConfirmacion)}
                              disabled={cancelando === c.codigoConfirmacion}
                              className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-40 transition"
                            >
                              {cancelando === c.codigoConfirmacion ? "Cancelando..." : "Cancelar"}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/cita/${c.codigoConfirmacion}`)}
                          className="text-xs text-primary font-semibold hover:underline"
                        >
                          Ver detalles →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {errorCancelacion && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
                    {errorCancelacion}
                  </div>
                )}

                {/* Paginación */}
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={pagina === 1 || isLoading}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      ← Anterior
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
                          <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                        ) : (
                          <button
                            key={item}
                            onClick={() => setPagina(item as number)}
                            disabled={isLoading}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                              pagina === item
                                ? "bg-primary text-white"
                                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      disabled={pagina === totalPaginas || isLoading}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}

                <div className="text-center pt-2">
                  <Link
                    to={`/b/${slug}`}
                    className="text-sm text-primary font-semibold hover:underline"
                  >
                    + Nueva reserva
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal reagendar */}
      {reagendando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Reagendar cita</h2>
                <p className="text-xs text-gray-400 mt-0.5">{reagendando.nombreServicio} · {reagendando.nombreEmpleado}</p>
              </div>
              <button
                onClick={() => { setReagendando(null); setSlotNuevo(null); setErrorReagenda(""); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              {exitoReagenda ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-green-700 font-semibold text-sm">{exitoReagenda}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">Selecciona la nueva fecha y hora para tu cita:</p>

                  <PasoFechaHora
                    servicioId={reagendando.servicioId}
                    empleadoId={reagendando.empleadoId}
                    seleccionado={slotNuevo}
                    onSeleccionar={setSlotNuevo}
                  />

                  {errorReagenda && (
                    <p className="mt-3 text-sm text-red-600 text-center">{errorReagenda}</p>
                  )}

                  <button
                    onClick={confirmarReagenda}
                    disabled={!slotNuevo || guardandoReagenda}
                    className="mt-5 w-full bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
                  >
                    {guardandoReagenda ? "Guardando..." : "Confirmar nuevo horario"}
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
