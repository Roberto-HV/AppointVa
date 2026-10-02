import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FiltroBarra from "./FiltroBarra";
import { campoActivo, type CampoFiltro } from "./tipos";

const camposBase = (): CampoFiltro[] => [
  {
    id: "estado",
    etiqueta: "Estado",
    tipo: "pills",
    valor: "",
    onChange: vi.fn(),
    etiquetaNeutra: "Todos",
    opciones: [
      { valor: "Pendiente", etiqueta: "Pendiente" },
      { valor: "Confirmada", etiqueta: "Confirmada" },
    ],
  },
  {
    id: "profesional",
    etiqueta: "Profesional",
    tipo: "select",
    valor: "",
    onChange: vi.fn(),
    opciones: [{ valor: "e1", etiqueta: "Ana" }],
  },
];

describe("campoActivo", () => {
  it("un select en su valor neutro no cuenta como activo", () => {
    expect(campoActivo(camposBase()[1])).toBe(false);
  });

  it("un select con valor sí cuenta como activo", () => {
    const campo = { ...camposBase()[1], valor: "e1" } as CampoFiltro;
    expect(campoActivo(campo)).toBe(true);
  });

  it("un rango de fechas vacío no cuenta como activo", () => {
    expect(
      campoActivo({
        id: "f", etiqueta: "Período", tipo: "rangoFechas",
        desde: "", hasta: "", onChange: vi.fn(),
      })
    ).toBe(false);
  });

  it("un rango igual al rango neutro no cuenta como activo", () => {
    expect(
      campoActivo({
        id: "f", etiqueta: "Período", tipo: "rangoFechas",
        desde: "2026-03-01", hasta: "2026-03-31", onChange: vi.fn(),
        rangoNeutro: { desde: "2026-03-01", hasta: "2026-03-31" },
      })
    ).toBe(false);
  });
});

describe("FiltroBarra", () => {
  it("etiqueta la región de filtros", () => {
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Filtros" })).toBeInTheDocument();
  });

  it("el toggle arranca colapsado y describe su estado", () => {
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /filtros/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("el toggle expande el panel", async () => {
    const user = userEvent.setup();
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: /filtros/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("no muestra el conteo cuando no hay filtros activos", () => {
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    expect(screen.queryByLabelText(/filtros activos/)).not.toBeInTheDocument();
  });

  it("la barra calcula el conteo de filtros activos, la página no lo pasa", () => {
    const campos = camposBase();
    campos[0] = { ...campos[0], valor: "Pendiente" } as CampoFiltro;
    campos[1] = { ...campos[1], valor: "e1" } as CampoFiltro;
    render(<FiltroBarra campos={campos} onLimpiar={vi.fn()} />);
    expect(screen.getByLabelText("2 filtros activos")).toHaveTextContent("2");
  });

  it("la búsqueda no cuenta en el badge porque nunca se colapsa", () => {
    render(
      <FiltroBarra
        busqueda={{ valor: "ana", onChange: vi.fn() }}
        campos={camposBase()}
        onLimpiar={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/filtros activos/)).not.toBeInTheDocument();
  });

  it("el campo de búsqueda queda etiquetado y a 16px en móvil", () => {
    render(
      <FiltroBarra
        busqueda={{ valor: "", onChange: vi.fn(), etiqueta: "Buscar cliente" }}
        campos={[]}
        onLimpiar={vi.fn()}
      />
    );
    const input = screen.getByLabelText("Buscar cliente");
    // text-base = 16px; iOS Safari hace zoom por debajo de ese tamaño.
    expect(input.className).toContain("text-base");
    expect(input.className).not.toMatch(/(^|\s)text-xs/);
  });

  it("sin controles en línea, 'Buscar' queda inmediatamente después del campo", () => {
    render(
      <FiltroBarra
        busqueda={{ valor: "", onChange: vi.fn(), etiqueta: "Buscar cliente" }}
        campos={[]}
        onLimpiar={vi.fn()}
      />
    );
    const form = screen.getByRole("search");
    expect(form.nextElementSibling).toBe(screen.getByRole("button", { name: "Buscar" }));
  });

  it("'Buscar' cierra la fila: va después de la acción y del toggle", () => {
    render(
      <FiltroBarra
        busqueda={{ valor: "", onChange: vi.fn(), etiqueta: "Buscar cliente" }}
        accion={<button type="button">Actividad</button>}
        campos={camposBase()}
        onLimpiar={vi.fn()}
      />
    );
    const fila = screen.getByRole("search").parentElement!;
    const posicion = (el: Element) => Array.from(fila.children).indexOf(el);
    const buscar = screen.getByRole("button", { name: "Buscar" });

    expect(posicion(screen.getByRole("search"))).toBeLessThan(
      posicion(screen.getByRole("button", { name: "Actividad" }))
    );
    expect(posicion(screen.getByRole("button", { name: /^filtros/i }))).toBeLessThan(posicion(buscar));
    expect(posicion(buscar)).toBe(fila.children.length - 1);
  });

  it("'Buscar' envía el formulario aunque viva fuera de él", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FiltroBarra
        busqueda={{ valor: "", onChange, etiqueta: "Buscar cliente" }}
        accion={<button type="button">Actividad</button>}
        campos={camposBase()}
        onLimpiar={vi.fn()}
      />
    );
    const buscar = screen.getByRole("button", { name: "Buscar" });
    // El botón queda fuera del landmark `search`; lo une al form el atributo `form`.
    expect(screen.getByRole("search").contains(buscar)).toBe(false);

    await user.type(screen.getByLabelText("Buscar cliente"), "ana");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(buscar);
    expect(onChange).toHaveBeenCalledWith("ana");
  });

  it("Enter y 'Buscar' son la misma acción", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FiltroBarra
        busqueda={{ valor: "", onChange, etiqueta: "Buscar cliente" }}
        campos={[]}
        onLimpiar={vi.fn()}
      />
    );
    await user.type(screen.getByLabelText("Buscar cliente"), "ana{Enter}");
    expect(onChange).toHaveBeenCalledWith("ana");
  });

  it("vaciar el campo se aplica solo, sin pasar por 'Buscar'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FiltroBarra
        busqueda={{ valor: "ana", onChange, etiqueta: "Buscar cliente" }}
        campos={[]}
        onLimpiar={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /^borrar buscar cliente/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("sin búsqueda declarada no hay botón 'Buscar'", () => {
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Buscar" })).not.toBeInTheDocument();
  });

  it("solo ofrece limpiar cuando hay algo que limpiar", async () => {
    const user = userEvent.setup();
    const onLimpiar = vi.fn();
    const campos = camposBase();
    campos[0] = { ...campos[0], valor: "Pendiente" } as CampoFiltro;
    render(<FiltroBarra campos={campos} onLimpiar={onLimpiar} />);
    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
    expect(onLimpiar).toHaveBeenCalledTimes(1);
  });

  it("oculta limpiar cuando todo está en su valor neutro", () => {
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).not.toBeInTheDocument();
  });

  it("las pills forman un radiogroup etiquetado con opción única", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const campos = camposBase();
    campos[0] = { ...campos[0], onChange } as CampoFiltro;
    render(<FiltroBarra campos={campos} onLimpiar={vi.fn()} />);

    const grupo = screen.getByRole("radiogroup", { name: "Estado" });
    expect(grupo).toBeInTheDocument();

    const opciones = screen.getAllByRole("radio");
    expect(opciones).toHaveLength(3); // Todos + 2
    expect(opciones[0]).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "Confirmada" }));
    expect(onChange).toHaveBeenCalledWith("Confirmada");
  });

  it("las pills se recorren con las flechas del teclado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const campos = camposBase();
    campos[0] = { ...campos[0], onChange } as CampoFiltro;
    render(<FiltroBarra campos={campos} onLimpiar={vi.fn()} />);

    screen.getAllByRole("radio")[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("Pendiente");
  });

  it("el select expone aria-expanded en su trigger visible", () => {
    render(<FiltroBarra campos={camposBase()} onLimpiar={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Profesional" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
  });
});
