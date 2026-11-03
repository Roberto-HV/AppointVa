import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Printer, Pencil, Trash2 } from "lucide-react";
import {
  adminApi,
  type NegocioMetricasDto,
  type PlanDto,
  type SuscripcionResumenDto,
  type PagoSuscripcionDto,
  type EditarPagoRequestDto,
} from "../../../api/admin";
import ConfirmarAccion from "../../../components/ui/ConfirmarAccion";
import Tabs from "../../../components/ui/Tabs";
import EmptyState from "../../../components/ui/EmptyState";
import ErrorCarga from "../../../components/ui/ErrorCarga";
import MenuAcciones from "../../../components/ui/MenuAcciones";
import Pagination from "../../../components/ui/Pagination";
import { Skeleton } from "../../../components/ui/Skeleton";
import { usePaginacionLocal } from "../../../hooks/usePaginacionLocal";
import { useToastStore } from "../../../store/toastStore";
import { formatFecha, formatFechaCorta, formatPrecio } from "../../../utils/formatters";
import { generarHTMLComprobante } from "../../../utils/comprobanteSuscripcion";
import { mensajeError } from "../../../utils/errores";
import { validarEdicionPago, nombrePlan } from "../../../utils/negociosAdmin";
import { esCancelacion } from "../../../lib/pruebaReautenticacion";
import BadgeSuscripcion from "./BadgeSuscripcion";
import { useReautenticacion } from "./useReautenticacion";
import { DIAS_DE_POR_VIDA, LIFETIME_SENTINEL } from "./formatoSuscripcion";
import { BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO, CAMPO_MODAL, CAMPO_OK } from "./estilos";

function imprimirComprobante(pago: PagoSuscripcionDto) {
  const w = window.open("", "_blank", "width=640,height=820");
  if (!w) return;
  w.document.write(generarHTMLComprobante(pago));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/**
 * Suscripción de un negocio: plan, sector, empleados extra, registrar pagos y su
 * historial. Es el contenido del modal "Suscripción" y, desde el lote 4, también
 * la sección "Suscripción y pagos" de la ficha del negocio.
 *
 * En el modal reparte el contenido en dos pestañas (Cuenta y Pagos). En la ficha
 * (`completa`) ya hay una pestaña para todo esto, así que una segunda bandeja
 * dentro de la primera sobraría: las dos partes van una debajo de la otra.
 */
export default function SuscripcionNegocio({
  negocio,
  suscripcion,
  planes,
  errorPlanes = false,
  onReintentarPlanes,
  completa = false,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  planes: PlanDto[];
  /** Falló la consulta de planes: en vez de "cargando" para siempre, se dice y se reintenta. */
  errorPlanes?: boolean;
  onReintentarPlanes?: () => void;
  /** Cuenta y Pagos a la vista a la vez, sin la bandeja de pestañas. */
  completa?: boolean;
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

  // Lote 5 (G1): dejar al negocio con acceso permanente pide reautenticación. "De por vida"
  // la pide de entrada; cualquier otro pago o edición la pide solo si el servidor responde
  // que el vencimiento resultante llega a acceso permanente (los pagos se acumulan), así el
  // front no duplica la regla del backend.
  const reautenticacion = useReautenticacion(`dar acceso permanente a ${negocio.nombre}`);

  const { mutate: registrar, isPending: registrando } = useMutation({
    mutationFn: () => {
      const dto = { mesesPagados: meses, monto: parseFloat(monto) || 0, notas: notas.trim() || undefined };
      return meses === LIFETIME_SENTINEL
        ? reautenticacion.conReautenticacion((prueba) => adminApi.registrarPago(negocio.id, dto, prueba))
        : reautenticacion.siLaPide((prueba) => adminApi.registrarPago(negocio.id, dto, prueba));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagos-negocio", negocio.id] });
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      // Vuelve al monto sugerido para los meses que siguen marcados, no a vacío.
      setMontoManual(null);
      setNotas("");
      toast("Pago registrado correctamente");
    },
    onError: (err: unknown) => {
      if (esCancelacion(err)) return;
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
        reautenticacion.siLaPide((prueba) => adminApi.editarPago(pagoId, dto, prueba)),
    onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["pagos-negocio", negocio.id] });
        qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
        setEditandoId(null);
        toast("Pago actualizado");
    },
    onError: (err: unknown) => {
      if (esCancelacion(err)) return;
      toast(mensajeError(err, "No se pudo actualizar el pago"), "error");
    },
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

  const seccionCuenta = (
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
  );

  const seccionPagos = (
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
        ) : errorHistorial && historial.length === 0 ? (
          // Si un refetch falla con pagos ya cargados, se siguen mostrando.
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
  );

  // Acceso permanente: "Confirma que eres tú" en lugar del contenido, hasta confirmar o cancelar.
  if (reautenticacion.formulario) {
    return <div className="max-w-md">{reautenticacion.formulario}</div>;
  }

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

      {completa ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <SeccionTitulada titulo="Cuenta">{seccionCuenta}</SeccionTitulada>
          <SeccionTitulada titulo="Pagos">{seccionPagos}</SeccionTitulada>
        </div>
      ) : (
        <>
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
          {tab === 'cuenta' && seccionCuenta}
          {tab === 'pagos' && seccionPagos}
        </>
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

function SeccionTitulada({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{titulo}</h3>
      {children}
    </section>
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
