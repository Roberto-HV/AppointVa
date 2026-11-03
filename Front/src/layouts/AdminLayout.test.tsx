import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const obtenerEstado2FA = vi.hoisted(() => vi.fn());
vi.mock("../api/auth", () => ({ authApi: { logout: vi.fn(), obtenerEstado2FA } }));

const emitirTicketHangfire = vi.hoisted(() => vi.fn());
const obtenerMetricas = vi.hoisted(() => vi.fn());
vi.mock("../api/admin", () => ({ adminApi: { emitirTicketHangfire, obtenerMetricas } }));

import AdminLayout from "./AdminLayout";

function renderizar(ruta = "/admin") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<p>Contenido admin</p>} />
            <Route path="cuenta" element={<p>Pantalla Mi cuenta</p>} />
            <Route path="seguridad" element={<p>Pantalla Seguridad</p>} />
            <Route path="facturacion" element={<p>Pantalla Facturación</p>} />
            <Route path="negocios/:id" element={<p>Ficha del negocio</p>} />
          </Route>
          <Route path="/login" element={<p>Pantalla de login</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cajon = () => screen.getByRole("complementary", { hidden: true, name: "Menú de administración" });

beforeEach(() => {
  vi.clearAllMocks();
  estadoInactividad.aviso = false;
  localStorage.removeItem(CLAVE_TEMA);
  obtenerEstado2FA.mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 10 });
  obtenerMetricas.mockResolvedValue([]);
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

// Lote 3, M1: una sola marca y "Admin" con el dorado de la marca.
describe("AdminLayout — marca", () => {
  it("'Admin' va junto al logo con el dorado de la marca, no con yellow-400", () => {
    renderizar();
    // Barra móvil y sidebar; la barra de escritorio ya no repite la marca.
    const chips = screen.getAllByText("Admin", { selector: "span" });
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip.className).toContain("bg-[#C8A961]");
      expect(chip.className).not.toContain("yellow-400");
    }
    expect(within(cajon()).getByText("Admin")).toBeInTheDocument();
  });

  it("el texto 'AppointVa' solo aparece en la barra móvil, donde no hay sidebar", () => {
    renderizar();
    const marcas = screen.getAllByText((_, el) => el?.tagName === "SPAN" && el.textContent === "AppointVa");
    expect(marcas).toHaveLength(1);
    expect(marcas[0].closest("header")).toHaveClass("md:hidden");
  });
});

// Lote 1, G1: el admin tiene menú de usuario con Mi cuenta y Seguridad.
describe("AdminLayout — menú de usuario", () => {
  // jsdom no aplica `md:hidden`: están el avatar de la barra móvil (primero) y el de escritorio.
  const avatares = () => screen.getAllByRole("button", { name: "Menú de usuario" });

  it("el avatar abre el menú con Mi cuenta, Seguridad y Cerrar sesión", async () => {
    const user = userEvent.setup();
    renderizar();
    const [movil, escritorio] = avatares();
    expect(movil).toHaveAttribute("aria-expanded", "false");

    await user.click(escritorio);

    expect(escritorio).toHaveAttribute("aria-expanded", "true");
    const menu = document.getElementById(escritorio.getAttribute("aria-controls")!)!;
    expect(within(menu).getByText("Admin Uno")).toBeInTheDocument();
    expect(within(menu).getByText("Super Admin")).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Seguridad" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    // Solo se abre el menú del avatar que se tocó.
    expect(movil).toHaveAttribute("aria-expanded", "false");
  });

  it("Mi cuenta lleva a /admin/cuenta y cierra el menú", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(avatares()[0]);
    await user.click(screen.getByRole("button", { name: "Mi cuenta" }));
    expect(screen.getByText("Pantalla Mi cuenta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mi cuenta" })).not.toBeInTheDocument();
  });

  it("Seguridad lleva a /admin/seguridad", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(avatares()[1]);
    await user.click(screen.getByRole("button", { name: "Seguridad" }));
    expect(screen.getByText("Pantalla Seguridad")).toBeInTheDocument();
  });

  it("Escape cierra el menú y devuelve el foco al avatar", async () => {
    const user = userEvent.setup();
    renderizar();
    const escritorio = avatares()[1];
    await user.click(escritorio);
    await user.keyboard("{Escape}");
    expect(escritorio).toHaveAttribute("aria-expanded", "false");
    expect(escritorio).toHaveFocus();
  });

  it("Cerrar sesión desde el menú cierra la sesión y va al login", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(avatares()[1]);
    const menu = document.getElementById("menu-usuario-admin-escritorio")!;
    await user.click(within(menu).getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(cerrarSesion).toHaveBeenCalled());
    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
  });
});

describe("AdminLayout — aviso de verificación en dos pasos", () => {
  it("sin 2FA avisa en todas las pantallas y enlaza a Seguridad", async () => {
    obtenerEstado2FA.mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    renderizar();
    expect(await screen.findByText("Activa la verificación en dos pasos.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Activar ahora" })).toHaveAttribute("href", "/admin/seguridad");
  });

  it("no avisa en la propia página de Seguridad", async () => {
    obtenerEstado2FA.mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    renderizar("/admin/seguridad");
    await waitFor(() => expect(obtenerEstado2FA).toHaveBeenCalled());
    expect(screen.queryByText("Activa la verificación en dos pasos.")).not.toBeInTheDocument();
  });

  it("con 2FA activa no avisa", async () => {
    renderizar();
    await waitFor(() => expect(obtenerEstado2FA).toHaveBeenCalled());
    expect(screen.queryByText("Activa la verificación en dos pasos.")).not.toBeInTheDocument();
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

describe("AdminLayout — navegación del lote 4", () => {
  const nav = () => screen.getByRole("navigation", { hidden: true, name: "Secciones de administración" });

  it("Facturación tiene su propia entrada en el menú", async () => {
    renderizar("/admin/facturacion");
    const enlace = within(nav()).getByRole("link", { hidden: true, name: "Facturación" });
    expect(enlace).toHaveAttribute("href", "/admin/facturacion");
    expect(enlace).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Pantalla Facturación")).toBeInTheDocument();
  });

  it("'Negocios' sigue marcado en la ficha de un negocio", () => {
    renderizar("/admin/negocios/neg-1");
    expect(within(nav()).getByRole("link", { hidden: true, name: /^Negocios/ }).className).toContain("bg-amber-50");
    expect(within(nav()).getByRole("link", { hidden: true, name: "Facturación" }).className).not.toContain("bg-amber-50");
  });

  it("muestra cuántos negocios esperan activación junto a 'Negocios'", async () => {
    obtenerMetricas.mockResolvedValue([
      { id: "a", nombre: "A", slug: "a", activo: 0, maxCitasMes: 0, maxEmpleados: 0, citasMes: 0, empleadosActivos: 0, emailsMes: 0 },
      { id: "b", nombre: "B", slug: "b", activo: 0, maxCitasMes: 0, maxEmpleados: 0, citasMes: 0, empleadosActivos: 0, emailsMes: 0 },
      // Desactivado después de tener plan: no es una alta pendiente.
      { id: "c", nombre: "C", slug: "c", activo: 0, planId: "p", planNombre: "Pro", maxCitasMes: 0, maxEmpleados: 0, citasMes: 0, empleadosActivos: 0, emailsMes: 0 },
    ]);
    renderizar();
    expect(await within(nav()).findByRole("link", { hidden: true, name: "Negocios, 2 pendientes de activación" })).toBeInTheDocument();
  });

  it("sin pendientes no hay contador", async () => {
    renderizar();
    await waitFor(() => expect(obtenerMetricas).toHaveBeenCalled());
    expect(within(nav()).getByRole("link", { hidden: true, name: "Negocios" })).toBeInTheDocument();
  });
});
