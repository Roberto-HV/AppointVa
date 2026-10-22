import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TarjetaPrimeraReserva from "./PrimeraReserva";
import { leerMarca, siguienteMarca, sinNingunaCita, unicaCita } from "../../lib/primeraReserva";
import type { ResumenDashboard } from "../../types";

const reducir = vi.hoisted(() => ({ valor: false }));
vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return { ...mod, useReducedMotion: () => reducir.valor };
});

beforeEach(() => { reducir.valor = false; });

const vacio: ResumenDashboard = {
  citasHoy: 0, citasSemana: 0, citasMes: 0, ingresosHoy: 0, ingresosSemana: 0, ingresosMes: 0,
  proximasCitas: [], topServicios: [],
};
const proxima = {
  id: "p1", inicioEn: "2026-10-22T10:00:00", nombreCliente: "Sofía Ramírez",
  nombreServicio: "Corte de dama", nombreEmpleado: "María", estadoTexto: "Pendiente",
};
const conUna: ResumenDashboard = { ...vacio, citasSemana: 1, citasMes: 1, proximasCitas: [proxima] };
const sinTendencia = [{ etiqueta: "21", citas: 0, ingresos: 0 }];

describe("primera reserva — reglas", () => {
  const datos = (resumen: ResumenDashboard, totalHistorico: number, citasHoy: Parameters<typeof unicaCita>[1] = []) =>
    ({ resumen, citasHoy, tendencia: sinTendencia, totalHistorico });

  it("sin ninguna cita en ningún periodo", () => {
    expect(sinNingunaCita(vacio, sinTendencia)).toBe(true);
    expect(sinNingunaCita(vacio, [{ etiqueta: "20", citas: 2, ingresos: 0 }])).toBe(false);
  });

  it("panel vacío y total histórico 0: queda pendiente de celebrar", () => {
    expect(siguienteMarca(null, datos(vacio, 0))).toBe("sin-reservas");
  });

  it("panel vacío pero con citas antiguas (negocio establecido): nunca se celebra", () => {
    expect(siguienteMarca(null, datos(vacio, 250))).toBe("vista");
  });

  it("si ya había citas la primera vez, no se celebra nunca", () => {
    expect(siguienteMarca(null, datos(conUna, 1))).toBe("vista");
  });

  it("pendiente y con una sola cita en toda la historia: celebra", () => {
    expect(siguienteMarca("sin-reservas", datos(conUna, 1))).toBe("celebrando");
    expect(unicaCita(conUna, [])).toEqual({ cliente: "Sofía Ramírez", servicio: "Corte de dama" });
  });

  it("pendiente y aún vacío: sigue esperando", () => {
    expect(siguienteMarca("sin-reservas", datos(vacio, 0))).toBe("sin-reservas");
  });

  it("si llegaron dos de golpe, no adivina cuál fue la primera", () => {
    const dos = { ...conUna, citasMes: 2, proximasCitas: [proxima, { ...proxima, id: "p2" }] };
    expect(unicaCita(dos, [])).toBeNull();
    expect(siguienteMarca("sin-reservas", datos(dos, 2))).toBe("vista");
    expect(siguienteMarca("sin-reservas", datos(conUna, 2))).toBe("vista");
  });

  it("una cita de hoy y la misma en próximas cuentan como una", () => {
    const hoy = [{ id: "p1", estadoTexto: "Pendiente", nombreCliente: "Sofía Ramírez", nombreServicio: "Corte de dama" }];
    expect(unicaCita(conUna, hoy)).toEqual({ cliente: "Sofía Ramírez", servicio: "Corte de dama" });
  });

  it("una vez vista no cambia; celebrando termina si llega otra reserva", () => {
    expect(siguienteMarca("vista", datos(conUna, 1))).toBe("vista");
    expect(siguienteMarca("celebrando", datos(conUna, 1))).toBe("celebrando");
    expect(siguienteMarca("celebrando", datos(conUna, 2))).toBe("vista");
  });
});

describe("primera reserva — almacenamiento", () => {
  afterEach(() => localStorage.clear());

  it("solo guarda un estado; un valor viejo con nombre y servicio se lee como «celebrando»", () => {
    localStorage.setItem("primera-reserva-n1", JSON.stringify({ cliente: "Sofía", servicio: "Corte" }));
    expect(leerMarca("n1")).toBe("celebrando");
    localStorage.setItem("primera-reserva-n1", "basura");
    expect(leerMarca("n1")).toBe("vista");
  });
});

describe("TarjetaPrimeraReserva", () => {
  const props = {
    celebracion: { cliente: "Sofía Ramírez", servicio: "Corte de dama" },
    color: "#B4532A",
    nombreNegocio: "Salón Aramis",
    bookingUrl: "https://appointva.test/b/salon-aramis",
    onCerrar: vi.fn(),
  };

  it("nombra a la clienta por su nombre de pila y el servicio", () => {
    render(<TarjetaPrimeraReserva {...props} conConfeti={false} />);
    expect(screen.getByRole("region", { name: "¡Tu primera reserva!" })).toHaveTextContent("Sofía reservó Corte de dama.");
  });

  it("el confeti sale solo cuando se acaba de detectar", () => {
    const { rerender } = render(<TarjetaPrimeraReserva {...props} conConfeti />);
    expect(screen.getByTestId("confeti")).toHaveAttribute("aria-hidden", "true");
    rerender(<TarjetaPrimeraReserva {...props} conConfeti={false} />);
    expect(screen.queryByTestId("confeti")).toBeNull();
  });

  it("con 'reducir movimiento' no hay confeti", () => {
    reducir.valor = true;
    render(<TarjetaPrimeraReserva {...props} conConfeti />);
    expect(screen.queryByTestId("confeti")).toBeNull();
  });

  it("sin hoja de compartir y sin portapapeles deja el enlace a la vista", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true, writable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
    render(<TarjetaPrimeraReserva {...props} conConfeti={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Compártelo en tus redes" }));
    const campo = await screen.findByLabelText("Enlace de reservas para copiar a mano");
    expect(campo).toHaveValue("https://appointva.test/b/salon-aramis");
    expect(campo).toHaveAttribute("readonly");
  });
});
