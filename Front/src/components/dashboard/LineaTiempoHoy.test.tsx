import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import LineaTiempoHoy from "./LineaTiempoHoy";
import { asignarCarriles, rangoLinea } from "../../lib/lineaTiempo";

const dia = (h: number, m = 0) => new Date(2026, 9, 21, h, m);

function cita(id: string, h: number, m: number, minutos: number, estadoTexto = "Confirmada") {
  const inicio = dia(h, m);
  return {
    id,
    inicioEn: inicio.toISOString(),
    finEn: new Date(inicio.getTime() + minutos * 60_000).toISOString(),
    estadoTexto,
    nombreServicio: "Corte de dama",
    nombreCliente: "Sofía Ramírez",
  };
}

describe("rangoLinea", () => {
  it("redondea a horas enteras y cubre al menos 4 horas", () => {
    const r = rangoLinea([cita("a", 9, 30, 45)])!;
    expect(new Date(r.inicio).getHours()).toBe(9);
    expect((r.fin - r.inicio) / 3_600_000).toBe(4);
  });

  it("llega hasta el fin de la última cita", () => {
    const r = rangoLinea([cita("a", 9, 0, 30), cita("b", 16, 30, 45)])!;
    expect(new Date(r.fin).getHours()).toBe(18);
  });
});

describe("asignarCarriles", () => {
  it("las que no se traslapan comparten el carril 0", () => {
    const r = asignarCarriles([cita("a", 9, 0, 60), cita("b", 10, 0, 30)]);
    expect(r.asignadas.map((a) => a.carril)).toEqual([0, 0]);
    expect(r.carriles).toBe(1);
    expect(r.ocultas).toBe(0);
  });

  it("las traslapadas van a sub-carriles y se reusa el primero libre", () => {
    const r = asignarCarriles([cita("a", 9, 0, 60), cita("b", 9, 30, 60), cita("c", 10, 0, 30)]);
    expect(r.asignadas.map((a) => [a.cita.id, a.carril])).toEqual([["a", 0], ["b", 1], ["c", 0]]);
    expect(r.carriles).toBe(2);
  });

  it("respeta el orden de entrada aunque asigne por hora de inicio", () => {
    const r = asignarCarriles([cita("tarde", 9, 30, 60), cita("temprano", 9, 0, 60)]);
    expect(r.asignadas.map((a) => [a.cita.id, a.carril])).toEqual([["tarde", 1], ["temprano", 0]]);
  });

  it("más allá de 3 carriles las cuenta como ocultas", () => {
    const r = asignarCarriles([1, 2, 3, 4, 5].map((i) => cita(`c${i}`, 9, 0, 60)));
    expect(r.carriles).toBe(3);
    expect(r.ocultas).toBe(2);
    expect(r.asignadas.filter((a) => a.carril === null)).toHaveLength(2);
  });
});

describe("LineaTiempoHoy", () => {
  it("traslapadas: no se tapan, la tira crece y lo que no cabe sale como +N sin salir de la lista", () => {
    const citas = [1, 2, 3, 4].map((i) => cita(`c${i}`, 9, 0, 60));
    render(<LineaTiempoHoy citas={citas} ahora={dia(8)} />);
    const lista = screen.getByRole("list", { name: "Citas de hoy en orden" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(4);
    const tops = screen.getAllByTestId("bloque-linea").filter((b) => b.dataset.carril !== "oculto").map((b) => b.style.top);
    expect(new Set(tops).size).toBe(3);
    expect(parseInt(lista.style.height, 10)).toBeGreaterThan(36);
    expect(screen.getByTestId("mas-citas")).toHaveTextContent("+1");
  });

  it("una entrada de lista por cita, con hora, servicio, cliente y estado", () => {
    render(<LineaTiempoHoy citas={[cita("a", 9, 0, 45), cita("b", 11, 0, 30, "Pendiente")]} ahora={dia(10)} />);
    const lista = screen.getByRole("list", { name: "Citas de hoy en orden" });
    const items = within(lista).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent(/11:00.+ a 11:30.+: Corte de dama con Sofía Ramírez, pendiente/);
  });

  it("coloca la aguja en la hora actual y la anuncia", () => {
    render(<LineaTiempoHoy citas={[cita("a", 9, 0, 60), cita("b", 12, 0, 60)]} ahora={dia(11)} />);
    // 9:00–13:00 → las 11:00 caen a la mitad.
    expect(screen.getByTestId("aguja-ahora")).toHaveStyle({ left: "50%" });
    expect(screen.getByText(/^Ahora son las 11:00/)).toHaveClass("sr-only");
  });

  it("sin la hora actual dentro del día de citas no dibuja aguja", () => {
    render(<LineaTiempoHoy citas={[cita("a", 9, 0, 60)]} ahora={dia(20)} />);
    expect(screen.queryByTestId("aguja-ahora")).toBeNull();
  });

  it("las canceladas no ocupan la tira; sin otras no se dibuja nada", () => {
    const { container } = render(<LineaTiempoHoy citas={[cita("a", 9, 0, 60, "Cancelada")]} ahora={dia(10)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ubica cada bloque según su hora", () => {
    render(<LineaTiempoHoy citas={[cita("a", 9, 0, 60), cita("b", 11, 0, 60)]} ahora={dia(10)} />);
    const [a, b] = screen.getAllByTestId("bloque-linea");
    expect(a).toHaveStyle({ left: "0%", width: "25%" });
    expect(b).toHaveStyle({ left: "50%" });
  });
});
