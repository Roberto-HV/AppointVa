import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Clock, CheckCircle2, Circle } from "lucide-react";
import { citasApi, METODOS_PAGO } from "../../api/citas";
import { pagosApi } from "../../api/pagos";
import { negociosApi } from "../../api/negocios";
import { useAuthStore } from "../../store/authStore";
import Modal from "../../components/ui/Modal";
import TicketRecibo from "../../components/dashboard/TicketRecibo";
import type { CitaDto } from "../../types";

type FiltroEstadoPago = "todas" | "pendientes" | "pagadas";
type FiltroPeriodo = "hoy" | "semana" | "mes";

const hoy = () => new Date().toISOString().slice(0, 10);
const inicioSemana = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
};
const finSemana = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
  return d.toISOString().slice(0, 10);
};
const inicioMes = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const finMes = () =>
  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

const PERIODOS: { key: FiltroPeriodo; label: string; desde: () => string; hasta: () => string }[] =
  [
    { key: "hoy", label: "Hoy", desde: hoy, hasta: hoy },
    { key: "semana", label: "Semana", desde: inicioSemana, hasta: finSemana },
    { key: "mes", label: "Mes", desde: inicioMes, hasta: finMes },
  ];

const METODO_ICONO: Record<string, string> = {
  Efectivo: "💵",
  Tarjeta: "💳",
  Transferencia: "🏦",
};

export default function PagosPage() {
  const qc = useQueryClient();
  const { usuario } = useAuthStore();
  const esEmpleado = usuario?.rol === "Empleado";

  const [periodo, setPeriodo] = useState<FiltroPeriodo>("hoy");
  const [filtroPago, setFiltroPago] = useState<FiltroEstadoPago>("pendientes");
  const [citaSel, setCitaSel] = useState<CitaDto | null>(null);
  const [metodoPago, setMetodoPago] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [citaPagada, setCitaPagada] = useState<CitaDto | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const periodoActivo = PERIODOS.find((p) => p.key === periodo)!;

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pagina, isLoading } = useQuery({
    queryKey: ["citas-pagos", periodo],
    queryFn: () =>
      citasApi.obtenerTodas({
        desde: periodoActivo.desde(),
        hasta: periodoActivo.hasta(),
        pagina: 1,
        tamano: 200,
      }),
  });

  const citas = useMemo(() => {
    const todas = pagina?.datos ?? [];
    if (filtroPago === "pendientes") return todas.filter((c) => !c.pagada);
    if (filtroPago === "pagadas") return todas.filter((c) => c.pagada);
    return todas;
  }, [pagina, filtroPago]);

  const mutPagar = useMutation({
    mutationFn: (payload: { id: string; montoRec: number }) =>
      pagosApi.registrar(payload.id, {
        pagada: true,
        metodoPago,
        montoCobrado: citaSel?.precio,
        montoRecibido: metodoPago === "Efectivo" ? payload.montoRec : undefined,
        cambio:
          metodoPago === "Efectivo" && payload.montoRec > (citaSel?.precio ?? 0)
            ? payload.montoRec - (citaSel?.precio ?? 0)
            : undefined,
      }),
    onSuccess: (citaActualizada) => {
      qc.invalidateQueries({ queryKey: ["citas-pagos"] });
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaSel(null);
      setMetodoPago("");
      setMontoRecibido("");
      setCitaPagada(citaActualizada);
    },
  });

  const cambio =
    metodoPago === "Efectivo" && montoRecibido && citaSel
      ? parseFloat(montoRecibido) - citaSel.precio
      : null;

  const puedeConfirmar =
    metodoPago !== "" &&
    (metodoPago !== "Efectivo" ||
      parseFloat(montoRecibido || "0") >= (citaSel?.precio ?? 0));

  const handleConfirmar = () => {
    if (!citaSel) return;
    mutPagar.mutate({ id: citaSel.id, montoRec: parseFloat(montoRecibido || "0") });
  };

  const handleEnviarEmail = async () => {
    if (!citaPagada) return;
    setEnviandoEmail(true);
    try {
      await pagosApi.enviarTicketEmail(citaPagada.id);
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Registro de pagos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {esEmpleado
            ? "Tus citas del período seleccionado"
            : "Citas del período seleccionado"}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Período</p>
          <div className="flex gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                  periodo === p.key
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Estado</p>
          <div className="flex gap-1">
            {(["pendientes", "todas", "pagadas"] as FiltroEstadoPago[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroPago(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition capitalize ${
                  filtroPago === f
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                }`}
              >
                {f === "pendientes" ? "Pendientes" : f === "pagadas" ? "Pagadas" : "Todas"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : citas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {filtroPago === "pendientes"
              ? "No hay citas pendientes de pago en este período"
              : "No hay citas en este período"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {citas.map((cita) => (
            <CitaCard
              key={cita.id}
              cita={cita}
              onCobrar={() => {
                setCitaSel(cita);
                setMetodoPago("");
                setMontoRecibido("");
              }}
            />
          ))}
        </div>
      )}

      {/* Modal: registrar pago */}
      <Modal
        abierto={!!citaSel}
        onCerrar={() => {
          setCitaSel(null);
          setMetodoPago("");
          setMontoRecibido("");
        }}
        titulo="Registrar pago"
        ancho="sm"
      >
        {citaSel && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {citaSel.nombreCliente}
              </p>
              <p className="text-gray-500 dark:text-gray-400">{citaSel.nombreServicio}</p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-2">
                ${citaSel.precio.toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Método de pago
              </p>
              <div className="grid grid-cols-3 gap-2">
                {METODOS_PAGO.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMetodoPago(m);
                      setMontoRecibido("");
                    }}
                    className={`py-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-1 transition ${
                      metodoPago === m
                        ? "bg-slate-700 text-white border-slate-700"
                        : "border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <span className="text-xl">{METODO_ICONO[m]}</span>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {metodoPago === "Efectivo" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Monto recibido
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={citaSel.precio}
                  placeholder="Monto recibido"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  className="mt-1 w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
                {cambio !== null && cambio >= 0 && (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    Cambio: <span className="font-bold">${cambio.toFixed(2)}</span>
                  </p>
                )}
                {cambio !== null && cambio < 0 && (
                  <p className="mt-2 text-sm text-red-500">
                    El monto recibido es menor al total
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleConfirmar}
              disabled={!puedeConfirmar || mutPagar.isPending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
            >
              {mutPagar.isPending ? "Procesando…" : "Confirmar pago"}
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: ticket de recibo */}
      <Modal
        abierto={!!citaPagada}
        onCerrar={() => setCitaPagada(null)}
        titulo="Pago registrado"
        ancho="sm"
      >
        {citaPagada && (
          <TicketRecibo
            cita={citaPagada}
            negocioNombre={negocio?.nombre ?? ""}
            onClose={() => setCitaPagada(null)}
            onEnviarEmail={handleEnviarEmail}
            enviandoEmail={enviandoEmail}
          />
        )}
      </Modal>
    </div>
  );
}

/* ── CitaCard ────────────────────────────────────────────────── */
function CitaCard({ cita, onCobrar }: { cita: CitaDto; onCobrar: () => void }) {
  const hora = cita.inicioEn
    ? new Date(cita.inicioEn).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      className={`bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3 shadow-sm ${
        cita.pagada
          ? "border-emerald-100 dark:border-emerald-900/40"
          : "border-gray-200 dark:border-slate-600"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {cita.nombreCliente}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {cita.nombreServicio}
          </p>
        </div>
        {cita.pagada ? (
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <Circle size={18} className="text-gray-300 dark:text-slate-600 shrink-0 mt-0.5" />
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {hora}
        </span>
        {cita.nombreEmpleado && <span className="truncate">{cita.nombreEmpleado}</span>}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
          ${cita.precio.toFixed(2)}
        </span>
        {cita.pagada ? (
          <span className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
            {cita.metodoPago ?? "Pagada"}
          </span>
        ) : (
          <button
            onClick={onCobrar}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition"
          >
            Cobrar
          </button>
        )}
      </div>
    </div>
  );
}
