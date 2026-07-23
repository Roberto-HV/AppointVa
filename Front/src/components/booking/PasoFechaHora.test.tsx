import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PasoFechaHora from "./PasoFechaHora";

vi.mock("../../api/publico", () => ({
  publicoApi: {
    obtenerDisponibilidad: vi.fn(),
  },
}));

import { publicoApi } from "../../api/publico";

function renderConQuery(props: Partial<React.ComponentProps<typeof PasoFechaHora>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const defaults = {
    servicioId: "srv-1",
    empleadoId: null,
    seleccionado: null,
    onSeleccionar: vi.fn(),
  };
  return render(
    <QueryClientProvider client={qc}>
      <PasoFechaHora {...defaults} {...props} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PasoFechaHora", () => {
  it("renders the heading without crashing", () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();
    expect(screen.getByText("Elige fecha y hora")).toBeInTheDocument();
  });

  it("renders 7 day buttons plus navigation buttons for the current week", () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();
    const allButtons = screen.getAllByRole("button");
    // 2 navigation + 7 day buttons = 9 total minimum
    expect(allButtons.length).toBeGreaterThanOrEqual(9);
  });

  it("shows loading spinner after a date is selected", async () => {
    // Never-resolving promise keeps query in loading state
    vi.mocked(publicoApi.obtenerDisponibilidad).mockReturnValue(new Promise(() => {}));
    renderConQuery();

    // Day buttons have no aria-label; nav buttons do. Enabled day buttons are not disabled.
    const dayButtons = screen.getAllByRole("button").filter(
      (b) => !b.hasAttribute("disabled") && !b.getAttribute("aria-label")
    );
    expect(dayButtons.length).toBeGreaterThan(0);

    fireEvent.click(dayButtons[0]);

    expect(await screen.findByText(/Cargando horarios/i)).toBeInTheDocument();
  });
});
