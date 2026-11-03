import { describe, it, expect } from "vitest";
import {
  validarEdicionPago, esColorHexValido, ordenarNegociosAdmin,
  resumenFacturacion, motivoSinIngreso, nombrePlan,
  coincideBusquedaNegocio, requiereAtencion, conteosAtencion, ordenarPorColumna, esMotivoAtencion,
} from "./negociosAdmin";
import type { NegocioMetricasDto, SuscripcionResumenDto } from "../api/admin";

function fila(extra: Partial<SuscripcionResumenDto>): SuscripcionResumenDto {
  return {
    negocioId: crypto.randomUUID(), negocioNombre: "N", negocioSlug: "n",
    fechaVencimiento: null, estado: "SinSuscripcion", diasRestantes: null, totalPagos: 0, ultimoPago: null,
    planNombre: "Pro", precioBase: 449, maxEmpleadosBase: 4, empleadosExtra: 0, totalMensual: 449, precioEmpleadoExtra: 50, sector: "belleza",
    esTester: false, suscripcionVigente: false, accesoPermanente: false, ingresoMensual: 0,
    ...extra,
  };
}

describe("resumenFacturacion (G3)", () => {
  it("separa plan asignado de suscripción vigente y suma solo el ingreso", () => {
    const filas = [
      fila({}), // Pro sin pago: tiene plan, no ingresa
      fila({ estado: "Activa", suscripcionVigente: true, ingresoMensual: 549, totalMensual: 549 }),
      fila({ estado: "Vencida", ingresoMensual: 0 }),
      fila({ estado: "Activa", suscripcionVigente: true, esTester: true, ingresoMensual: 0 }),
      fila({ planNombre: null, precioBase: 0, totalMensual: 0 }),
    ];
    expect(resumenFacturacion(filas)).toEqual({ conPlanAsignado: 3, conSuscripcionVigente: 1, ingresoMensual: 549 });
  });

  it("el total es la suma de la columna de las filas, igual que el pie", () => {
    const filas = [
      fila({ estado: "Activa", suscripcionVigente: true, ingresoMensual: 449 }),
      fila({ estado: "PorVencer", suscripcionVigente: true, ingresoMensual: 249 }),
    ];
    const sumaFilas = filas.reduce((s, f) => s + f.ingresoMensual, 0);
    expect(resumenFacturacion(filas).ingresoMensual).toBe(sumaFilas);
  });

  it("explica por qué una fila no aporta", () => {
    expect(motivoSinIngreso(fila({}))).toMatch(/Sin pago registrado/);
    expect(motivoSinIngreso(fila({ estado: "Vencida" }))).toMatch(/vencida/);
    expect(motivoSinIngreso(fila({ estado: "Activa", suscripcionVigente: true, accesoPermanente: true }))).toMatch(/de por vida/);
    expect(motivoSinIngreso(fila({ planNombre: null }))).toBe("Sin plan asignado");
    expect(motivoSinIngreso(fila({ ingresoMensual: 449 }))).toBeNull();
  });
});

describe("nombrePlan (M6)", () => {
  it("pone el acento a los planes conocidos y deja los demás como vienen", () => {
    expect(nombrePlan("Basico")).toBe("Básico");
    expect(nombrePlan("PRO")).toBe("Pro");
    expect(nombrePlan("Empresarial")).toBe("Empresarial");
    expect(nombrePlan(null)).toBe("");
  });
});

describe("validarEdicionPago (AP-23)", () => {
  const ok = { monto: "449", desde: "2026-01-01", hasta: "2026-01-31" };

  it("acepta un pago con monto positivo y período en orden", () => {
    expect(validarEdicionPago(ok)).toBeNull();
    expect(validarEdicionPago({ ...ok, monto: "449,50" })).toBeNull();
  });

  it("rechaza un monto vacío, cero o que no es número (antes se guardaba $0)", () => {
    expect(validarEdicionPago({ ...ok, monto: "" })).toMatch(/mayor que 0/);
    expect(validarEdicionPago({ ...ok, monto: "0" })).toMatch(/mayor que 0/);
    expect(validarEdicionPago({ ...ok, monto: "44o" })).toMatch(/mayor que 0/);
  });

  it("rechaza un período invertido o incompleto", () => {
    expect(validarEdicionPago({ ...ok, desde: "2026-02-01" })).toMatch(/posterior/);
    expect(validarEdicionPago({ ...ok, hasta: "" })).toMatch(/período completo/);
  });
});

describe("esColorHexValido", () => {
  it("solo acepta #RRGGBB", () => {
    expect(esColorHexValido("#334155")).toBe(true);
    expect(esColorHexValido("#abcdef")).toBe(true);
    expect(esColorHexValido("#33415")).toBe(false);
    expect(esColorHexValido("334155")).toBe(false);
    expect(esColorHexValido("#33415g")).toBe(false);
  });
});

describe("ordenarNegociosAdmin (AP-07, B23)", () => {
  const n = (nombre: string, over: Partial<NegocioMetricasDto>): NegocioMetricasDto => ({
    id: nombre, nombre, slug: nombre, activo: 0, maxCitasMes: 0, maxEmpleados: 0, citasMes: 0,
    empleadosActivos: 0, emailsMes: 0, ...over,
  });

  it("pendientes primero, con el registro más reciente arriba; luego activos y desactivados", () => {
    const lista = [
      n("Activo", { activo: 1, planId: "p" }),
      n("Viejo", { fechaCreacion: "2026-10-01T10:00:00Z" }),
      n("Desactivado", { planId: "p" }),
      n("Nuevo", { fechaCreacion: "2026-10-20T10:00:00Z" }),
      n("SinFecha", {}),
    ];
    expect([...lista].sort(ordenarNegociosAdmin).map((x) => x.nombre))
      .toEqual(["Nuevo", "Viejo", "SinFecha", "Activo", "Desactivado"]);
  });
});
// ── Lote 4: búsqueda, "Requiere atención" y orden de la tabla ────────────────

function neg(extra: Partial<NegocioMetricasDto>): NegocioMetricasDto {
  return {
    id: crypto.randomUUID(), nombre: "Negocio", slug: "negocio", activo: 1,
    maxCitasMes: 0, maxEmpleados: 0, citasMes: 0, empleadosActivos: 0, emailsMes: 0,
    planNombre: "Pro", planId: "pro",
    ...extra,
  };
}

describe("coincideBusquedaNegocio (lote 4)", () => {
  const n = neg({
    nombre: "Peluquería Ámbar", slug: "ambar", email: "hola@ambar.mx",
    propietarioEmail: "Sofia.Ruiz@Gmail.com", propietarioNombre: "Sofía Ruiz",
  });

  it("encuentra por nombre, slug, correo del negocio y del propietario, y nombre del propietario", () => {
    for (const t of ["peluquer", "ambar", "hola@", "sofia.ruiz@gmail", "ruiz"]) {
      expect(coincideBusquedaNegocio(n, t)).toBe(true);
    }
  });

  it("no distingue mayúsculas ni acentos, e ignora espacios de más", () => {
    expect(coincideBusquedaNegocio(n, "  PELUQUERIA ambar ")).toBe(true);
    expect(coincideBusquedaNegocio(n, "sofía")).toBe(true);
  });

  it("sin término coincide todo; un término ajeno no coincide", () => {
    expect(coincideBusquedaNegocio(n, "")).toBe(true);
    expect(coincideBusquedaNegocio(n, "barbería")).toBe(false);
  });
});

describe("requiereAtencion / conteosAtencion (lote 4, I7)", () => {
  it("pendiente = inactivo y sin plan; un desactivado con plan no lo es", () => {
    expect(requiereAtencion(neg({ activo: 0, planId: undefined, planNombre: undefined }), undefined, "pendientes")).toBe(true);
    expect(requiereAtencion(neg({ activo: 0 }), undefined, "pendientes")).toBe(false);
  });

  it("los motivos de cobro solo cuentan negocios activos que no son de prueba", () => {
    const vencida = fila({ estado: "Vencida" });
    expect(requiereAtencion(neg({}), vencida, "vencidas")).toBe(true);
    expect(requiereAtencion(neg({ esTester: true }), vencida, "vencidas")).toBe(false);
    expect(requiereAtencion(neg({ activo: 0 }), vencida, "vencidas")).toBe(false);
    expect(requiereAtencion(neg({}), fila({ estado: "PorVencer" }), "porVencer")).toBe(true);
  });

  it("plan sin pago: con plan y sin suscripción; sin plan no es un cobro pendiente", () => {
    expect(requiereAtencion(neg({}), fila({ estado: "SinSuscripcion" }), "sinPago")).toBe(true);
    expect(requiereAtencion(neg({}), fila({ estado: "SinSuscripcion", planNombre: null }), "sinPago")).toBe(false);
    expect(requiereAtencion(neg({}), fila({ estado: "Activa" }), "sinPago")).toBe(false);
  });

  it("correo sin verificar solo cuando hay propietario y no lo confirmó", () => {
    expect(requiereAtencion(neg({ emailConfirmado: false }), undefined, "correoSinVerificar")).toBe(true);
    expect(requiereAtencion(neg({ emailConfirmado: null }), undefined, "correoSinVerificar")).toBe(false);
  });

  it("cuenta cada motivo por separado; un negocio puede estar en varios", () => {
    const a = neg({ activo: 0, planId: undefined, planNombre: undefined, emailConfirmado: false });
    const b = neg({});
    const sus = { [b.id]: fila({ negocioId: b.id, estado: "Vencida" }) };
    expect(conteosAtencion([a, b], (id) => sus[id])).toEqual({
      pendientes: 1, sinPago: 0, porVencer: 0, vencidas: 1, correoSinVerificar: 1,
    });
  });

  it("esMotivoAtencion solo acepta los motivos conocidos (llegan por la URL)", () => {
    expect(esMotivoAtencion("vencidas")).toBe(true);
    expect(esMotivoAtencion("inventado")).toBe(false);
    expect(esMotivoAtencion(null)).toBe(false);
  });
});

describe("ordenarPorColumna (lote 4, I1)", () => {
  const nombres = (lista: NegocioMetricasDto[]) => lista.map((n) => n.nombre);

  it("ordena texto sin acentos y cifras en las dos direcciones", () => {
    const lista = [neg({ nombre: "Óptica", citasMes: 3 }), neg({ nombre: "Barbería", citasMes: 9 }), neg({ nombre: "Nails", citasMes: 1 })];
    expect(nombres(ordenarPorColumna(lista, () => undefined, "nombre", "asc"))).toEqual(["Barbería", "Nails", "Óptica"]);
    expect(nombres(ordenarPorColumna(lista, () => undefined, "citas", "desc"))).toEqual(["Barbería", "Óptica", "Nails"]);
    expect(nombres(ordenarPorColumna(lista, () => undefined, "citas", "asc"))).toEqual(["Nails", "Óptica", "Barbería"]);
  });

  it("lo que no tiene el dato va al final en cualquier dirección", () => {
    const lista = [neg({ nombre: "Sin dueño" }), neg({ nombre: "Zeta", propietarioEmail: "z@x.mx" }), neg({ nombre: "Alfa", propietarioEmail: "a@x.mx" })];
    expect(nombres(ordenarPorColumna(lista, () => undefined, "propietario", "asc"))).toEqual(["Alfa", "Zeta", "Sin dueño"]);
    expect(nombres(ordenarPorColumna(lista, () => undefined, "propietario", "desc"))).toEqual(["Zeta", "Alfa", "Sin dueño"]);
  });

  it("la suscripción va de lo más urgente a lo más tranquilo", () => {
    const [v, p, s, a] = [neg({ nombre: "V" }), neg({ nombre: "P" }), neg({ nombre: "S" }), neg({ nombre: "A" })];
    const sus: Record<string, SuscripcionResumenDto> = {
      [v.id]: fila({ estado: "Vencida" }),
      [p.id]: fila({ estado: "PorVencer" }),
      [s.id]: fila({ estado: "SinSuscripcion" }),
      [a.id]: fila({ estado: "Activa" }),
    };
    expect(nombres(ordenarPorColumna([a, s, p, v], (id) => sus[id], "suscripcion", "asc"))).toEqual(["V", "P", "S", "A"]);
  });

  it("no muta la lista que recibe", () => {
    const lista = [neg({ nombre: "B" }), neg({ nombre: "A" })];
    ordenarPorColumna(lista, () => undefined, "nombre", "asc");
    expect(nombres(lista)).toEqual(["B", "A"]);
  });
});
