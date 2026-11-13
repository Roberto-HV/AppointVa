import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccionesCita, { HojaAccionesCita } from "./AccionesCita";
import type { CitaDto } from "../../types";

vi.mock("../../api/citas", () => ({
  citasApi: {
    cambiarEstado: vi.fn().mockResolvedValue({}),
    reagendar: vi.fn().mockResolvedValue({}),
  },
  ESTADOS: { Pendiente: 1, Confirmada: 2, Completada: 3, Cancelada: 4, Inasistencia: 5 },
}));

vi.mock("../../api/axios", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: [
        { inicio: "2026-10-22T16:00:00Z", horaTexto: "10:00 AM" },
        { inicio: "2026-10-22T17:00:00Z", horaTexto: "11:00 AM" },
      ],
    }),
  },
}));

vi.mock("../../api/intake", () => ({
  intakeApi: { getRespuestas: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerPerfil: vi.fn().mockResolvedValue({ nombre: "Salón Test", sector: "belleza" }) },
}));

vi.mock("../ui/DateTimePicker", () => ({
  DatePicker: ({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { citasApi } from "../../api/citas";

const cita = (over: Partial<CitaDto> = {}): CitaDto => ({
  id: "cita-1",
  codigoConfirmacion: "ABC123",
  clienteId: "cli-1",
  empleadoId: "emp-1",
  servicioId: "svc-1",
  nombreCliente: "Ana López",
  telefonoCliente: "5511223344",
  nombreEmpleado: "María García",
  nombreServicio: "Corte",
  duracionMinutos: 30,
  precio: 450,
  pagada: false,
  inicioEn: "2026-10-21T16:00:00Z",
  finEn: "2026-10-21T16:30:00Z",
  estado: 1,
  estadoTexto: "Pendiente",
  ...over,
});

function renderizar(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Teléfono: 375px. Nada de la fila depende de `sm:` para existir.
  window.innerWidth = 375;
});

// `clearAllMocks` borra las llamadas pero no deshace un spy: si una prueba falla
// antes de su `mockRestore`, `window.open` se queda falseado para todas las que
// siguen y una falla real se convierte en varias que no significan nada.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("AccionesCita — botones de la fila", () => {
  it("nombra cada botón con la acción y el cliente", () => {
    renderizar(<AccionesCita cita={cita()} />);
    expect(screen.getByRole("link", { name: "Enviar recordatorio por WhatsApp a Ana López" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cita de Ana López" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acciones de la cita de Ana López" })).toBeInTheDocument();
  });

  it("los botones de la fila no se ocultan en pantallas pequeñas y miden al menos 44px", () => {
    renderizar(<AccionesCita cita={cita({ estadoTexto: "Confirmada", estado: 2 })} />);
    for (const boton of screen.getAllByRole("button")) {
      expect(boton.className).not.toMatch(/(^|\s)hidden(\s|$)/);
      expect(boton.className).toContain("min-h-[44px]");
    }
    expect(screen.getByRole("button", { name: "Completar cita de Ana López" })).toBeInTheDocument();
  });

  it("la acción principal lleva texto también en el teléfono, no solo el icono", () => {
    renderizar(<AccionesCita cita={cita({ estadoTexto: "Confirmada", estado: 2 })} />);
    const texto = screen.getByText("Completar");
    expect(texto.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("Confirmar cambia el estado sin pasar por la hoja", async () => {
    renderizar(<AccionesCita cita={cita()} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    await waitFor(() =>
      expect(citasApi.cambiarEstado).toHaveBeenCalledWith("cita-1", { nuevoEstado: 2, motivo: undefined })
    );
  });
});

describe("AccionesCita — hoja de acciones", () => {
  it("en el teléfono, la hoja ofrece Reagendar y reagenda con el horario elegido", async () => {
    renderizar(<AccionesCita cita={cita()} />);
    await userEvent.click(screen.getByRole("button", { name: "Acciones de la cita de Ana López" }));

    const hoja = await screen.findByRole("dialog");
    expect(within(hoja).getByRole("button", { name: "Confirmar cita" })).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();
    await userEvent.click(within(hoja).getByRole("button", { name: "Reagendar" }));

    const fecha = await screen.findByLabelText("Nueva fecha");
    await userEvent.type(fecha, "2026-10-22");
    await userEvent.click(await screen.findByRole("button", { name: "11:00 AM" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar nuevo horario" }));

    await waitFor(() => expect(citasApi.reagendar).toHaveBeenCalledWith("cita-1", "2026-10-22T17:00:00Z"));
  });

  it("Cancelar pide confirmación y envía el motivo", async () => {
    renderizar(<HojaAccionesCita cita={cita()} onCerrar={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar cita" }));
    await userEvent.type(screen.getByLabelText(/Motivo/), "El cliente llamó");
    // En la confirmación, "Volver" cierra sin cancelar; el botón rojo es el que cancela.
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar cita" }));
    await waitFor(() =>
      expect(citasApi.cambiarEstado).toHaveBeenCalledWith("cita-1", { nuevoEstado: 4, motivo: "El cliente llamó" })
    );
  });

  it("una cita confirmada ofrece completar e inasistencia, no confirmar", async () => {
    renderizar(<HojaAccionesCita cita={cita({ estadoTexto: "Confirmada", estado: 2 })} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Marcar como completada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar inasistencia" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar cita" })).toBeNull();
  });

  it("una cita completada no ofrece cambios de estado pero sí las acciones extra", async () => {
    const onSelect = vi.fn();
    const onCerrar = vi.fn();
    renderizar(
      <HojaAccionesCita
        cita={cita({ estadoTexto: "Completada", estado: 3 })}
        onCerrar={onCerrar}
        accionesExtra={[{ id: "notas", etiqueta: "Agregar nota interna", Icono: () => null, onSelect }]}
      />
    );
    expect(await screen.findByText("Esta cita ya no admite cambios de estado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reagendar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Agregar nota interna" }));
    expect(onCerrar).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalled();
  });

  it("enlaza al detalle de la cita", async () => {
    renderizar(<HojaAccionesCita cita={cita()} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "Ver detalle" })).toHaveAttribute("href", "/dashboard/citas/cita-1");
  });
});

describe("AccionesCita — popover en escritorio, hoja en el teléfono (M8)", () => {
  const matchMediaOriginal = window.matchMedia;
  const simular = (movil: boolean) => {
    window.matchMedia = ((q: string) => ({
      matches: movil && q.includes("max-width"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  };
  afterEach(() => { window.matchMedia = matchMediaOriginal; });

  it("en escritorio las acciones salen junto a su botón, sin velo y sin ocultar la página", async () => {
    simular(false);
    renderizar(<AccionesCita cita={cita()} />);
    const disparador = screen.getByRole("button", { name: "Acciones de la cita de Ana López" });
    await userEvent.click(disparador);
    const pop = await screen.findByRole("dialog", { name: "Cita de Ana López" });
    expect(pop).toHaveAttribute("data-popover");
    // No modal: la fila sigue accesible mientras el menú está abierto.
    expect(disparador.closest("[aria-hidden='true']")).toBeNull();
    expect(within(pop).getByRole("button", { name: "Reagendar" })).toBeInTheDocument();
  });

  it("en el teléfono se abre la hoja de siempre (Modal), no el popover", async () => {
    simular(true);
    renderizar(<AccionesCita cita={cita()} />);
    await userEvent.click(screen.getByRole("button", { name: "Acciones de la cita de Ana López" }));
    const hoja = await screen.findByRole("dialog", { name: "Cita de Ana López" });
    expect(hoja).not.toHaveAttribute("data-popover");
  });

  it("sin ancla (p. ej. la fila ya no está) usa la hoja aunque sea escritorio", async () => {
    simular(false);
    const huerfano = document.createElement("button"); // nunca se monta en la página
    renderizar(<HojaAccionesCita cita={cita()} onCerrar={vi.fn()} ancla={huerfano} />);
    const hoja = await screen.findByRole("dialog", { name: "Cita de Ana López" });
    expect(hoja).not.toHaveAttribute("data-popover");
  });

  it("se coloca debajo del ancla si cabe, si no arriba, y nunca fuera de la pantalla", async () => {
    const { posicionPopover } = await import("../../lib/posicionPopover");
    const vista = { ancho: 1440, alto: 900 };
    // Debajo, alineado a la izquierda del ancla.
    expect(posicionPopover({ top: 100, bottom: 140, left: 200, right: 240 }, { ancho: 360, alto: 300 }, vista))
      .toEqual({ top: 148, left: 200, maxHeight: 744 });
    // Cerca del borde inferior: arriba.
    const arriba = posicionPopover({ top: 700, bottom: 740, left: 200, right: 240 }, { ancho: 360, alto: 300 }, vista);
    expect(arriba.top).toBe(700 - 8 - 300);
    // Cerca del borde derecho: alineado al borde derecho del ancla.
    expect(posicionPopover({ top: 100, bottom: 140, left: 1380, right: 1420 }, { ancho: 360, alto: 300 }, vista).left)
      .toBe(1420 - 360);
    // Alto que no cabe arriba ni abajo (bloque a media rejilla): a un lado, completo.
    const lado = posicionPopover({ top: 540, bottom: 600, left: 1100, right: 1175 }, { ancho: 360, alto: 600 }, vista);
    expect(lado.left).toBe(1100 - 8 - 360);
    expect(lado.top + 600).toBeLessThanOrEqual(900 - 8);
  });
});

describe("AccionesCita — deshacer (DC-17)", () => {
  it("marcar inasistencia ofrece 'Deshacer', que vuelve a Confirmada con el mismo endpoint", async () => {
    const { useToastStore } = await import("../../store/toastStore");
    useToastStore.setState({ toasts: [] });
    renderizar(<HojaAccionesCita cita={cita({ estadoTexto: "Confirmada", estado: 2 })} onCerrar={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Marcar inasistencia" }));
    await userEvent.click(screen.getByRole("button", { name: "Marcar inasistencia" }));
    await waitFor(() =>
      expect(citasApi.cambiarEstado).toHaveBeenCalledWith("cita-1", { nuevoEstado: 5, motivo: undefined }),
    );
    const aviso = await waitFor(() => {
      const t = useToastStore.getState().toasts.find((x) => x.accion);
      expect(t?.accion?.etiqueta).toBe("Deshacer");
      return t!;
    });
    useToastStore.getState().ejecutarAccion(aviso.id);
    await waitFor(() =>
      expect(citasApi.cambiarEstado).toHaveBeenLastCalledWith("cita-1", { nuevoEstado: 2, motivo: undefined }),
    );
    useToastStore.setState({ toasts: [] });
  });

  it("cancelar no ofrece deshacer: el backend no deja reabrir una cita cancelada", async () => {
    const { useToastStore } = await import("../../store/toastStore");
    useToastStore.setState({ toasts: [] });
    renderizar(<HojaAccionesCita cita={cita()} onCerrar={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar cita" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar cita" }));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0].accion).toBeUndefined();
    useToastStore.setState({ toasts: [] });
  });
});

// Quien reserva solo con teléfono no recibe ningún correo del servidor: el aviso
// de que su cita quedó confirmada se lo manda el negocio por WhatsApp.
describe("AccionesCita — aviso de confirmación por WhatsApp", () => {
  const confirmada = () => cita({ estadoTexto: "Confirmada", estado: 2, emailCliente: null });

  async function limpiarToasts() {
    const { useToastStore } = await import("../../store/toastStore");
    useToastStore.setState({ toasts: [] });
    return useToastStore;
  }

  it("al confirmar ofrece 'Avisar por WhatsApp', y no abre nada por su cuenta", async () => {
    const useToastStore = await limpiarToasts();
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    renderizar(<AccionesCita cita={cita({ emailCliente: null })} nombreNegocio="Salón Aramis" />);

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    await waitFor(() =>
      expect(citasApi.cambiarEstado).toHaveBeenCalledWith("cita-1", { nuevoEstado: 2, motivo: undefined })
    );

    const aviso = await waitFor(() => {
      const t = useToastStore.getState().toasts.find((x) => x.accion);
      expect(t?.accion?.etiqueta).toBe("Avisar por WhatsApp");
      return t!;
    });
    // El navegador bloquea lo que se abre sin un toque: nadie abre WhatsApp solo.
    expect(abrir).not.toHaveBeenCalled();

    useToastStore.getState().ejecutarAccion(aviso.id);
    expect(abrir).toHaveBeenCalledTimes(1);
    const url = abrir.mock.calls[0][0] as string;
    expect(url).toContain("https://wa.me/525511223344");
    expect(decodeURIComponent(url)).toContain("/cita/ABC123");

    abrir.mockRestore();
    useToastStore.setState({ toasts: [] });
  });

  it("si el navegador bloquea WhatsApp, lo dice y señala dónde volver a encontrarlo", async () => {
    // El aviso ya se cerró al tocar el botón: sin este error, el único mensaje que
    // esa clienta iba a recibir se perdería sin que nadie se entere.
    const useToastStore = await limpiarToasts();
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    renderizar(<AccionesCita cita={cita({ emailCliente: null })} nombreNegocio="Salón Aramis" />);

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    const aviso = await waitFor(() => {
      const t = useToastStore.getState().toasts.find((x) => x.accion);
      expect(t?.accion?.etiqueta).toBe("Avisar por WhatsApp");
      return t!;
    });

    useToastStore.getState().ejecutarAccion(aviso.id);

    const error = useToastStore.getState().toasts.find((t) => t.tipo === "error");
    expect(error?.mensaje).toContain("bloqueó WhatsApp");
    // El reintento viaja en el aviso: no depende de que la lista ya se haya
    // refrescado para que el botón de la hoja exista.
    expect(error?.accion?.etiqueta).toBe("Reintentar");
    useToastStore.getState().ejecutarAccion(error!.id);
    expect(abrir).toHaveBeenCalledTimes(2);

    // Y queda registrado como el original: si la cita se cancela mientras el
    // reintento sigue en pantalla, también se retira.
    const reintento = useToastStore.getState().toasts.find((t) => t.accion);
    expect(reintento?.accion?.etiqueta).toBe("Reintentar");
    await userEvent.click(screen.getByRole("button", { name: "Acciones de la cita de Ana López" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar cita" }));
    // Igual que arriba: que no pase por expiración del aviso.
    expect(useToastStore.getState().toasts.some((t) => t.id === reintento!.id)).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar cita" }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.id === reintento!.id)).toBe(false),
    );

    abrir.mockRestore();
    useToastStore.setState({ toasts: [] });
  });

  it("si WhatsApp sí abre, no molesta con un error y corta el vínculo con la pestaña", async () => {
    const useToastStore = await limpiarToasts();
    const ventana = { opener: window } as unknown as Window;
    const abrir = vi.spyOn(window, "open").mockReturnValue(ventana);
    renderizar(<AccionesCita cita={cita({ emailCliente: null })} nombreNegocio="Salón Aramis" />);

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    const aviso = await waitFor(() => {
      const t = useToastStore.getState().toasts.find((x) => x.accion);
      expect(t?.accion?.etiqueta).toBe("Avisar por WhatsApp");
      return t!;
    });

    useToastStore.getState().ejecutarAccion(aviso.id);

    // Primero que la acción corrió: si el aviso expirara antes, `ejecutarAccion`
    // no haría nada y el opener seguiría puesto — el mismo síntoma que el bug.
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts.some((t) => t.tipo === "error")).toBe(false);
    expect(ventana.opener).toBeNull();

    abrir.mockRestore();
    useToastStore.setState({ toasts: [] });
  });

  it("completar no ofrece el aviso: solo lo ofrece la confirmación", async () => {
    const useToastStore = await limpiarToasts();
    renderizar(<HojaAccionesCita cita={confirmada()} onCerrar={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como completada" }));
    await userEvent.click(screen.getByRole("button", { name: "Marcar como completada" }));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0].accion).toBeUndefined();
    useToastStore.setState({ toasts: [] });
  });

  it("sin correo, el aviso es la acción destacada de la hoja y explica por qué", async () => {
    renderizar(<HojaAccionesCita cita={confirmada()} onCerrar={vi.fn()} nombreNegocio="Salón Aramis" />);
    const enlace = await screen.findByRole("link", { name: "Avisar la confirmación por WhatsApp" });
    expect(enlace.className).toContain("font-semibold");
    expect(enlace.className).toContain("min-h-[44px]");
    expect(enlace).toHaveAttribute("href", expect.stringContaining("https://wa.me/525511223344"));
    expect(screen.getByText(/Sin correo registrado/)).toBeInTheDocument();
    // Va por encima de "Marcar como completada": es lo único que recibirá.
    const completar = screen.getByRole("button", { name: "Marcar como completada" });
    expect(enlace.compareDocumentPosition(completar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("con correo el aviso sigue disponible, pero sin destacar ni explicación", async () => {
    renderizar(
      <HojaAccionesCita
        cita={cita({ estadoTexto: "Confirmada", estado: 2, emailCliente: "ana@test.com" })}
        onCerrar={vi.fn()}
      />
    );
    const enlace = await screen.findByRole("link", { name: "Reenviar confirmación por WhatsApp" });
    expect(enlace.className).not.toContain("font-semibold");
    expect(screen.queryByText(/Sin correo registrado/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Avisar la confirmación por WhatsApp" })).toBeNull();
  });

  it("una cita pendiente todavía no tiene nada que avisar", async () => {
    renderizar(<HojaAccionesCita cita={cita({ emailCliente: null })} onCerrar={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Confirmar cita" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /confirmación por WhatsApp/ })).toBeNull();
  });

  /** Espera al aviso de confirmación en pantalla y lo devuelve. */
  async function esperarAviso(store: Awaited<ReturnType<typeof limpiarToasts>>) {
    return waitFor(() => {
      const t = store.getState().toasts.find((x) => x.accion?.etiqueta === "Avisar por WhatsApp");
      expect(t).toBeTruthy();
      return t!;
    });
  }

  // El texto del aviso es lo único que le dice al negocio que el cliente no va a
  // enterarse por correo. Si la condición se invirtiera, la advertencia saldría al revés.
  it("sin correo, el aviso dice que nadie más le avisará", async () => {
    const useToastStore = await limpiarToasts();
    renderizar(<AccionesCita cita={cita({ emailCliente: null })} nombreNegocio="Salón Aramis" />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    const aviso = await esperarAviso(useToastStore);
    expect(aviso.mensaje).toBe("Cita confirmada. Sin correo: avísale tú.");
    useToastStore.setState({ toasts: [] });
  });

  it("con correo el aviso sigue ofreciéndose, pero sin la advertencia", async () => {
    const useToastStore = await limpiarToasts();
    renderizar(<AccionesCita cita={cita({ emailCliente: "ana@test.com" })} nombreNegocio="Salón Aramis" />);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    const aviso = await esperarAviso(useToastStore);
    expect(aviso.mensaje).toBe("Cita confirmada");
    expect(aviso.mensaje).not.toMatch(/correo/i);
    useToastStore.setState({ toasts: [] });
  });

  // El Inicio del empleado no pasa `nombreNegocio` ni monta consulta de perfil:
  // sin respaldo, el cliente recibía el aviso sin saber de qué negocio viene.
  it("sin la prop, el mensaje firma con el negocio en sesión", async () => {
    const useToastStore = await limpiarToasts();
    const abrir = vi.spyOn(window, "open").mockReturnValue(null);
    renderizar(<AccionesCita cita={cita({ emailCliente: null })} />);

    await waitFor(() =>
      expect(
        decodeURIComponent(
          screen.getByRole("link", { name: "Enviar recordatorio por WhatsApp a Ana López" }).getAttribute("href") ?? "",
        ),
      ).toContain("Salón Test"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    const aviso = await esperarAviso(useToastStore);
    useToastStore.getState().ejecutarAccion(aviso.id);
    expect(decodeURIComponent(abrir.mock.calls[0][0] as string)).toContain("Salón Test");

    abrir.mockRestore();
    useToastStore.setState({ toasts: [] });
  });

  // El aviso dura 8 s y se pausa con el puntero encima: puede seguir en pantalla
  // cuando la cita ya se canceló. Su enlace no vuelve al servidor, así que el
  // mensaje saldría igual.
  it("cancelar después retira el aviso: no se manda 'confirmada' de una cita cancelada", async () => {
    const useToastStore = await limpiarToasts();
    renderizar(<AccionesCita cita={cita({ emailCliente: null })} nombreNegocio="Salón Aramis" />);

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita de Ana López" }));
    const aviso = await esperarAviso(useToastStore);

    // La misma cita se cancela desde la hoja (otra instancia del hook) con el aviso aún visible.
    await userEvent.click(screen.getByRole("button", { name: "Acciones de la cita de Ana López" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar cita" }));

    // El aviso dura 8 s de reloj real: si la corrida se alarga podría cerrarse
    // solo y la aserción de abajo pasaría sin que nada lo haya retirado. Se
    // comprueba que sigue vivo justo antes de cancelar.
    expect(useToastStore.getState().toasts.some((t) => t.id === aviso.id)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar cita" }));
    await waitFor(() =>
      expect(citasApi.cambiarEstado).toHaveBeenLastCalledWith("cita-1", { nuevoEstado: 4, motivo: undefined }),
    );

    expect(useToastStore.getState().toasts.some((t) => t.id === aviso.id)).toBe(false);
    expect(useToastStore.getState().toasts.some((t) => t.accion?.etiqueta === "Avisar por WhatsApp")).toBe(false);
    useToastStore.setState({ toasts: [] });
  });
});
