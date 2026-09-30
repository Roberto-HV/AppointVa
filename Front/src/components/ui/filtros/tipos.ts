import type { ReactNode } from "react";

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
  /** Contador opcional junto a la etiqueta (solo en pills). */
  conteo?: number;
}

export interface PresetRango {
  etiqueta: string;
  desde: string;
  hasta: string;
}

interface CampoBase {
  /** Identificador estable; sirve de `key` y de base para los `id` de los labels. */
  id: string;
  /** Texto del label visible. Siempre presente: todo control queda etiquetado. */
  etiqueta: string;
}

export interface CampoSelect extends CampoBase {
  tipo: "select";
  valor: string;
  onChange: (valor: string) => void;
  opciones: OpcionFiltro[];
  /** Valor que significa "sin filtrar". Por defecto "". */
  valorNeutro?: string;
  /** Etiqueta de la opción neutra. Por defecto "Todos". */
  etiquetaNeutra?: string;
}

export interface CampoPills extends CampoBase {
  tipo: "pills";
  valor: string;
  onChange: (valor: string) => void;
  opciones: OpcionFiltro[];
  /** Valor que significa "sin filtrar". Por defecto "". */
  valorNeutro?: string;
  /** Etiqueta de la opción neutra; si se omite no se agrega pill neutra. */
  etiquetaNeutra?: string;
}

export interface CampoRangoFechas extends CampoBase {
  tipo: "rangoFechas";
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  presets?: PresetRango[];
  /** Rango que significa "sin filtrar"; si se omite, cualquier fecha cuenta como activa. */
  rangoNeutro?: { desde: string; hasta: string };
}

/** Escotilla de escape para controles que no encajan en los tipos anteriores. */
export interface CampoPersonalizado extends CampoBase {
  tipo: "personalizado";
  activo: boolean;
  contenido: ReactNode;
}

export type CampoFiltro = CampoSelect | CampoPills | CampoRangoFechas | CampoPersonalizado;

/** Decide si un campo cuenta para el badge de "Filtros" y para "Limpiar". */
export function campoActivo(campo: CampoFiltro): boolean {
  switch (campo.tipo) {
    case "select":
    case "pills":
      return campo.valor !== (campo.valorNeutro ?? "");
    case "rangoFechas": {
      if (!campo.desde && !campo.hasta) return false;
      if (!campo.rangoNeutro) return true;
      return campo.desde !== campo.rangoNeutro.desde || campo.hasta !== campo.rangoNeutro.hasta;
    }
    case "personalizado":
      return campo.activo;
  }
}
