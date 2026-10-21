import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// Componente que lanza un error controlado
function Bomba({ lanzar }: { lanzar: boolean }) {
  if (lanzar) throw new Error("Error de prueba");
  return <div>Contenido normal</div>;
}

// Silenciar los console.error de React durante pruebas de error boundaries
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renderiza hijos cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <div>Hijo sin error</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Hijo sin error")).toBeInTheDocument();
  });

  it("muestra el fallback por defecto cuando un hijo lanza un error", () => {
    render(
      <ErrorBoundary>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    expect(screen.getByText(/ocurrió un error inesperado/i)).toBeInTheDocument();
  });

  it("muestra el botón de recargar en el fallback por defecto", () => {
    render(
      <ErrorBoundary>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("button", { name: /recargar página/i })).toBeInTheDocument();
  });

  it("el botón de recargar llama a window.location.reload", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /recargar página/i }));
    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("muestra el fallback personalizado cuando se proporciona", () => {
    render(
      <ErrorBoundary fallback={<div>Mi error personalizado</div>}>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Mi error personalizado")).toBeInTheDocument();
    expect(screen.queryByText("Algo salió mal")).not.toBeInTheDocument();
  });

  it("no muestra el fallback cuando no hay error", () => {
    render(
      <ErrorBoundary fallback={<div>Fallback</div>}>
        <Bomba lanzar={false} />
      </ErrorBoundary>
    );
    expect(screen.queryByText("Fallback")).not.toBeInTheDocument();
    expect(screen.getByText("Contenido normal")).toBeInTheDocument();
  });

  it("el ícono de advertencia SVG está presente en el fallback", () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("con historial en la pestaña, Volver llama a window.history.back", () => {
    const backMock = vi.fn();
    Object.defineProperty(window, "history", {
      value: { back: backMock, state: { idx: 2 } },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(backMock).toHaveBeenCalledOnce();
  });

  it("sin historial (primera página de la pestaña) ofrece Ir al inicio en lugar de un Volver inerte", () => {
    const backMock = vi.fn();
    const assignMock = vi.fn();
    Object.defineProperty(window, "history", { value: { back: backMock, state: { idx: 0 } }, writable: true });
    Object.defineProperty(window, "location", { value: { assign: assignMock, reload: vi.fn() }, writable: true });

    render(
      <ErrorBoundary>
        <Bomba lanzar={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByRole("button", { name: /volver/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir al inicio" }));
    expect(assignMock).toHaveBeenCalledWith("/");
    expect(backMock).not.toHaveBeenCalled();
  });

  it("al volver atrás en el historial suelta el error y pinta la página", () => {
    let romper = true;
    function Pagina() {
      if (romper) throw new Error("Error de prueba");
      return <div>Página anterior</div>;
    }
    render(
      <ErrorBoundary>
        <Pagina />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

    romper = false;
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByText("Página anterior")).toBeInTheDocument();
  });
});
