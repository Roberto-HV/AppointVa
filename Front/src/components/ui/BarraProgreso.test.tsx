import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BarraProgreso from "./BarraProgreso";

describe("BarraProgreso", () => {
  it("muestra el label correctamente", () => {
    render(<BarraProgreso valor={5} maximo={10} label="Citas este mes" />);
    expect(screen.getByText("Citas este mes")).toBeInTheDocument();
  });

  it("muestra valor y máximo", () => {
    render(<BarraProgreso valor={3} maximo={10} label="Citas" />);
    expect(screen.getByText(/3 \/ 10/)).toBeInTheDocument();
  });

  it("muestra 0% cuando maximo es 0", () => {
    render(<BarraProgreso valor={0} maximo={0} label="Citas" />);
    expect(screen.getByText("(0%)")).toBeInTheDocument();
  });

  it("barra verde cuando porcentaje es menor de 60%", () => {
    render(<BarraProgreso valor={5} maximo={10} label="Citas" />);
    const fill = screen.getByTestId("barra-fill");
    expect(fill.className).toContain("bg-emerald-500");
  });

  it("barra ámbar cuando porcentaje está entre 60% y 84%", () => {
    render(<BarraProgreso valor={7} maximo={10} label="Citas" />);
    const fill = screen.getByTestId("barra-fill");
    expect(fill.className).toContain("bg-amber-400");
  });

  it("barra roja cuando porcentaje es 85% o más", () => {
    render(<BarraProgreso valor={9} maximo={10} label="Citas" />);
    const fill = screen.getByTestId("barra-fill");
    expect(fill.className).toContain("bg-red-500");
  });

  it("no muestra aviso cuando porcentaje es menor de 75%", () => {
    render(<BarraProgreso valor={7} maximo={10} label="Citas" />);
    // 70% — no debe mostrar aviso
    expect(screen.queryByTestId("aviso-restantes")).not.toBeInTheDocument();
  });

  it("muestra aviso de restantes cuando porcentaje es exactamente 75%", () => {
    render(<BarraProgreso valor={75} maximo={100} label="Citas" />);
    const aviso = screen.getByTestId("aviso-restantes");
    expect(aviso).toBeInTheDocument();
    expect(aviso.textContent).toContain("25 restantes");
  });

  it("muestra '1 restante' (singular) cuando queda exactamente 1", () => {
    render(<BarraProgreso valor={9} maximo={10} label="Citas" />);
    const aviso = screen.getByTestId("aviso-restantes");
    expect(aviso.textContent).toContain("1 restante");
    expect(aviso.textContent).not.toContain("restantes");
  });

  it("muestra '⛔ Límite alcanzado' cuando valor iguala al máximo", () => {
    render(<BarraProgreso valor={10} maximo={10} label="Citas" />);
    const aviso = screen.getByTestId("aviso-restantes");
    expect(aviso.textContent).toContain("Límite alcanzado");
  });

  it("muestra '⛔ Límite alcanzado' cuando valor supera al máximo", () => {
    render(<BarraProgreso valor={15} maximo={10} label="Citas" />);
    const aviso = screen.getByTestId("aviso-restantes");
    expect(aviso.textContent).toContain("Límite alcanzado");
  });

  it("ancho de la barra no supera el 100% aunque valor > maximo", () => {
    render(<BarraProgreso valor={20} maximo={10} label="Citas" />);
    const fill = screen.getByTestId("barra-fill");
    expect(fill.getAttribute("style")).toContain("width: 100%");
  });

  it("muestra el porcentaje calculado correctamente", () => {
    render(<BarraProgreso valor={1} maximo={4} label="Citas" />);
    expect(screen.getByText("(25%)")).toBeInTheDocument();
  });
});
