import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("como primera página de la pestaña no muestra un Volver inerte", () => {
    render(
      <MemoryRouter initialEntries={["/no-existe"]}>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: /volver/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al inicio" })).toBeInTheDocument();
  });

  it("con historial, Volver regresa a la página anterior", () => {
    render(
      <MemoryRouter initialEntries={["/anterior", "/no-existe"]} initialIndex={1}>
        <Routes>
          <Route path="/anterior" element={<p>Página anterior</p>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByText("Página anterior")).toBeInTheDocument();
  });
});
