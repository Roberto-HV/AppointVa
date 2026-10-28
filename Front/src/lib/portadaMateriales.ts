import type { FondoPortada } from "./portadaPresets";

// ── Fondos de materiales ──────────────────────────────────────────────────────
// A diferencia del resto del catálogo, estos fondos no salen del color de marca:
// imitan una superficie real (cuarzo, mármol, duela, piel…) y sus colores están
// curados a mano. Se dibujan con SVG en línea: ruido de `feTurbulence` con semilla
// fija —el mismo dibujo en cualquier navegador y en cualquier visita— que se
// recorta con tablas de transferencia para sacar vetas, grano o poros. No hay
// imágenes externas ni peticiones de red.
//
// El lienzo mide 1600×600 y se escala con `cover`: en un móvil se ve la franja
// central y en escritorio casi todo, sin repetición que delate el mosaico.

const ANCHO = 1600;
const ALTO = 600;

/** "#rrggbb" → "r g b" en 0–1, para la última columna de una feColorMatrix. */
function canales(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => +(c / 255).toFixed(3))
    .join(" ");
}

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function lienzo(contenido: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">` +
    contenido +
    `</svg>`
  );
}

interface Capa {
  id: string;
  /** baseFrequency; dos valores estiran el ruido en un eje. */
  frec: string;
  octavas: number;
  semilla: number;
  color: string;
  /** tableValues del canal alfa: decide qué parte del ruido se pinta. */
  tabla?: string;
  /**
   * Alternativa a `tabla`: solo pinta donde el ruido supera este valor (0–1), con
   * una rampa lineal muy empinada. Ocupa una fracción de lo que ocupa una tabla escalón.
   */
  umbral?: number;
  opacidad?: number;
  tipo?: "fractalNoise" | "turbulence";
  /** Desenfoque del trazo; suaviza los bordes pixelados de la tabla. */
  suave?: number;
  /** Halo difuso bajo el trazo, como la veta que se funde con la piedra. */
  halo?: number;
  /** Giro del ruido en grados: las vetas de la piedra rara vez corren rectas. */
  giro?: number;
}

/** Filtro + rectángulo de una capa de ruido coloreado. */
function capa(c: Capa): string {
  const filtro =
    `<filter id="${c.id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="${c.tipo ?? "fractalNoise"}" baseFrequency="${c.frec}" numOctaves="${c.octavas}" seed="${c.semilla}"/>` +
    `<feColorMatrix values="0 0 0 0 ${canales(c.color).split(" ").join(" 0 0 0 0 ")} 1 0 0 0 0"/>` +
    `<feComponentTransfer result="v">` +
    (c.umbral !== undefined
      ? `<feFuncA type="linear" slope="25" intercept="${+(-25 * c.umbral).toFixed(2)}"/>`
      : `<feFuncA type="table" tableValues="${c.tabla}"/>`) +
    `</feComponentTransfer>` +
    (c.suave ? `<feGaussianBlur stdDeviation="${c.suave}" result="s"/>` : "") +
    (c.halo
      ? `<feGaussianBlur in="v" stdDeviation="${c.halo}" result="h"/>` +
        `<feMerge><feMergeNode in="h"/><feMergeNode in="${c.suave ? "s" : "v"}"/></feMerge>`
      : "") +
    `</filter>`;
  const op = c.opacidad !== undefined ? ` opacity="${c.opacidad}"` : "";
  if (!c.giro) {
    return `${filtro}<rect width="${ANCHO}" height="${ALTO}" filter="url(#${c.id})"${op}/>`;
  }
  // El rectángulo girado tiene que seguir cubriendo el lienzo entero, y no más:
  // cada píxel de más es ruido que se calcula y no se ve.
  const rad = (Math.abs(c.giro) * Math.PI) / 180;
  const w = Math.ceil(ANCHO * Math.cos(rad) + ALTO * Math.sin(rad));
  const h = Math.ceil(ANCHO * Math.sin(rad) + ALTO * Math.cos(rad));
  return (
    `${filtro}<g transform="rotate(${c.giro} ${ANCHO / 2} ${ALTO / 2})">` +
    `<rect x="${(ANCHO - w) / 2}" y="${(ALTO - h) / 2}" width="${w}" height="${h}" filter="url(#${c.id})"${op}/></g>`
  );
}

/**
 * Relieve: el ruido se usa como mapa de alturas y se ilumina con una luz rasante.
 * Sale un gris opaco que se funde con `soft-light` sobre el color de abajo: los
 * poros y crestas aclaran y oscurecen el material sin cambiarle el tono.
 */
function relieve(frec: string, octavas: number, semilla: number, altura: number, elevacion = 50): string {
  return svgUrl(
    lienzo(
      `<filter id="r" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${frec}" numOctaves="${octavas}" seed="${semilla}"/>` +
        `<feDiffuseLighting surfaceScale="${altura}" lighting-color="#fff">` +
        `<feDistantLight azimuth="235" elevation="${elevacion}"/></feDiffuseLighting></filter>` +
        `<rect width="${ANCHO}" height="${ALTO}" filter="url(#r)"/>`,
    ),
  );
}

/** Oscurece el pie de la portada, donde va el nombre en blanco. */
const PIE_OSCURO = "linear-gradient(180deg, rgba(8,8,10,0) 40%, rgba(8,8,10,0.5) 100%)";

function material(svg: string, base: string, pie?: string, relieveUrl?: string): FondoPortada {
  const capas = [
    pie,
    relieveUrl && `${relieveUrl} center / cover no-repeat`,
    `${svgUrl(lienzo(svg))} center / cover no-repeat`,
    base,
  ].filter((c): c is string => !!c);
  const fondo: FondoPortada = { background: capas.join(", ") };
  if (relieveUrl) {
    fondo.backgroundBlendMode = capas
      .map((c) => (c.startsWith(relieveUrl) ? "soft-light" : "normal"))
      .join(", ");
  }
  return fondo;
}

// ── Piedras ───────────────────────────────────────────────────────────────────

interface Vetas {
  id: string;
  /** Posición y grosor de cada veta antes de deformarla, en el marco girado. */
  lineas: [number, number][];
  color: string;
  opacidad: number;
  giro: number;
  frec: string;
  octavas: number;
  semilla: number;
  /** Cuánto se aparta la veta de la recta: más escala, más serpentea. */
  escala: number;
  suave?: number;
  halo?: number;
}

/**
 * Vetas de piedra: rectas paralelas que un ruido de baja frecuencia desplaza
 * hasta hacerlas serpentear. Es el truco clásico del mármol procedural (una onda
 * perturbada por turbulencia): a diferencia de recortar curvas de nivel, el trazo
 * conserva su grosor y corre en una dirección, como una veta de verdad.
 */
function vetas(v: Vetas): string {
  const m = 160;
  const filtro =
    `<filter id="${v.id}" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${ANCHO + 2 * m}" height="${ALTO + 2 * m}" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${v.frec}" numOctaves="${v.octavas}" seed="${v.semilla}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="${v.escala}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
    // Desenfocar y volver a subir el alfa alisa el borde: el desplazamiento mueve
    // cada píxel por su cuenta y, sin esto, la veta queda en dientes de sierra.
    (v.suave
      ? `<feGaussianBlur stdDeviation="${v.suave}"/>` +
        `<feComponentTransfer result="d"><feFuncA type="table" tableValues="0 0.75 1 1"/></feComponentTransfer>`
      : "") +
    (v.halo
      ? `<feGaussianBlur in="d" stdDeviation="${v.halo}" result="h"/><feMerge><feMergeNode in="h"/><feMergeNode in="d"/></feMerge>`
      : "") +
    `</filter>`;
  const trazos = v.lineas
    .map(([y, w]) => `<path d="M-700 ${y}H2300" stroke-width="${w}"/>`)
    .join("");
  return (
    filtro +
    `<g filter="url(#${v.id})" opacity="${v.opacidad}">` +
    `<g transform="rotate(${v.giro} ${ANCHO / 2} ${ALTO / 2})" stroke="${v.color}" fill="none">${trazos}</g></g>`
  );
}

interface OpcionesPiedra {
  base: string;
  nube: string;
  nubeOpacidad: number;
  vetaFina: string;
  vetaFinaOpacidad: number;
  veta: string;
  vetaOpacidad: number;
  semilla: number;
  giro: number;
  pie?: string;
  /** Vetas principales [y, grosor]; pocas y marcadas dan el carácter. */
  principales?: [number, number][];
  /** Vetas secundarias; muchas y finas, casi un rumor. */
  secundarias?: [number, number][];
  /** Sombra ancha y desenfocada que acompaña a las vetas, como en el mármol natural. */
  difusa?: { color: string; opacidad: number };
}

const PRINCIPALES: [number, number][] = [[-40, 5], [170, 2.5], [330, 7], [560, 3], [760, 4.5]];
const SECUNDARIAS: [number, number][] = [
  [-120, 1.2], [20, 1], [90, 1.6], [230, 1], [280, 1.3], [410, 1], [470, 1.8],
  [620, 1.1], [690, 1.4], [840, 1],
];

function piedra(o: OpcionesPiedra): FondoPortada {
  const s = o.semilla;
  const svg =
    // Nubes: manchas grandes y blandas que le dan profundidad a la piedra.
    capa({
      id: "n", frec: "0.0024 0.0045", octavas: 4, semilla: s, color: o.nube,
      tabla: "0 0 0.15 0.45 0.8", opacidad: o.nubeOpacidad, giro: o.giro,
    }) +
    (o.difusa
      ? vetas({
          id: "d", lineas: (o.principales ?? PRINCIPALES).map(([y, w]) => [y + 25, w * 9]),
          color: o.difusa.color, opacidad: o.difusa.opacidad,
          giro: o.giro, frec: "0.0032", octavas: 3, semilla: s + 23, escala: 240, suave: 14,
        })
      : "") +
    vetas({
      id: "f", lineas: o.secundarias ?? SECUNDARIAS, color: o.vetaFina, opacidad: o.vetaFinaOpacidad,
      giro: o.giro + 6, frec: "0.006", octavas: 3, semilla: s + 11, escala: 170, suave: 1.2,
    }) +
    // Pocas octavas a propósito: las altas dejan el borde de la veta en dientes de
    // sierra, porque el desplazamiento mueve cada píxel por separado.
    vetas({
      id: "v", lineas: o.principales ?? PRINCIPALES, color: o.veta, opacidad: o.vetaOpacidad,
      giro: o.giro, frec: "0.0032", octavas: 3, semilla: s + 23, escala: 240, suave: 1.8, halo: 4,
    });
  return material(svg, o.base, o.pie);
}

// ── Madera ────────────────────────────────────────────────────────────────────

/** Tabla de franjas repetidas: las curvas de nivel del ruido estirado son el grano. */
function tablaGrano(franjas: number, alfa: number): string {
  const t: number[] = [];
  for (let i = 0; i < franjas; i++) t.push(0, alfa, alfa * 0.35);
  t.push(0);
  return t.join(" ");
}

interface Grano {
  id: string;
  color: string;
  opacidad: number;
  /** Separación de los anillos; dos periodos que no se dividen dan un ritmo irregular. */
  periodos: [number, number];
  frec: string;
  octavas: number;
  semilla: number;
  escala: number;
}

/**
 * Grano de madera: franjas horizontales finas (los anillos de crecimiento vistos
 * de canto) que un ruido estirado en horizontal ondula. Al juntarse y separarse
 * dibujan las "catedrales" de una tabla aserrada, no un rayado de laminado.
 */
function grano(g: Grano): string {
  const franja = (sufijo: string, p: number, fuerte: number) =>
    `<linearGradient id="${g.id}${sufijo}" gradientUnits="userSpaceOnUse" x2="0" y2="${p}" spreadMethod="repeat">` +
    `<stop offset="0.4" stop-color="${g.color}" stop-opacity="0"/>` +
    `<stop offset="0.62" stop-color="${g.color}" stop-opacity="${fuerte}"/>` +
    `<stop offset="0.8" stop-color="${g.color}" stop-opacity="0"/></linearGradient>`;
  const m = 80;
  return (
    franja("a", g.periodos[0], 1) +
    franja("b", g.periodos[1], 0.7) +
    `<filter id="${g.id}" filterUnits="userSpaceOnUse" x="${-m}" y="${-m}" width="${ANCHO + 2 * m}" height="${ALTO + 2 * m}">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${g.frec}" numOctaves="${g.octavas}" seed="${g.semilla}"/>` +
    `<feDisplacementMap in="SourceGraphic" scale="${g.escala}" xChannelSelector="R" yChannelSelector="G"/>` +
    `<feGaussianBlur stdDeviation="0.5"/></filter>` +
    `<g filter="url(#${g.id})" opacity="${g.opacidad}">` +
    `<rect x="${-m}" y="${-m}" width="${ANCHO + 2 * m}" height="${ALTO + 2 * m}" fill="url(#${g.id}a)"/>` +
    `<rect x="${-m}" y="${-m}" width="${ANCHO + 2 * m}" height="${ALTO + 2 * m}" fill="url(#${g.id}b)"/></g>`
  );
}

interface OpcionesMadera {
  tablas: string[];
  grano: string;
  granoOpacidad: number;
  junta: string;
  luz: string;
  semilla: number;
  pie?: string;
}

function duela(o: OpcionesMadera): FondoPortada {
  const alto = 75;
  const filas = ALTO / alto;
  // Un trazado por color en vez de un <rect> por tabla: mismo dibujo, la mitad de bytes.
  const tablas = new Map<string, string>();
  let juntas = "";
  let luces = "";
  for (let i = 0; i < filas; i++) {
    const y = i * alto;
    // Juntas de testa escalonadas como en un piso real: nunca alineadas entre filas.
    const desfase = [180, 760, 420, 1040, 300, 880, 560, 120][i % 8];
    const cortes = [desfase, desfase + 690, desfase + 1380].filter((x) => x < ANCHO);
    let x0 = 0;
    cortes.concat(ANCHO).forEach((x, j) => {
      const color = o.tablas[(i * 3 + j * 2) % o.tablas.length];
      tablas.set(color, (tablas.get(color) ?? "") + `M${x0} ${y}h${x - x0}v${alto}H${x0}z`);
      x0 = x;
    });
    juntas += `M0 ${y}H${ANCHO}` + cortes.map((x) => `M${x} ${y}v${alto}`).join("");
    luces += `M0 ${y + 1.5}H${ANCHO}` + cortes.map((x) => `M${x + 1.5} ${y}v${alto}`).join("");
  }
  const svg =
    [...tablas].map(([color, d]) => `<path fill="${color}" d="${d}"/>`).join("") +
    grano({
      id: "g", color: o.grano, opacidad: o.granoOpacidad, periodos: [11, 26],
      frec: "0.0016 0.02", octavas: 3, semilla: o.semilla, escala: 45,
    }) +
    // Fibra: rayado muy fino que corre a lo largo de la tabla.
    capa({
      id: "p", frec: "0.004 0.45", octavas: 2, semilla: o.semilla + 5, color: o.grano,
      tabla: "0 0 0 0.35 0.6", opacidad: 0.35,
    }) +
    `<path d="${luces}" stroke="${o.luz}" stroke-width="1.5" fill="none"/>` +
    `<path d="${juntas}" stroke="${o.junta}" stroke-width="2" fill="none"/>`;
  return material(svg, o.tablas[0], o.pie);
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export const CONSTRUCTORES_MATERIALES: Record<string, () => FondoPortada> = {
  "mat-cuarzo-blanco": () =>
    piedra({
      base: "linear-gradient(160deg, #f7f5f1 0%, #efebe4 55%, #e8e3da 100%)",
      nube: "#b9b0a2", nubeOpacidad: 0.22,
      vetaFina: "#a8a299", vetaFinaOpacidad: 0.35,
      veta: "#c39a46", vetaOpacidad: 0.95,
      semilla: 7, giro: -28,
    }),

  "mat-cuarzo-negro": () =>
    piedra({
      base: "linear-gradient(160deg, #1d1e21 0%, #141518 60%, #0e0f11 100%)",
      nube: "#3a3d44", nubeOpacidad: 0.5,
      vetaFina: "#8a8f98", vetaFinaOpacidad: 0.3,
      veta: "#d9dde3", vetaOpacidad: 0.85,
      semilla: 31, giro: 24,
      pie: PIE_OSCURO,
    }),

  "mat-marmol-carrara": () =>
    piedra({
      base: "linear-gradient(170deg, #f3f3f1 0%, #e9e9e6 100%)",
      nube: "#9a9ea3", nubeOpacidad: 0.3,
      vetaFina: "#8d939b", vetaFinaOpacidad: 0.45,
      veta: "#7c838c", vetaOpacidad: 0.6,
      semilla: 53, giro: -18,
      principales: [[-60, 3], [100, 1.8], [250, 4], [400, 2], [520, 3.5], [700, 2.2], [850, 3]],
      difusa: { color: "#8f959c", opacidad: 0.35 },
    }),

  "mat-marmol-verde": () =>
    piedra({
      base: "linear-gradient(160deg, #134a3a 0%, #0d3a2d 55%, #082a20 100%)",
      nube: "#03170f", nubeOpacidad: 0.6,
      vetaFina: "#5f9c86", vetaFinaOpacidad: 0.45,
      veta: "#d8efe4", vetaOpacidad: 0.75,
      semilla: 71, giro: 32,
      difusa: { color: "#3f8a6e", opacidad: 0.4 },
      pie: PIE_OSCURO,
    }),

  "mat-rosa-cuarzo": () =>
    piedra({
      base: "linear-gradient(160deg, #f6e4de 0%, #f0d6cd 55%, #e9cabf 100%)",
      nube: "#c99a8c", nubeOpacidad: 0.25,
      vetaFina: "#fff8f5", vetaFinaOpacidad: 0.7,
      veta: "#b7775f", vetaOpacidad: 0.8,
      semilla: 97, giro: -22,
    }),

  "mat-duela-clara": () =>
    duela({
      tablas: ["#d6b48a", "#cfa97c", "#dcbb93", "#c9a273", "#d3ae83", "#dfc199"],
      grano: "#8a5f34", granoOpacidad: 0.7,
      junta: "#7a5634", luz: "rgba(255,240,215,0.45)",
      semilla: 13,
    }),

  "mat-duela-oscura": () =>
    duela({
      tablas: ["#5a3a24", "#4e321f", "#634128", "#472d1b", "#573823", "#6a452b"],
      grano: "#1e120a", granoOpacidad: 0.6,
      junta: "#1a0f08", luz: "rgba(255,210,170,0.12)",
      semilla: 41,
      pie: PIE_OSCURO,
    }),

  "mat-madera": () => {
    const svg =
      grano({
        id: "g", color: "#2e1a0c", opacidad: 0.75, periodos: [17, 41],
        frec: "0.0011 0.006", octavas: 3, semilla: 19, escala: 140,
      }) +
      capa({
        id: "p", frec: "0.003 0.35", octavas: 2, semilla: 24, color: "#2a170b",
        tabla: "0 0 0 0.3 0.55", opacidad: 0.45,
      }) +
      capa({
        id: "n", frec: "0.002 0.006", octavas: 3, semilla: 27, color: "#2a170b",
        tabla: "0 0 0.2 0.5", opacidad: 0.5,
      });
    return material(
      svg,
      "linear-gradient(175deg, #8e5a33 0%, #7a4b2a 50%, #633b20 100%)",
      PIE_OSCURO,
    );
  },

  "mat-terrazo": () => {
    // Las lascas son las crestas más altas de un ruido, cada color con su semilla:
    // salen con bordes quebrados y tamaños dispares, sin mosaico que se repita.
    // Círculos o polígonos regulares son justo lo que delata a un terrazo falso.
    const lascas: [string, number, string, number][] = [
      ["#c8664a", 1, "0.022", 0.76],
      ["#7d9a83", 2, "0.022", 0.78],
      ["#3d3f43", 3, "0.024", 0.8],
      ["#d9a441", 4, "0.024", 0.8],
      ["#ffffff", 5, "0.02", 0.76],
      ["#c8664a", 6, "0.08", 0.8],
      ["#3d3f43", 7, "0.085", 0.8],
      ["#7d9a83", 8, "0.08", 0.82],
    ];
    const svg =
      lascas
        .map(([color, semilla, frec, umbral]) =>
          capa({ id: `t${semilla}`, frec, octavas: 2, semilla, color, umbral }),
        )
        .join("");
    return material(
      svg,
      "linear-gradient(170deg, #f2ece1 0%, #e9e1d3 100%)",
      undefined,
      relieve("0.7", 2, 10, 0.8),
    );
  },

  "mat-concreto": () => {
    const svg =
      capa({
        id: "n", frec: "0.0035", octavas: 5, semilla: 61, color: "#5f6264",
        tabla: "0 0.08 0.25 0.45 0.6", opacidad: 0.5,
      }) +
      // Poros: las crestas más altas de un ruido fino, puntos oscuros dispersos.
      capa({
        id: "p", frec: "0.09", octavas: 2, semilla: 63, color: "#45484b",
        umbral: 0.8, opacidad: 0.75,
      }) +
      capa({
        id: "q", frec: "0.2", octavas: 1, semilla: 64, color: "#55585b",
        umbral: 0.78, opacidad: 0.6,
      });
    return material(
      svg,
      "linear-gradient(170deg, #c8c8c4 0%, #babab5 55%, #adada8 100%)",
      undefined,
      relieve("0.55", 3, 65, 1.1),
    );
  },

  "mat-lino": () => {
    // Tejido: hilos horizontales y verticales con grosor irregular (los "slubs").
    const svg =
      capa({
        id: "h", frec: "0.012 0.7", octavas: 2, semilla: 81, color: "#8f7f66",
        tabla: "0 0 0.15 0.45 0.7", opacidad: 0.55,
      }) +
      capa({
        id: "v", frec: "0.7 0.012", octavas: 2, semilla: 82, color: "#8f7f66",
        tabla: "0 0 0.15 0.45 0.7", opacidad: 0.45,
      }) +
      capa({
        id: "n", frec: "0.004", octavas: 3, semilla: 83, color: "#a69477",
        tabla: "0 0 0.2 0.4", opacidad: 0.4,
      });
    return material(svg, "linear-gradient(170deg, #ebe3d5 0%, #e2d8c6 100%)");
  },

  "mat-pizarra": () => {
    const svg =
      // Lajas: capas apiladas casi horizontales, típicas de la piedra exfoliada.
      capa({
        id: "l", frec: "0.0014 0.012", octavas: 4, semilla: 91, color: "#66707a",
        tabla: tablaGrano(6, 0.5), suave: 1.2, opacidad: 0.45, giro: -6,
      }) +
      capa({
        id: "n", frec: "0.003 0.006", octavas: 4, semilla: 92, color: "#0c0f12",
        tabla: "0 0 0.25 0.55 0.8", opacidad: 0.55,
      });
    return material(
      svg,
      "linear-gradient(165deg, #3d454c 0%, #2e353b 55%, #23282d 100%)",
      PIE_OSCURO,
      // Relieve estirado en horizontal: las crestas de la piedra partida en lajas.
      relieve("0.004 0.035", 4, 93, 3, 40),
    );
  },

  "mat-cuero": () => {
    // Flor de la piel: un graneado fino en relieve sobre manchas suaves de
    // curtido desigual, con algún pliegue más marcado.
    const svg =
      capa({
        id: "c", frec: "0.05", octavas: 2, semilla: 101, color: "#1a0d06", tipo: "turbulence",
        tabla: "0.8 0.2 0 0 0 0 0 0", opacidad: 0.3,
      }) +
      capa({
        id: "n", frec: "0.0025 0.004", octavas: 4, semilla: 102, color: "#1a0d06",
        tabla: "0 0 0.3 0.6 0.85", opacidad: 0.55,
      }) +
      capa({
        id: "b", frec: "0.003", octavas: 3, semilla: 103, color: "#b07a4e",
        tabla: "0 0 0 0.3 0.55", opacidad: 0.4,
      });
    return material(
      svg,
      "radial-gradient(ellipse 120% 140% at 35% 20%, #6b4129 0%, #4f2f1c 55%, #3a2214 100%)",
      PIE_OSCURO,
      relieve("0.12", 2, 104, 1.6),
    );
  },
};
