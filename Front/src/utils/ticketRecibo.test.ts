import { describe, it, expect } from "vitest";
import type { CitaDto } from "../types";
import { resumirTicket } from "./ticketRecibo";
// Los mismos vectores que corre el servidor (TicketVectoresTests.cs contra
// EmailService.ResumirTicket): el ticket impreso y el correo deben dar los mismos renglones.
import vectoresJson from "../../../Back/AppointVaAPI/AppointVaAPI.Tests/Fixtures/ticket-vectores.json?raw";

type Renglon = [string, string];

interface Vector {
  nombre: string;
  sector?: string;
  entrada: Partial<CitaDto>;
  esperado: {
    servicio: string;
    totales: Renglon[];
    total: string;
    saldoAFavor: Renglon | null;
    pagos: Renglon[];
    etiquetaEmpleado: string;
  };
}

const { vectores } = JSON.parse(vectoresJson) as { vectores: Vector[] };

const citaBase: CitaDto = {
  id: "cita-1",
  codigoConfirmacion: "A1B2C3D4",
  clienteId: "c1",
  empleadoId: "e1",
  servicioId: "s1",
  nombreCliente: "Ana García",
  telefonoCliente: "555-1234",
  nombreEmpleado: "Sofía Hernández",
  nombreServicio: "Corte de dama",
  duracionMinutos: 45,
  precio: 0,
  inicioEn: "2026-10-30T16:00:00",
  finEn: "2026-10-30T16:45:00",
  pagada: true,
  estado: 2,
  estadoTexto: "Confirmada",
};

const comoRenglones = (filas: { etiqueta: string; monto: string }[]): Renglon[] =>
  filas.map((f) => [f.etiqueta, f.monto]);

describe("resumirTicket — vectores compartidos con el servidor", () => {
  it("el archivo trae los escenarios", () => {
    expect(vectores.length).toBeGreaterThanOrEqual(10);
  });

  it.each(vectores.map((v) => [v.nombre, v] as const))("%s", (_nombre, v) => {
    const r = resumirTicket({ ...citaBase, ...v.entrada }, v.sector ?? null);

    expect(r.servicio.monto).toBe(v.esperado.servicio);
    expect(comoRenglones(r.totales)).toEqual(v.esperado.totales);
    expect(r.total).toBe(v.esperado.total);
    expect(r.saldoAFavor ? [r.saldoAFavor.etiqueta, r.saldoAFavor.monto] : null).toEqual(v.esperado.saldoAFavor);
    expect(comoRenglones(r.pagos)).toEqual(v.esperado.pagos);
    expect(r.etiquetaEmpleado).toBe(v.esperado.etiquetaEmpleado);
  });
});
