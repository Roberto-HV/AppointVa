import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketRecibo from "./TicketRecibo";
import type { CitaDto } from "../../types";
import { CLAVE_PAPEL_TICKET, type NegocioTicket } from "../../utils/ticketRecibo";

// El QR real es un mosaico de rutas imposible de leer en un test: el doble deja
// a la vista el valor que codifica.
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-qr-value={value} />,
}));

const toast = vi.fn();
vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast }),
}));

/** Pago en tarjeta, sin descuento, anticipo, propina ni efectivo. */
const citaBase: CitaDto = {
  id: "cita-1",
  codigoConfirmacion: "A1B2C3D4",
  clienteId: "c1",
  empleadoId: "e1",
  servicioId: "s1",
  nombreCliente: "Ana García",
  telefonoCliente: "555-1234",
  nombreEmpleado: "Sofía Hernández",
  nombreServicio: "Corte de dama",
  duracionMinutos: 45,
  precio: 280,
  precioServicio: 280,
  montoCobrado: 280,
  metodoPago: "Tarjeta",
  fechaPago: "2026-10-30T16:50:00",
  inicioEn: "2026-10-30T16:00:00",
  finEn: "2026-10-30T16:45:00",
  pagada: true,
  estado: 2,
  estadoTexto: "Confirmada",
};

const negocioBase: NegocioTicket = {
  nombre: "Salón Aramis",
  slug: "salon-aramis",
  sector: "belleza",
};

function renderTicket(cita: Partial<CitaDto> = {}, negocio: Partial<NegocioTicket> = {}, onEnviarEmail = vi.fn()) {
  return render(
    <TicketRecibo
      cita={{ ...citaBase, ...cita }}
      negocio={{ ...negocioBase, ...negocio }}
      onClose={vi.fn()}
      onEnviarEmail={onEnviarEmail}
      enviandoEmail={false}
    />,
  );
}

const vistaPrevia = () => screen.getByTitle("Vista previa del comprobante") as HTMLIFrameElement;

/** El documento de la vista previa, ya interpretado. */
function documentoVista(): Document {
  return new DOMParser().parseFromString(vistaPrevia().getAttribute("srcdoc") ?? "", "text/html");
}

/** Texto de la vista previa con los espacios normalizados. */
const textoVista = () => (documentoVista().body.textContent ?? "").replace(/\s+/g, " ");

/** Los renglones etiqueta → importe del ticket. */
function filas(): Record<string, string> {
  const res: Record<string, string> = {};
  documentoVista().querySelectorAll(".fila").forEach((f) => {
    const [a, b] = Array.from(f.querySelectorAll("span")).map((s) => s.textContent ?? "");
    res[a] = b;
  });
  return res;
}

beforeEach(() => {
  localStorage.clear();
  toast.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TicketRecibo — contenido", () => {
  it("encabezado del negocio, título, folio, fecha, cliente y quién atendió", () => {
    renderTicket({}, { direccion: "Av. Juárez 120, Centro", telefono: "55 1234 5678" });
    const texto = textoVista();
    expect(texto).toContain("Salón Aramis");
    expect(texto).toContain("Av. Juárez 120, Centro");
    expect(texto).toContain("Tel. 55 1234 5678");
    expect(texto).toContain("COMPROBANTE DE PAGO");
    const f = filas();
    expect(f["Folio"]).toBe("A1B2C3D4");
    expect(f["Fecha"]).toBe("30/10/2026");
    expect(f["Hora"]).toMatch(/^4:00\sp/);
    expect(f["Cliente"]).toBe("Ana García");
    expect(f["Atendió"]).toBe("Sofía Hernández");
    expect(f["Corte de dama · 45 min"]).toBe("$280.00");
    expect(f["TOTAL"]).toBe("$280.00");
    expect(f["Tarjeta"]).toBe("$280.00");
    expect(texto).toContain("Gracias por tu visita");
    expect(texto).toContain("Agenda en línea con AppointVa · appointva.com");
  });

  it("sin datos opcionales no aparecen sus renglones", () => {
    renderTicket({ nombreEmpleado: "" });
    const f = filas();
    for (const etiqueta of ["Subtotal", "Anticipo pagado", "Cargo adicional", "Recibido", "Cambio", "Propina", "Atendió"]) {
      expect(f[etiqueta]).toBeUndefined();
    }
    expect(Object.keys(f).some((k) => k.startsWith("Descuento"))).toBe(false);
    const doc = documentoVista();
    expect(doc.querySelector("img.logo")).toBeNull();
    expect(textoVista()).not.toContain("Tel.");
  });

  it("cupón del 10 %, efectivo con cambio y propina: los renglones cierran", () => {
    renderTicket({
      precio: 315, precioServicio: 350, montoCobrado: 315,
      metodoPago: "Efectivo", montoRecibido: 400, cambio: 85, propina: 50,
    });
    const f = filas();
    expect(f["Corte de dama · 45 min"]).toBe("$350.00");
    expect(f["Subtotal"]).toBe("$350.00");
    expect(f["Descuento 10%"]).toBe("-$35.00");
    expect(f["TOTAL"]).toBe("$315.00");
    expect(f["Efectivo"]).toBe("$315.00");
    expect(f["Recibido"]).toBe("$400.00");
    expect(f["Cambio"]).toBe("$85.00");
    expect(f["Propina"]).toBe("$50.00");
  });

  it("anticipo pagado y pago dividido: cada método con su parte", () => {
    renderTicket({
      precio: 1200, precioServicio: 1200, anticipoRecibido: true, montoAnticipo: 300,
      montoCobrado: 900, metodoPago: "Tarjeta", metodoPago2: "Efectivo", montoPago2: 400,
      montoRecibido: 500, cambio: 100,
    });
    const f = filas();
    expect(f["Subtotal"]).toBe("$1,200.00");
    expect(f["Anticipo pagado"]).toBe("-$300.00");
    expect(f["TOTAL"]).toBe("$900.00");
    expect(f["Tarjeta"]).toBe("$500.00");
    expect(f["Efectivo"]).toBe("$400.00");
    expect(f["Recibido"]).toBe("$500.00");
    expect(f["Cambio"]).toBe("$100.00");
  });

  it("un anticipo registrado pero no recibido no se resta", () => {
    renderTicket({ anticipoRequerido: true, anticipoRecibido: false, montoAnticipo: 100 });
    expect(filas()["Anticipo pagado"]).toBeUndefined();
  });

  it("si en caja se cobró menos de lo esperado, la diferencia es descuento", () => {
    renderTicket({ montoCobrado: 250 });
    const f = filas();
    expect(f["Subtotal"]).toBe("$280.00");
    expect(f["Descuento"]).toBe("-$30.00");
    expect(f["TOTAL"]).toBe("$250.00");
  });

  it("sin efectivo no hay Recibido ni Cambio aunque lleguen datos", () => {
    renderTicket({ metodoPago: "Tarjeta", montoRecibido: 300, cambio: 20 });
    const f = filas();
    expect(f["Recibido"]).toBeUndefined();
    expect(f["Cambio"]).toBeUndefined();
  });

  it("en salud usa los términos del sector: Paciente y Profesional", () => {
    renderTicket({}, { sector: "salud" });
    const f = filas();
    expect(f["Paciente"]).toBe("Ana García");
    expect(f["Profesional"]).toBe("Sofía Hernández");
    expect(f["Atendió"]).toBeUndefined();
  });

  it("muestra el logo del negocio solo con una URL http(s)", () => {
    const { unmount } = renderTicket({}, { logoUrl: "https://res.cloudinary.com/demo/logo.png" });
    expect(documentoVista().querySelector("img.logo")?.getAttribute("src")).toBe("https://res.cloudinary.com/demo/logo.png");
    unmount();
    renderTicket({}, { logoUrl: "javascript:alert(1)" });
    expect(documentoVista().querySelector("img.logo")).toBeNull();
  });
});

describe("TicketRecibo — reserva y QR", () => {
  it("el QR y el enlace apuntan a la página pública de reservas", async () => {
    renderTicket();
    const url = `${window.location.origin}/b/salon-aramis`;
    await waitFor(() => expect(documentoVista().querySelector("[data-qr-value]")).not.toBeNull());
    expect(documentoVista().querySelector("[data-qr-value]")?.getAttribute("data-qr-value")).toBe(url);
    const texto = textoVista();
    expect(texto).toContain("Reserva tu próxima cita");
    expect(texto).toContain(url.replace(/^https?:\/\//, ""));
  });

  it("sin slug no hay bloque de reserva ni QR", async () => {
    renderTicket({}, { slug: undefined });
    await new Promise((r) => setTimeout(r, 5));
    expect(documentoVista().querySelector("[data-qr-value]")).toBeNull();
    expect(textoVista()).not.toContain("Reserva tu próxima cita");
    expect(textoVista()).toContain("Gracias por tu visita");
  });
});

describe("TicketRecibo — papel", () => {
  it("80 mm por omisión", () => {
    renderTicket();
    expect(screen.getByRole("radio", { name: "80 mm" })).toHaveAttribute("aria-checked", "true");
    expect(vistaPrevia().getAttribute("srcdoc")).toContain("size: 80mm auto");
  });

  it("elegir 58 mm cambia el documento y se recuerda en el dispositivo", async () => {
    const { unmount } = renderTicket();
    await userEvent.click(screen.getByRole("radio", { name: "58 mm" }));
    expect(localStorage.getItem(CLAVE_PAPEL_TICKET)).toBe("58");
    expect(vistaPrevia().getAttribute("srcdoc")).toContain("size: 58mm auto");
    expect(vistaPrevia().style.width).toBe("222px");
    unmount();

    renderTicket();
    expect(screen.getByRole("radio", { name: "58 mm" })).toHaveAttribute("aria-checked", "true");
    expect(vistaPrevia().getAttribute("srcdoc")).toContain("size: 58mm auto");
  });

  it("sin almacenamiento disponible usa 80 mm y no truena al elegir", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    renderTicket();
    expect(screen.getByRole("radio", { name: "80 mm" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "58 mm" }));
    expect(screen.getByRole("radio", { name: "58 mm" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("TicketRecibo — acciones", () => {
  it("llama onEnviarEmail al presionar el botón de email", async () => {
    const onEnviarEmail = vi.fn();
    renderTicket({}, {}, onEnviarEmail);
    await userEvent.click(screen.getByRole("button", { name: /email/i }));
    expect(onEnviarEmail).toHaveBeenCalledOnce();
  });

  it("avisa si el navegador bloquea la ventana de impresión", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    renderTicket();
    await userEvent.click(screen.getByRole("button", { name: /imprimir/i }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/bloqueó/), "error");
  });

  it("imprime el mismo documento que muestra la vista previa", async () => {
    let escrito = "";
    const ventana = {
      document: { write: (h: string) => { escrito += h; }, close: vi.fn(), images: [] },
      focus: vi.fn(), print: vi.fn(), close: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);
    renderTicket();
    await waitFor(() => expect(documentoVista().querySelector("[data-qr-value]")).not.toBeNull());
    await userEvent.click(screen.getByRole("button", { name: /imprimir/i }));
    expect(escrito).toBe(vistaPrevia().getAttribute("srcdoc"));
    await waitFor(() => expect(ventana.print).toHaveBeenCalledOnce());
  });
});

describe("TicketRecibo — escapado", () => {
  it("todo dato con marcado se imprime como texto", async () => {
    let escrito = "";
    const ventana = {
      document: { write: (h: string) => { escrito += h; }, close: vi.fn(), images: [] },
      focus: vi.fn(), print: vi.fn(), close: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(ventana as unknown as Window);
    const ataque = "<img src=x onerror=alert(1)>";
    renderTicket(
      {
        nombreCliente: ataque, nombreEmpleado: ataque, nombreServicio: ataque,
        codigoConfirmacion: ataque, metodoPago: ataque,
      },
      {
        nombre: `"><script>alert(1)</script>`, direccion: ataque, telefono: ataque,
        logoUrl: `https://x" onerror="alert(1)`, slug: `"><script>alert(2)</script>`,
      },
    );
    await userEvent.click(screen.getByRole("button", { name: /imprimir/i }));
    const doc = new DOMParser().parseFromString(escrito, "text/html");
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelector("img[onerror]")).toBeNull();
    // Solo dos imágenes legítimas: el logo (con la URL como texto) y la marca de AppointVa.
    expect(doc.querySelectorAll("img")).toHaveLength(2);
    expect(doc.body.textContent).toContain(ataque);
    expect(doc.body.textContent).toContain("<script>alert(1)</script>");
  });
});
