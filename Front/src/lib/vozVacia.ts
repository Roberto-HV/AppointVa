// ── Estados vacíos con voz ───────────────────────────────────────────────────
//
// Una línea por lista y por sector, en tú y sin icono de lupa: el vacío se dice
// como lo diría alguien del negocio. Belleza es cálida; salud, sobria.

export type TonoVacio = "belleza" | "salud";

export type ClaveVacio = "citasRango" | "clientes" | "listaEspera";

interface TextoVacio {
  titulo: string;
  descripcion?: string;
}

export const VOZ_VACIA: Record<ClaveVacio, Record<TonoVacio, TextoVacio>> = {
  citasRango: {
    belleza: { titulo: "Nada agendado en estas fechas", descripcion: "¿Mueves el rango o creas una cita?" },
    salud: { titulo: "Sin consultas en este periodo", descripcion: "Cambia las fechas o agenda una consulta." },
  },
  clientes: {
    belleza: { titulo: "Aún no hay clientes", descripcion: "Llegan solos con su primera reserva. Comparte tu enlace para estrenar la lista." },
    salud: { titulo: "Aún no hay pacientes", descripcion: "Aparecerán aquí con su primera consulta. Comparte tu enlace de citas." },
  },
  listaEspera: {
    belleza: { titulo: "Nadie en espera por ahora", descripcion: "Cuando un horario se llene, quien quiera un lugar aparecerá aquí." },
    salud: { titulo: "Sin pacientes en espera", descripcion: "Cuando una agenda se llene, quien pida un lugar aparecerá aquí." },
  },
};

/** El tono que corresponde a un sector del negocio; todo lo que no es salud habla como belleza. */
export function tonoDeSector(sector: string | null | undefined): TonoVacio {
  return sector === "salud" ? "salud" : "belleza";
}

export function textoVacio(clave: ClaveVacio, tono: TonoVacio): TextoVacio {
  return VOZ_VACIA[clave][tono];
}
