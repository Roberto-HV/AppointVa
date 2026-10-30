import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

function SkeletonTableRows({ filas, columnas }: { filas: number; columnas: number }) {
  return (
    <>
      {Array.from({ length: filas }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: columnas }).map((_, j) => (
            <td key={j} className="px-3 py-2">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SkeletonCards({ cantidad }: { cantidad: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ filas = 5 }: { filas?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: filas }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

// ── Skeletons por variante (I14) ─────────────────────────────────────────────
//
// Cada uno copia la caja real de su pantalla —tarjeta, relleno, alto de fila,
// columnas— para que al llegar el contenido nada salte. Los que cambian entre
// teléfono y escritorio pintan las dos variantes y dejan que el breakpoint `sm`
// (el mismo de las listas reales) elija: tarjetas abajo de 640px y filas arriba.
// `role="status"` + `aria-label`: el lector anuncia que carga, no veinte cajas.

const CARTA = "bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700";

function Cargando({ etiqueta, className, children }: { etiqueta: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={etiqueta} className={className}>
      {children}
    </div>
  );
}

/**
 * Lista adaptable: tarjetas apiladas en el teléfono y filas de tabla en
 * escritorio. `tarjeta` elige la forma de la tarjeta del teléfono: la de una
 * cita (`TarjetaCita`: nombre, servicio, hora · precio y botones) o la de un
 * cliente (avatar, nombre y dos líneas).
 */
function SkeletonLista({
  filas = 6, columnas = 6, tarjeta = "cita", etiqueta = "Cargando",
}: { filas?: number; columnas?: number; tarjeta?: "cita" | "cliente"; etiqueta?: string }) {
  const n = Array.from({ length: filas });
  return (
    <Cargando etiqueta={etiqueta}>
      <ul data-variante="tarjetas" className={`sm:hidden ${CARTA} divide-y divide-slate-100 dark:divide-slate-700`}>
        {n.map((_, i) => (
          <li key={i} className={tarjeta === "cita" ? "px-4 py-3 space-y-2" : "flex items-center gap-3 px-4 py-3"}>
            {tarjeta === "cita" ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-11 w-28 rounded-xl" />
                  <Skeleton className="h-11 w-11 rounded-xl" />
                </div>
              </>
            ) : (
              <>
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <div data-variante="filas" className={`hidden sm:block ${CARTA} overflow-hidden`}>
        <div className="flex gap-6 px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          {Array.from({ length: columnas }).map((_, j) => <Skeleton key={j} className="h-3 flex-1 max-w-[6rem]" />)}
        </div>
        {n.map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
            <div className="flex-1 flex items-center gap-3 min-w-0">
              {tarjeta === "cliente" && <Skeleton className="w-8 h-8 rounded-full shrink-0" />}
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            {Array.from({ length: Math.max(0, columnas - 2) }).map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
            <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </Cargando>
  );
}

/** Tarjetas de Empleados: foto redonda, nombre con estado, contacto y la fila de acciones. */
function SkeletonTarjetasEmpleado({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <Cargando etiqueta="Cargando equipo" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} data-variante="tarjeta-empleado" className={`${CARTA} p-5 flex flex-col gap-4`}>
          <div className="flex gap-4">
            <Skeleton className="w-14 h-14 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <Skeleton className="h-11 lg:h-9 rounded-xl" />
            <Skeleton className="h-11 lg:h-9 rounded-xl" />
            <Skeleton className="h-11 lg:h-9 rounded-xl" />
            <Skeleton className="h-11 w-11 lg:h-9 lg:w-9 rounded-xl" />
          </div>
        </div>
      ))}
    </Cargando>
  );
}

/** Filas de Servicios: rótulo de categoría y tarjeta con imagen, nombre, precio y controles. */
function SkeletonServicios({ filas = 5 }: { filas?: number }) {
  return (
    <Cargando etiqueta="Cargando servicios" className="space-y-6">
      <div>
        <Skeleton className="h-3 w-24 mb-2" />
        <div className={CARTA}>
          {Array.from({ length: filas }).map((_, i) => (
            <div key={i} data-variante="fila-servicio" className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-4 sm:pl-7 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
              <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0 basis-0 space-y-1.5">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 sm:gap-5">
                <Skeleton className="h-4 w-16" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-11 rounded-full" />
                  <Skeleton className="h-11 w-11 sm:w-20 lg:h-9 rounded-xl" />
                  <Skeleton className="h-11 w-11 lg:h-9 lg:w-9 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Cargando>
  );
}

/** Inicio de la dueña: agenda de hoy, citas e ingresos (3 + 3), gráfica y las dos columnas finales. */
function SkeletonInicio() {
  const fila = (n: number, clase: string) => (
    <div className={`grid grid-cols-3 gap-2 sm:gap-3 ${clase}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-4 space-y-2.5">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-6 sm:h-7 w-1/2" />
        </div>
      ))}
    </div>
  );
  return (
    <Cargando etiqueta="Cargando resumen">
      <div data-variante="agenda" className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="h-3 w-12 mb-2.5" />
      {fila(3, "mb-6")}
      <Skeleton className="h-3 w-16 mb-2.5" />
      {fila(3, "mb-8")}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${CARTA} p-5 space-y-3`}>
          <Skeleton className="h-4 w-28 mb-2" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
        <div className={`${CARTA} p-5 space-y-3`}>
          <Skeleton className="h-4 w-28 mb-2" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-7" />)}
        </div>
      </div>
    </Cargando>
  );
}

/** Línea de tiempo: una fila por empleado con su nombre y bloques de cita. */
function SkeletonJornada({ filas = 4 }: { filas?: number }) {
  return (
    <Cargando etiqueta="Cargando jornada" className="divide-y divide-slate-100 dark:divide-slate-700">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} data-variante="carril" className="flex items-center gap-3 px-3 py-3">
          <div className="w-28 sm:w-36 shrink-0 flex items-center gap-2">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
          <div className="flex-1 relative h-10">
            <Skeleton className="absolute top-0 h-10 rounded-lg" style={{ left: `${8 + i * 9}%`, width: "18%" }} />
            <Skeleton className="absolute top-0 h-10 rounded-lg" style={{ left: `${45 + (i % 2) * 12}%`, width: "14%" }} />
          </div>
        </div>
      ))}
    </Cargando>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#C8A961] flex items-center justify-center text-white font-bold text-lg animate-pulse select-none">
          AV
        </div>
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    </div>
  );
}

export {
  Skeleton, SkeletonTableRows, SkeletonCards, SkeletonList, SkeletonStat, PageLoader,
  SkeletonLista, SkeletonTarjetasEmpleado, SkeletonServicios, SkeletonInicio, SkeletonJornada,
};
