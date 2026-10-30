import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PerfilPage from "./PerfilPage";
import { negociosApi } from "../../api/negocios";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: () => <canvas id="qr-reservas" />,
}));

vi.mock("../../hooks/useUnsavedChanges", () => ({
  useUnsavedChanges: vi.fn(),
}));

// El backend crea los negocios con `PorcentajeAnticipo = 10`, el piso del
// deslizador. La fixture copia ese valor real: usar uno "cómodo" fue justo lo
// que escondió durante dos meses que el default no se podía guardar.
const PERFIL_BASE = {
  id: "n1",
  nombre: "Salón Test",
  slug: "salon-test",
  telefono: "5550000",
  email: "test@salon.com",
  descripcion: "",
  direccion: "",
  activo: true,
  requiereAnticipo: false,
  porcentajeAnticipo: 10,
  horasCancelacionConReembolso: 24,
  politicaCancelacionAnticipo: "",
  instruccionesAnticipo: "",
  autoConfirmar: false,
  listaEsperaActiva: false,
  zonaHoraria: "America/Mexico_City",
  moduloPagosHabilitado: true,
  planNombre: "Básico",
  colorPrimario: "#334155",
  logoUrl: null,
  portadaUrl: null,
  portadaPreset: null,
  horasRecordatorio: 24,
  horasCancelacion: 0,
  metodoNotificacion: "Correo",
  telefonoWhatsApp: "",
  montoAnticipo: 0,
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
};

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn(),
    actualizarPerfil: vi.fn().mockResolvedValue({}),
    actualizarColores: vi.fn().mockResolvedValue({}),
    subirLogo: vi.fn().mockResolvedValue({ url: "" }),
    subirPortada: vi.fn().mockResolvedValue({ url: "" }),
    subirPoliticas: vi.fn().mockResolvedValue({ url: "" }),
    obtenerHorarios: vi.fn().mockResolvedValue([]),
    obtenerDiasBloqueados: vi.fn().mockResolvedValue([]),
    bloquearDia: vi.fn().mockResolvedValue({}),
    desbloquearDia: vi.fn().mockResolvedValue({}),
    actualizarHorarios: vi.fn().mockResolvedValue([]),
    eliminarLogo: vi.fn().mockResolvedValue(undefined),
    eliminarPortada: vi.fn().mockResolvedValue(undefined),
    eliminarPoliticas: vi.fn().mockResolvedValue(undefined),
    actualizarPosicionPortada: vi.fn().mockImplementation(async (p: string) => ({ portadaObjectPosition: p })),
  },
}));

vi.mock("../../api/auth", () => ({
  authApi: {
    eliminarCuenta: vi.fn().mockResolvedValue({}),
    logout: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: () => ({
    usuario: { id: "u1", nombre: "Owner", email: "owner@test.com", rol: "Propietario" },
    refreshToken: null,
    cerrarSesion: vi.fn(),
  }),
}));

const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: toastSpy }),
}));

/** Edita un campo del formulario: sin cambios "Guardar cambios" está deshabilitado. */
function marcarCambio() {
  fireEvent.change(screen.getByDisplayValue("Salón Test"), { target: { value: "Salón Test 2" } });
}

/** Apariencia › "Cambiar portada": elige un fondo en el panel y lo aplica (I11). */
async function elegirFondo(nombre: string) {
  await userEvent.click(await screen.findByRole("button", { name: "Cambiar portada" }));
  const panel = await screen.findByRole("dialog", { name: "Cambiar portada" });
  await userEvent.click(within(panel).getByRole("radio", { name: nombre }));
  await userEvent.click(within(panel).getByRole("button", { name: "Usar esta portada" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cambiar portada" })).toBeNull());
}

function renderPerfilPage(searchParams = "") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/perfil${searchParams}`]}>
      <QueryClientProvider client={qc}>
        <PerfilPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PerfilPage — 5 tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
  });

  it("muestra las 6 pestañas", async () => {
    renderPerfilPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Perfil" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Apariencia" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Citas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Anticipos" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Horarios" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cuenta" })).toBeInTheDocument();
    });
  });

  it("Apariencia es su propia pestaña y la cuadrícula de portadas solo sale en el panel (I11)", async () => {
    renderPerfilPage();
    await screen.findByText("Información del negocio");
    // En Perfil ya no están logo, color ni portadas.
    expect(screen.getByText("Color de tu página de reservas")).not.toBeVisible();
    expect(screen.queryByRole("radio", { name: "Arcos" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Apariencia" }));
    expect(screen.getByText("Color de tu página de reservas")).toBeVisible();
    expect(screen.getByText("Información del negocio")).not.toBeVisible();
    expect(screen.queryByRole("radio", { name: "Arcos" })).toBeNull();
    // La portada elegida y el botón que abre el panel.
    expect(screen.getByTestId("portada-actual")).toBeInTheDocument();
    expect(screen.getByText("Color de marca")).toBeInTheDocument();

    // Cancelar no aplica la elección.
    await userEvent.click(screen.getByRole("button", { name: "Cambiar portada" }));
    const panel = await screen.findByRole("dialog", { name: "Cambiar portada" });
    expect(within(panel).getAllByRole("radio").length).toBeGreaterThanOrEqual(26);
    await userEvent.click(within(panel).getByRole("radio", { name: "Arcos" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    expect(screen.getByText("Color de marca")).toBeInTheDocument();
  });

  it("la pestaña activa por defecto es Perfil", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Perfil" }));
    await waitFor(() =>
      expect(screen.getByText("Información del negocio")).toBeInTheDocument()
    );
  });

  it("clic en Anticipos muestra el toggle de RequiereAnticipo", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Anticipos" }));
    await userEvent.click(screen.getByRole("button", { name: "Anticipos" }));
    await waitFor(() =>
      expect(screen.getByText("Requerir anticipo al reservar")).toBeInTheDocument()
    );
  });

  it("habilitar anticipo revela el slider de porcentaje", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Anticipos" }));
    await userEvent.click(screen.getByRole("button", { name: "Anticipos" }));
    await waitFor(() => screen.getByText("Requerir anticipo al reservar"));

    expect(screen.queryByText("Porcentaje del anticipo")).toBeNull();

    // Es un `Switch`, como los demás sí/no de Mi negocio, no un checkbox suelto.
    expect(screen.queryByRole("checkbox")).toBeNull();
    const toggle = screen.getByRole("switch", { name: "Requerir anticipo al reservar" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    expect(screen.getByText("Porcentaje del anticipo")).toBeInTheDocument();
  });

  it("guarda el fondo de portada aunque el negocio no exija anticipo", async () => {
    renderPerfilPage("?tab=apariencia");
    await elegirFondo("Arcos");
    expect(screen.getByText(/Fondo: Arcos/)).toHaveTextContent("sin guardar");

    await userEvent.click(screen.getAllByRole("button", { name: "Guardar cambios" })[0]);

    await waitFor(() =>
      expect(negociosApi.actualizarPerfil).toHaveBeenCalledWith(
        expect.objectContaining({ portadaPreset: "geo-arcos" })
      )
    );
  });

  it("la vista previa usa tinta oscura y sin velo negro sobre un material claro", async () => {
    renderPerfilPage("?tab=apariencia");
    await screen.findByText("Color de tu página de reservas");
    const previa = () => screen.getByTestId("vista-previa-portada");
    const velo = () => screen.queryByTestId("velo-vista-previa")?.style.background ?? "";

    // Degradado de marca: texto blanco y el velo ligero de siempre.
    expect(previa().dataset.tinta).toBe("clara");
    expect(within(previa()).getByText("Tu negocio").className).toContain("text-white");
    expect(velo()).toMatch(/rgba\(12, 12, 15, 0\.42\)/);

    await elegirFondo("Cuarzo blanco y oro");
    expect(previa().dataset.tinta).toBe("oscura");
    expect(within(previa()).getByText("Tu negocio").className).toContain("text-slate-900");
    expect(within(previa()).getByText("Descripción breve...").className).toContain("text-slate-800");
    expect(velo()).not.toMatch(/rgba\(12, 12, 15/);

    // Material oscuro y fondo de marca: sin cambios.
    await elegirFondo("Cuarzo negro y plata");
    expect(previa().dataset.tinta).toBe("clara");
    expect(velo()).toMatch(/rgba\(12, 12, 15, 0\.42\)/);
    await elegirFondo("Arcos");
    expect(previa().dataset.tinta).toBe("clara");
    expect(screen.queryByTestId("velo-vista-previa")).toBeNull();
  });

  it("guarda aunque la base aún devuelva el 0 heredado", async () => {
    // Bases sin la migración `SetNegocioPorcentajeAnticipoDefault` siguen
    // devolviendo 0. Ese 0 bloqueaba el formulario completo durante dos meses.
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({
      ...PERFIL_BASE,
      porcentajeAnticipo: 0,
    } as never);
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));

    // Sin cambios el botón está deshabilitado (OM-13): se edita otro campo.
    marcarCambio();
    await userEvent.click(screen.getAllByRole("button", { name: "Guardar cambios" })[0]);

    await waitFor(() =>
      expect(negociosApi.actualizarPerfil).toHaveBeenCalledWith(
        expect.objectContaining({ porcentajeAnticipo: 10 })
      )
    );
  });

  it("avisa al dueño cuando la validación impide guardar", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));

    await userEvent.clear(screen.getByDisplayValue("Salón Test"));
    await userEvent.click(screen.getAllByRole("button", { name: "Guardar cambios" })[0]);

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining("No se guardó"), "error")
    );
    expect(negociosApi.actualizarPerfil).not.toHaveBeenCalled();
  });

  // El botón vivía al final de cada pestaña y se perdía de vista al editar
  // arriba. Ahora hay una sola barra pegada al fondo, y solo en las pestañas que
  // este formulario guarda: Horarios y Días bloqueados tienen sus propias
  // mutaciones y su propio botón.
  it.each([
    ["", "perfil"],
    ["?tab=apariencia", "apariencia"],
    ["?tab=citas", "citas"],
    ["?tab=anticipos", "anticipos"],
  ])("muestra una sola barra de guardado en %s", async (params) => {
    renderPerfilPage(params);
    await waitFor(() => expect(screen.getByTestId("barra-guardar")).toBeInTheDocument());
    expect(screen.getAllByTestId("barra-guardar")).toHaveLength(1);
    expect(
      within(screen.getByTestId("barra-guardar")).getByRole("button", { name: "Guardar cambios" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Guardar cambios" })).toHaveLength(1);
  });

  it.each([
    ["?tab=horarios", "Guardar horarios"],
    ["?tab=cuenta", "Eliminar mi cuenta"],
  ])("no muestra la barra de guardado en %s", async (params, propio) => {
    renderPerfilPage(params);
    await waitFor(() => expect(screen.getByRole("button", { name: propio })).toBeInTheDocument());
    expect(screen.queryByTestId("barra-guardar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
  });

  it("confirma con un toast cuando el guardado sale bien", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));

    marcarCambio();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(negociosApi.actualizarPerfil).toHaveBeenCalled());
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith("Cambios guardados"));
  });

  it("deja vaciar el hexadecimal y no aplica un color a medio teclear", async () => {
    // El filtro anterior exigía el "#", así que el campo no se podía vaciar; y
    // aceptaba parciales, que llegaban a guardarse como color de la marca.
    renderPerfilPage();
    await waitFor(() => screen.getByText("Color de tu página de reservas"));

    const campo = screen.getByLabelText("Color en hexadecimal");
    fireEvent.change(campo, { target: { value: "" } });
    expect(campo).toHaveValue("");

    fireEvent.change(campo, { target: { value: "#FF0" } });
    expect(campo).toHaveValue("#FF0");

    marcarCambio();
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(negociosApi.actualizarPerfil).toHaveBeenCalled());
    expect(negociosApi.actualizarColores).not.toHaveBeenCalled();
  });

  it("acepta un hexadecimal pegado sin almohadilla y revierte lo incompleto", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByText("Color de tu página de reservas"));

    const campo = screen.getByLabelText("Color en hexadecimal");
    fireEvent.change(campo, { target: { value: "FF0000" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("#FF0000");

    fireEvent.change(campo, { target: { value: "#AB" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("#FF0000");
  });

  it("da un solo aviso cuando el guardado también lleva color", async () => {
    // El color viaja en el mismo clic pero por otro endpoint. Antes anunciaba su
    // propio éxito, así que un botón devolvía dos veredictos apilados.
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));

    // El campo filtra con /^#[0-9A-Fa-f]{0,6}$/, así que `clear` no pasa el
    // filtro y teclear carácter por carácter no llega al valor; se cambia entero.
    fireEvent.change(screen.getByPlaceholderText("#334155"), { target: { value: "#FF0000" } });

    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(negociosApi.actualizarColores).toHaveBeenCalled());
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith("Cambios guardados"));

    expect(toastSpy).not.toHaveBeenCalledWith("Color actualizado");
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });

  it("avisa que el color no se guardó sin callar el resto", async () => {
    // Si el color falla y el perfil no, un verde solo estaría anunciando un
    // guardado a medias.
    vi.mocked(negociosApi.actualizarColores).mockRejectedValueOnce(new Error("500"));
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));

    fireEvent.change(screen.getByPlaceholderText("#334155"), { target: { value: "#FF0000" } });

    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith("El color no se guardó. Intenta de nuevo.", "error")
    );
    expect(toastSpy).toHaveBeenCalledWith("Cambios guardados");
  });

  it("avisa con un toast y conserva lo escrito cuando el guardado falla", async () => {
    vi.mocked(negociosApi.actualizarPerfil).mockRejectedValueOnce(new Error("500"));
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));

    const nombre = screen.getByDisplayValue("Salón Test");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Salón Aramis");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(
        "No se pudieron guardar los cambios. Intenta de nuevo.",
        "error"
      )
    );
    // Sin esto, un 500 borraría lo que el dueño acababa de escribir.
    expect(screen.getByDisplayValue("Salón Aramis")).toBeInTheDocument();
  });

  it("clic en Cuenta muestra la zona de peligro", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Cuenta" }));
    await userEvent.click(screen.getByRole("button", { name: "Cuenta" }));
    await waitFor(() =>
      expect(screen.getByText(/zona de peligro/i)).toBeInTheDocument()
    );
  });
});

function renderConEnlace(searchParams = "") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/perfil${searchParams}`]}>
      <QueryClientProvider client={qc}>
        <Link to="/dashboard/citas">Ir a citas</Link>
        <PerfilPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PerfilPage — interruptores accesibles (OM-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
  });

  it("la confirmación automática es un switch con nombre que se cambia con el teclado y se guarda", async () => {
    const user = userEvent.setup();
    renderPerfilPage("?tab=citas");
    const sw = await screen.findByRole("switch", { name: "Confirmación automática de citas" });
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"));

    sw.focus();
    await user.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Lista de espera" })).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(negociosApi.actualizarPerfil).toHaveBeenCalled());
    expect(vi.mocked(negociosApi.actualizarPerfil).mock.calls[0][0]).toMatchObject({ autoConfirmar: true });
  });

  it("cada día del horario del negocio es un switch con el nombre del día", async () => {
    const user = userEvent.setup();
    vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue([
      { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "18:00" }] },
      { diaSemana: 0, activo: false, intervalos: [] },
    ]);
    renderPerfilPage("?tab=horarios");
    const lunes = await screen.findByRole("switch", { name: "Lunes" });
    expect(lunes).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Guardar horarios" })).toBeDisabled();

    lunes.focus();
    await user.keyboard("{Enter}");
    expect(lunes).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Guardar horarios" })).toBeEnabled();
  });
});

describe("PerfilPage — cambios sin guardar (OM-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
    vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue([]);
  });

  it("sin cambios, un enlace del menú no pregunta", async () => {
    const user = userEvent.setup();
    renderConEnlace();
    await screen.findByDisplayValue("Salón Test");
    await user.click(screen.getByRole("link", { name: "Ir a citas" }));
    expect(screen.queryByText("¿Descartar cambios?")).not.toBeInTheDocument();
  });

  it("con un campo editado, un enlace del menú pide confirmar antes de salir", async () => {
    const user = userEvent.setup();
    renderConEnlace();
    const nombre = await screen.findByDisplayValue("Salón Test");
    await user.type(nombre, " Centro");
    await user.click(screen.getByRole("link", { name: "Ir a citas" }));
    expect(await screen.findByText("¿Descartar cambios?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByDisplayValue("Salón Test Centro")).toBeInTheDocument();
  });

  it("el color de marca sin guardar también cuenta como cambio", async () => {
    const user = userEvent.setup();
    renderConEnlace();
    await screen.findByDisplayValue("Salón Test");
    const hex = screen.getByLabelText("Color en hexadecimal");
    await user.clear(hex);
    await user.type(hex, "#123456");
    await user.click(screen.getByRole("link", { name: "Ir a citas" }));
    expect(await screen.findByText("¿Descartar cambios?")).toBeInTheDocument();
  });
});

describe("PerfilPage — posición de la portada (OM-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({
      ...PERFIL_BASE, portadaUrl: "https://cdn.test/portada.jpg", portadaObjectPosition: "50% 50%",
    } as never);
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  async function arrastrarYConfirmar(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Posicionar" }));
    const arrastre = screen.getByText("Arrastra para ajustar la posición").closest("div")!.previousElementSibling as HTMLElement;
    fireEvent.pointerDown(arrastre, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(arrastre, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(arrastre, { pointerId: 1 });
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
  }

  it("'Confirmar' guarda la nueva posición al momento, sin 'Guardar cambios' (B11)", async () => {
    const user = userEvent.setup();
    renderPerfilPage("?tab=apariencia");
    await arrastrarYConfirmar(user);

    await waitFor(() => expect(negociosApi.actualizarPosicionPortada).toHaveBeenCalledTimes(1));
    const pos = vi.mocked(negociosApi.actualizarPosicionPortada).mock.calls[0][0];
    expect(pos).not.toBe("50% 50%");
    expect(pos).toMatch(/^\d+(\.\d)?% \d+(\.\d)?%$/);
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith("Posición guardada"));
    expect(screen.queryByText(/Posición sin guardar/)).not.toBeInTheDocument();
    expect(negociosApi.actualizarPerfil).not.toHaveBeenCalled();
  });

  it("una portada nueva guarda la posición elegida cuando termina la subida (B11)", async () => {
    const user = userEvent.setup();
    const crear = vi.fn(() => "blob:portada");
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() });
    renderPerfilPage("?tab=apariencia");
    // La foto se sube desde el panel "Cambiar portada", que se cierra para dar
    // paso a la vista previa donde se posiciona.
    await user.click(await screen.findByRole("button", { name: "Cambiar portada" }));
    const panel = await screen.findByRole("dialog", { name: "Cambiar portada" });
    const clicEnInput = vi.spyOn(screen.getByLabelText<HTMLInputElement>("Archivo de la portada"), "click");
    await user.click(within(panel).getByRole("button", { name: "Subir otra foto" }));
    expect(clicEnInput).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cambiar portada" })).toBeNull());
    await user.upload(screen.getByLabelText("Archivo de la portada"), new File(["x"], "portada.png", { type: "image/png" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(negociosApi.subirPortada).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(negociosApi.actualizarPosicionPortada).toHaveBeenCalledWith("50% 50%"));
    expect(vi.mocked(negociosApi.subirPortada).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(negociosApi.actualizarPosicionPortada).mock.invocationCallOrder[0]);
  });

  it("si guardar la posición falla, avisa que falta guardar y la envía con 'Guardar cambios'", async () => {
    vi.mocked(negociosApi.actualizarPosicionPortada).mockRejectedValueOnce(new Error("500"));
    const user = userEvent.setup();
    renderPerfilPage("?tab=apariencia");
    await arrastrarYConfirmar(user);

    expect(await screen.findByText(/Posición sin guardar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(negociosApi.actualizarPerfil).toHaveBeenCalled());
    const enviado = vi.mocked(negociosApi.actualizarPerfil).mock.calls[0][0];
    expect(enviado.portadaObjectPosition).not.toBe("50% 50%");
    expect(enviado.portadaObjectPosition).toMatch(/^\d+(\.\d)?% \d+(\.\d)?%$/);
  });
});

describe("PerfilPage — acciones públicas con confirmación (OM-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({
      ...PERFIL_BASE, logoUrl: "https://cdn.test/logo.png",
    } as never);
  });

  it("eliminar el logo pide confirmación y solo borra al confirmar", async () => {
    const user = userEvent.setup();
    renderPerfilPage("?tab=apariencia");
    await screen.findByAltText("Logo");
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByRole("dialog", { name: "Eliminar logo" })).toBeInTheDocument();
    expect(negociosApi.eliminarLogo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Eliminar logo" }));
    await waitFor(() => expect(negociosApi.eliminarLogo).toHaveBeenCalledTimes(1));
  });
});

describe("PerfilPage — días sin atención usan la fecha local (DC-04 / B7)", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("de noche hoy sigue siendo seleccionable y ayer no", async () => {
    // Un instante en que la fecha local y la UTC no coinciden en la zona del runner.
    const offset = new Date(2026, 9, 20).getTimezoneOffset();
    const instante = new Date(2026, 9, 20, offset > 0 ? 22 : 1, 30);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instante);
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
    vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue([]);
    vi.mocked(negociosApi.obtenerDiasBloqueados).mockResolvedValue([]);

    renderPerfilPage("?tab=horarios");
    fireEvent.click(await screen.findByRole("button", { name: "Fecha" }));
    const calendario = await screen.findByRole("dialog", { name: /Calendario/ });
    expect(within(calendario).getByRole("button", { name: "20" })).toBeEnabled();
    expect(within(calendario).getByRole("button", { name: "19" })).toBeDisabled();
  });
});

describe("PerfilPage — barra de guardado (OM-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
    vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue([]);
  });

  it("sin cambios el botón está deshabilitado; al editar dice 'Cambios sin guardar'", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));
    const guardar = screen.getByRole("button", { name: "Guardar cambios" });
    expect(guardar).toBeDisabled();
    marcarCambio();
    expect(guardar).toBeEnabled();
    expect(within(screen.getByTestId("barra-guardar")).getByRole("status")).toHaveTextContent("1 cambio sin guardar");
  });

  it("la barra cuenta los cambios sin guardar de todas las pestañas (I11)", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));
    marcarCambio();
    fireEvent.change(screen.getByLabelText("Color en hexadecimal"), { target: { value: "#FF0000" } });
    await userEvent.click(screen.getByRole("button", { name: "Apariencia" }));
    await elegirFondo("Arcos");
    expect(within(screen.getByTestId("barra-guardar")).getByRole("status")).toHaveTextContent("3 cambios sin guardar");
  });

  it("mientras guarda muestra 'Guardando…' y no deja mandar un segundo PUT", async () => {
    let resolver: (v: unknown) => void = () => {};
    vi.mocked(negociosApi.actualizarPerfil).mockReturnValueOnce(new Promise((r) => { resolver = r; }) as never);
    renderPerfilPage();
    await waitFor(() => screen.getByText("Información del negocio"));
    marcarCambio();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const pendiente = await screen.findByRole("button", { name: "Guardando…" });
    expect(pendiente).toBeDisabled();
    fireEvent.click(pendiente);
    expect(negociosApi.actualizarPerfil).toHaveBeenCalledTimes(1);

    resolver({});
    await waitFor(() =>
      expect(within(screen.getByTestId("barra-guardar")).getByRole("status")).toHaveTextContent("Guardado"),
    );
  });
});

describe("PerfilPage — subidas de imágenes (OM-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
  });

  it("rechaza un logo que no es imagen sin subirlo y lo explica", async () => {
    renderPerfilPage("?tab=apariencia");
    const input = await screen.findByLabelText("Archivo del logo");
    fireEvent.change(input, { target: { files: [new File(["x"], "logo.svg", { type: "image/svg+xml" })] } });
    expect(negociosApi.subirLogo).not.toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('"logo.svg" no es JPG, PNG, WebP o GIF.', "error");
  });

  it("una portada demasiado grande no abre la vista previa", async () => {
    renderPerfilPage("?tab=apariencia");
    const input = await screen.findByLabelText("Archivo de la portada");
    const grande = new File(["x"], "portada.jpg", { type: "image/jpeg" });
    Object.defineProperty(grande, "size", { value: 40 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [grande] } });
    expect(screen.queryByText("Vista previa de portada")).toBeNull();
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining("el límite es 10 MB"), "error");
  });

  it("muestra el avance al subir la imagen de políticas", async () => {
    vi.mocked(negociosApi.subirPoliticas).mockImplementationOnce((_a, onProgreso) => {
      onProgreso?.(55);
      return new Promise(() => {});
    });
    renderPerfilPage();
    // Las políticas son información para el cliente: se quedan en Perfil.
    const input = await screen.findByLabelText("Archivo de políticas");
    expect(screen.getByText("Imagen de políticas")).toBeVisible();
    fireEvent.change(input, { target: { files: [new File(["x"], "p.png", { type: "image/png" })] } });
    const barra = await screen.findByRole("progressbar", { name: "Subiendo imagen de políticas" });
    await waitFor(() => expect(barra).toHaveAttribute("aria-valuenow", "55"));
  });
});

describe("PerfilPage — correo, QR y cuenta (OM-23, OM-28, OM-29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({ ...PERFIL_BASE } as never);
  });

  it("un correo inválido muestra su mensaje, no solo el borde rojo", async () => {
    renderPerfilPage();
    const correo = await screen.findByLabelText("Correo de contacto");
    fireEvent.change(correo, { target: { value: "no-es-correo" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Correo inválido")).toBeInTheDocument();
    expect(correo).toHaveAttribute("aria-invalid", "true");
    expect(correo.className).toContain("dark:border-red-400");
  });

  it("'Imprimir' abre una hoja solo con el QR, no imprime el dashboard", async () => {
    const escrito: string[] = [];
    const ventana = { document: { write: (h: string) => escrito.push(h), close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn() };
    const abrir = vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);
    const imprimirPagina = vi.spyOn(window, "print").mockImplementation(() => {});
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,AAA");
    renderPerfilPage();
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir" }));
    expect(abrir).toHaveBeenCalled();
    expect(imprimirPagina).not.toHaveBeenCalled();
    expect(escrito.join("")).toContain("Salón Test");
    expect(escrito.join("")).toContain("/b/salon-test");
    abrir.mockRestore();
    imprimirPagina.mockRestore();
  });

  it("eliminar la cuenta usa un diálogo accesible que se cierra con Escape", async () => {
    const user = userEvent.setup();
    renderPerfilPage("?tab=cuenta");
    await user.click(await screen.findByRole("button", { name: "Eliminar mi cuenta" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Eliminar tu cuenta?" });
    expect(within(dialogo).getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Eliminar cuenta" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
