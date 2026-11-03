import { useMemo, useState, type ReactNode } from "react";
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
import ModalAcciones from "../../components/ui/ModalAcciones";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import {
  esPendienteActivacion, ordenarNegociosAdmin, validarEdicionPago, esColorHexValido,
  resumenFacturacion, motivoSinIngreso, nombrePlan,
} from "../../utils/negociosAdmin";
import BarraProgreso from "../../components/ui/BarraProgreso";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import BotonAccion from "../../components/ui/BotonAccion";
import Tabs from "../../components/ui/Tabs";
import EmptyState from "../../components/ui/EmptyState";
import ErrorCarga from "../../components/ui/ErrorCarga";
import MenuAcciones from "../../components/ui/MenuAcciones";
import Pagination from "../../components/ui/Pagination";
import { Skeleton, SkeletonKpis, SkeletonLista, SkeletonTarjetasNegocio } from "../../components/ui/Skeleton";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { useToastStore } from "../../store/toastStore";
import { formatFecha, formatFechaCorta, formatPrecio } from "../../utils/formatters";
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
  // Con plan asignado pero sin pago: no es lo mismo que no tener plan (G3).
  SinPago: { label: 'Sin pago registrado', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
};

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
  "flex-1 min-h-[44px] lg:min-h-[36px] px-4 rounded-xl text-sm transition-colors disabled:opacity-50 " +
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
  conPlan = false,
}: {
  estado: SuscripcionResumenDto["estado"];
  dias: number | null;
  /** Fecha de vencimiento ISO; alimenta el `title` con el dato exacto. */
  vence?: string | null;
  /**
   * Tiene un plan asignado. Sin pago, "Pro" junto a "Sin suscripción" no dejaba
   * claro si el negocio paga (G3): se dice "Sin pago registrado", en ámbar.
   */
  conPlan?: boolean;
}) {
  const titulo = vence ? `Vence el ${formatFecha(vence)}` : undefined;

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
  if (conPlan) {
    return (
      <span
        title="Tiene un plan asignado, pero no hay un pago que lo cubra: no cuenta en el ingreso"
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <Clock size={10} aria-hidden="true" /> Sin pago registrado
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
  errorPlanes = false,
  onReintentarPlanes,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  planes: PlanDto[];
  /** Falló la consulta de planes: en vez de "cargando" para siempre, se dice y se reintenta. */
  errorPlanes?: boolean;
  onReintentarPlanes?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Borrar un pago se confirma con `ConfirmarAccion`, como el resto de las
  // acciones con consecuencias; antes era un "¿Eliminar este pago?" en línea.
  const [pagoAEliminar, setPagoAEliminar] = useState<PagoSuscripcionDto | null>(null);
  const [editForm, setEditForm] = useState({ monto: "", notas: "", desde: "", hasta: "" });

  const extraGuardado = suscripcion?.empleadosExtra ?? 0;
  const [empleadosExtra, setEmpleadosExtra] = useState(extraGuardado);
  const precioBase = suscripcion?.precioBase ?? 0;
  // El precio por empleado extra viene del backend; sin fila de suscripción
  // tampoco hay precio base, así que el resumen queda en cero igual que antes.
  const precioExtra = suscripcion?.precioEmpleadoExtra ?? 0;
  const totalMensual = precioBase + empleadosExtra * precioExtra;
  const extraSinGuardar = empleadosExtra !== extraGuardado;

  const [meses, setMeses] = useState(1);
  // El monto sugerido se deriva siempre del total mensual vigente por los meses
  // elegidos: sigue al plan (recargado tras cambiarlo), a los empleados extra y a
  // los meses. "1 mes" ya viene marcado, así que arranca en el total mensual (M4).
  // Si el admin teclea otro monto, ese manda hasta registrar el pago.
  const montoSugerido =
    meses === LIFETIME_SENTINEL || totalMensual * meses <= 0 ? "" : String(totalMensual * meses);
  const [montoManual, setMontoManual] = useState<string | null>(null);
  const monto = montoManual ?? montoSugerido;
  const [notas, setNotas] = useState("");
  const [tab, setTab] = useState<'cuenta' | 'pagos'>('cuenta');

  const {
    data: historial = [], isLoading: cargandoHistorial, isError: errorHistorial,
    refetch: recargarHistorial, isFetching: recargandoHistorial,
  } = useQuery({
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
      // Vuelve al monto sugerido para los meses que siguen marcados, no a vacío.
      setMontoManual(null);
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
      toast(`Empleados extra actualizados: ${val} · total ${formatPrecio(precioBase + val * precioExtra)}/mes`);
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, "No se pudieron actualizar los empleados extra."), "error");
    },
  });

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
        setPagoAEliminar(null);
        toast("Pago eliminado");
    },
    onError: () => toast("No se pudo eliminar el pago", "error"),
  });

  const iniciarEdicion = (pago: PagoSuscripcionDto) => {
    setEditandoId(pago.id);
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

  // El plan cambia límites y precio: un clic en la pastilla solo propone el
  // cambio, y se aplica tras ver el antes y el después (I2).
  const [planPorConfirmar, setPlanPorConfirmar] = useState<PlanDto | null>(null);
  const planActual = planes.find(p => p.id === negocio.planId);

  const handleSetPlan = async (plan: PlanDto) => {
    if (guardandoPlan || plan.id === negocio.planId) return;
    setGuardandoPlan(true);
    try {
      await adminApi.setPlan(negocio.id, plan.id);
      await qc.invalidateQueries({ queryKey: ['admin-suscripciones'] });
      await qc.invalidateQueries({ queryKey: ['admin-negocios-metricas'] });
      toast(`Plan actualizado: ${nombrePlan(plan.nombre)}`);
      setPlanPorConfirmar(null);
    } catch (err) {
      toast(mensajeError(err, "No se pudo actualizar el plan. Intenta de nuevo."), "error");
    } finally {
      setGuardandoPlan(false);
    }
  };

  // El monto sugerido se recalcula solo; un monto tecleado se respeta.
  const handleMesesChange = (val: number) => setMeses(val);

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
            conPlan={!!suscripcion?.planNombre}
          />
        </div>
        {vencimiento && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Vence</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {esPermanente ? "Sin vencimiento" : formatFecha(vencimiento)}
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
                  onClick={() => { if (p.id !== negocio.planId) setPlanPorConfirmar(p); }}
                  disabled={guardandoPlan}
                  aria-pressed={negocio.planId === p.id}
                  className={`min-h-[44px] lg:min-h-[36px] px-3.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40 ${
                    negocio.planId === p.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-slate-500'
                  }`}
                >
                  {nombrePlan(p.nombre)}
                </button>
              ))}
              {/* Mientras llegan, pastillas en gris del mismo tamaño (I5); si
                  fallan, el error con "Reintentar" en vez de esperar para siempre. */}
              {planes.length === 0 && !errorPlanes && (
                <div role="status" aria-label="Cargando planes" className="flex gap-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 lg:h-9 w-20 rounded-full" />)}
                </div>
              )}
            </div>
            {planes.length === 0 && errorPlanes && onReintentarPlanes && (
              <ErrorCarga
                className="py-5"
                mensaje="No se pudieron cargar los planes."
                onReintentar={onReintentarPlanes}
              />
            )}
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
          </div>

          {/* Billing summary */}
          <div data-testid="billing-summary" className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Plan</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                {suscripcion?.planNombre ? nombrePlan(suscripcion.planNombre) : '—'} · {formatPrecio(precioBase)}/mes
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
                    const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    setEmpleadosExtra(val);
                  }}
                  disabled={mutarEmpleadosExtra.isPending}
                  className="w-16 text-right tabular-nums rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-0.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
                {empleadosExtra > 0 && (
                  <span className="text-xs text-slate-400 tabular-nums">+{formatPrecio(empleadosExtra * precioExtra)}/mes</span>
                )}
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Total mensual</span>
              <span className="text-slate-900 dark:text-slate-100 tabular-nums">{formatPrecio(totalMensual)}/mes</span>
            </div>
            {/* Antes se guardaba al salir del campo, sin ver el nuevo total (I2):
                ahora el cambio queda pendiente hasta pulsar "Guardar", que lo
                nombra con el precio que resultará. */}
            {extraSinGuardar && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEmpleadosExtra(extraGuardado)}
                  disabled={mutarEmpleadosExtra.isPending}
                  className="min-h-[44px] lg:min-h-[36px] px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => mutarEmpleadosExtra.mutate(empleadosExtra)}
                  disabled={mutarEmpleadosExtra.isPending}
                  className="min-h-[44px] lg:min-h-[36px] px-3.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600 dark:hover:bg-slate-500 text-xs font-semibold tabular-nums disabled:opacity-50"
                >
                  {mutarEmpleadosExtra.isPending ? "Guardando…" : `Guardar · ${formatPrecio(totalMensual)}/mes`}
                </button>
              </div>
            )}
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
                <label htmlFor="pago-monto" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Monto (MXN)</label>
                <input
                  id="pago-monto"
                  type="text"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMontoManual(e.target.value)}
                  className={`${CAMPO_MODAL} ${CAMPO_OK} tabular-nums`}
                />
                {meses === LIFETIME_SENTINEL && (
                  <p className="text-[10px] text-amber-600 mt-1 font-medium">Acceso permanente — sin vencimiento</p>
                )}
              </div>
              <div>
                <label htmlFor="pago-notas" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Método / Notas</label>
                <input
                  id="pago-notas"
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
                : `Registrar pago · ${formatPrecio(parseFloat(monto || "0") || 0)}`}
            </button>
          </div>

          {/* Historial */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Historial de pagos</p>
            {cargandoHistorial ? (
              // Filas en gris con la altura de un pago (I5), no "Cargando historial…".
              <div role="status" aria-label="Cargando historial de pagos" className="border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="h-11 w-11 lg:h-9 lg:w-9 rounded-xl shrink-0" />
                  </div>
                ))}
              </div>
            ) : errorHistorial ? (
              <ErrorCarga
                className="py-6"
                mensaje="No se pudo cargar el historial de pagos."
                onReintentar={() => recargarHistorial()}
                reintentando={recargandoHistorial}
              />
            ) : historial.length === 0 ? (
              <div className="border border-slate-100 dark:border-slate-700 rounded-xl">
                <EmptyState
                  className="!py-8"
                  icon={<CreditCard size={32} strokeWidth={1.5} />}
                  title="Sin pagos registrados"
                  description="Cuando registres el primero, aquí verás su comprobante y su período."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                {paginaHistorial.visibles.map((pago) => {
                  const enEdicion = editandoId === pago.id;

                  if (enEdicion) {
                    // Mismos campos que el resto del modal (M5): 44px de alto,
                    // etiqueta de 12px asociada con `htmlFor`.
                    const id = (campo: string) => `pago-${pago.id}-${campo}`;
                    return (
                      <div key={pago.id} className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor={id("monto")} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Monto (MXN)</label>
                            <input
                              id={id("monto")}
                              type="text"
                              inputMode="decimal"
                              value={editForm.monto}
                              onChange={e => setEditForm(f => ({ ...f, monto: e.target.value }))}
                              className={`${CAMPO_MODAL} ${CAMPO_OK} tabular-nums`}
                            />
                          </div>
                          <div>
                            <label htmlFor={id("notas")} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notas</label>
                            <input
                              id={id("notas")}
                              type="text"
                              value={editForm.notas}
                              onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))}
                              placeholder="Efectivo, transferencia…"
                              className={`${CAMPO_MODAL} ${CAMPO_OK}`}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor={id("desde")} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Período desde</label>
                            <input
                              id={id("desde")}
                              type="date"
                              value={editForm.desde}
                              onChange={e => setEditForm(f => ({ ...f, desde: e.target.value }))}
                              className={`${CAMPO_MODAL} ${CAMPO_OK}`}
                            />
                          </div>
                          <div>
                            <label htmlFor={id("hasta")} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Período hasta</label>
                            <input
                              id={id("hasta")}
                              type="date"
                              value={editForm.hasta}
                              onChange={e => setEditForm(f => ({ ...f, hasta: e.target.value }))}
                              className={`${CAMPO_MODAL} ${CAMPO_OK}`}
                            />
                          </div>
                        </div>
                        {errorEdicion && (
                          <p role="alert" className="text-xs text-red-700 dark:text-red-400">{errorEdicion}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditandoId(null)}
                            className={BOTON_PIE_SECUNDARIO}
                          >
                            Cancelar
                          </button>
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
                            className={BOTON_PIE_PRIMARIO}
                          >
                            {mutarEditar.isPending ? "Guardando…" : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={pago.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                            #{String(pago.numeroPago).padStart(3, "0")}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                            {formatPrecio(pago.monto)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            · {pago.mesesPagados >= 600 ? "De por vida" : pago.mesesPagados === 1 ? "1 mes" : `${pago.mesesPagados} meses`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {formatFechaCorta(pago.periodoDesde)} – {formatFechaCorta(pago.periodoHasta)}
                          {pago.notas && <span className="ml-1">· {pago.notas}</span>}
                        </p>
                      </div>
                      {/* Imprimir, editar y eliminar detrás de "⋯" (M5): tres
                          iconos de 26px eran difíciles de acertar en el teléfono. */}
                      <MenuAcciones
                        etiqueta={`Acciones del pago ${String(pago.numeroPago).padStart(3, "0")}`}
                        className="shrink-0"
                        acciones={[
                          { id: "imprimir", etiqueta: "Imprimir comprobante", Icono: Printer, onSelect: () => imprimirComprobante(pago) },
                          { id: "editar", etiqueta: "Editar pago", Icono: Pencil, onSelect: () => iniciarEdicion(pago) },
                          {
                            id: "eliminar", etiqueta: "Eliminar pago", Icono: Trash2, destructiva: true,
                            onSelect: () => { setEditandoId(null); setPagoAEliminar(pago); },
                          },
                        ]}
                      />
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

      <ConfirmarAccion
        abierto={planPorConfirmar !== null}
        titulo={`¿Cambiar ${negocio.nombre} al plan ${nombrePlan(planPorConfirmar?.nombre)}?`}
        mensaje={planPorConfirmar && (
          <DetalleCambioPlan
            antes={planActual}
            despues={planPorConfirmar}
            empleadosExtra={extraGuardado}
            precioExtra={precioExtra}
            moduloPagosAntes={!!negocio.moduloPagosHabilitado}
          />
        )}
        etiquetaConfirmar="Cambiar plan"
        pendiente={guardandoPlan}
        onConfirmar={() => planPorConfirmar && handleSetPlan(planPorConfirmar)}
        onCerrar={() => { if (!guardandoPlan) setPlanPorConfirmar(null); }}
      />

      {/* El sector se confirmaba con un aviso en línea: ahora con el mismo
          `ConfirmarAccion` que el plan, como el resto de la consola. */}
      <ConfirmarAccion
        abierto={sectorPorConfirmar !== null}
        titulo={`¿Cambiar ${negocio.nombre} a ${sectorPorConfirmar === 'salud' ? 'Salud' : 'Belleza'}?`}
        mensaje={<p>Cambia el vocabulario y los módulos de su panel.</p>}
        etiquetaConfirmar="Cambiar sector"
        pendiente={guardandoSector}
        onConfirmar={() => sectorPorConfirmar && handleSetSector(sectorPorConfirmar)}
        onCerrar={() => { if (!guardandoSector) setSectorPorConfirmar(null); }}
      />

      <ConfirmarAccion
        abierto={pagoAEliminar !== null}
        titulo={`¿Eliminar el pago #${String(pagoAEliminar?.numeroPago ?? 0).padStart(3, "0")}?`}
        mensaje={pagoAEliminar && (
          <>
            <p>
              Se borrará el pago de <span className="font-medium text-foreground tabular-nums">{formatPrecio(pagoAEliminar.monto)}</span>{" "}
              del {formatFechaCorta(pagoAEliminar.periodoDesde)} al {formatFechaCorta(pagoAEliminar.periodoHasta)}.
            </p>
            <p className="mt-2">El vencimiento de la suscripción se recalcula con los pagos que queden.</p>
          </>
        )}
        etiquetaConfirmar="Eliminar pago"
        destructiva
        pendiente={mutarEliminar.isPending}
        onConfirmar={() => pagoAEliminar && mutarEliminar.mutate(pagoAEliminar.id)}
        onCerrar={() => { if (!mutarEliminar.isPending) setPagoAEliminar(null); }}
      />
    </div>
  );
}

/**
 * El antes y el después de un cambio de plan: precio, total con los empleados
 * extra, límites y el módulo de pagos, que el backend enciende o apaga según el
 * plan. Con eso a la vista, el clic deja de ser un cambio de cobro a ciegas.
 */
function DetalleCambioPlan({
  antes,
  despues,
  empleadosExtra,
  precioExtra,
  moduloPagosAntes,
}: {
  antes: PlanDto | undefined;
  despues: PlanDto;
  empleadosExtra: number;
  precioExtra: number;
  moduloPagosAntes: boolean;
}) {
  const extra = empleadosExtra * precioExtra;
  // El backend dice qué plan enciende el módulo (la misma regla que aplica SetPlan).
  const moduloDespues = despues.habilitaModuloPagos;
  const filas: { etiqueta: string; antes: string; despues: string }[] = [
    {
      etiqueta: "Precio del plan",
      antes: antes ? `${formatPrecio(antes.precioMensual)}/mes` : "—",
      despues: `${formatPrecio(despues.precioMensual)}/mes`,
    },
    ...(empleadosExtra > 0 ? [{
      etiqueta: `Total con ${empleadosExtra} empleado${empleadosExtra === 1 ? "" : "s"} extra`,
      antes: antes ? `${formatPrecio(antes.precioMensual + extra)}/mes` : "—",
      despues: `${formatPrecio(despues.precioMensual + extra)}/mes`,
    }] : []),
    {
      etiqueta: "Empleados incluidos",
      antes: antes ? String(antes.maxEmpleados) : "—",
      despues: String(despues.maxEmpleados),
    },
    {
      etiqueta: "Citas al mes",
      antes: antes ? String(antes.maxCitasMes) : "—",
      despues: String(despues.maxCitasMes),
    },
  ];

  return (
    <div className="space-y-3">
      <dl className="rounded-lg border border-border divide-y divide-border">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <dt>Plan</dt>
          <dd className="font-medium text-foreground">
            {antes ? nombrePlan(antes.nombre) : "Sin plan"} → {nombrePlan(despues.nombre)}
          </dd>
        </div>
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt>{f.etiqueta}</dt>
            {/* Sin plan previo no hay "antes": solo el valor que tendrá. */}
            <dd className="font-medium text-foreground tabular-nums whitespace-nowrap">
              {antes ? `${f.antes} → ${f.despues}` : f.despues}
            </dd>
          </div>
        ))}
      </dl>
      {moduloDespues !== moduloPagosAntes && (
        <p className="text-amber-800 dark:text-amber-300">
          El módulo de pagos quedará {moduloDespues ? "habilitado" : "deshabilitado"} con este plan.
        </p>
      )}
      <p>No registra ningún pago ni cambia la fecha de vencimiento. Los próximos pagos usarán el nuevo precio.</p>
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
    // Borde y sin sombra, como `.tarjeta`: elevación por borde O sombra, no ambas.
    <article aria-label={negocio.nombre} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
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
          {negocio.planNombre ? nombrePlan(negocio.planNombre) : "Sin plan"}
        </span>
        {suscripcion && (
          <BadgeSuscripcion
            estado={suscripcion.estado}
            dias={suscripcion.diasRestantes}
            vence={suscripcion.fechaVencimiento}
            conPlan={!!suscripcion.planNombre}
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
          Siete acciones no pesan lo mismo. Las tres del trabajo diario
          —suscripción, alta/baja y propietario— quedan a la vista; lo ocasional
          (confirmar correo, colores, ver la página) y "Eliminar", la única
          irreversible, van detrás de "⋯", como en las tarjetas de Empleados.
          Eliminar queda al final del menú, en rojo y tras una línea, y sigue
          pidiendo el nombre del negocio antes de borrar.
          Dos renglones y no uno: con tres botones y "⋯" en una sola fila, una
          tarjeta de la rejilla de tres columnas (unos 290px) los recortaba. */}
      <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
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
          <div className="col-span-2 flex gap-1.5">
            <button
              onClick={onCrearPropietario}
              className={`${ACCION_TARJETA} flex-1 border-blue-300 bg-blue-50 text-blue-600 hover:border-blue-500 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950`}
            >
              <UserPlus size={12} aria-hidden="true" /> Propietario
            </button>
            <MenuAcciones
              className="shrink-0"
              etiqueta={`Más acciones de ${negocio.nombre}`}
              acciones={[
                // Solo cuando hay un propietario con el correo sin verificar: con
                // "Correo verificado" al lado, la acción era un clic que no hacía nada.
                ...(negocio.emailConfirmado === false
                  ? [{ id: "confirmar-correo", etiqueta: "Confirmar correo", Icono: MailCheck, onSelect: onConfirmarEmail }]
                  : []),
                { id: "colores", etiqueta: "Colores", Icono: Palette, onSelect: onColores },
                {
                  id: "ver-pagina", etiqueta: "Ver página de reservas", Icono: ExternalLink,
                  onSelect: () => window.open(`/b/${negocio.slug}`, "_blank", "noopener,noreferrer"),
                },
                { id: "eliminar", etiqueta: "Eliminar negocio", Icono: Trash2, destructiva: true, onSelect: onEliminar },
              ]}
            />
          </div>
        </div>
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
    </article>
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

/**
 * Empleados extra en una fila de Facturación. Ya no se guarda al salir del
 * campo (I2): mientras el valor difiere del guardado aparece "Guardar" con el
 * nuevo total, así el cambio de cobro se ve antes de aplicarse.
 */
function EmpleadosExtraFila({
  suscripcion,
  guardando,
  onGuardar,
}: {
  suscripcion: SuscripcionResumenDto;
  guardando: boolean;
  onGuardar: (valor: number) => void;
}) {
  const [valor, setValor] = useState(suscripcion.empleadosExtra);
  // Si el dato guardado cambia (otro guardado, una recarga), el borrador lo sigue.
  const [guardadoPrevio, setGuardadoPrevio] = useState(suscripcion.empleadosExtra);
  if (suscripcion.empleadosExtra !== guardadoPrevio) {
    setGuardadoPrevio(suscripcion.empleadosExtra);
    setValor(suscripcion.empleadosExtra);
  }
  const cambiado = valor !== suscripcion.empleadosExtra;
  const nuevoTotal = suscripcion.precioBase + valor * suscripcion.precioEmpleadoExtra;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="number"
        min={0}
        aria-label={`Empleados extra de ${suscripcion.negocioNombre}`}
        value={valor}
        onChange={(e) => setValor(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        onKeyDown={(e) => { if (e.key === "Escape") setValor(suscripcion.empleadosExtra); }}
        disabled={guardando}
        className="w-14 text-center tabular-nums rounded-lg border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
      />
      {cambiado && (
        <button
          type="button"
          onClick={() => onGuardar(valor)}
          disabled={guardando}
          aria-label={`Guardar ${valor} empleados extra de ${suscripcion.negocioNombre}: total ${formatPrecio(nuevoTotal)} al mes`}
          className="min-h-[36px] px-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600 dark:hover:bg-slate-500 text-xs font-semibold tabular-nums whitespace-nowrap disabled:opacity-50"
        >
          {guardando ? "Guardando…" : `Guardar · ${formatPrecio(nuevoTotal)}`}
        </button>
      )}
    </div>
  );
}

/** Insignia de una fila de Facturación: un plan sin pago no es "Sin suscripción" (G3). */
function badgeFacturacion(s: SuscripcionResumenDto) {
  return s.estado === 'SinSuscripcion' && s.planNombre
    ? ESTADO_BADGE.SinPago
    : ESTADO_BADGE[s.estado] ?? ESTADO_BADGE.SinSuscripcion;
}

/** Vencimiento legible: un acceso de por vida vence el año 2126, la fecha es cierta y no dice nada. */
function textoVence(s: SuscripcionResumenDto): string {
  if ((s.diasRestantes ?? 0) >= DIAS_DE_POR_VIDA) return 'De por vida';
  return s.fechaVencimiento ? formatFechaCorta(s.fechaVencimiento) : '—';
}

/**
 * Facturación en el teléfono (I6): una tarjeta por negocio con lo que el admin
 * busca primero —nombre e ingreso arriba, estado y vencimiento debajo— y "Ver
 * suscripción" como acción. Los empleados extra se editan dentro del modal.
 * El pie es el mismo de la tabla: el ingreso de todas las filas, no el de la página.
 */
function TarjetasFacturacion({
  filas,
  resumen,
  onVerSuscripcion,
  paginacion,
}: {
  filas: SuscripcionResumenDto[];
  resumen: ReturnType<typeof resumenFacturacion>;
  onVerSuscripcion: (s: SuscripcionResumenDto) => void;
  paginacion: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      <ul aria-label="Suscripciones" className="divide-y divide-slate-100 dark:divide-slate-700">
        {filas.map((s) => {
          const badge = badgeFacturacion(s);
          const sinIngreso = motivoSinIngreso(s);
          return (
            <li key={s.negocioId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium text-slate-800 dark:text-slate-200 truncate">{s.negocioNombre}</p>
                <p className="shrink-0 text-right tabular-nums">
                  {sinIngreso ? (
                    <span title={sinIngreso} className="text-sm text-slate-500 dark:text-slate-400">Sin ingreso</span>
                  ) : (
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatPrecio(s.ingresoMensual)}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mes</span>
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                {textoVence(s) !== '—' && (
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">Vence: {textoVence(s)}</span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                {/* El motivo de "Sin ingreso" ya lo dice la insignia; aquí, el plan. */}
                <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {s.planNombre ? `${nombrePlan(s.planNombre)} · ${formatPrecio(s.totalMensual)}/mes de lista` : 'Sin plan'}
                  {s.empleadosExtra > 0 && ` · +${s.empleadosExtra} emp. extra`}
                </p>
                <button
                  type="button"
                  onClick={() => onVerSuscripcion(s)}
                  aria-label={`Ver suscripción de ${s.negocioNombre}`}
                  className="shrink-0 min-h-[44px] px-3 -mr-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
                >
                  Ver suscripción
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ingreso mensual · {resumen.conSuscripcionVigente} de {resumen.conPlanAsignado} con suscripción vigente
        </p>
        <p data-testid="total-ingreso-mensual" className="shrink-0 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {formatPrecio(resumen.ingresoMensual)}
        </p>
      </div>
      {paginacion}
    </div>
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

  // Los negocios de prueba no son clientes: fuera de la tabla y de las cifras.
  const sortedSuscripciones = useMemo(
    () => [...suscripciones]
      .filter(s => !s.esTester)
      .sort((a, b) => (ESTADO_ORDER[a.estado] ?? 4) - (ESTADO_ORDER[b.estado] ?? 4)),
    [suscripciones]
  );

  // Un solo resumen para la tira de KPIs y el pie de Facturación (G3): antes
  // cada uno contaba a su manera y "Con plan 2" convivía con "$0/mes".
  const resumen = useMemo(() => resumenFacturacion(suscripciones), [suscripciones]);

  const { data: planes = [], isError: errorPlanes, refetch: recargarPlanes } = useQuery({
    queryKey: ["planes"],
    queryFn: adminApi.obtenerPlanes,
  });

  // Debajo de `sm` Facturación es una lista de tarjetas (I6): en la tabla, a
  // 390px quedaban fuera justo el ingreso, el vencimiento y el estado.
  const esMovil = useMediaQuery(CONSULTA_MOVIL);

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

  // Marcar un correo como verificado sin que el dueño abra el enlace se
  // confirma antes, y al terminar la tarjeta lo refleja (antes no se recargaba).
  const [negocioCorreoPorConfirmar, setNegocioCorreoPorConfirmar] = useState<NegocioMetricasDto | null>(null);
  const { mutate: confirmarEmail, isPending: confirmandoEmail } = useMutation({
    mutationFn: (id: string) => adminApi.confirmarEmail(id),
    onSuccess: () => {
      invalidar();
      setNegocioCorreoPorConfirmar(null);
      toast("Correo del propietario confirmado");
    },
    onError: () => toast("Error al confirmar el correo. Intenta de nuevo.", "error"),
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

  // Los interruptores son reversibles: aplican al instante y el aviso ofrece
  // "Deshacer" (I2). Deshacer es otro cambio normal, con su propia entrada en la
  // auditoría, y su aviso ya no ofrece deshacer de nuevo.
  const { mutate: togglePagos } = useMutation({
    mutationFn: ({ id, habilitado }: { id: string; habilitado: boolean; nombre: string; deshacer?: boolean }) =>
      adminApi.toggleModuloPagos(id, habilitado),
    onSuccess: (_, { id, habilitado, nombre, deshacer }) => {
      qc.setQueryData(
        ["admin-negocios-metricas"],
        (old: NegocioMetricasDto[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, moduloPagosHabilitado: habilitado } : n))
      );
      const mensaje = `Módulo de pagos ${habilitado ? "habilitado" : "deshabilitado"} en ${nombre}`;
      if (deshacer) {
        toast(`Cambio deshecho: ${mensaje.charAt(0).toLowerCase()}${mensaje.slice(1)}`);
        return;
      }
      toast(mensaje, "exito", {
        accion: { etiqueta: "Deshacer", onClick: () => togglePagos({ id, habilitado: !habilitado, nombre, deshacer: true }) },
      });
    },
    onError: () => toast("Error al actualizar el módulo de pagos", "error"),
  });

  // Como togglePagos, se envía el valor absoluto (no "alternar"): deshacer desde
  // un aviso viejo o reintentar tras perder la respuesta no invierte el estado.
  const { mutate: toggleTester } = useMutation({
    mutationFn: ({ id, esTester }: { id: string; esTester: boolean; nombre: string; deshacer?: boolean }) =>
      adminApi.setTester(id, esTester),
    onSuccess: (data, { id, esTester, nombre, deshacer }) => {
      qc.setQueryData(
        ["admin-negocios-metricas"],
        (old: NegocioMetricasDto[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, esTester: data.esTester } : n))
      );
      // Un tester sale (o vuelve) de las cifras de facturación.
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      const mensaje = `Modo tester ${data.esTester ? "activado" : "desactivado"} en ${nombre}`;
      if (deshacer) {
        toast(`Cambio deshecho: ${mensaje.charAt(0).toLowerCase()}${mensaje.slice(1)}`);
        return;
      }
      toast(mensaje, "exito", {
        accion: { etiqueta: "Deshacer", onClick: () => toggleTester({ id, esTester: !esTester, nombre, deshacer: true }) },
      });
    },
    onError: () => toast("Error al actualizar el modo tester", "error"),
  });

  // Empleados extra desde la tabla de Facturación: mismo guardado explícito que
  // en el modal de suscripción.
  const { mutate: guardarExtraFila, isPending: guardandoExtraFila, variables: extraFilaEnCurso } = useMutation({
    mutationFn: ({ s, valor }: { s: SuscripcionResumenDto; valor: number }) =>
      adminApi.setEmpleadosExtra(s.negocioId, valor),
    onSuccess: (_, { s, valor }) => {
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      toast(`Empleados extra de ${s.negocioNombre}: ${valor} · total ${formatPrecio(s.precioBase + valor * s.precioEmpleadoExtra)}/mes`);
    },
    onError: (err: unknown) => toast(mensajeError(err, "No se pudieron actualizar los empleados extra."), "error"),
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

  const abrirNuevoNegocio = () => { formNegocio.reset(); setModalNegocio(true); };
  const cargandoPanel = isLoading || cargandoSuscripciones;

  return (
    <div className="p-4 sm:p-8">
      {/* "Negocios", como en el menú (M2): antes eran "Negocios" en el menú,
          "Panel de negocios" aquí y otra vez "Negocios" en la pestaña. */}
      <EncabezadoPagina
        className="mb-5"
        titulo="Negocios"
        subtitulo={
          errorMetricas ? undefined
            : isLoading ? <span aria-hidden="true" className="inline-block align-middle h-3.5 w-36 rounded-md bg-muted animate-pulse" />
            : `${metricas.length} ${metricas.length === 1 ? "registrado" : "registrados"} en total`
        }
        acciones={
          <BotonAccion onClick={abrirNuevoNegocio}>
            + Nuevo negocio
          </BotonAccion>
        }
      />

      {/* Metrics strip: mientras carga, el skeleton ocupa su lugar para que la
          página no salte al llegar los datos (I5). */}
      {errorPanel ? (
        <ErrorCarga
          className="mb-5 py-6"
          mensaje="No se pudieron cargar las métricas del panel."
          onReintentar={reintentarPanel}
          reintentando={recargandoMetricas || recargandoSuscripciones}
        />
      ) : cargandoPanel ? (
        <div className="mb-5"><SkeletonKpis /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total", value: String(metricas.length), color: "text-slate-700 dark:text-slate-200" },
            { label: "Activos", value: String(metricas.filter(n => n.activo === 1).length), color: "text-emerald-600 dark:text-emerald-400" },
            // Plan asignado ≠ suscripción pagada (G3): la cifra es la que paga, y
            // el pie dice cuántos tienen plan, para que "Pro" sin pago no se
            // lea como ingreso.
            {
              label: "Con suscripción vigente",
              value: String(resumen.conSuscripcionVigente),
              nota: `de ${resumen.conPlanAsignado} con plan asignado`,
              color: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Ingreso mensual",
              value: formatPrecio(resumen.ingresoMensual) + "/mes",
              nota: "solo suscripciones vigentes",
              color: "text-slate-900 dark:text-slate-100",
            },
          ].map(({ label, value, nota, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3 min-w-0">
              <p className="text-xs text-slate-400 dark:text-slate-400 mb-0.5 truncate">{label}</p>
              <p className={`text-lg font-bold truncate tabular-nums ${color}`}>{value}</p>
              {nota && <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 tabular-nums">{nota}</p>}
            </div>
          ))}
        </div>
      )}

      <Tabs
        className="mb-5"
        etiqueta="Secciones del panel"
        valor={tab}
        onChange={setTab}
        // "General" y no otra vez "Negocios": la página ya se llama así (M2).
        opciones={[
          { id: 'negocios', label: 'General' },
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
          {cargandoPanel && !errorPanel ? (
            <SkeletonTarjetasNegocio />
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
                // La acción va en el propio vacío (M10), no nombrada en el texto.
                // Otro nombre que el del encabezado: dos botones iguales no se
                // distinguen al recorrer la página con un lector.
                <EmptyState
                  title="No hay negocios registrados"
                  description="Cuando des de alta el primero, aquí verás su estado, su plan y su uso."
                  action={<BotonAccion onClick={abrirNuevoNegocio}>Crear el primer negocio</BotonAccion>}
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
                    onConfirmarEmail={() => setNegocioCorreoPorConfirmar(neg)}
                    onCrearPropietario={() => abrirPropietario(neg)}
                    onColores={() => abrirColores(neg)}
                    onSuscripcion={() => abrirSuscripcion(neg)}
                    onTogglePagos={(habilitado) => togglePagos({ id: neg.id, habilitado, nombre: neg.nombre })}
                    onToggleTester={() => toggleTester({ id: neg.id, esTester: !neg.esTester, nombre: neg.nombre })}
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
          {cargandoSuscripciones ? (
            // Antes, mientras cargaba, se leía "Sin facturación todavía".
            <SkeletonLista filas={6} columnas={8} etiqueta="Cargando facturación" />
          ) : suscripcionesFiltradas.length === 0 ? (
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
                  description="No hay negocios activos que facturar."
                />
              )}
            </div>
          ) : esMovil ? (
            <TarjetasFacturacion
              filas={paginaFacturacion.visibles}
              resumen={resumen}
              onVerSuscripcion={(s) => {
                const neg = metricas?.find(m => m.id === s.negocioId);
                if (neg) abrirSuscripcion(neg);
              }}
              paginacion={paginaFacturacion.totalPaginas > 1 && (
                <Pagination
                  pagina={paginaFacturacion.pagina}
                  totalPaginas={paginaFacturacion.totalPaginas}
                  total={paginaFacturacion.total}
                  labelTotal="suscripciones"
                  onCambiar={paginaFacturacion.setPagina}
                />
              )}
            />
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
                    {/* Dos cifras distintas con nombre propio (G3): lo que cuesta
                        el plan asignado y lo que de verdad entra cada mes. */}
                    <th className="px-4 py-3 text-right whitespace-nowrap">Precio del plan</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Ingreso mensual</th>
                    <th className="px-4 py-3 text-center">Vence</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginaFacturacion.visibles.map(s => {
                    const badge = badgeFacturacion(s);
                    const sinIngreso = motivoSinIngreso(s);
                    return (
                      <tr key={s.negocioId} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                        {/* `whitespace-nowrap`: la tabla ya se desplaza en
                            horizontal; sin esto, a 390px el nombre se parte en
                            cuatro líneas y estira la fila en vez de aprovechar
                            el desplazamiento que ya existe. */}
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{s.negocioNombre}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.planNombre ? nombrePlan(s.planNombre) : '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 tabular-nums">{s.maxEmpleadosBase}</td>
                        <td className="px-4 py-3 text-center">
                          <EmpleadosExtraFila
                            suscripcion={s}
                            guardando={guardandoExtraFila && extraFilaEnCurso?.s.negocioId === s.negocioId}
                            onGuardar={(valor) => guardarExtraFila({ s, valor })}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {s.planNombre ? formatPrecio(s.totalMensual) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                          {sinIngreso ? (
                            <span title={sinIngreso} className="relative font-normal text-slate-400 dark:text-slate-500">
                              —<span className="sr-only"> {sinIngreso}</span>
                            </span>
                          ) : (
                            formatPrecio(s.ingresoMensual)
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {/* Un acceso de por vida vence el año 2126: la fecha
                              es cierta y no dice nada. */}
                          {textoVence(s)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}>
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
                  {/* El pie suma la columna "Ingreso mensual" de TODAS las filas,
                      no las de la página ni las que pasan el filtro: es el
                      ingreso del mes, y recortarlo al filtro haría que el mismo
                      rótulo significara cosas distintas según lo que esté
                      escrito en el buscador. Es la misma cifra del KPI. */}
                  <tr className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    <td colSpan={5} className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
                      Ingreso mensual · {resumen.conSuscripcionVigente} de {resumen.conPlanAsignado} con suscripción vigente
                    </td>
                    <td data-testid="total-ingreso-mensual" className="px-4 py-3 text-right text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums">
                      {formatPrecio(resumen.ingresoMensual)}
                    </td>
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

      {/* Confirmación: marcar el correo del propietario como verificado */}
      <ConfirmarAccion
        abierto={negocioCorreoPorConfirmar !== null}
        titulo="¿Confirmar el correo del propietario?"
        mensaje={
          <>
            <p>
              {negocioCorreoPorConfirmar?.propietarioEmail
                ? <>Marcarás <span className="font-medium text-foreground break-all">{negocioCorreoPorConfirmar.propietarioEmail}</span> como verificado</>
                : "Marcarás el correo del propietario como verificado"}{" "}
              sin que abra el enlace que le enviamos.
            </p>
            <p className="mt-2">Hazlo solo si ya comprobaste que el correo es suyo.</p>
          </>
        }
        etiquetaConfirmar="Confirmar correo"
        pendiente={confirmandoEmail}
        onConfirmar={() => negocioCorreoPorConfirmar && confirmarEmail(negocioCorreoPorConfirmar.id)}
        onCerrar={() => { if (!confirmandoEmail) setNegocioCorreoPorConfirmar(null); }}
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
            // La copia de `negocioSel` se tomó al abrir: tras cambiar el plan,
            // la pastilla marcada debe salir de los datos recargados.
            negocio={metricas.find((m) => m.id === negocioSel.id) ?? negocioSel}
            suscripcion={suscripcionMap[negocioSel.id]}
            planes={planes}
            errorPlanes={errorPlanes}
            onReintentarPlanes={() => recargarPlanes()}
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

          {/* En la hoja del teléfono el pie queda fijo abajo (I13). */}
          <ModalAcciones apilado>
            <button
              type="submit"
              disabled={creandoNegocio || slugNuevo === "taken" || slugNuevo === "checking"}
              className={BOTON_PIE_PRIMARIO}
            >
              {creandoNegocio ? "Creando..." : "Crear negocio"}
            </button>
          </ModalAcciones>
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
                  <ModalAcciones apilado>
                    <button
                      onClick={handleRestablecerPassword}
                      disabled={resetandoPassword || nuevaPasswordProp.length < 6 || confirmarPasswordProp.length < 6}
                      className={BOTON_PIE_PRIMARIO}
                    >
                      {resetandoPassword ? "Restableciendo…" : "Restablecer contraseña"}
                    </button>
                  </ModalAcciones>
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
                  <ModalAcciones apilado>
                    <button
                      type="submit"
                      disabled={creandoPropietario}
                      className={BOTON_PIE_PRIMARIO}
                    >
                      {creandoPropietario ? "Creando cuenta…" : "Crear propietario"}
                    </button>
                  </ModalAcciones>
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
            {/* Pie compartido de los modales: en el teléfono, apilado y fijo abajo. */}
            <ModalAcciones>
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
            </ModalAcciones>
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
            <ModalAcciones>
              <button
                onClick={() => setPasoEliminar(1)}
                className={BOTON_PIE_SECUNDARIO}
              >
                Volver
              </button>
              <button
                onClick={() => eliminarNegocio(negocioSel.id)}
                disabled={eliminandoNegocio}
                className={`${BOTON_PIE} font-semibold bg-red-700 hover:bg-red-800 text-white`}
              >
                {eliminandoNegocio ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </ModalAcciones>
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
            <ModalAcciones>
              <button onClick={() => setModalColores(false)} className={BOTON_PIE_SECUNDARIO}>
                Cancelar
              </button>
              <button onClick={() => actualizarColores()} disabled={guardandoColores || !esColorHexValido(colorPrimario)} className={BOTON_PIE_PRIMARIO}>
                {guardandoColores ? "Guardando…" : "Guardar colores"}
              </button>
            </ModalAcciones>
          </div>
        )}
      </Modal>

    </div>
  );
}
