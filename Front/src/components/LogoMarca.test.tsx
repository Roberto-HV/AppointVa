import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LogoMarca from "./LogoMarca";

describe("LogoMarca", () => {
  it("usa el logo optimizado con dimensiones intrínsecas, nunca el PNG de 488 KB", () => {
    render(<LogoMarca prioridad className="h-20" />);
    const img = screen.getByRole("img", { name: "AppointVa" });
    expect(img.getAttribute("src")).toBe("/logo-appointva.png");
    expect(img.getAttribute("width")).toBe("576");
    expect(img.getAttribute("height")).toBe("192");
    expect(img.getAttribute("loading")).toBe("eager");
  });

  it("la variante pequeña carga diferida", () => {
    render(<LogoMarca variante="pequeno" className="h-6" />);
    const img = screen.getByRole("img", { name: "AppointVa" });
    expect(img.getAttribute("src")).toBe("/logo-appointva-sm.png");
    expect(img.getAttribute("loading")).toBe("lazy");
  });
});
