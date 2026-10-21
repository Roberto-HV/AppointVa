import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstrellasCalificacion from "./EstrellasCalificacion";

function Envoltorio({ onCambiar = vi.fn() }: { onCambiar?: (v: number) => void }) {
  const [valor, setValor] = useState(0);
  return (
    <>
      <p id="pregunta">¿Cómo calificarías tu experiencia?</p>
      <EstrellasCalificacion
        valor={valor}
        onCambiar={(v) => { setValor(v); onCambiar(v); }}
        etiquetadoPor="pregunta"
      />
    </>
  );
}

describe("EstrellasCalificacion", () => {
  it("es un grupo de radio con nombre y cinco opciones con nombre propio", () => {
    render(<Envoltorio />);
    expect(screen.getByRole("radiogroup", { name: "¿Cómo calificarías tu experiencia?" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "3 de 5: Regular" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "5 de 5: Excelente" })).toBeInTheDocument();
  });

  it("marca la estrella elegida como seleccionada", async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);
    await user.click(screen.getByRole("radio", { name: "4 de 5: Bueno" }));
    expect(screen.getByRole("radio", { name: "4 de 5: Bueno" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "3 de 5: Regular" })).toHaveAttribute("aria-checked", "false");
  });

  it("se puede usar solo con teclado: Tab entra, flechas cambian el valor y mueven el foco", async () => {
    const user = userEvent.setup();
    const onCambiar = vi.fn();
    render(<Envoltorio onCambiar={onCambiar} />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "1 de 5: Muy malo" })).toHaveFocus();

    await user.keyboard(" ");
    expect(onCambiar).toHaveBeenLastCalledWith(1);

    await user.keyboard("{ArrowRight}{ArrowRight}");
    const tres = screen.getByRole("radio", { name: "3 de 5: Regular" });
    expect(tres).toHaveAttribute("aria-checked", "true");
    expect(tres).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "5 de 5: Excelente" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(onCambiar).toHaveBeenLastCalledWith(4);
  });

  it("solo la estrella elegida está en el orden de tabulación", async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);
    await user.click(screen.getByRole("radio", { name: "2 de 5: Malo" }));
    const enTab = screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0");
    expect(enTab).toHaveLength(1);
    expect(enTab[0]).toHaveAccessibleName("2 de 5: Malo");
  });

  it("usa el token de calificación, no el dorado de marca", async () => {
    const user = userEvent.setup();
    const { container } = render(<Envoltorio />);
    await user.click(screen.getByRole("radio", { name: "5 de 5: Excelente" }));
    expect(container.querySelectorAll("svg.fill-rating")).toHaveLength(5);
    expect(container.innerHTML).not.toMatch(/C8A961/i);
  });
});
