import { describe, it, expect } from "vitest";
import { ESTADO_CITA, ESTADOS_CITA, estiloEstadoCita, citaAbierta } from "./estadoCita";

const TOKEN: Record<string, string> = {
  Pendiente: "pending",
  Confirmada: "confirmed",
  Completada: "completed",
  Cancelada: "cancelled",
  Inasistencia: "absent",
};

// Paletas crudas de Tailwind que antes usaba cada vista por su cuenta.
const PALETA_CRUDA = /\b(?:bg|text|border)-(?:green|blue|red|amber|yellow|gray|emerald|orange|slate)-\d{2,3}\b/;

describe("estadoCita — mapa único de estados", () => {
  it("cubre los cinco estados del backend", () => {
    expect(ESTADOS_CITA).toEqual(["Pendiente", "Confirmada", "Completada", "Cancelada", "Inasistencia"]);
  });

  it.each(ESTADOS_CITA)("%s usa solo su token --status-* en todas sus variantes", (estado) => {
    const estilo = ESTADO_CITA[estado];
    const token = TOKEN[estado];
    for (const clases of [estilo.badge, estilo.bloque, estilo.punto, estilo.texto]) {
      expect(clases).toContain(`status-${token}-`);
      expect(clases).not.toMatch(PALETA_CRUDA);
      // Ningún otro estado se cuela en las clases.
      for (const otro of Object.values(TOKEN).filter((t) => t !== token)) {
        expect(clases).not.toContain(`status-${otro}-`);
      }
    }
  });

  it("cada estado tiene su etiqueta e icono, y no se repiten", () => {
    const etiquetas = ESTADOS_CITA.map((e) => ESTADO_CITA[e].etiqueta);
    const iconos = ESTADOS_CITA.map((e) => ESTADO_CITA[e].Icono);
    expect(new Set(etiquetas).size).toBe(5);
    expect(new Set(iconos).size).toBe(5);
  });

  it("los bloques rellenos nunca usan texto blanco", () => {
    for (const estado of ESTADOS_CITA) {
      expect(ESTADO_CITA[estado].bloque).not.toContain("text-white");
    }
  });

  it("un estado desconocido cae en un estilo neutro con su propio texto", () => {
    const estilo = estiloEstadoCita("EnRevision");
    expect(estilo.etiqueta).toBe("EnRevision");
    expect(estilo.badge).toContain("status-absent-");
  });

  it("solo Pendiente y Confirmada admiten acciones", () => {
    expect(ESTADOS_CITA.filter(citaAbierta)).toEqual(["Pendiente", "Confirmada"]);
  });
});
