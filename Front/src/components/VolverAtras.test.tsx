import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import VolverAtras from "./VolverAtras";

function Rutas() {
  return (
    <Routes>
      <Route path="/" element={<p>Inicio</p>} />
      <Route path="/registro" element={<Link to="/terminos">Ver términos</Link>} />
      <Route path="/terminos" element={<VolverAtras />} />
    </Routes>
  );
}

describe("VolverAtras (AP-15)", () => {
  it("sin historial (pestaña nueva) lleva al inicio", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/terminos"]}><Rutas /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByText("Inicio")).toBeInTheDocument();
  });

  it("con historial vuelve a la página anterior", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/registro"]}><Rutas /></MemoryRouter>);
    await user.click(screen.getByRole("link", { name: "Ver términos" }));
    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByRole("link", { name: "Ver términos" })).toBeInTheDocument();
  });
});
