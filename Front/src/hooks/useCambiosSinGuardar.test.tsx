import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { useConfirmarDescarte, useProtegerNavegacion } from "./useCambiosSinGuardar";

function FormularioEnModal({ onCerrado }: { onCerrado: () => void }) {
  const [abierto, setAbierto] = useState(true);
  const [texto, setTexto] = useState("");
  const descarte = useConfirmarDescarte();
  const cerrar = () => { setAbierto(false); onCerrado(); };
  return (
    <>
      <Modal abierto={abierto} onCerrar={() => descarte.pedirCierre(texto !== "", cerrar)} titulo="Notas">
        <label htmlFor="n">Nota</label>
        <input id="n" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Modal>
      {descarte.dialogo}
    </>
  );
}

describe("useConfirmarDescarte", () => {
  it("sin cambios, Escape cierra el modal sin preguntar", async () => {
    const user = userEvent.setup();
    const onCerrado = vi.fn();
    render(<FormularioEnModal onCerrado={onCerrado} />);
    await user.keyboard("{Escape}");
    expect(onCerrado).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Descartar cambios?")).not.toBeInTheDocument();
  });

  it("con cambios pregunta; 'Seguir editando' conserva lo escrito", async () => {
    const user = userEvent.setup();
    const onCerrado = vi.fn();
    render(<FormularioEnModal onCerrado={onCerrado} />);
    await user.type(screen.getByLabelText("Nota"), "Alergia al látex");
    await user.keyboard("{Escape}");

    expect(await screen.findByText("¿Descartar cambios?")).toBeInTheDocument();
    expect(onCerrado).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() => expect(screen.queryByText("¿Descartar cambios?")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Nota")).toHaveValue("Alergia al látex");
    expect(onCerrado).not.toHaveBeenCalled();
  });

  it("con cambios, 'Descartar cambios' cierra", async () => {
    const user = userEvent.setup();
    const onCerrado = vi.fn();
    render(<FormularioEnModal onCerrado={onCerrado} />);
    await user.type(screen.getByLabelText("Nota"), "x");
    await user.keyboard("{Escape}");
    await user.click(await screen.findByRole("button", { name: "Descartar cambios" }));
    expect(onCerrado).toHaveBeenCalledTimes(1);
  });
});

function PaginaConCambios({ hayCambios }: { hayCambios: boolean }) {
  const dialogo = useProtegerNavegacion(hayCambios);
  return (
    <>
      <p>Mi negocio</p>
      <Link to="/dashboard/citas">Citas</Link>
      {dialogo}
    </>
  );
}

function renderConRouter(hayCambios: boolean) {
  return render(
    <MemoryRouter initialEntries={["/dashboard/perfil"]}>
      <Routes>
        <Route path="/dashboard/perfil" element={<PaginaConCambios hayCambios={hayCambios} />} />
        <Route path="/dashboard/citas" element={<p>Pantalla de citas</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useProtegerNavegacion", () => {
  it("sin cambios, los enlaces navegan normalmente", async () => {
    const user = userEvent.setup();
    renderConRouter(false);
    await user.click(screen.getByRole("link", { name: "Citas" }));
    expect(await screen.findByText("Pantalla de citas")).toBeInTheDocument();
  });

  it("con cambios, un enlace interno pregunta antes de salir", async () => {
    const user = userEvent.setup();
    renderConRouter(true);
    await user.click(screen.getByRole("link", { name: "Citas" }));

    expect(await screen.findByText("¿Descartar cambios?")).toBeInTheDocument();
    expect(screen.getByText("Mi negocio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() => expect(screen.queryByText("¿Descartar cambios?")).not.toBeInTheDocument());
    expect(screen.getByText("Mi negocio")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Citas" }));
    await user.click(await screen.findByRole("button", { name: "Descartar cambios" }));
    expect(await screen.findByText("Pantalla de citas")).toBeInTheDocument();
  });
});
