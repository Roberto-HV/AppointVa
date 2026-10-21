import { describe, it, expect, vi, beforeEach } from "vitest";
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
