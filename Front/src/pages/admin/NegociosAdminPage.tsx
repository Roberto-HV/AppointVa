import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, Printer } from "lucide-react";
import {
  adminApi,
  type NegocioMetricasDto,
  type PlanDto,
  type SuscripcionResumenDto,
  type PagoSuscripcionDto,
} from "../../api/admin";
import Modal from "../../components/ui/Modal";
import BarraProgreso from "../../components/ui/BarraProgreso";
import { useToastStore } from "../../store/toastStore";
import { formatPrecio } from "../../utils/formatters";

// ── Schemas ────────────────────────────────────────────────────────────────
const schemaNegocio = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  slug: z
    .string()
    .min(2, "Slug requerido")
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  descripcion: z.string().optional(),
  planId: z.string().optional(),
});
type NegocioForm = z.infer<typeof schemaNegocio>;

const schemaPropietario = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  apellido: z.string().default(""),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type PropietarioForm = z.infer<typeof schemaPropietario>;

// ── Helpers ────────────────────────────────────────────────────────────────
function formatFechaMx(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function generarHTMLComprobante(pago: PagoSuscripcionDto): string {
  const mesesLabel = pago.mesesPagados >= 600 ? "De por vida" : pago.mesesPagados === 1 ? "1 mes" : `${pago.mesesPagados} meses`;
  const folio = `PAGO-${String(pago.numeroPago).padStart(3, "0")}`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Comprobante ${folio}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;padding:48px;max-width:520px;margin:0 auto;}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;}
  .logo span{color:#C8A961;}
  .subtitle{font-size:12px;color:#6b7280;margin-bottom:32px;}
  h2{font-size:15px;font-weight:700;color:#111;margin:0 0 20px;}
  .folio{display:inline-block;background:#f3f4f6;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;font-family:monospace;margin-bottom:24px;}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row .label{color:#6b7280;}
  .row .value{font-weight:600;color:#111;}
  .monto{font-size:22px;font-weight:800;color:#C8A961;text-align:center;margin:24px 0 8px;}
  .footer{margin-top:40px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #f3f4f6;padding-top:16px;}
  @media print{body{padding:24px;}}
</style></head><body>
<div class="logo">Appoint<span>Va</span></div>
<div class="subtitle">Sistema de reservas · appointva.com</div>
<div class="folio">${folio}</div>
<h2>Comprobante de pago de suscripción</h2>
<div class="monto">$${pago.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN</div>
<div class="row"><span class="label">Negocio</span><span class="value">${pago.negocioNombre}</span></div>
<div class="row"><span class="label">Período pagado</span><span class="value">${formatFechaMx(pago.periodoDesde)} – ${formatFechaMx(pago.periodoHasta)}</span></div>
<div class="row"><span class="label">Meses pagados</span><span class="value">${mesesLabel}</span></div>
<div class="row"><span class="label">Fecha de pago</span><span class="value">${formatFechaMx(pago.fechaPago)}</span></div>
${pago.notas ? `<div class="row"><span class="label">Notas</span><span class="value">${pago.notas}</span></div>` : ""}
<div class="row"><span class="label">Registrado por</span><span class="value">${pago.registradoPorEmail}</span></div>
<div class="footer">AppointVa © ${new Date().getFullYear()} · hola@appointva.com · Documento generado el ${formatFechaMx(new Date().toISOString())}</div>
</body></html>`;
}

function imprimirComprobante(pago: PagoSuscripcionDto) {
  const w = window.open("", "_blank", "width=640,height=820");
  if (!w) return;
  w.document.write(generarHTMLComprobante(pago));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── BadgeSuscripcion ───────────────────────────────────────────────────────
function BadgeSuscripcion({ estado, dias }: { estado: SuscripcionResumenDto["estado"]; dias: number | null }) {
  if (estado === "Activa") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
        <CheckCircle size={10} /> Activa {dias !== null && `· ${dias}d`}
      </span>
    );
  }
  if (estado === "PorVencer") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
        <AlertTriangle size={10} /> Vence en {dias}d
      </span>
    );
  }
  if (estado === "Vencida") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
        <XCircle size={10} /> Vencida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      <Clock size={10} /> Sin suscripción
    </span>
  );
}


// ── ModalSuscripcion ───────────────────────────────────────────────────────
function ModalSuscripcion({
  negocio,
  suscripcion,
  onCerrar,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [meses, setMeses] = useState(1);
  const [monto, setMonto] = useState("249");
  const [notas, setNotas] = useState("");

  const PRECIO_MES = 249;
  const PRECIO_ANUAL = 2490;

  const { data: historial = [], isLoading: cargandoHistorial } = useQuery({
    queryKey: ["pagos-negocio", negocio.id],
    queryFn: () => adminApi.obtenerPagos(negocio.id),
  });

  const { mutate: registrar, isPending: registrando } = useMutation({
    mutationFn: () =>
      adminApi.registrarPago(negocio.id, {
        mesesPagados: meses,
        monto: parseFloat(monto) || 0,
        notas: notas.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagos-negocio", negocio.id] });
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      setNotas("");
      toast("Pago registrado correctamente");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string; title?: string } } })?.response?.data?.mensaje
        ?? (err as { response?: { data?: { title?: string } } })?.response?.data?.title
        ?? "No se pudo registrar el pago.";
      toast(msg, "error");
    },
  });

  const LIFETIME = 1200;

  const handleMesesChange = (val: number) => {
    setMeses(val);
    if (val === LIFETIME) {
      setMonto("0");
    } else {
      setMonto(val === 12 ? String(PRECIO_ANUAL) : String(PRECIO_MES * val));
    }
  };

  const estado = suscripcion?.estado ?? "SinSuscripcion";
  const vencimiento = suscripcion?.fechaVencimiento;

  return (
    <div className="space-y-5">
      {/* Estado actual */}
      <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Estado de suscripción</p>
          <BadgeSuscripcion estado={estado} dias={suscripcion?.diasRestantes ?? null} />
        </div>
        {vencimiento && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Vence</p>
            <p className="text-sm font-semibold text-gray-800">{formatFechaMx(vencimiento)}</p>
          </div>
        )}
      </div>

      {/* Formulario de pago */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Registrar nuevo pago</p>

        {/* Selector de meses */}
        <div className="flex gap-2 mb-2">
          {[1, 3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => handleMesesChange(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${
                meses === m
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {m === 12 ? "1 año" : `${m} mes${m > 1 ? "es" : ""}`}
            </button>
          ))}
        </div>
        <button
          onClick={() => handleMesesChange(LIFETIME)}
          className={`w-full py-2 rounded-lg text-xs font-bold border transition mb-3 ${
            meses === LIFETIME
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
          }`}
        >
          ♾ De por vida
        </button>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto (MXN)</label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              min={0}
              step={0.01}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 font-variant-numeric"
            />
            {meses === 12 && (
              <p className="text-[10px] text-emerald-600 mt-1 font-medium">2 meses gratis vs precio mensual</p>
            )}
            {meses === LIFETIME && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">Acceso permanente — sin vencimiento</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Método / Notas</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Efectivo, transferencia…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
            />
          </div>
        </div>

        <button
          onClick={() => registrar()}
          disabled={registrando || !monto}
          className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
        >
          {registrando
            ? "Registrando..."
            : meses === LIFETIME
            ? "Registrar acceso de por vida"
            : `Registrar pago · $${parseFloat(monto || "0").toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`}
        </button>
      </div>

      {/* Historial */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Historial de pagos</p>
        {cargandoHistorial ? (
          <p className="text-xs text-gray-400 py-4 text-center">Cargando historial…</p>
        ) : historial.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">Sin pagos registrados</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {historial.map((pago) => (
              <div key={pago.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      #{String(pago.numeroPago).padStart(3, "0")}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">
                      ${pago.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                    </span>
                    <span className="text-[10px] text-gray-400">
                      · {pago.mesesPagados >= 600 ? "♾ De por vida" : pago.mesesPagados === 1 ? "1 mes" : `${pago.mesesPagados} meses`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {formatFechaMx(pago.periodoDesde)} – {formatFechaMx(pago.periodoHasta)}
                    {pago.notas && <span className="ml-2 text-gray-400">· {pago.notas}</span>}
                  </p>
                </div>
                <button
                  onClick={() => imprimirComprobante(pago)}
                  title="Imprimir comprobante"
                  className="text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <Printer size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onCerrar}
        className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
      >
        Cerrar
      </button>
    </div>
  );
}

// ── TarjetaNegocio ─────────────────────────────────────────────────────────
function TarjetaNegocio({
  negocio,
  suscripcion,
  onActivar,
  onDesactivar,
  onCrearPropietario,
  onColores,
  onSuscripcion,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  onActivar: () => void;
  onDesactivar: () => void;
  onCrearPropietario: () => void;
  onColores: () => void;
  onSuscripcion: () => void;
}) {
  const esActivo = negocio.activo === 1;
  const iniciales = negocio.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
          {negocio.logoUrl ? (
            <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-slate-600">{iniciales}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{negocio.nombre}</p>
          <p className="text-xs text-gray-400 truncate">{negocio.slug}</p>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            esActivo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {esActivo ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Plan + suscripción */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
          {negocio.planNombre ?? "Sin plan"}
        </span>
        {suscripcion && (
          <BadgeSuscripcion estado={suscripcion.estado} dias={suscripcion.diasRestantes} />
        )}
      </div>

      {/* Métricas */}
      <div className="px-4 pb-4 flex-1">
        {negocio.maxCitasMes > 0 && (
          <BarraProgreso valor={negocio.citasMes} maximo={negocio.maxCitasMes} label="Citas este mes" />
        )}
        {negocio.maxEmpleados > 0 && (
          <BarraProgreso valor={negocio.empleadosActivos} maximo={negocio.maxEmpleados} label="Empleados" />
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-gray-400">Emails este mes:</span>
          <span
            className={`text-xs font-semibold ${
              negocio.emailsMes > 200 ? "text-red-600" : negocio.emailsMes > 100 ? "text-amber-600" : "text-gray-600"
            }`}
          >
            {negocio.emailsMes}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap gap-2">
        <button
          onClick={esActivo ? onDesactivar : onActivar}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
            esActivo
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {esActivo ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={onSuscripcion}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition inline-flex items-center gap-1"
        >
          <CreditCard size={11} /> Suscripción
        </button>
        <button
          onClick={onColores}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
        >
          Colores
        </button>
        <button
          onClick={onCrearPropietario}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
        >
          + Propietario
        </button>
        <a
          href={`/b/${negocio.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
        >
          Ver booking
        </a>
      </div>
    </div>
  );
}

// ── Page principal ─────────────────────────────────────────────────────────
export default function NegociosAdminPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [modalNegocio, setModalNegocio] = useState(false);
  const [modalPropietario, setModalPropietario] = useState(false);
  const [modalColores, setModalColores] = useState(false);
  const [modalSuscripcion, setModalSuscripcion] = useState(false);
  const [negocioSel, setNegocioSel] = useState<NegocioMetricasDto | null>(null);
  const [errorPropietario, setErrorPropietario] = useState("");
  const [mostrarPasswordProp, setMostrarPasswordProp] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#C8A961");
  const [colorSecundario, setColorSecundario] = useState("#a07830");

  const { data: metricas = [], isLoading } = useQuery({
    queryKey: ["admin-negocios-metricas"],
    queryFn: adminApi.obtenerMetricas,
    staleTime: 1000 * 60 * 2,
  });

  const { data: suscripciones = [] } = useQuery({
    queryKey: ["admin-suscripciones"],
    queryFn: adminApi.obtenerSuscripciones,
    staleTime: 1000 * 60,
  });

  const suscripcionMap = Object.fromEntries(suscripciones.map((s) => [s.negocioId, s]));

  const { data: planes = [] } = useQuery({
    queryKey: ["planes"],
    queryFn: adminApi.obtenerPlanes,
  });

  const formNegocio = useForm<NegocioForm>({ resolver: zodResolver(schemaNegocio) });
  const formPropietario = useForm<PropietarioForm>({ resolver: zodResolver(schemaPropietario) as Resolver<PropietarioForm> });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
    qc.invalidateQueries({ queryKey: ["admin-negocios"] });
  };

  const { mutate: crearNegocio, isPending: creandoNegocio } = useMutation({
    mutationFn: (d: NegocioForm) =>
      adminApi.crearNegocio({
        ...d,
        email: d.email || undefined,
        planId: d.planId || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setModalNegocio(false);
      formNegocio.reset();
      toast("Negocio creado correctamente");
    },
  });

  const { mutate: activar } = useMutation({
    mutationFn: (id: string) => adminApi.activar(id),
    onSuccess: invalidar,
  });

  const { mutate: desactivar } = useMutation({
    mutationFn: (id: string) => adminApi.desactivar(id),
    onSuccess: invalidar,
  });

  const { mutate: actualizarColores, isPending: guardandoColores } = useMutation({
    mutationFn: () =>
      adminApi.actualizarColores(negocioSel!.id, {
        colorPrimario: colorPrimario || undefined,
        colorSecundario: colorSecundario || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setModalColores(false);
      toast("Colores actualizados");
    },
  });

  const { mutate: crearPropietario, isPending: creandoPropietario } = useMutation({
    mutationFn: (d: PropietarioForm) =>
      adminApi.crearPropietario(negocioSel!.id, {
        email: d.email,
        password: d.password,
        nombre: d.nombre,
        apellido: d.apellido ?? "",
      }),
    onSuccess: () => {
      setModalPropietario(false);
      formPropietario.reset();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      setErrorPropietario(msg ?? "No se pudo crear el propietario.");
    },
  });

  const abrirColores = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setColorPrimario(neg.colorPrimario ?? "#C8A961");
    setColorSecundario(neg.colorSecundario ?? "#a07830");
    setModalColores(true);
  };

  const abrirPropietario = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setErrorPropietario("");
    formPropietario.reset({ nombre: "", apellido: "", email: "", password: "" });
    setModalPropietario(true);
  };

  const abrirSuscripcion = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setModalSuscripcion(true);
  };

  const metricasFiltradas = metricas.filter(
    (n) =>
      n.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.slug.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Negocios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{metricas.length} registrados en total</p>
        </div>
        <button
          onClick={() => { formNegocio.reset(); setModalNegocio(true); }}
          className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Nuevo negocio
        </button>
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar por nombre o slug..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full max-w-sm px-4 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 mb-6"
      />

      {/* Grid de tarjetas */}
      {isLoading ? (
        <p className="text-gray-400">Cargando negocios...</p>
      ) : metricasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400">
            {busqueda ? "Sin resultados para esa búsqueda" : "No hay negocios registrados"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {metricasFiltradas.map((neg) => (
            <TarjetaNegocio
              key={neg.id}
              negocio={neg}
              suscripcion={suscripcionMap[neg.id]}
              onActivar={() => activar(neg.id)}
              onDesactivar={() => desactivar(neg.id)}
              onCrearPropietario={() => abrirPropietario(neg)}
              onColores={() => abrirColores(neg)}
              onSuscripcion={() => abrirSuscripcion(neg)}
            />
          ))}
        </div>
      )}

      {/* Modal: suscripción */}
      <Modal
        abierto={modalSuscripcion}
        onCerrar={() => setModalSuscripcion(false)}
        titulo={`Suscripción — ${negocioSel?.nombre ?? ""}`}
        ancho="sm"
      >
        {negocioSel && (
          <ModalSuscripcion
            negocio={negocioSel}
            suscripcion={suscripcionMap[negocioSel.id]}
            onCerrar={() => setModalSuscripcion(false)}
          />
        )}
      </Modal>

      {/* Modal: nuevo negocio */}
      <Modal abierto={modalNegocio} onCerrar={() => setModalNegocio(false)} titulo="Nuevo negocio">
        <form onSubmit={formNegocio.handleSubmit((d) => crearNegocio(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              {...formNegocio.register("nombre")}
              placeholder="Barbería Luis"
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${formNegocio.formState.errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formNegocio.formState.errors.nombre && (
              <p className="text-red-500 text-xs mt-1">{formNegocio.formState.errors.nombre.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *{" "}
              <span className="font-normal text-gray-400">
                (aparece en la URL: /b/<strong>slug</strong>)
              </span>
            </label>
            <input
              {...formNegocio.register("slug")}
              placeholder="barberia-luis"
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary font-mono
                ${formNegocio.formState.errors.slug ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formNegocio.formState.errors.slug && (
              <p className="text-red-500 text-xs mt-1">{formNegocio.formState.errors.slug.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                {...formNegocio.register("telefono")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                {...formNegocio.register("email")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <Select {...formNegocio.register("planId")} className="w-full">
              <option value="">Sin plan asignado</option>
              {planes.map((p: PlanDto) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatPrecio(p.precioMensual)}/mes · {p.maxEmpleados} empleados
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={2}
              {...formNegocio.register("descripcion")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={creandoNegocio}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {creandoNegocio ? "Creando..." : "Crear negocio"}
          </button>
        </form>
      </Modal>

      {/* Modal: crear propietario */}
      <Modal
        abierto={modalPropietario}
        onCerrar={() => setModalPropietario(false)}
        titulo="Crear propietario"
        ancho="sm"
      >
        <p className="text-sm text-gray-500 mb-4">
          Crea la cuenta de acceso para el propietario de{" "}
          <strong>{negocioSel?.nombre}</strong>.
        </p>
        <form onSubmit={formPropietario.handleSubmit((d) => crearPropietario(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...formPropietario.register("nombre")}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                  ${formPropietario.formState.errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              />
              {formPropietario.formState.errors.nombre && (
                <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.nombre.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                {...formPropietario.register("apellido")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo de acceso *</label>
            <input
              type="email"
              {...formPropietario.register("email")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${formPropietario.formState.errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formPropietario.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña inicial *</label>
            <div className="relative">
              <input
                type={mostrarPasswordProp ? "text" : "password"}
                {...formPropietario.register("password")}
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-primary
                  ${formPropietario.formState.errors.password ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMostrarPasswordProp((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {mostrarPasswordProp ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {formPropietario.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.password.message}</p>
            )}
          </div>
          {errorPropietario && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              {errorPropietario}
            </div>
          )}
          <button
            type="submit"
            disabled={creandoPropietario}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {creandoPropietario ? "Creando cuenta..." : "Crear propietario"}
          </button>
        </form>
      </Modal>

      {/* Modal: colores del negocio */}
      <Modal abierto={modalColores} onCerrar={() => setModalColores(false)} titulo="Colores del negocio" ancho="sm">
        {negocioSel && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Personaliza los colores del panel de{" "}
              <span className="font-semibold text-gray-800">{negocioSel.nombre}</span>.
            </p>
            <div className="space-y-4">
              {([
                { label: "Color primario", val: colorPrimario, set: setColorPrimario, ph: "#C8A961" },
                { label: "Color secundario", val: colorSecundario, set: setColorSecundario, ph: "#a07830" },
              ] as const).map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                  <div className="flex gap-3 items-center">
                    <input type="color" value={val} onChange={(e) => set(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200 p-0.5" />
                    <input type="text" value={val} onChange={(e) => set(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 font-mono uppercase"
                      maxLength={7} placeholder={ph} />
                    <div className="w-10 h-10 rounded-lg border border-gray-200 shrink-0" style={{ backgroundColor: val }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-gray-100 p-3 bg-gray-50">
              <p className="text-xs text-gray-400 mb-2">Vista previa</p>
              <div className="flex flex-col gap-1">
                {["Inicio", "Citas", "Empleados", "Servicios"].map((item, i) => (
                  <div key={item} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                    style={i === 0 ? { backgroundColor: colorPrimario, color: "#fff" } : { color: "#6b7280" }}>
                    <div className="w-4 h-4 rounded bg-current opacity-30" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalColores(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition">
                Cancelar
              </button>
              <button onClick={() => actualizarColores()} disabled={guardandoColores}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold transition">
                {guardandoColores ? "Guardando..." : "Guardar colores"}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
