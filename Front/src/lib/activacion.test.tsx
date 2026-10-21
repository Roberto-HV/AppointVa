import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ACTIVACION_FAQ, ACTIVACION_PASOS, ACTIVACION_RESUMEN } from "./activacion";
import AvisoActivacionPendiente from "../components/dashboard/AvisoActivacionPendiente";

// AP-02: la FAQ de la landing, la pantalla de registro y el aviso del panel
// deben contar la misma historia sobre la activación.
describe("mensaje de activación", () => {
  it("la FAQ y el aviso del panel contienen la misma frase central", () => {
    expect(ACTIVACION_FAQ).toContain(ACTIVACION_RESUMEN);
    render(<AvisoActivacionPendiente />);
    expect(screen.getByRole("status")).toHaveTextContent(ACTIVACION_RESUMEN);
    expect(screen.getByRole("status")).toHaveTextContent("Tu negocio está pendiente de activación.");
  });

  it("no promete lo que el backend no hace: ni aviso por correo ni un plazo fijo", () => {
    const todo = [ACTIVACION_FAQ, ACTIVACION_RESUMEN, ...ACTIVACION_PASOS].join(" ");
    expect(todo).not.toMatch(/te notificamos|te avisaremos por (email|correo)/i);
    expect(todo).not.toMatch(/24-48|24–48|48 horas/);
  });

  it("dice que la activación es manual y que la página no recibe citas mientras tanto", () => {
    expect(ACTIVACION_RESUMEN).toMatch(/manual/);
    expect(ACTIVACION_RESUMEN).toMatch(/no recibe citas/);
  });
});
