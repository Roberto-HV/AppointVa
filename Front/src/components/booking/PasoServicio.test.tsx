import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasoServicio from "./PasoServicio";
import type { ServicioPublico } from "../../types";

vi.mock("../../utils/formatters", () => ({
  formatPrecio: (v: number) => `$${v}`,
}));

const mockServicios: ServicioPublico[] = [
  {
    id: "srv-1",
    nombre: "Corte de cabello",
    duracionMinutos: 30,
    bufferMinutos: 0,
    precio: 150,
    orden: 1,
  },
  {
    id: "srv-2",
    nombre: "Coloración",
    duracionMinutos: 60,
    bufferMinutos: 0,
    precio: 300,
    orden: 2,
  },
];

describe("PasoServicio", () => {
  it("renders service list when services are provided", () => {
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
    expect(screen.getByText("Coloración")).toBeInTheDocument();
  });

  it("shows name and price for each service card", () => {
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
    expect(screen.getByText("$150")).toBeInTheDocument();
    expect(screen.getByText("Coloración")).toBeInTheDocument();
    expect(screen.getByText("$300")).toBeInTheDocument();
  });

  it("calls onSeleccionar with the correct service when clicked", () => {
    const onSeleccionar = vi.fn();
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={onSeleccionar}
      />
    );
    fireEvent.click(screen.getByText("Corte de cabello"));
    expect(onSeleccionar).toHaveBeenCalledWith(mockServicios[0]);
  });

  it("renders without crashing when services list is empty", () => {
    render(
      <PasoServicio servicios={[]} seleccionado={null} onSeleccionar={vi.fn()} />
    );
    expect(screen.getByText(/¿Qué servicio necesitas?/i)).toBeInTheDocument();
  });

  it("does not invent a category heading when the business uses no categories", () => {
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.queryByText("Servicios")).not.toBeInTheDocument();
    expect(screen.queryByText("Otros")).not.toBeInTheDocument();
  });

  it("renders no image element for a service without a photo", () => {
    const { container } = render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders a trailing thumbnail only for services that have a photo", () => {
    const { container } = render(
      <PasoServicio
        servicios={[
          { ...mockServicios[0], imagenUrl: "https://cdn.test/corte.jpg" },
          mockServicios[1],
        ]}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", "https://cdn.test/corte.jpg");
  });

  it("marks the selected row with aria-pressed", () => {
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={mockServicios[0]}
        onSeleccionar={vi.fn()}
      />
    );
    const filas = screen.getAllByRole("button");
    expect(filas[0]).toHaveAttribute("aria-pressed", "true");
    expect(filas[1]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("PasoServicio — grupo Destacados", () => {
  const conCategorias: ServicioPublico[] = [
    { ...mockServicios[0], categoriaNombre: "Cabello", destacado: true },
    { ...mockServicios[1], categoriaNombre: "Cabello" },
    {
      id: "srv-3",
      nombre: "Manicura",
      duracionMinutos: 45,
      bufferMinutos: 0,
      precio: 200,
      orden: 3,
      categoriaNombre: "Uñas",
    },
  ];

  it("renders Destacados as the first group, before the categories", () => {
    render(
      <PasoServicio
        servicios={conCategorias}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    const encabezados = screen
      .getAllByText(/^(Destacados|Cabello|Uñas)$/)
      .map((el) => el.textContent);
    expect(encabezados).toEqual(["Destacados", "Cabello", "Uñas"]);
  });

  it("does not repeat a featured service under its own category", () => {
    render(
      <PasoServicio
        servicios={conCategorias}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getAllByText("Corte de cabello")).toHaveLength(1);
  });

  it("drops a category group that only contained featured services", () => {
    render(
      <PasoServicio
        servicios={[{ ...mockServicios[0], categoriaNombre: "Cabello", destacado: true }]}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Destacados")).toBeInTheDocument();
    expect(screen.queryByText("Cabello")).not.toBeInTheDocument();
  });

  it("labels the uncategorized leftovers only when other groups exist", () => {
    render(
      <PasoServicio
        servicios={[
          { ...mockServicios[0], destacado: true },
          mockServicios[1],
        ]}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Destacados")).toBeInTheDocument();
    expect(screen.getByText("Otros")).toBeInTheDocument();
  });
});
