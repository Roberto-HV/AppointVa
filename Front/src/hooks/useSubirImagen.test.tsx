import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSubirImagen } from "./useSubirImagen";
import { useToastStore } from "../store/toastStore";

const envoltorio = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const imagen = () => new File([new Uint8Array(4)], "foto.png", { type: "image/png" });

beforeEach(() => useToastStore.setState({ toasts: [] }));

describe("useSubirImagen", () => {
  it("no sube un archivo inválido y lo explica", () => {
    const subir = vi.fn();
    const { result } = renderHook(() => useSubirImagen({ subir, mensajeFallo: "x" }), { wrapper: envoltorio });
    act(() => { result.current.subirArchivo(new File(["a"], "a.heic", { type: "image/heic" })); });
    expect(subir).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ tipo: "error", mensaje: '"a.heic" no es JPG, PNG, WebP o GIF.' });
  });

  it("informa avance y destino mientras sube, y llama a onExito", async () => {
    let terminar: (v: string) => void = () => {};
    const subir = vi.fn((_a: File, _d: string | undefined, onProgreso: (n: number) => void) => {
      onProgreso(40);
      return new Promise<string>((r) => { terminar = r; });
    });
    const onExito = vi.fn();
    const { result } = renderHook(() => useSubirImagen({ subir, onExito, mensajeFallo: "x" }), { wrapper: envoltorio });

    act(() => { result.current.subirArchivo(imagen(), "emp-1"); });
    await waitFor(() => expect(result.current.subiendo).toBe(true));
    expect(result.current.destino).toBe("emp-1");
    await waitFor(() => expect(result.current.progreso).toBe(40));

    await act(async () => { terminar("ok"); });
    await waitFor(() => expect(result.current.subiendo).toBe(false));
    expect(onExito).toHaveBeenCalledWith("ok", "emp-1");
    expect(result.current.progreso).toBeNull();
  });

  it("muestra el mensaje del servidor si la subida falla", async () => {
    const subir = vi.fn().mockRejectedValue({ response: { data: { mensaje: "El archivo supera el límite de 20 MB." } } });
    const { result } = renderHook(() => useSubirImagen({ subir, mensajeFallo: "No se pudo subir" }), { wrapper: envoltorio });
    act(() => { result.current.subirArchivo(imagen()); });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]?.mensaje).toBe("El archivo supera el límite de 20 MB."),
    );
  });

  it("limpia el input para poder volver a elegir el mismo archivo", async () => {
    const subir = vi.fn(() => new Promise<void>(() => {}));
    const { result } = renderHook(() => useSubirImagen({ subir, mensajeFallo: "x" }), { wrapper: envoltorio });
    const input = document.createElement("input");
    input.type = "file";
    Object.defineProperty(input, "files", { value: [imagen()] });
    let valor = "C:\\fakepath\\foto.png";
    Object.defineProperty(input, "value", { get: () => valor, set: (v) => { valor = v; } });
    act(() => { result.current.alElegir({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>); });
    expect(valor).toBe("");
    await waitFor(() => expect(subir).toHaveBeenCalled());
  });
});
