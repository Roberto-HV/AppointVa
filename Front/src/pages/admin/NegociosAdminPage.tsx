import { useMemo, useState } from "react";
import { useDisponibilidadSlug } from "../../hooks/useDisponibilidadSlug";
import { useQuery, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, CreditCard, Clock, CheckCircle, XCircle, AlertTriangle, Printer, Pencil, Trash2, Palette, UserPlus, MailCheck, ExternalLink, Power } from "lucide-react";
import {
  adminApi,
  type NegocioMetricasDto,
  type PlanDto,
  type SuscripcionResumenDto,
  type PagoSuscripcionDto,
  type EditarPagoRequestDto,
} from "../../api/admin";
import Modal from "../../components/ui/Modal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import { esPendienteActivacion, ordenarNegociosAdmin, validarEdicionPago, esColorHexValido } from "../../utils/negociosAdmin";
import BarraProgreso from "../../components/ui/BarraProgreso";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import BotonAccion from "../../components/ui/BotonAccion";
import Tabs from "../../components/ui/Tabs";
import EmptyState from "../../components/ui/EmptyState";
import ErrorCarga from "../../components/ui/ErrorCarga";
import Pagination from "../../components/ui/Pagination";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import { useToastStore } from "../../store/toastStore";
import { formatFecha, formatFechaMx, formatPrecio } from "../../utils/formatters";
import { esClavePlan, NOMBRES_PLANES } from "../../lib/precios";
import { generarHTMLComprobante } from "../../utils/comprobanteSuscripcion";
import { mensajeError } from "../../utils/errores";
import { useTituloPagina } from "../../hooks/useTituloPagina";

// ── Constants ──────────────────────────────────────────────────────────────
const ESTADO_ORDER: Record<string, number> = {
  Vencida: 0, PorVencer: 1, Activa: 2, SinSuscripcion: 3
};

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  Activa: { label: 'Activa', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  PorVencer: { label: 'Por vencer', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  Vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SinSuscripcion: { label: 'Sin suscripción', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const PRECIO_EXTRA_EMP = 50;
const LIFETIME_SENTINEL = 1200;

/**
 * Umbral a partir del cual la vigencia deja de ser un dato y pasa a ser
 * "permanente".
 *
 * "De por vida" se registra como un pago de 1200 meses y el backend fija el
 * vencimiento en `periodoDesde.AddMonths(1200)`, es decir cien años. Por eso
 * `diasRestantes` llegaba al badge como 37160 y se pintaba "Activa · 37160d":
 * el dato es correcto, lo que no se sostiene es mostrarlo en días. Cincuenta
 * años deja margen de sobra sobre cualquier suscripción real sin acercarse al
 * centenar del centinela.
 */
const DIAS_DE_POR_VIDA = 365 * 50;

/**
 * Base de los botones de acción de la tarjeta de negocio.
 *
 * Mismo tratamiento que las acciones de Empleados: el tinte claro del borde es
 * también el relleno, no blanco. Con siete botones blancos de cinco colores de
 * borde distintos la tarjeta se leía como un semáforo; con el tinte, el color
 * informa sin gritar. El alto sigue el mínimo táctil de 44px y baja a 36px en
 * escritorio, igual que `BotonAccion`, `Tabs` y `Pagination`.
 */
const ACCION_TARJETA =
  "min-h-[44px] lg:min-h-[36px] px-2 rounded-md border text-xs font-medium " +
  "inline-flex items-center justify-center gap-1.5 text-center transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 " +
  "dark:focus-visible:ring-accent-brand/40 disabled:opacity-50 disabled:cursor-not-allowed";

/** Campo de texto de los modales: mismo alto táctil y mismo modo oscuro. */
const CAMPO_MODAL =
  "w-full min-h-[44px] px-3 py-2 rounded-lg border text-sm outline-none transition-colors " +
  "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 " +
  "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
  "focus:border-accent-brand dark:focus:border-accent-brand";
const CAMPO_OK = "border-slate-200 dark:border-slate-600";
/** Clave compartida por activar/desactivar, para saber qué tarjetas están en curso. */
const CLAVE_ESTADO_NEGOCIO = ["admin", "estado-negocio"] as const;
const CAMPO_ERROR = "border-red-400 bg-red-50 dark:bg-red-950/30";

/** Par de botones al pie de los modales. El primario es el mismo `slate-700`
 *  que `BotonAccion`, para que el panel no mantenga su propio negro. */
const BOTON_PIE =
  "flex-1 min-h-[44px] rounded-xl text-sm transition-colors disabled:opacity-50 " +
  "disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40";
const BOTON_PIE_SECUNDARIO =
  `${BOTON_PIE} border-2 font-medium border-slate-200 dark:border-slate-600 ` +
  "text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500";
const BOTON_PIE_PRIMARIO =
  `${BOTON_PIE} font-semibold bg-slate-700 hover:bg-slate-800 text-white ` +
  "dark:bg-slate-600 dark:hover:bg-slate-500";

/** Vigencia restante en la unidad que se pueda leer de un vistazo. */
function formatVigencia(dias: number): string {
  if (dias >= DIAS_DE_POR_VIDA) return "de por vida";
  if (dias >= 365) {
    const anios = Math.floor(dias / 365);
    return `${anios} año${anios === 1 ? "" : "s"}`;
  }
  if (dias >= 60) return `${Math.round(dias / 30)} meses`;
  return `${dias} d`;
}

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
function imprimirComprobante(pago: PagoSuscripcionDto) {
  const w = window.open("", "_blank", "width=640,height=820");
  if (!w) return;
  w.document.write(generarHTMLComprobante(pago));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── BadgeSuscripcion ───────────────────────────────────────────────────────
function BadgeSuscripcion({
  estado,
  dias,
  vence,
}: {
  estado: SuscripcionResumenDto["estado"];
  dias: number | null;
  /** Fecha de vencimiento ISO; alimenta el `title` con el dato exacto. */
  vence?: string | null;
}) {
  const titulo = vence ? `Vence el ${formatFechaMx(vence)}` : undefined;

  if (estado === "Activa") {
    const permanente = dias !== null && dias >= DIAS_DE_POR_VIDA;
    return (
      <span
        title={permanente ? "Acceso permanente — sin vencimiento" : titulo}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        <CheckCircle size={10} aria-hidden="true" />
        {permanente ? "De por vida" : `Activa${dias !== null ? ` · ${formatVigencia(dias)}` : ""}`}
      </span>
    );
  }
  if (estado === "PorVencer") {
    return (
      <span
        title={titulo}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <AlertTriangle size={10} aria-hidden="true" />
        {dias !== null && dias <= 0 ? "Vence hoy" : `Vence en ${dias} d`}
      </span>
    );
  }
  if (estado === "Vencida") {
    return (
      <span
        title={titulo}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
      >
        <XCircle size={10} aria-hidden="true" /> Vencida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      <Clock size={10} aria-hidden="true" /> Sin suscripción
    </span>
  );
}


// ── ModalSuscripcion ───────────────────────────────────────────────────────
function ModalSuscripcion({
  negocio,
  suscripcion,
  planes,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  planes: PlanDto[];
}) {
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ monto: "", notas: "", desde: "", hasta: "" });

  const [empleadosExtra, setEmpleadosExtra] = useState(suscripcion?.empleadosExtra ?? 0);
  const precioBase = suscripcion?.precioBase ?? 0;
  const totalMensual = precioBase + empleadosExtra * PRECIO_EXTRA_EMP;

  const [meses, setMeses] = useState(1);
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [tab, setTab] = useState<'cuenta' | 'pagos'>('cuenta');

  const { data: historial = [], isLoading: cargandoHistorial } = useQuery({
    queryKey: ["pagos-negocio", negocio.id],
    queryFn: () => adminApi.obtenerPagos(negocio.id),
  });

  const paginaHistorial = usePaginacionLocal(historial);

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
      setMonto("");
      setNotas("");
      toast("Pago registrado correctamente");
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, "No se pudo registrar el pago."), "error");
    },
  });

  const mutarEmpleadosExtra = useMutation({
    mutationFn: (val: number) => adminApi.setEmpleadosExtra(negocio.id, val),
    onSuccess: (_, val) => {
      qc.invalidateQueries({ queryKey: ['admin-suscripciones'] });
      toast(`Empleados extra actualizados: ${val}`);
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, "No se pudieron actualizar los empleados extra."), "error");
    },
  });

  // Solo se guarda al salir del campo si el valor cambió (antes se guardaba siempre, en silencio).
  const guardarEmpleadosExtra = (val: number) => {
    if (val === (suscripcion?.empleadosExtra ?? 0)) return;
    mutarEmpleadosExtra.mutate(val);
  };

  const mutarEditar = useMutation({
    mutationFn: ({ pagoId, dto }: { pagoId: string; dto: EditarPagoRequestDto }) =>
        adminApi.editarPago(pagoId, dto),
    onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["pagos-negocio", negocio.id] });
        qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
        setEditandoId(null);
        toast("Pago actualizado");
    },
    onError: (err: unknown) => toast(mensajeError(err, "No se pudo actualizar el pago"), "error"),
  });

  // Monto > 0 y período en orden, antes de enviar (AP-23).
  const errorEdicion = editandoId ? validarEdicionPago(editForm) : null;

  const mutarEliminar = useMutation({
    mutationFn: (pagoId: string) => adminApi.eliminarPago(pagoId),
    onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["pagos-negocio", negocio.id] });
        qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
        setConfirmandoEliminarId(null);
        toast("Pago eliminado");
    },
    onError: () => toast("No se pudo eliminar el pago", "error"),
  });

  const iniciarEdicion = (pago: PagoSuscripcionDto) => {
    setEditandoId(pago.id);
    setConfirmandoEliminarId(null);
    setEditForm({
        monto: String(pago.monto),
        notas: pago.notas ?? "",
        // El período es una fecha de calendario, no un instante: se recorta del
        // propio ISO. Pasar por `Date` y `toISOString()` reintroduce el desfase
        // de zona horaria que ya se corrigió dos veces en este repo.
        desde: pago.periodoDesde.slice(0, 10),
        hasta: pago.periodoHasta.slice(0, 10),
    });
  };

  // El sector cambia el vocabulario y los módulos del panel: se confirma (AP-23).
  const [sectorPorConfirmar, setSectorPorConfirmar] = useState<'belleza' | 'salud' | null>(null);
  const [guardandoSector, setGuardandoSector] = useState(false);
  const [guardandoPlan, setGuardandoPlan] = useState(false);

  const handleSetSector = async (sector: 'belleza' | 'salud') => {
    setGuardandoSector(true);
    try {
      await adminApi.setSector(negocio.id, sector);
      await qc.invalidateQueries({ queryKey: ['admin-suscripciones'] });
      toast(`Sector actualizado: ${sector === 'salud' ? 'Salud' : 'Belleza'}`);
      setSectorPorConfirmar(null);
    } catch (err) {
      toast(mensajeError(err, "No se pudo actualizar el sector. Intenta de nuevo."), "error");
    } finally {
      setGuardandoSector(false);
    }
  };

  const handleSetPlan = async (planId: string | null) => {
    if (guardandoPlan || planId === negocio.planId) return;
    setGuardandoPlan(true);
    try {
      await adminApi.setPlan(negocio.id, planId);
      await qc.invalidateQueries({ queryKey: ['admin-suscripciones'] });
      await qc.invalidateQueries({ queryKey: ['admin-negocios-metricas'] });
      const nombre = planes.find(p => p.id === planId)?.nombre;
      toast(nombre ? `Plan actualizado: ${nombre}` : "Plan actualizado");
    } catch (err) {
      toast(mensajeError(err, "No se pudo actualizar el plan. Intenta de nuevo."), "error");
    } finally {
      setGuardandoPlan(false);
    }
  };

  const handleMesesChange = (val: number) => {
    setMeses(val);
    if (val === LIFETIME_SENTINEL) {
      setMonto('');
    } else {
      setMonto(String(totalMensual * val));
    }
  };

  const estado = suscripcion?.estado ?? "SinSuscripcion";
  const vencimiento = suscripcion?.fechaVencimiento;
  const esPermanente = (suscripcion?.diasRestantes ?? 0) >= DIAS_DE_POR_VIDA;

  return (
    <div className="space-y-4">

      {/* ── Status header — always visible ── */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-1">Estado de suscripción</p>
          <BadgeSuscripcion
            estado={estado}
            dias={suscripcion?.diasRestantes ?? null}
            vence={vencimiento}
          />
        </div>
        {vencimiento && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Vence</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {esPermanente ? "Sin vencimiento" : formatFechaMx(vencimiento)}
            </p>
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <Tabs
        etiqueta="Secciones de la suscripción"
        valor={tab}
        onChange={setTab}
        opciones={[
          { id: 'cuenta', label: 'Cuenta' },
          { id: 'pagos', label: 'Pagos' },
        ]}
      />

      {/* ── Tab: Cuenta ── */}
      {tab === 'cuenta' && (
        <div className="space-y-4">
          {/* Plan selector */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Plan</p>
            <div className="flex gap-2 flex-wrap">
              {planes.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSetPlan(p.id)}
                  disabled={guardandoPlan}
                  aria-pressed={negocio.planId === p.id}
                  className={`min-h-[44px] lg:min-h-[36px] px-3.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40 ${
                    negocio.planId === p.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {p.nombre}
                </button>
              ))}
              {planes.length === 0 && (
                <span className="text-xs text-slate-400">Cargando planes…</span>
              )}
            </div>
          </div>

          {/* Sector selector */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sector</p>
            <div className="flex gap-2">
              {(['belleza', 'salud'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { if (suscripcion?.sector !== s) setSectorPorConfirmar(s); }}
                  disabled={guardandoSector}
                  aria-pressed={suscripcion?.sector === s}
                  className={`min-h-[44px] lg:min-h-[36px] px-3.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40 ${
                    suscripcion?.sector === s
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                  }`}
                >
                  {s === 'salud' ? 'Salud' : 'Belleza'}
                </button>
              ))}
            </div>
            {sectorPorConfirmar && (
              <div role="alert" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
                <p>
                  Cambiar {negocio.nombre} a {sectorPorConfirmar === 'salud' ? 'Salud' : 'Belleza'} cambia el vocabulario
                  y los módulos de su panel.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetSector(sectorPorConfirmar)}
                    disabled={guardandoSector}
                    className="min-h-[44px] lg:min-h-[36px] px-3.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold disabled:opacity-50"
                  >
                    {guardandoSector ? 'Guardando…' : 'Cambiar sector'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSectorPorConfirmar(null)}
                    disabled={guardandoSector}
                    className="min-h-[44px] lg:min-h-[36px] px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Billing summary */}
          <div data-testid="billing-summary" className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Plan</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {suscripcion?.planNombre ?? '—'} · {formatPrecio(precioBase)}/mes
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Emp. base</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {suscripcion?.maxEmpleadosBase ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Emp. extra</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  aria-label="Empleados extra"
                  value={empleadosExtra}
                  onChange={e => {
                    const val = Math.max(0, Number(e.target.value));
                    setEmpleadosExtra(val);
                    if (meses !== LIFETIME_SENTINEL) {
                      setMonto(String((precioBase + val * PRECIO_EXTRA_EMP) * meses));
                    }
                  }}
                  onBlur={e => guardarEmpleadosExtra(Math.max(0, Number(e.target.value)))}
                  disabled={mutarEmpleadosExtra.isPending}
                  className="w-16 text-right rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-0.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
                {empleadosExtra > 0 && (
                  <span className="text-xs text-slate-400">+{formatPrecio(empleadosExtra * PRECIO_EXTRA_EMP)}/mes</span>
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Total mensual</span>
              <span className="text-slate-900 dark:text-slate-100">{formatPrecio(totalMensual)}/mes</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Pagos ── */}
      {tab === 'pagos' && (
        <div className="space-y-5">
          {/* Meses selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Registrar pago</p>
            <div className="flex gap-2 mb-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMesesChange(m)}
                  aria-pressed={meses === m}
                  className={`flex-1 min-h-[44px] lg:min-h-[36px] rounded-lg text-xs font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40 ${
                    meses === m
                      ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {m === 12 ? "1 año" : `${m} mes${m > 1 ? "es" : ""}`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleMesesChange(LIFETIME_SENTINEL)}
              aria-pressed={meses === LIFETIME_SENTINEL}
              className={`w-full min-h-[44px] lg:min-h-[36px] rounded-lg text-xs font-bold border transition mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40 ${
                meses === LIFETIME_SENTINEL
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              }`}
            >
              De por vida
            </button>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Monto (MXN)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={`${CAMPO_MODAL} ${CAMPO_OK} tabular-nums`}
                />
                {meses === LIFETIME_SENTINEL && (
                  <p className="text-[10px] text-amber-600 mt-1 font-medium">Acceso permanente — sin vencimiento</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Método / Notas</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Efectivo, transferencia…"
                  className={`${CAMPO_MODAL} ${CAMPO_OK}`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => registrar()}
              disabled={registrando || !monto || parseFloat(monto) <= 0}
              className={`${BOTON_PIE_PRIMARIO} w-full`}
            >
              {registrando
                ? "Registrando..."
                : meses === LIFETIME_SENTINEL
                ? "Registrar acceso de por vida"
                : `Registrar pago · $${parseFloat(monto || "0").toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`}
            </button>
          </div>

          {/* Historial */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Historial de pagos</p>
            {cargandoHistorial ? (
              <p className="text-xs text-slate-400 py-4 text-center">Cargando historial…</p>
            ) : historial.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin pagos registrados</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                {paginaHistorial.visibles.map((pago) => {
                  const enEdicion = editandoId === pago.id;
                  const enConfirmar = confirmandoEliminarId === pago.id;

                  if (enEdicion) {
                    return (
                      <div key={pago.id} className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Monto (MXN)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editForm.monto}
                              onChange={e => setEditForm(f => ({ ...f, monto: e.target.value }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs outline-none focus:border-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Notas</label>
                            <input
                              type="text"
                              value={editForm.notas}
                              onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))}
                              placeholder="Efectivo, transferencia…"
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Período desde</label>
                            <input
                              type="date"
                              value={editForm.desde}
                              onChange={e => setEditForm(f => ({ ...f, desde: e.target.value }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs outline-none focus:border-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Período hasta</label>
                            <input
                              type="date"
                              value={editForm.hasta}
                              onChange={e => setEditForm(f => ({ ...f, hasta: e.target.value }))}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>
                        {errorEdicion && (
                          <p role="alert" className="text-xs text-red-700 dark:text-red-400">{errorEdicion}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => !errorEdicion && mutarEditar.mutate({
                              pagoId: pago.id,
                              dto: {
                                monto: Number(editForm.monto.replace(",", ".")),
                                notas: editForm.notas.trim() || undefined,
                                periodoDesde: editForm.desde,
                                periodoHasta: editForm.hasta,
                              },
                            })}
                            disabled={mutarEditar.isPending || !!errorEdicion}
                            className="flex-1 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-700 dark:hover:bg-slate-200 disabled:opacity-50 transition"
                          >
                            {mutarEditar.isPending ? "Guardando…" : "Guardar cambios"}
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={pago.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                            #{String(pago.numeroPago).padStart(3, "0")}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            ${pago.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
                          </span>
                          <span className="text-[10px] text-slate-400">
                            · {pago.mesesPagados >= 600 ? "De por vida" : pago.mesesPagados === 1 ? "1 mes" : `${pago.mesesPagados} meses`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatFechaMx(pago.periodoDesde)} – {formatFechaMx(pago.periodoHasta)}
                          {pago.notas && <span className="ml-2 text-slate-400">· {pago.notas}</span>}
                        </p>
                        {enConfirmar && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">¿Eliminar este pago?</span>
                            <button
                              onClick={() => mutarEliminar.mutate(pago.id)}
                              disabled={mutarEliminar.isPending}
                              className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                            >
                              {mutarEliminar.isPending ? "Eliminando…" : "Confirmar"}
                            </button>
                            <button
                              onClick={() => setConfirmandoEliminarId(null)}
                              className="text-[11px] text-slate-400 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => imprimirComprobante(pago)}
                          aria-label={`Imprimir comprobante del pago ${pago.numeroPago}`}
                          title="Imprimir comprobante"
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => iniciarEdicion(pago)}
                          aria-label={`Editar el pago ${pago.numeroPago}`}
                          title="Editar pago"
                          className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmandoEliminarId(enConfirmar ? null : pago.id);
                            setEditandoId(null);
                          }}
                          aria-label={`Eliminar el pago ${pago.numeroPago}`}
                          title="Eliminar pago"
                          className={`transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${
                            enConfirmar
                              ? "text-red-500 dark:text-red-400"
                              : "text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {paginaHistorial.totalPaginas > 1 && (
                  <Pagination
                    pagina={paginaHistorial.pagina}
                    totalPaginas={paginaHistorial.totalPaginas}
                    total={paginaHistorial.total}
                    labelTotal="pagos"
                    onCambiar={paginaHistorial.setPagina}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── TarjetaNegocio ─────────────────────────────────────────────────────────
function TarjetaNegocio({
  negocio,
  suscripcion,
  onActivar,
  onDesactivar,
  onConfirmarEmail,
  onCrearPropietario,
  onColores,
  onSuscripcion,
  onTogglePagos,
  onToggleTester,
  onEliminar,
  isToggling,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  onActivar: () => void;
  onDesactivar: () => void;
  onConfirmarEmail: () => void;
  onCrearPropietario: () => void;
  onColores: () => void;
  onSuscripcion: () => void;
  onTogglePagos: (habilitado: boolean) => void;
  onToggleTester: () => void;
  onEliminar: () => void;
  isToggling?: boolean;
}) {
  const esActivo = negocio.activo === 1;
  const pendiente = esPendienteActivacion(negocio);
  const iniciales = negocio.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
          {negocio.logoUrl ? (
            <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{iniciales}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{negocio.nombre}</p>
          <p className="text-xs text-slate-400 truncate">{negocio.slug}</p>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            esActivo
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : pendiente
              ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          }`}
        >
          {esActivo ? "Activo" : pendiente ? "Pendiente de activación" : "Inactivo"}
        </span>
      </div>

      {/* Plan + suscripción */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
          {negocio.planNombre ?? "Sin plan"}
        </span>
        {suscripcion && (
          <BadgeSuscripcion
            estado={suscripcion.estado}
            dias={suscripcion.diasRestantes}
            vence={suscripcion.fechaVencimiento}
          />
        )}
        {suscripcion && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              suscripcion.sector === 'salud'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                : 'bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300'
            }`}
          >
            {suscripcion.sector === 'salud' ? 'Salud' : 'Belleza'}
          </span>
        )}
        {negocio.esTester && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            Tester
          </span>
        )}
      </div>

      {/* Registro (B23): cuándo se dio de alta y si el propietario verificó su
          correo, lo que necesita el SuperAdmin para decidir la activación. */}
      {(negocio.fechaCreacion || negocio.emailConfirmado != null || (pendiente && esClavePlan(negocio.planSolicitado))) && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap text-[11px]">
          {negocio.fechaCreacion && (
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">Registrado el {formatFecha(negocio.fechaCreacion)}</span>
          )}
          {negocio.emailConfirmado != null && (
            <span
              className={`font-semibold px-2 py-0.5 rounded-full ${
                negocio.emailConfirmado
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {negocio.emailConfirmado ? "Correo verificado" : "Correo sin verificar"}
            </span>
          )}
          {pendiente && esClavePlan(negocio.planSolicitado) && (
            <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Eligió el plan {NOMBRES_PLANES[negocio.planSolicitado]}
            </span>
          )}
        </div>
      )}

      {/* Métricas */}
      <div className="px-4 pb-4 flex-1">
        {negocio.maxCitasMes > 0 && (
          <BarraProgreso valor={negocio.citasMes} maximo={negocio.maxCitasMes} label="Citas este mes" />
        )}
        {negocio.maxEmpleados > 0 && (
          <BarraProgreso valor={negocio.empleadosActivos} maximo={negocio.maxEmpleados} label="Empleados" />
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-slate-400">Emails este mes:</span>
          <span
            className={`text-xs font-semibold ${
              negocio.emailsMes > 200
                ? "text-red-600 dark:text-red-400"
                : negocio.emailsMes > 100
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {negocio.emailsMes}
          </span>
        </div>
      </div>

      {/* Acciones
          Siete acciones no pesan lo mismo. Las seis reversibles comparten una
          rejilla de dos columnas ordenada por frecuencia de uso —suscripción y
          alta/baja arriba, lo cosmético abajo— y "Eliminar" sale de la rejilla
          a su propio renglón: es la única irreversible y no debe quedar a un
          dedo de distancia de las demás mientras se recorre la tarjeta. */}
      <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onSuscripcion}
            className={`${ACCION_TARJETA} border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950`}
          >
            <CreditCard size={12} aria-hidden="true" /> Suscripción
          </button>
          <button
            onClick={esActivo ? onDesactivar : onActivar}
            disabled={isToggling}
            className={`${ACCION_TARJETA} ${
              esActivo
                ? "border-red-300 bg-red-50 text-red-600 hover:border-red-500 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950"
            }`}
          >
            <Power size={12} aria-hidden="true" />
            {isToggling ? "Guardando…" : esActivo ? "Desactivar" : "Activar"}
          </button>
          <button
            onClick={onCrearPropietario}
            className={`${ACCION_TARJETA} border-blue-300 bg-blue-50 text-blue-600 hover:border-blue-500 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950`}
          >
            <UserPlus size={12} aria-hidden="true" /> Propietario
          </button>
          <button
            onClick={onConfirmarEmail}
            title="Confirmar manualmente el correo del propietario"
            className={`${ACCION_TARJETA} border-sky-300 bg-sky-50 text-sky-600 hover:border-sky-500 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400 dark:hover:bg-sky-950`}
          >
            <MailCheck size={12} aria-hidden="true" /> Confirmar correo
          </button>
          <button
            onClick={onColores}
            className={`${ACCION_TARJETA} border-violet-300 bg-violet-50 text-violet-600 hover:border-violet-500 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400 dark:hover:bg-violet-950`}
          >
            <Palette size={12} aria-hidden="true" /> Colores
          </button>
          <a
            href={`/b/${negocio.slug}`}
            target="_blank"
            rel="noreferrer"
            className={`${ACCION_TARJETA} border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300 dark:hover:bg-slate-700`}
          >
            <ExternalLink size={12} aria-hidden="true" /> Ver booking
          </a>
        </div>
        <button
          onClick={onEliminar}
          title="Eliminar negocio"
          // Tinte muy tenue en reposo y relleno sólido al apuntar. En oscuro el
          // `destructive/5` quedaba casi negro sobre la tarjeta y la etiqueta no
          // se leía, así que ahí el reposo usa el mismo `950/40` que el resto.
          className={`${ACCION_TARJETA} w-full border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive hover:border-destructive hover:text-white dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-600 dark:hover:border-red-600 dark:hover:text-white`}
        >
          <Trash2 size={12} aria-hidden="true" /> Eliminar
        </button>
      </div>

      {/* Interruptores: una sola fila en vez de dos renglones con borde cada uno. */}
      <div className="grid grid-cols-2 gap-x-3 px-4 py-2 border-t border-slate-100 dark:border-slate-700">
        <InterruptorTarjeta
          etiqueta="Módulo pagos"
          activo={!!negocio.moduloPagosHabilitado}
          onToggle={() => onTogglePagos(!negocio.moduloPagosHabilitado)}
          colorActivo="bg-emerald-500"
          anillo="focus-visible:ring-emerald-500"
        />
        <InterruptorTarjeta
          etiqueta="Tester"
          activo={!!negocio.esTester}
          onToggle={onToggleTester}
          colorActivo="bg-purple-500"
          anillo="focus-visible:ring-purple-500"
        />
      </div>
    </div>
  );
}

/**
 * Interruptor con su etiqueta dentro de la tarjeta de negocio.
 *
 * La etiqueta es parte del `<button role="switch">` y no un `<span>` suelto al
 * lado: así el nombre accesible sale del propio contenido y el área táctil
 * incluye el texto, que es lo que la gente toca en un teléfono.
 */
function InterruptorTarjeta({
  etiqueta,
  activo,
  onToggle,
  colorActivo,
  anillo,
}: {
  etiqueta: string;
  activo: boolean;
  onToggle: () => void;
  colorActivo: string;
  anillo: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={onToggle}
      className={`flex items-center gap-2 min-h-[44px] lg:min-h-[36px] rounded-lg px-1 -mx-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40 focus-visible:outline-none focus-visible:ring-2 ${anillo}`}
    >
      <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-0 truncate">{etiqueta}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          activo ? colorActivo : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            activo ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

// ── Page principal ─────────────────────────────────────────────────────────
export default function NegociosAdminPage() {
  useTituloPagina("Negocios · Admin");
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [modalNegocio, setModalNegocio] = useState(false);
  const [modalPropietario, setModalPropietario] = useState(false);
  const [modalColores, setModalColores] = useState(false);
  const [modalSuscripcion, setModalSuscripcion] = useState(false);
  const [negocioSel, setNegocioSel] = useState<NegocioMetricasDto | null>(null);
  const [errorPropietario, setErrorPropietario] = useState("");
  const [mostrarPasswordProp, setMostrarPasswordProp] = useState(false);
  const [nuevaPasswordProp, setNuevaPasswordProp] = useState("");
  const [confirmarPasswordProp, setConfirmarPasswordProp] = useState("");
  const [mostrarNuevaPassword, setMostrarNuevaPassword] = useState(false);
  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] = useState(false);
  const [resetandoPassword, setResetandoPassword] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("");
  const [filtroSuscripcion, setFiltroSuscripcion] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#334155");
  const [modalEliminar, setModalEliminar] = useState(false);
  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);
  const [nombreConfirmacion, setNombreConfirmacion] = useState("");

  const queryClient = qc;
  const [tab, setTab] = useState<'negocios' | 'facturacion'>('negocios');

  const {
    data: metricas = [], isLoading, isError: errorMetricas, refetch: recargarMetricas, isFetching: recargandoMetricas,
  } = useQuery({
    queryKey: ["admin-negocios-metricas"],
    queryFn: adminApi.obtenerMetricas,
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: suscripciones = [], isLoading: cargandoSuscripciones, isError: errorSuscripciones,
    refetch: recargarSuscripciones, isFetching: recargandoSuscripciones,
  } = useQuery({
    queryKey: ["admin-suscripciones"],
    queryFn: adminApi.obtenerSuscripciones,
    staleTime: 1000 * 60,
  });

  // Un fallo de cualquiera de las dos consultas deja los KPIs en cero: se
  // muestra el error con "Reintentar" en vez de cifras falsas.
  const errorPanel = errorMetricas || errorSuscripciones;
  const reintentarPanel = () => {
    if (errorMetricas) recargarMetricas();
    if (errorSuscripciones) recargarSuscripciones();
  };

  const suscripcionMap = useMemo(
    () => Object.fromEntries(suscripciones.map((s) => [s.negocioId, s])),
    [suscripciones]
  );

  const testerIds = useMemo(
    () => new Set(metricas.filter(m => m.esTester).map(m => m.id)),
    [metricas]
  );

  const sortedSuscripciones = useMemo(
    () => [...suscripciones]
      .filter(s => !testerIds.has(s.negocioId))
      .sort((a, b) => (ESTADO_ORDER[a.estado] ?? 4) - (ESTADO_ORDER[b.estado] ?? 4)),
    [suscripciones, testerIds]
  );

  const totalEstimado = suscripciones
    .filter(s => s.estado !== 'SinSuscripcion' && !testerIds.has(s.negocioId))
    .reduce((sum, s) => sum + s.totalMensual, 0);

  const negociosConPlan = suscripciones.filter(s => s.estado !== 'SinSuscripcion' && !testerIds.has(s.negocioId)).length;

  // Los negocios de prueba no cuentan como clientes con plan: quedan fuera de
  // "Ingresos est." y del total de Facturación, así que contarlos aquí hacía
  // que la tira de KPIs y el pie de la tabla dieran cifras distintas de lo
  // mismo en la misma pantalla.
  const conPlan = suscripciones.filter(
    s => s.planNombre !== null && !testerIds.has(s.negocioId)
  ).length;

  const { data: planes = [] } = useQuery({
    queryKey: ["planes"],
    queryFn: adminApi.obtenerPlanes,
  });

  const formNegocio = useForm<NegocioForm>({ resolver: zodResolver(schemaNegocio) });
  // Misma comprobación en vivo que el registro público (AP-23).
  const slugNuevo = useDisponibilidadSlug(modalNegocio ? formNegocio.watch("slug") : undefined);
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
    // El servidor explica el motivo (p. ej. un identificador ya en uso).
    onError: (err: unknown) => toast(mensajeError(err, "Error al crear el negocio. Intenta de nuevo."), "error"),
  });

  // Cada tarjeta sabe si SU cambio de estado sigue en curso, aunque haya varios
  // a la vez: `variables` de useMutation solo guarda el último (AP-06, OM-30).
  const idsCambiandoEstado = new Set(
    useMutationState({
      filters: { mutationKey: CLAVE_ESTADO_NEGOCIO, status: "pending" },
      select: (m) => m.state.variables as string,
    })
  );

  const { mutate: mutarActivar } = useMutation({
    mutationKey: CLAVE_ESTADO_NEGOCIO,
    mutationFn: (id: string) => adminApi.activar(id),
    onSuccess: () => {
      invalidar();
      toast("Negocio activado");
    },
    onError: () => toast("Error al activar el negocio. Intenta de nuevo.", "error"),
  });

  // Desactivar saca de línea la página pública: se confirma antes (AP-06).
  const [negocioADesactivar, setNegocioADesactivar] = useState<NegocioMetricasDto | null>(null);
  const { mutate: mutarDesactivar } = useMutation({
    mutationKey: CLAVE_ESTADO_NEGOCIO,
    mutationFn: (id: string) => adminApi.desactivar(id),
    onSuccess: (_, id) => {
      invalidar();
      setNegocioADesactivar((n) => (n?.id === id ? null : n));
      toast("Negocio desactivado");
    },
    onError: () => toast("Error al desactivar el negocio. Intenta de nuevo.", "error"),
  });

  // Un segundo clic mientras la petición sigue en curso no envía otra.
  const activar = (id: string) => { if (!idsCambiandoEstado.has(id)) mutarActivar(id); };
  const desactivar = (id: string) => { if (!idsCambiandoEstado.has(id)) mutarDesactivar(id); };
  const desactivandoSeleccionado = !!negocioADesactivar && idsCambiandoEstado.has(negocioADesactivar.id);

  const { mutate: confirmarEmail } = useMutation({
    mutationFn: (id: string) => adminApi.confirmarEmail(id),
    onSuccess: () => toast("Email del propietario confirmado"),
    onError: () => toast("Error al confirmar el email. Intenta de nuevo.", "error"),
  });

  const { mutate: actualizarColores, isPending: guardandoColores } = useMutation({
    mutationFn: () =>
      adminApi.actualizarColores(negocioSel!.id, {
        colorPrimario: colorPrimario || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setModalColores(false);
      toast("Colores actualizados");
    },
    onError: () => toast("Error al guardar los colores. Intenta de nuevo.", "error"),
  });

  const { mutate: crearPropietario, isPending: creandoPropietario } = useMutation({
    mutationFn: (d: PropietarioForm) =>
      adminApi.crearPropietario(negocioSel!.id, {
        email: d.email,
        password: d.password,
        nombre: d.nombre,
        apellido: d.apellido ?? "",
      }),
    onSuccess: (_, d) => {
      setModalPropietario(false);
      formPropietario.reset();
      toast(`Propietario creado: ${d.email}`);
    },
    onError: (err: unknown) => {
      setErrorPropietario(mensajeError(err, "No se pudo crear el propietario."));
    },
  });

  const { mutate: togglePagos } = useMutation({
    mutationFn: ({ id, habilitado }: { id: string; habilitado: boolean }) =>
      adminApi.toggleModuloPagos(id, habilitado),
    onSuccess: (_, { id, habilitado }) => {
      qc.setQueryData(
        ["admin-negocios-metricas"],
        (old: NegocioMetricasDto[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, moduloPagosHabilitado: habilitado } : n))
      );
      toast(habilitado ? "Módulo de pagos habilitado" : "Módulo de pagos deshabilitado");
    },
    onError: () => toast("Error al actualizar el módulo de pagos", "error"),
  });

  const { mutate: toggleTester } = useMutation({
    mutationFn: (id: string) => adminApi.toggleTester(id),
    onSuccess: (data, id) => {
      qc.setQueryData(
        ["admin-negocios-metricas"],
        (old: NegocioMetricasDto[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, esTester: data.esTester } : n))
      );
      toast(data.esTester ? "Modo tester activado" : "Modo tester desactivado");
    },
    onError: () => toast("Error al actualizar el modo tester", "error"),
  });

  const { mutate: eliminarNegocio, isPending: eliminandoNegocio } = useMutation({
    mutationFn: (id: string) => adminApi.eliminarNegocio(id),
    onSuccess: () => {
      invalidar();
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      setModalEliminar(false);
      setPasoEliminar(1);
      setNombreConfirmacion("");
      toast("Negocio eliminado correctamente");
    },
    onError: () => toast("Error al eliminar el negocio.", "error"),
  });

  const abrirColores = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setColorPrimario(neg.colorPrimario ?? "#334155");
    setModalColores(true);
  };

  const abrirPropietario = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setErrorPropietario("");
    setNuevaPasswordProp("");
    setConfirmarPasswordProp("");
    setMostrarNuevaPassword(false);
    setMostrarConfirmarPassword(false);
    formPropietario.reset({ nombre: "", apellido: "", email: "", password: "" });
    setModalPropietario(true);
  };

  const handleRestablecerPassword = async () => {
    if (!negocioSel || nuevaPasswordProp.length < 6) return;
    if (nuevaPasswordProp !== confirmarPasswordProp) {
      setErrorPropietario("Las contraseñas no coinciden.");
      return;
    }
    setResetandoPassword(true);
    try {
      await adminApi.restablecerPasswordPropietario(negocioSel.id, nuevaPasswordProp);
      setNuevaPasswordProp("");
      setConfirmarPasswordProp("");
      setModalPropietario(false);
      toast("Contraseña restablecida correctamente");
    } catch (err) {
      setErrorPropietario(mensajeError(err, "No se pudo restablecer la contraseña."));
    } finally {
      setResetandoPassword(false);
    }
  };

  const abrirSuscripcion = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setModalSuscripcion(true);
  };

  const abrirEliminar = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setPasoEliminar(1);
    setNombreConfirmacion("");
    setModalEliminar(true);
  };

  const termino = busqueda.trim().toLowerCase();

  const metricasFiltradas = useMemo(
    () => metricas
      .filter((n) => {
        const coincide =
          !termino ||
          n.nombre.toLowerCase().includes(termino) ||
          n.slug.toLowerCase().includes(termino);
        if (!coincide) return false;
        if (filtroActivo === "activos" && n.activo !== 1) return false;
        if (filtroActivo === "inactivos" && n.activo === 1) return false;
        if (filtroActivo === "pendientes" && !esPendienteActivacion(n)) return false;
        if (filtroSuscripcion) {
          const estado = suscripcionMap[n.id]?.estado ?? "SinSuscripcion";
          if (estado !== filtroSuscripcion) return false;
        }
        return true;
      })
      .sort(ordenarNegociosAdmin),
    [metricas, termino, filtroActivo, filtroSuscripcion, suscripcionMap]
  );

  const suscripcionesFiltradas = useMemo(
    () => sortedSuscripciones.filter(
      (s) =>
        !termino ||
        s.negocioNombre.toLowerCase().includes(termino) ||
        s.negocioSlug.toLowerCase().includes(termino)
    ),
    [sortedSuscripciones, termino]
  );

  const paginaNegocios = usePaginacionLocal(metricasFiltradas);
  const paginaFacturacion = usePaginacionLocal(suscripcionesFiltradas);

  const hayFiltros = Boolean(termino || filtroActivo || filtroSuscripcion);
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroActivo("");
    setFiltroSuscripcion("");
  };

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-5"
        titulo="Panel de negocios"
        subtitulo={isLoading || errorMetricas ? undefined : `${metricas.length} ${metricas.length === 1 ? "registrado" : "registrados"} en total`}
        acciones={
          <BotonAccion onClick={() => { formNegocio.reset(); setModalNegocio(true); }}>
            + Nuevo negocio
          </BotonAccion>
        }
      />

      {/* Metrics strip */}
      {errorPanel ? (
        <ErrorCarga
          className="mb-5 py-6"
          mensaje="No se pudieron cargar las métricas del panel."
          onReintentar={reintentarPanel}
          reintentando={recargandoMetricas || recargandoSuscripciones}
        />
      ) : !isLoading && !cargandoSuscripciones && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total", value: String(metricas.length), color: "text-slate-700 dark:text-slate-200" },
            { label: "Activos", value: String(metricas.filter(n => n.activo === 1).length), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Con plan", value: String(conPlan), color: "text-amber-600 dark:text-amber-400" },
            { label: "Ingresos est.", value: formatPrecio(totalEstimado) + "/mes", color: "text-slate-900 dark:text-slate-100" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3 min-w-0">
              <p className="text-xs text-slate-400 dark:text-slate-400 mb-0.5 truncate">{label}</p>
              <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs
        className="mb-5"
        etiqueta="Secciones del panel"
        valor={tab}
        onChange={setTab}
        opciones={[
          { id: 'negocios', label: 'Negocios' },
          { id: 'facturacion', label: 'Facturación' },
        ]}
      />

      <FiltroBarra
        etiqueta="Filtros de negocios"
        busqueda={{
          valor: busqueda,
          onChange: setBusqueda,
          etiqueta: "Buscar negocio",
          placeholder: "Buscar por nombre o slug...",
        }}
        // Activo/inactivo solo describe la tarjeta; en Facturación la tabla ya
        // trae su propia columna de estado de suscripción.
        campos={tab === 'negocios' ? [
          {
            id: "activo",
            tipo: "select",
            etiqueta: "Estado",
            valor: filtroActivo,
            onChange: setFiltroActivo,
            etiquetaNeutra: "Todos",
            opciones: [
              { valor: "pendientes", etiqueta: "Pendientes de activación" },
              { valor: "activos", etiqueta: "Activos" },
              { valor: "inactivos", etiqueta: "Inactivos" },
            ],
          },
          {
            id: "suscripcion",
            tipo: "select",
            etiqueta: "Suscripción",
            valor: filtroSuscripcion,
            onChange: setFiltroSuscripcion,
            etiquetaNeutra: "Todas",
            opciones: [
              { valor: "Activa", etiqueta: "Activa" },
              { valor: "PorVencer", etiqueta: "Por vencer" },
              { valor: "Vencida", etiqueta: "Vencida" },
              { valor: "SinSuscripcion", etiqueta: "Sin suscripción" },
            ],
          },
        ] : []}
        onLimpiar={limpiarFiltros}
      />

      {tab === 'negocios' && (
        <>
          {/* Grid de tarjetas */}
          {isLoading ? (
            <p className="text-slate-400 dark:text-slate-500">Cargando negocios...</p>
          ) : errorMetricas ? null : metricasFiltradas.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {hayFiltros ? (
                <EmptyState
                  variante="sinResultados"
                  title="Sin resultados"
                  description="Ningún negocio coincide con los filtros actuales."
                  onLimpiarFiltros={limpiarFiltros}
                  // Distinto del "Limpiar filtros" de la barra: dos botones con
                  // el mismo nombre accesible en la misma pantalla no se
                  // distinguen al navegar por lista.
                  labelLimpiarFiltros="Ver todos los negocios"
                />
              ) : (
                <EmptyState
                  title="No hay negocios registrados"
                  description="Crea el primero con “+ Nuevo negocio”."
                />
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {paginaNegocios.visibles.map((neg) => (
                  <TarjetaNegocio
                    key={neg.id}
                    negocio={neg}
                    suscripcion={suscripcionMap[neg.id]}
                    onActivar={() => activar(neg.id)}
                    onDesactivar={() => setNegocioADesactivar(neg)}
                    onConfirmarEmail={() => confirmarEmail(neg.id)}
                    onCrearPropietario={() => abrirPropietario(neg)}
                    onColores={() => abrirColores(neg)}
                    onSuscripcion={() => abrirSuscripcion(neg)}
                    onTogglePagos={(habilitado) => togglePagos({ id: neg.id, habilitado })}
                    onToggleTester={() => toggleTester(neg.id)}
                    onEliminar={() => abrirEliminar(neg)}
                    // Solo la tarjeta cuyo estado está cambiando queda en espera (AP-06).
                    isToggling={idsCambiandoEstado.has(neg.id)}
                  />
                ))}
              </div>
              {paginaNegocios.totalPaginas > 1 && (
                <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <Pagination
                    pagina={paginaNegocios.pagina}
                    totalPaginas={paginaNegocios.totalPaginas}
                    total={paginaNegocios.total}
                    labelTotal="negocios"
                    onCambiar={paginaNegocios.setPagina}
                    cargando={isLoading}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'facturacion' && !errorSuscripciones && (
        <div>
          {suscripcionesFiltradas.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {hayFiltros ? (
                <EmptyState
                  variante="sinResultados"
                  title="Sin resultados"
                  description="Ningún negocio coincide con los filtros actuales."
                  onLimpiarFiltros={limpiarFiltros}
                  labelLimpiarFiltros="Ver todas las suscripciones"
                />
              ) : (
                <EmptyState
                  title="Sin facturación todavía"
                  description="Ningún negocio tiene un plan activo."
                />
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Negocio</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-center">Emp. base</th>
                    <th className="px-4 py-3 text-center">Emp. extra</th>
                    <th className="px-4 py-3 text-right">Total/mes</th>
                    <th className="px-4 py-3 text-center">Vence</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginaFacturacion.visibles.map(s => {
                    const badge = ESTADO_BADGE[s.estado] ?? ESTADO_BADGE.SinSuscripcion;
                    return (
                      <tr key={s.negocioId} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                        {/* `whitespace-nowrap`: la tabla ya se desplaza en
                            horizontal; sin esto, a 390px el nombre se parte en
                            cuatro líneas y estira la fila en vez de aprovechar
                            el desplazamiento que ya existe. */}
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{s.negocioNombre}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.planNombre ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{s.maxEmpleadosBase}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            aria-label={`Empleados extra de ${s.negocioNombre}`}
                            defaultValue={s.empleadosExtra}
                            onBlur={e => {
                              const val = Math.max(0, Number(e.target.value));
                              if (val === s.empleadosExtra) return;
                              adminApi.setEmpleadosExtra(s.negocioId, val)
                                .then(() => {
                                  queryClient.invalidateQueries({ queryKey: ['admin-suscripciones'] });
                                  toast(`Empleados extra de ${s.negocioNombre}: ${val}`);
                                })
                                .catch(() => {
                                  toast('No se pudo actualizar los empleados extra', 'error');
                                });
                            }}
                            className="w-14 text-center rounded-lg border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                          {formatPrecio(s.totalMensual)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {/* Un acceso de por vida vence el año 2126: la fecha
                              es cierta y no dice nada. */}
                          {(s.diasRestantes ?? 0) >= DIAS_DE_POR_VIDA
                            ? 'De por vida'
                            : s.fechaVencimiento
                            ? formatFechaMx(s.fechaVencimiento)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              const neg = metricas?.find(m => m.id === s.negocioId);
                              if (neg) abrirSuscripcion(neg);
                            }}
                            className="min-h-[44px] lg:min-h-[36px] px-2 -mx-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
                          >
                            Ver suscripción
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* El pie suma TODAS las suscripciones vigentes, no las de la
                      página ni las que pasan el filtro: es el ingreso del mes,
                      y recortarlo al filtro haría que el mismo rótulo
                      significara cosas distintas según lo que esté escrito en
                      el buscador. */}
                  <tr className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Total estimado · {negociosConPlan} negocio{negociosConPlan !== 1 ? 's' : ''} con suscripción
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatPrecio(totalEstimado)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {paginaFacturacion.totalPaginas > 1 && (
              <div className="bg-white dark:bg-slate-800">
                <Pagination
                  pagina={paginaFacturacion.pagina}
                  totalPaginas={paginaFacturacion.totalPaginas}
                  total={paginaFacturacion.total}
                  labelTotal="suscripciones"
                  onCambiar={paginaFacturacion.setPagina}
                />
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Confirmación: desactivar negocio */}
      <ConfirmarAccion
        abierto={negocioADesactivar !== null}
        titulo={`¿Desactivar ${negocioADesactivar?.nombre ?? "el negocio"}?`}
        mensaje={
          <>
            <p>
              La página <span className="font-mono text-foreground">/b/{negocioADesactivar?.slug}</span> dejará
              de aceptar reservas y sus clientes no podrán verla hasta que vuelvas a activar el negocio.
            </p>
            <p className="mt-2">Las citas ya agendadas no se cancelan.</p>
          </>
        }
        etiquetaConfirmar="Desactivar negocio"
        destructiva
        pendiente={desactivandoSeleccionado}
        onConfirmar={() => negocioADesactivar && desactivar(negocioADesactivar.id)}
        onCerrar={() => { if (!desactivandoSeleccionado) setNegocioADesactivar(null); }}
      />

      {/* Modal: suscripción */}
      <Modal
        abierto={modalSuscripcion}
        onCerrar={() => setModalSuscripcion(false)}
        titulo={`Suscripción — ${negocioSel?.nombre ?? ""}`}
        ancho="lg"
      >
        {negocioSel && (
          <ModalSuscripcion
            negocio={negocioSel}
            suscripcion={suscripcionMap[negocioSel.id]}
            planes={planes}
          />
        )}
      </Modal>

      {/* Modal: nuevo negocio */}
      <Modal abierto={modalNegocio} onCerrar={() => setModalNegocio(false)} titulo="Nuevo negocio">
        <form onSubmit={formNegocio.handleSubmit((d) => crearNegocio(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
            <input
              {...formNegocio.register("nombre")}
              placeholder="Barbería Luis"
              className={`${CAMPO_MODAL} ${formNegocio.formState.errors.nombre ? CAMPO_ERROR : CAMPO_OK}`}
            />
            {formNegocio.formState.errors.nombre && (
              <p className="text-red-500 text-xs mt-1">{formNegocio.formState.errors.nombre.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Slug *{" "}
              <span className="font-normal text-slate-400">
                (aparece en la URL: /b/<strong>slug</strong>)
              </span>
            </label>
            <input
              {...formNegocio.register("slug")}
              placeholder="barberia-luis"
              className={`${CAMPO_MODAL} font-mono ${formNegocio.formState.errors.slug ? CAMPO_ERROR : CAMPO_OK}`}
            />
            {formNegocio.formState.errors.slug ? (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formNegocio.formState.errors.slug.message}</p>
            ) : (
              <p className="text-xs mt-1 min-h-[1rem]" aria-live="polite">
                {slugNuevo === "checking" && <span className="text-muted-foreground">Verificando…</span>}
                {slugNuevo === "available" && (
                  <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                    <CheckCircle size={12} aria-hidden="true" /> Disponible
                  </span>
                )}
                {slugNuevo === "taken" && (
                  <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                    <XCircle size={12} aria-hidden="true" /> Ya está en uso — elige otro
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
              <input
                {...formNegocio.register("telefono")}
                className={`${CAMPO_MODAL} ${CAMPO_OK}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo</label>
              <input
                type="email"
                {...formNegocio.register("email")}
                className={`${CAMPO_MODAL} ${CAMPO_OK}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label>
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea
              rows={2}
              {...formNegocio.register("descripcion")}
              className={`${CAMPO_MODAL} ${CAMPO_OK} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={creandoNegocio || slugNuevo === "taken" || slugNuevo === "checking"}
            className={`${BOTON_PIE_PRIMARIO} w-full`}
          >
            {creandoNegocio ? "Creando..." : "Crear negocio"}
          </button>
        </form>
      </Modal>

      {/* Modal: propietario */}
      <Modal
        abierto={modalPropietario}
        onCerrar={() => setModalPropietario(false)}
        titulo="Propietario"
        ancho="sm"
      >
        {negocioSel && (
          <div className="space-y-4">
            {negocioSel.propietarioEmail ? (
              <>
                {/* Existing propietario card */}
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    {negocioSel.propietarioNombre && (
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 truncate">
                        {negocioSel.propietarioNombre}
                      </p>
                    )}
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                      {negocioSel.propietarioEmail}
                    </p>
                  </div>
                </div>

                {/* Password reset section */}
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                    Establece una nueva contraseña para el acceso de{" "}
                    <strong className="text-slate-700 dark:text-slate-200">{negocioSel.nombre}</strong>.
                  </p>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative mb-3">
                    <input
                      type={mostrarNuevaPassword ? "text" : "password"}
                      value={nuevaPasswordProp}
                      onChange={e => setNuevaPasswordProp(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className={`${CAMPO_MODAL} ${CAMPO_OK} pr-10`}
                    />
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setMostrarNuevaPassword(v => !v)}
                      aria-label={mostrarNuevaPassword ? "Ocultar la nueva contraseña" : "Mostrar la nueva contraseña"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {mostrarNuevaPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Confirmar contraseña
                  </label>
                  <div className="relative mb-3">
                    <input
                      type={mostrarConfirmarPassword ? "text" : "password"}
                      value={confirmarPasswordProp}
                      onChange={e => setConfirmarPasswordProp(e.target.value)}
                      placeholder="Repite la contraseña"
                      className={`${CAMPO_MODAL} ${CAMPO_OK} pr-10`}
                    />
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setMostrarConfirmarPassword(v => !v)}
                      aria-label={mostrarConfirmarPassword ? "Ocultar la confirmación" : "Mostrar la confirmación"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      {mostrarConfirmarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errorPropietario && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-3">
                      {errorPropietario}
                    </div>
                  )}
                  <button
                    onClick={handleRestablecerPassword}
                    disabled={resetandoPassword || nuevaPasswordProp.length < 6 || confirmarPasswordProp.length < 6}
                    className={`${BOTON_PIE_PRIMARIO} w-full`}
                  >
                    {resetandoPassword ? "Restableciendo…" : "Restablecer contraseña"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Crea la cuenta de acceso para el propietario de{" "}
                  <strong className="text-slate-700 dark:text-slate-200">{negocioSel.nombre}</strong>.
                </p>
                <form onSubmit={formPropietario.handleSubmit((d) => crearPropietario(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
                      <input
                        {...formPropietario.register("nombre")}
                        className={`${CAMPO_MODAL} ${formPropietario.formState.errors.nombre ? CAMPO_ERROR : CAMPO_OK}`}
                      />
                      {formPropietario.formState.errors.nombre && (
                        <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.nombre.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Apellido</label>
                      <input
                        {...formPropietario.register("apellido")}
                        className={`${CAMPO_MODAL} ${CAMPO_OK}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo de acceso *</label>
                    <input
                      type="email"
                      {...formPropietario.register("email")}
                      className={`${CAMPO_MODAL} ${formPropietario.formState.errors.email ? CAMPO_ERROR : CAMPO_OK}`}
                    />
                    {formPropietario.formState.errors.email && (
                      <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña inicial *</label>
                    <div className="relative">
                      <input
                        type={mostrarPasswordProp ? "text" : "password"}
                        {...formPropietario.register("password")}
                        className={`${CAMPO_MODAL} pr-10 ${formPropietario.formState.errors.password ? CAMPO_ERROR : CAMPO_OK}`}
                      />
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setMostrarPasswordProp(v => !v)}
                        aria-label={mostrarPasswordProp ? "Ocultar la contraseña" : "Mostrar la contraseña"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-3 py-2">
                      {errorPropietario}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={creandoPropietario}
                    className={`${BOTON_PIE_PRIMARIO} w-full`}
                  >
                    {creandoPropietario ? "Creando cuenta…" : "Crear propietario"}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: eliminar negocio */}
      <Modal
        abierto={modalEliminar}
        onCerrar={() => { setModalEliminar(false); setPasoEliminar(1); setNombreConfirmacion(""); }}
        titulo="Eliminar negocio"
        ancho="sm"
      >
        {negocioSel && pasoEliminar === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Esta acción es permanente y eliminará todos los datos del negocio.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Escribe el nombre del negocio para confirmar:
              </label>
              <input
                type="text"
                value={nombreConfirmacion}
                onChange={e => setNombreConfirmacion(e.target.value)}
                placeholder={negocioSel.nombre}
                className={`${CAMPO_MODAL} ${CAMPO_OK}`}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setModalEliminar(false); setPasoEliminar(1); setNombreConfirmacion(""); }}
                className={BOTON_PIE_SECUNDARIO}
              >
                Cancelar
              </button>
              <button
                onClick={() => setPasoEliminar(2)}
                disabled={nombreConfirmacion !== negocioSel.nombre}
                className={BOTON_PIE_PRIMARIO}
              >
                Continuar
              </button>
            </div>
          </div>
        )}
        {negocioSel && pasoEliminar === 2 && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-red-600 dark:text-red-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Última oportunidad</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              Estás a punto de eliminar permanentemente{" "}
              <strong className="text-slate-900 dark:text-white">"{negocioSel.nombre}"</strong>.{" "}
              Esta acción <strong>NO se puede deshacer</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPasoEliminar(1)}
                className={BOTON_PIE_SECUNDARIO}
              >
                Volver
              </button>
              <button
                onClick={() => eliminarNegocio(negocioSel.id)}
                disabled={eliminandoNegocio}
                className={`${BOTON_PIE} font-semibold bg-red-600 hover:bg-red-700 text-white`}
              >
                {eliminandoNegocio ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: colores del negocio */}
      <Modal abierto={modalColores} onCerrar={() => setModalColores(false)} titulo="Colores del negocio" ancho="sm">
        {negocioSel && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Personaliza los colores del panel de{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{negocioSel.nombre}</span>.
            </p>
            <div>
              <label htmlFor="color-primario" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Color primario
              </label>
              <div className="flex gap-3 items-center">
                <input id="color-primario" type="color" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)}
                  className="w-12 h-12 shrink-0 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-800" />
                <input type="text" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)}
                  aria-label="Color primario en hexadecimal"
                  aria-invalid={!esColorHexValido(colorPrimario) || undefined}
                  aria-describedby={!esColorHexValido(colorPrimario) ? "color-primario-error" : undefined}
                  className={`${CAMPO_MODAL} ${esColorHexValido(colorPrimario) ? CAMPO_OK : CAMPO_ERROR} flex-1 min-w-0 font-mono uppercase`}
                  maxLength={7} placeholder="#334155" />
                <div aria-hidden="true" className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0" style={{ backgroundColor: colorPrimario }} />
              </div>
              {!esColorHexValido(colorPrimario) && (
                <p id="color-primario-error" role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">
                  Escribe un color con el formato #RRGGBB, por ejemplo #334155.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Vista previa</p>
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
              <button onClick={() => setModalColores(false)} className={BOTON_PIE_SECUNDARIO}>
                Cancelar
              </button>
              <button onClick={() => actualizarColores()} disabled={guardandoColores || !esColorHexValido(colorPrimario)} className={BOTON_PIE_PRIMARIO}>
                {guardandoColores ? "Guardando..." : "Guardar colores"}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
