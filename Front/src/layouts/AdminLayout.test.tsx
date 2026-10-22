import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CLAVE_TEMA } from "../lib/temaPorRuta";

const estadoInactividad = vi.hoisted(() => ({ aviso: false, seguir: vi.fn() }));
const cerrarSesion = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useInactividadTimeout", () => ({
  useInactividadTimeout: () => estadoInactividad,
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    usuario: { nombreCompleto: "Admin Uno", email: "admin@test.com", rol: "SuperAdmin" },
    token: "t",
    refreshToken: null,
    cerrarSesion,
  })),
}));

vi.mock("../api/auth", () => ({ authApi: { logout: vi.fn() } }));

const emitirTicketHangfire = vi.hoisted(() => vi.fn());
vi.mock("../api/admin", () => ({ adminApi: { emitirTicketHangfire } }));

import AdminLayout from "./AdminLayout";

function renderizar() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Contenido admin</p>} />
        </Route>
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const cajon = () => screen.getByRole("complementary", { hidden: true, name: "Menú de administración" });

beforeEach(() => {
  vi.clearAllMocks();
  estadoInactividad.aviso = false;
  localStorage.removeItem(CLAVE_TEMA);
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

// jsdom no tiene matchMedia: useMediaQuery devuelve false, es decir, móvil.
describe("AdminLayout — cajón móvil", () => {
  it("cerrado, el cajón es inert y no es un diálogo", () => {
    renderizar();
    const aside = cajon();
    expect(aside).toHaveAttribute("inert");
    expect(aside).not.toHaveAttribute("role", "dialog");
  });

  it("abierto es un diálogo modal con el foco dentro; Escape lo cierra y devuelve el foco", async () => {
    const user = userEvent.setup();
    renderizar();
    const abrir = screen.getByRole("button", { name: "Abrir el menú" });
    await user.click(abrir);

    const dialogo = screen.getByRole("dialog", { name: "Menú de administración" });
    expect(dialogo).not.toHaveAttribute("inert");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cerrar el menú" })).toHaveFocus();
    expect(abrir).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(cajon()).toHaveAttribute("inert");
    expect(abrir).toHaveFocus();
  });

  it("Tab no sale del cajón abierto", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole("button", { name: "Abrir el menú" }));
    const cerrar = screen.getByRole("button", { name: "Cerrar el menú" });
    const ultimo = screen.getByRole("button", { name: "Cerrar sesión" });

    ultimo.focus();
    await user.tab();
    expect(cerrar).toHaveFocus();

    await user.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });

  it("el botón de cerrar devuelve el foco al botón de menú", async () => {
    const user = userEvent.setup();
    renderizar();
    const abrir = screen.getByRole("button", { name: "Abrir el menú" });
    await user.click(abrir);
    await user.click(screen.getByRole("button", { name: "Cerrar el menú" }));
    expect(cajon()).toHaveAttribute("inert");
    expect(abrir).toHaveFocus();
  });
});

describe("AdminLayout — inactividad", () => {
  it("avisa antes de cerrar la sesión y 'Seguir conectado' la mantiene", async () => {
    estadoInactividad.aviso = true;
    const user = userEvent.setup();
    renderizar();
    const aviso = await screen.findByRole("dialog", { name: "¿Sigues ahí?" });
    expect(aviso).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir conectado" }));
    expect(estadoInactividad.seguir).toHaveBeenCalled();
  });

  it("sin aviso pendiente no muestra el diálogo", () => {
    renderizar();
    expect(screen.queryByRole("dialog", { name: "¿Sigues ahí?" })).not.toBeInTheDocument();
  });
});

describe("AdminLayout — logo", () => {
  it("usa el logo optimizado en modo claro, nunca el PNG de 488 KB", () => {
    localStorage.setItem(CLAVE_TEMA, "light");
    renderizar();
    const logo = screen.getByRole("img", { hidden: true, name: "AppointVa" });
    expect(logo).toHaveAttribute("src", "/logo-appointva.png");
    expect(logo).toHaveAttribute("width", "576");
  });

  it("en modo oscuro usa la variante optimizada de texto claro", () => {
    localStorage.setItem(CLAVE_TEMA, "dark");
    renderizar();
    const logo = screen.getByRole("img", { hidden: true, name: "AppointVa" });
    expect(logo).toHaveAttribute("src", "/logo-appointva-oscuro.png");
    expect(document.querySelector('img[src*="MasterLogo"], img[src*="MaterLogo"]')).toBeNull();
  });
});

// S2: the JWT must never travel in the Hangfire URL; a one-time ticket does.
describe("AdminLayout — tareas programadas (Hangfire)", () => {
  const boton = () => screen.getByRole("button", { hidden: true, name: /Tareas programadas/ });

  it("pide un ticket de un solo uso y abre /hangfire-session?ticket=… sin el JWT", async () => {
    emitirTicketHangfire.mockResolvedValueOnce("tkt-123");
    const ventana = { opener: {} as unknown, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);

    renderizar();
    fireEvent.click(boton());

    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    await waitFor(() => expect(ventana.location.replace).toHaveBeenCalled());
    const url = ventana.location.replace.mock.calls[0][0] as string;
    expect(url).toMatch(/\/hangfire-session\?ticket=tkt-123$/);
    expect(url).not.toContain("token=");
    expect(ventana.opener).toBeNull();
    open.mockRestore();
  });

  it("si el ticket falla, cierra la pestaña y avisa", async () => {
    emitirTicketHangfire.mockRejectedValueOnce(new Error("403"));
    const ventana = { opener: null, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);

    renderizar();
    fireEvent.click(boton());

    expect(await screen.findByRole("alert", { hidden: true })).toHaveTextContent("No se pudo abrir el panel de tareas");
    expect(ventana.close).toHaveBeenCalled();
    expect(ventana.location.replace).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("si el navegador bloquea la pestaña, no navega la pestaña admin ni gasta un ticket", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const urlAntes = window.location.href;

    renderizar();
    fireEvent.click(boton());

    expect(await screen.findByRole("alert", { hidden: true })).toHaveTextContent("Permite las ventanas emergentes");
    expect(emitirTicketHangfire).not.toHaveBeenCalled();
    expect(window.location.href).toBe(urlAntes);
    expect(screen.getByText("Contenido admin")).toBeInTheDocument();
    open.mockRestore();
  });
});
