import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
    expect(screen.getByText("¿Qué te hacemos hoy?")).toBeInTheDocument();
    expect(screen.queryByText(/para continuar/)).not.toBeInTheDocument();
  });

  it("asks about the type of consultation in the salud sector", () => {
    render(
      <PasoServicio servicios={[]} seleccionado={null} onSeleccionar={vi.fn()} sector="salud" />
    );
    expect(screen.getByText("¿Qué tipo de consulta necesitas?")).toBeInTheDocument();
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

describe("PasoServicio — como carta", () => {
  const conCategoria: ServicioPublico[] = [
    { ...mockServicios[0], categoriaNombre: "Cabello" },
    { ...mockServicios[1], categoriaNombre: "Color" },
  ];

  it("nombre y precio en la misma línea, unidos por una guía punteada que no se lee", () => {
    render(<PasoServicio servicios={mockServicios} seleccionado={null} onSeleccionar={vi.fn()} />);
    const nombre = screen.getByText("Corte de cabello");
    const linea = nombre.parentElement!;
    expect(linea).toHaveClass("items-baseline");
    expect(linea).toContainElement(screen.getByText("$150"));
    const guia = linea.querySelector(".border-dotted");
    expect(guia).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("30 min")).toHaveClass("text-slate-500");
  });

  it("los encabezados de categoría usan Inter (sin cara display), también en salud", () => {
    const { unmount } = render(<PasoServicio servicios={conCategoria} seleccionado={null} onSeleccionar={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 3, name: "Cabello" })).not.toHaveClass("font-display");
    unmount();
    render(<PasoServicio servicios={conCategoria} seleccionado={null} onSeleccionar={vi.fn()} sector="salud" />);
    expect(screen.getByRole("heading", { level: 3, name: "Cabello" })).not.toHaveClass("font-display");
  });

  it("cada categoría es una lista con nombre; la fila sigue siendo un botón conmutable", () => {
    render(<PasoServicio servicios={conCategoria} seleccionado={conCategoria[1]} onSeleccionar={vi.fn()} />);
    const color = screen.getByRole("region", { name: "Color" });
    expect(within(color).getByRole("button", { name: /Coloración/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("la palomita del seleccionado se rellena con el color sólido del negocio", () => {
    render(<PasoServicio servicios={mockServicios} seleccionado={mockServicios[0]} onSeleccionar={vi.fn()} color="#1F6F43" />);
    const fila = screen.getByRole("button", { name: /Corte de cabello/ });
    const palomita = fila.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(palomita.style.background).toBe("rgb(31, 111, 67)");
  });
});