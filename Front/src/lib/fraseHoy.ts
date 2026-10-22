import type { CitaDto } from "../types";
import { citaAbierta } from "./estadoCita";
import { describirCuandoCita, formatALasHora } from "../utils/formatters";

// ── La frase de "hoy" del Inicio ─────────────────────────────────────────────
//
// Una sola oración en lugar del saludo suelto y las tarjetas de cifras:
// "Buenas tardes, Aramis. Hoy tienes 4 citas; la siguiente es Corte de dama a
// las 5:30 p. m. con Sofía." Los trozos con `enfasis` van en negritas.

export type CitaFrase = Pick<CitaDto, "inicioEn" | "finEn" | "estadoTexto" | "nombreServicio" | "nombreCliente">;

/** Lo mínimo de una próxima cita (`resumen.proximasCitas`) para anunciar la de mañana. */
export type ProximaFrase = Pick<CitaDto, "inicioEn" | "estadoTexto">;

export interface TrozoFrase {
  texto: string;
  enfasis?: boolean;
}

/** Mismo corte que la vista del empleado: mañana antes de las 12, tarde hasta las 19. */
export function saludoDelDia(fecha: Date = new Date()): string {
  const h = fecha.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? "";
}

function conCliente(nombreCliente: string): string {
  const nombre = primerNombre(nombreCliente);
  return nombre ? ` con ${nombre}` : "";
}

/** Términos en minúscula y en singular/plural ("cita"/"citas", "consulta"/"consultas"). */
export interface TerminosFrase {
  cita: string;
  citas: string;
}

/**
 * "mañana a las 8:00 a. m." si la próxima cita abierta empieza mañana y dentro
 * de las próximas 24 h; si no, `null`.
 */
export function siguienteManana(proximas: ProximaFrase[], ahora: Date): string | null {
  const t = ahora.getTime();
  const siguiente = proximas
    .filter((c) => citaAbierta(c.estadoTexto) && new Date(c.inicioEn).getTime() > t)
    .sort((a, b) => new Date(a.inicioEn).getTime() - new Date(b.inicioEn).getTime())[0];
  if (!siguiente || new Date(siguiente.inicioEn).getTime() - t > 24 * 3_600_000) return null;
  const cuando = describirCuandoCita(siguiente.inicioEn, ahora);
  return cuando?.dias === 1 ? cuando.texto : null;
}

/**
 * Lo que queda de la frase después del saludo. Las canceladas no cuentan: no
 * ocupan la agenda. Sin citas devuelve "Agenda libre hoy."; si no queda nada
 * hoy pero `proximas` trae una para mañana (≤ 24 h), lo añade:
 * "Agenda libre hoy; la siguiente es mañana a las 8:00 a. m.".
 */
export function fraseDeHoy(
  citas: CitaFrase[],
  ahora: Date = new Date(),
  terminos: TerminosFrase = { cita: "cita", citas: "citas" },
  proximas: ProximaFrase[] = [],
): TrozoFrase[] {
  const manana = () => siguienteManana(proximas, ahora);
  const activas = citas
    .filter((c) => c.estadoTexto !== "Cancelada")
    .sort((a, b) => new Date(a.inicioEn).getTime() - new Date(b.inicioEn).getTime());
  const n = activas.length;
  if (n === 0) {
    const cuandoManana = manana();
    return cuandoManana
      ? [{ texto: "Agenda libre hoy; la siguiente es " }, { texto: cuandoManana, enfasis: true }, { texto: "." }]
      : [{ texto: "Agenda libre hoy." }];
  }

  const cuenta = `${n} ${n === 1 ? terminos.cita : terminos.citas}`;
  const t = ahora.getTime();
  const siguiente = activas.find((c) => citaAbierta(c.estadoTexto) && new Date(c.inicioEn).getTime() > t);
  const enCurso = activas.find(
    (c) => citaAbierta(c.estadoTexto) && new Date(c.inicioEn).getTime() <= t && new Date(c.finEn).getTime() > t,
  );

  if (siguiente) {
    const cuando = `${siguiente.nombreServicio} ${formatALasHora(new Date(siguiente.inicioEn))}`;
    return [
      { texto: "Hoy tienes " },
      { texto: cuenta, enfasis: true },
      { texto: n === 1 ? ": " : "; la siguiente es " },
      { texto: cuando, enfasis: true },
      { texto: `${conCliente(siguiente.nombreCliente)}.` },
    ];
  }

  if (enCurso) {
    return [
      { texto: "Hoy tienes " },
      { texto: cuenta, enfasis: true },
      { texto: "; ahora atiendes " },
      { texto: enCurso.nombreServicio, enfasis: true },
      { texto: `${conCliente(enCurso.nombreCliente)}.` },
    ];
  }

  // Ninguna por delante ni en curso: el día de citas ya pasó.
  const cuandoManana = manana();
  return [
    { texto: "Hoy tuviste " },
    { texto: cuenta, enfasis: true },
    ...(cuandoManana
      ? [{ texto: " y ya no quedan más; la siguiente es " }, { texto: cuandoManana, enfasis: true }, { texto: "." }]
      : [{ texto: " y ya no quedan más." }]),
  ];
}

/** El saludo con el nombre: "Buenas tardes, Aramis." (sin nombre, solo el saludo). */
export function saludoConNombre(nombre: string, ahora: Date = new Date()): string {
  const saludo = saludoDelDia(ahora);
  return nombre ? `${saludo}, ${nombre}.` : `${saludo}.`;
}

/** La frase completa como texto plano (lectores de pantalla, pruebas). */
export function textoFrase(trozos: TrozoFrase[]): string {
  return trozos.map((t) => t.texto).join("");
}
