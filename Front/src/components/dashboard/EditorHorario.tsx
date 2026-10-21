import { X, Copy } from "lucide-react";
import Switch from "../ui/Switch";
import { TimePicker, HORAS } from "../ui/DateTimePicker";
import type { HorarioDiaDto } from "../../types";
import {
  DIAS_SEMANA, HORA_MAXIMA, aplicarATodosLosAbiertos, errorDelDia, horaLegible, siguienteIntervalo,
  type Intervalo,
} from "../../lib/horario";

interface Props {
  horarios: HorarioDiaDto[];
  onCambiar: (horarios: HorarioDiaDto[]) => void;
  /** Prefijo único para los ids de las etiquetas (dos editores en la misma página). */
  idBase: string;
  /** Intervalo con el que se abre un día que estaba cerrado. */
  intervaloInicial: Intervalo;
  /** Texto de un día cerrado: "Cerrado" (negocio) o "Descanso" (empleado). */
  etiquetaCerrado: string;
  /**
   * Horario del negocio para ese día, si el editor es el de un empleado: oculta
   * las horas fuera de él, pone el tope al agregar intervalos y lo muestra como pista.
   */
  horarioPermitido?: (diaSemana: number) => Intervalo[] | null;
}

// Horas del selector fuera del horario permitido (se ocultan).
function horasFuera(intervalos: Intervalo[], paraFin: boolean): string[] {
  if (intervalos.length === 0) return [];
  return HORAS.filter((slot) =>
    !intervalos.some((iv) =>
      paraFin ? slot > iv.horaInicio && slot <= iv.horaFin : slot >= iv.horaInicio && slot < iv.horaFin,
    ),
  );
}

/**
 * Editor de horario semanal, el mismo para el negocio y para cada empleado:
 * mismas reglas al agregar intervalos, errores que dicen qué intervalo falla,
 * botones de 44 px con nombre y "Aplicar a los demás días abiertos".
 */
export default function EditorHorario({
  horarios, onCambiar, idBase, intervaloInicial, etiquetaCerrado, horarioPermitido,
}: Props) {
  const cambiarDia = (diaSemana: number, cambio: (h: HorarioDiaDto) => HorarioDiaDto) =>
    onCambiar(horarios.map((h) => (h.diaSemana === diaSemana ? cambio(h) : h)));

  const alternarDia = (diaSemana: number) =>
    cambiarDia(diaSemana, (h) => ({
      ...h,
      activo: !h.activo,
      intervalos: !h.activo && h.intervalos.length === 0 ? [{ ...intervaloInicial }] : h.intervalos,
    }));

  const abiertos = horarios.filter((h) => h.activo).length;

  return (
    <div className="space-y-2">
      {horarios.map((h) => {
        const dia = DIAS_SEMANA[h.diaSemana];
        const idDia = `${idBase}-dia-${h.diaSemana}`;
        const idError = `${idBase}-error-${h.diaSemana}`;
        const permitido = horarioPermitido?.(h.diaSemana) ?? null;
        const maximo = permitido?.length ? permitido[permitido.length - 1].horaFin : HORA_MAXIMA;
        const siguiente = siguienteIntervalo(h.intervalos, maximo, permitido?.[0]?.horaInicio);
        const error = errorDelDia(h);

        return (
          <div
            key={h.diaSemana}
            role="group"
            aria-labelledby={idDia}
            className={`rounded-lg border p-3 transition ${
              h.activo
                ? "bg-card border-border"
                : "bg-muted border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 -ml-2">
                <Switch activo={h.activo} onCambiar={() => alternarDia(h.diaSemana)} idEtiqueta={idDia} />
                {/* El nombre del día también cambia el interruptor. */}
                <span
                  id={idDia}
                  onClick={() => alternarDia(h.diaSemana)}
                  className={`text-sm font-medium cursor-pointer select-none ${h.activo ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {dia}
                </span>
              </div>
              {!h.activo && <span className="text-xs text-muted-foreground">{etiquetaCerrado}</span>}
            </div>

            {h.activo && (
              <div className="mt-2 pl-0 sm:pl-11 space-y-2">
                {h.intervalos.map((iv, idx) => {
                  const n = idx + 1;
                  const actualizar = (campo: keyof Intervalo, valor: string) =>
                    cambiarDia(h.diaSemana, (d) => ({
                      ...d,
                      intervalos: d.intervalos.map((x, j) => (j === idx ? { ...x, [campo]: valor } : x)),
                    }));
                  return (
                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">De</span>
                      <TimePicker
                        compact
                        value={iv.horaInicio}
                        onChange={(v) => actualizar("horaInicio", v)}
                        busySlots={permitido ? horasFuera(permitido, false) : undefined}
                        ariaLabel={`${dia}, inicio del intervalo ${n}`}
                      />
                      <span className="text-xs text-muted-foreground">a</span>
                      <TimePicker
                        compact
                        value={iv.horaFin}
                        onChange={(v) => actualizar("horaFin", v)}
                        minTime={iv.horaInicio}
                        busySlots={permitido ? horasFuera(permitido, true) : undefined}
                        ariaLabel={`${dia}, fin del intervalo ${n}`}
                      />
                      {h.intervalos.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            cambiarDia(h.diaSemana, (d) => ({ ...d, intervalos: d.intervalos.filter((_, j) => j !== idx) }))}
                          aria-label={`Eliminar intervalo ${n} del ${dia.toLowerCase()}`}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {permitido && permitido.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {`Horario del negocio: ${permitido.map((iv) => `${horaLegible(iv.horaInicio)}–${horaLegible(iv.horaFin)}`).join(" · ")}`}
                  </p>
                )}
                {error && (
                  <p id={idError} role="alert" className="text-xs text-red-700 dark:text-red-400">{error}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4">
                  <button
                    type="button"
                    disabled={!siguiente}
                    onClick={() => siguiente && cambiarDia(h.diaSemana, (d) => ({ ...d, intervalos: [...d.intervalos, siguiente] }))}
                    title={siguiente ? undefined : "No cabe otro intervalo después del último"}
                    className="min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-foreground hover:underline disabled:opacity-40 disabled:no-underline transition
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    + Agregar intervalo
                  </button>
                  {abiertos > 1 && (
                    <button
                      type="button"
                      onClick={() => onCambiar(aplicarATodosLosAbiertos(horarios, h.diaSemana))}
                      aria-label={`Aplicar el horario del ${dia.toLowerCase()} a los demás días abiertos`}
                      className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-foreground hover:underline transition
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      <Copy size={14} aria-hidden="true" />
                      Aplicar a los demás días abiertos
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
