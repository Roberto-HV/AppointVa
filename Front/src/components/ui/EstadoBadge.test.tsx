import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EstadoBadge from "./EstadoBadge";
import { ESTADO_CITA, ESTADOS_CITA } from "../../lib/estadoCita";

describe("EstadoBadge", () => {
  it.each(ESTADOS_CITA)("%s se pinta con las clases del mapa único de estados", (estado) => {
    render(<EstadoBadge estado={estado} />);
    const badge = screen.getByText(estado);
    for (const clase of ESTADO_CITA[estado].badge.split(" ")) {
      expect(badge).toHaveClass(clase);
    }
    // El color nunca va solo: siempre acompaña un icono.
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("no anima la pastilla de las citas confirmadas", () => {
    render(<EstadoBadge estado="Confirmada" />);
    expect(screen.getByText("Confirmada").querySelector(".animate-pulse")).toBeNull();
  });
});
