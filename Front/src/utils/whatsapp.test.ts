import { describe, it, expect } from "vitest";
import { telefonoWhatsApp, urlConfirmacionWhatsApp } from "./whatsapp";
import { formatFechaHoraCorta } from "./formatters";
import type { CitaDto } from "../types";

const cita = (over: Partial<CitaDto> = {}): CitaDto => ({
  id: "cita-1",
  codigoConfirmacion: "ABC123",
  clienteId: "cli-1",
  empleadoId: "emp-1",
  servicioId: "svc-1",
  nombreCliente: "Ana López",
  telefonoCliente: "5511223344",
  nombreEmpleado: "María García",
  nombreServicio: "Corte",
  duracionMinutos: 30,
  precio: 450,
  pagada: false,
  inicioEn: "2026-10-21T16:00:00",
  finEn: "2026-10-21T16:30:00",
  estado: 2,
  estadoTexto: "Confirmada",
  ...over,
});

/** El texto del mensaje que lleva el enlace, ya decodificado. */
function texto(url: string): string {
  return new URL(url).searchParams.get("text") ?? "";
}

describe("urlConfirmacionWhatsApp", () => {
  it("apunta al teléfono del cliente en formato internacional", () => {
    const url = urlConfirmacionWhatsApp(cita());
    expect(url.startsWith(`https://wa.me/${telefonoWhatsApp("5511223344")}?text=`)).toBe(true);
    expect(url).toContain("https://wa.me/525511223344?text=");
  });

  it("lleva el código y el enlace a /cita/<código> para consultar el estado", () => {
    const msg = texto(urlConfirmacionWhatsApp(cita()));
    expect(msg).toContain("ABC123");
    expect(msg).toContain(`${window.location.origin}/cita/ABC123`);
  });

  it("dice que la cita quedó confirmada e incluye negocio, servicio, profesional y fecha", () => {
    const c = cita();
    const msg = texto(urlConfirmacionWhatsApp(c, "Salón Aramis"));
    expect(msg).toContain("Ana López");
    expect(msg).toContain("Salón Aramis");
    expect(msg).toContain("Corte");
    expect(msg).toContain("María García");
    expect(msg.toLowerCase()).toContain("confirmada");
    // La fecha sale del formateador compartido, no armada a mano.
    expect(msg).toContain(formatFechaHoraCorta(c.inicioEn));
  });

  it("sin nombre de negocio no deja el hueco en el saludo", () => {
    const msg = texto(urlConfirmacionWhatsApp(cita()));
    expect(msg).not.toContain(" en *");
    expect(msg).not.toContain("**");
  });
});
