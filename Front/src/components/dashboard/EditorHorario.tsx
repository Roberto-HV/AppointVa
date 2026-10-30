import { useState } from "react";
import { X, Copy, Plus } from "lucide-react";
import Switch from "../ui/Switch";
import Select from "../ui/Select";
import { TimePicker, HORAS } from "../ui/DateTimePicker";
import type { HorarioDiaDto } from "../../types";
import {
  DIAS_SEMANA, HORA_MAXIMA, aplicarATodosLosAbiertos, avisoAplicar, errorDelDia, horaLegible, siguienteIntervalo,
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
 * mismas reglas al agregar intervalos, errores que dicen qué intervalo falla y
 * botones de 44 px con nombre.
 *
 * Una fila compacta por día (M12), como Calendly: interruptor y día a la
 * izquierda, intervalos en línea y "+" al final. "Aplicar a todos" va una sola
 * vez arriba, eligiendo de qué día se copia, en vez de repetirse en cada tarjeta.
 * En el teléfono los intervalos bajan a su propio renglón y el "+" queda junto
 * al nombre del día.
 */
export default function EditorHorario({
  horarios, onCambiar, idBase, intervaloInicial, etiquetaCerrado, horarioPermitido,
}: Props) {
  // Qué pasó al copiar un día a los demás, cuando no fue una copia exacta.
  const [aviso, setAviso] = useState<string | null>(null);
  const [origenElegido, setOrigenElegido] = useState<number | null>(null);

  const cambiarDia = (diaSemana: number, cambio: (h: HorarioDiaDto) => HorarioDiaDto) =>
    onCambiar(horarios.map((h) => (h.diaSemana === diaSemana ? cambio(h) : h)));

  // En el editor de un empleado la copia se recorta al horario del negocio de
  // cada día, y se omite donde no cabe; se avisa en vez de dejar horas que el
  // negocio no tiene abiertas.
  const aplicarALosDemas = (diaSemana: number) => {
    const resultado = aplicarATodosLosAbiertos(horarios, diaSemana, horarioPermitido);
    onCambiar(resultado.horarios);
    setAviso(avisoAplicar(resultado));
  };

  const alternarDia = (diaSemana: number) =>
    cambiarDia(diaSemana, (h) => ({
      ...h,
      activo: !h.activo,
      intervalos: !h.activo && h.intervalos.length === 0 ? [{ ...intervaloInicial }] : h.intervalos,
    }));

  const diasAbiertos = horarios.filter((h) => h.activo);
  // Si el día elegido se cerró, se copia del primero abierto.
  const origen = diasAbiertos.some((h) => h.diaSemana === origenElegido)
    ? origenElegido!
    : diasAbiertos[0]?.diaSemana ?? null;
  const idOrigen = `${idBase}-origen`;

  return (
    <div className="space-y-3">
      {diasAbiertos.length > 1 && origen !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <label id={idOrigen} className="text-sm text-muted-foreground">Copiar el horario del</label>
          <Select
            value={String(origen)}
            onChange={(e) => setOrigenElegido(Number(e.target.value))}
            aria-labelledby={idOrigen}
            className="w-36"
          >
            {diasAbiertos.map((h) => (
              <option key={h.diaSemana} value={h.diaSemana}>{DIAS_SEMANA[h.diaSemana].toLowerCase()}</option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => aplicarALosDemas(origen)}
            // El texto visible va al inicio del nombre accesible (WCAG 2.5.3).
            aria-label={`Aplicar a todos el horario del ${DIAS_SEMANA[origen].toLowerCase()}`}
            className="min-h-[44px] lg:min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-lg border border-border dark:border-slate-600 text-sm font-medium text-foreground hover:bg-muted transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy size={14} aria-hidden="true" className="text-muted-foreground" />
            Aplicar a todos
          </button>
        </div>
      )}
      <p
        role="status"
        className={aviso ? "rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "sr-only"}
      >
        {aviso ?? ""}
      </p>
      <div className="rounded-lg border border-border divide-y divide-border">
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
              className={`flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-1 pl-1 pr-2 py-1.5 transition ${h.activo ? "" : "bg-muted/60"}`}
            >
              <div className="flex items-center gap-1 min-h-[44px] flex-1 sm:flex-none sm:w-36">
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

              {h.activo ? (
                <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 min-w-0 space-y-1 pb-1 sm:pb-0">
                  {h.intervalos.map((iv, idx) => {
                    const n = idx + 1;
                    const actualizar = (campo: keyof Intervalo, valor: string) =>
                      cambiarDia(h.diaSemana, (d) => ({
                        ...d,
                        intervalos: d.intervalos.map((x, j) => (j === idx ? { ...x, [campo]: valor } : x)),
                      }));
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <TimePicker
                          compact
                          value={iv.horaInicio}
                          onChange={(v) => actualizar("horaInicio", v)}
                          busySlots={permitido ? horasFuera(permitido, false) : undefined}
                          ariaLabel={`${dia}, inicio del intervalo ${n}`}
                        />
                        <span className="text-xs text-muted-foreground" aria-hidden="true">–</span>
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
                </div>
              ) : (
                <span className="min-h-[44px] flex items-center text-xs text-muted-foreground sm:flex-1">{etiquetaCerrado}</span>
              )}

              {h.activo && (
                <button
                  type="button"
                  disabled={!siguiente}
                  onClick={() => siguiente && cambiarDia(h.diaSemana, (d) => ({ ...d, intervalos: [...d.intervalos, siguiente] }))}
                  aria-label={`Agregar intervalo al ${dia.toLowerCase()}`}
                  title={siguiente ? "Agregar intervalo" : "No cabe otro intervalo después del último"}
                  className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
