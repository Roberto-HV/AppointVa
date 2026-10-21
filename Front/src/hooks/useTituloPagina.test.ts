import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { TITULO_POR_DEFECTO, useTituloPagina } from "./useTituloPagina";

beforeEach(() => {
  document.title = TITULO_POR_DEFECTO;
});

describe("useTituloPagina (AP-17)", () => {
  it("pone el título de la pantalla y lo restaura al desmontar", () => {
    const { unmount } = renderHook(() => useTituloPagina("Iniciar sesión"));
    expect(document.title).toBe("Iniciar sesión · AppointVa");
    unmount();
    expect(document.title).toBe(TITULO_POR_DEFECTO);
  });

  it("se actualiza cuando cambia el título y no hace nada sin título", () => {
    const { rerender } = renderHook(({ t }: { t: string | null }) => useTituloPagina(t), {
      initialProps: { t: null as string | null },
    });
    expect(document.title).toBe(TITULO_POR_DEFECTO);
    rerender({ t: "Mis citas · Barbería Luis" });
    expect(document.title).toBe("Mis citas · Barbería Luis · AppointVa");
  });
});
