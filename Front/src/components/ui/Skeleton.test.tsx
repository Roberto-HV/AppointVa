import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Skeleton,
  SkeletonTableRows,
  SkeletonCards,
  SkeletonList,
  SkeletonStat,
  PageLoader,
} from "./Skeleton";

describe("Skeleton", () => {
  it("renderiza un div con animate-pulse", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("acepta clases adicionales", () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    expect(container.firstChild).toHaveClass("h-4", "w-full");
  });
});

describe("SkeletonTableRows", () => {
  it("renderiza el número correcto de filas", () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRows filas={3} columnas={2} />
        </tbody>
      </table>
    );
    const filas = container.querySelectorAll("tr");
    expect(filas).toHaveLength(3);
  });

  it("renderiza el número correcto de columnas por fila", () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRows filas={2} columnas={4} />
        </tbody>
      </table>
    );
    const celdas = container.querySelectorAll("td");
    expect(celdas).toHaveLength(8); // 2 filas × 4 columnas
  });

  it("renderiza 0 filas cuando filas=0", () => {
    const { container } = render(
      <table>
        <tbody>
          <SkeletonTableRows filas={0} columnas={3} />
        </tbody>
      </table>
    );
    expect(container.querySelectorAll("tr")).toHaveLength(0);
  });
});

describe("SkeletonCards", () => {
  it("renderiza la cantidad correcta de tarjetas", () => {
    const { container } = render(<SkeletonCards cantidad={4} />);
    const tarjetas = container.querySelectorAll(".rounded-xl");
    expect(tarjetas).toHaveLength(4);
  });

  it("renderiza 0 tarjetas cuando cantidad=0", () => {
    const { container } = render(<SkeletonCards cantidad={0} />);
    expect(container.querySelectorAll(".rounded-xl")).toHaveLength(0);
  });
});

describe("SkeletonList", () => {
  it("renderiza 5 filas por defecto", () => {
    const { container } = render(<SkeletonList />);
    const items = container.querySelectorAll(".h-10");
    expect(items).toHaveLength(5);
  });

  it("renderiza el número de filas especificado", () => {
    const { container } = render(<SkeletonList filas={3} />);
    expect(container.querySelectorAll(".h-10")).toHaveLength(3);
  });
});

describe("SkeletonStat", () => {
  it("renderiza sin errores", () => {
    const { container } = render(<SkeletonStat />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("contiene elementos de skeleton internos", () => {
    const { container } = render(<SkeletonStat />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("PageLoader", () => {
  it("muestra el texto 'Cargando…'", () => {
    render(<PageLoader />);
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("muestra las siglas 'AV'", () => {
    render(<PageLoader />);
    expect(screen.getByText("AV")).toBeInTheDocument();
  });

  it("ocupa al menos el alto de la pantalla", () => {
    const { container } = render(<PageLoader />);
    expect(container.firstChild).toHaveClass("min-h-screen");
  });
});
