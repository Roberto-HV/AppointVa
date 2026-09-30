import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("muestra título y descripción", () => {
    render(<EmptyState title="Aún no hay citas" description="Agenda la primera." />);
    expect(screen.getByText("Aún no hay citas")).toBeInTheDocument();
    expect(screen.getByText("Agenda la primera.")).toBeInTheDocument();
  });

  it("la variante por defecto no ofrece limpiar filtros", () => {
    render(<EmptyState title="Aún no hay citas" onLimpiarFiltros={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).not.toBeInTheDocument();
  });

  it("la variante sinResultados ofrece restablecer los filtros", async () => {
    const user = userEvent.setup();
    const onLimpiarFiltros = vi.fn();
    render(
      <EmptyState
        variante="sinResultados"
        title="Sin resultados"
        description="Ninguna cita coincide con los filtros."
        onLimpiarFiltros={onLimpiarFiltros}
      />
    );
    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));
    expect(onLimpiarFiltros).toHaveBeenCalledTimes(1);
  });

  it("sinResultados sin callback no inventa un botón sin salida", () => {
    render(<EmptyState variante="sinResultados" title="Sin resultados" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("una acción explícita gana sobre el botón por defecto", () => {
    render(
      <EmptyState
        variante="sinResultados"
        title="Sin resultados"
        onLimpiarFiltros={vi.fn()}
        action={<button type="button">Crear cita</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Crear cita" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).not.toBeInTheDocument();
  });
});
