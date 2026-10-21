import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Link } from "react-router-dom";
import TemaPorRuta from "./TemaPorRuta";
import { rutaAdmiteTemaOscuro } from "../lib/temaPorRuta";

const root = document.documentElement;

function renderEn(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <TemaPorRuta />
      <Link to="/b/salon-test">ir a reservar</Link>
      <Link to="/dashboard/citas">ir al panel</Link>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.setItem("appointva-theme", "dark");
  root.classList.remove("dark");
  root.style.colorScheme = "";
});

afterEach(() => {
  localStorage.clear();
  root.classList.remove("dark");
  root.style.colorScheme = "";
});

describe("rutaAdmiteTemaOscuro", () => {
  it.each(["/dashboard", "/dashboard/citas", "/dashboard/kiosk", "/admin", "/admin/audit"])(
    "el panel %s respeta el tema",
    (ruta) => expect(rutaAdmiteTemaOscuro(ruta)).toBe(true)
  );

  it.each([
    "/", "/landing", "/salud", "/login", "/registro", "/b/salon-test",
    "/b/salon-test/confirmacion/ABC123", "/cita/ABC123", "/cancelar/ABC123",
    "/resena/tok", "/privacidad", "/terminos", "/dashboards-falso", "/administrar",
  ])("la ruta pública %s es solo clara", (ruta) => expect(rutaAdmiteTemaOscuro(ruta)).toBe(false));
});

describe("TemaPorRuta", () => {
  it("nunca aplica .dark en una página pública, aunque el usuario prefiera oscuro", () => {
    root.classList.add("dark"); // p. ej. heredado de una sesión en el panel
    renderEn("/b/salon-test");
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });

  it("aplica la preferencia oscura en el panel", () => {
    renderEn("/dashboard");
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("");
  });

  it("respeta la preferencia clara en el panel", () => {
    localStorage.setItem("appointva-theme", "light");
    renderEn("/dashboard");
    expect(root.classList.contains("dark")).toBe(false);
  });

  it("quita y restaura .dark al navegar entre el panel y las páginas públicas", () => {
    renderEn("/dashboard");
    expect(root.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByText("ir a reservar"));
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");

    fireEvent.click(screen.getByText("ir al panel"));
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("");
  });
});
