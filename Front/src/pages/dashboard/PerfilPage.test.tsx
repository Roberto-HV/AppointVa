import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
    obtenerHorarios: vi.fn().mockResolvedValue([]),
    obtenerDiasBloqueados: vi.fn().mockResolvedValue([]),
    bloquearDia: vi.fn().mockResolvedValue({}),
    desbloquearDia: vi.fn().mockResolvedValue({}),
    actualizarHorarios: vi.fn().mockResolvedValue([]),
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

  it("muestra las 5 pestañas", async () => {
    renderPerfilPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Perfil" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Citas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Anticipos" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Horarios" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cuenta" })).toBeInTheDocument();
    });
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

    const toggle = screen.getByRole("checkbox");
    await userEvent.click(toggle);

    expect(screen.getByText("Porcentaje del anticipo")).toBeInTheDocument();
  });

  it("guarda el fondo de portada aunque el negocio no exija anticipo", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByText("Fondo de portada"));

    const grupo = screen.getByRole("group", { name: "Fondo de portada" });
    await userEvent.click(within(grupo).getByRole("radio", { name: "Arcos" }));
    expect(screen.getByText(/Fondo sin guardar/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Guardar cambios" })[0]);

    await waitFor(() =>
      expect(negociosApi.actualizarPerfil).toHaveBeenCalledWith(
        expect.objectContaining({ portadaPreset: "geo-arcos" })
      )
    );
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
