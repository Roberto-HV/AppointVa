import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportarExcel } from "./exportarExcel";

describe("exportarExcel", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let mockAnchor: HTMLAnchorElement;

  beforeEach(() => {
    clickSpy = vi.fn();

    // Create anchor before spy so we don't recurse
    const originalCreateElement = document.createElement.bind(document);
    mockAnchor = originalCreateElement("a") as HTMLAnchorElement;
    mockAnchor.click = clickSpy;

    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return mockAnchor;
      return originalCreateElement(tag);
    });

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node as ChildNode);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node as ChildNode);

    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("contrato de invocación", () => {
    it("no lanza con los argumentos mínimos requeridos", () => {
      expect(() =>
        exportarExcel(["Nombre", "Valor"], [[["Alice", 100]]], "reporte")
      ).not.toThrow();
    });

    it("no lanza con titulo opcional", () => {
      expect(() =>
        exportarExcel(["Col"], [[["dato"]]], "archivo", "Mi Título")
      ).not.toThrow();
    });

    it("no lanza con titulo, subtitulo y totales", () => {
      expect(() =>
        exportarExcel(
          ["A", "B"],
          [[["x", "y"]]],
          "archivo",
          "Reporte Mensual",
          { subtitulo: "Enero 2025", totales: ["Total", 42] }
        )
      ).not.toThrow();
    });

    it("no lanza con caracteres especiales HTML en encabezados y celdas", () => {
      expect(() =>
        exportarExcel(
          ["<script>", "A & B"],
          [[["<b>valor</b>", "> 100"]]],
          "reporte"
        )
      ).not.toThrow();
    });

    it("aplana grupos de filas correctamente (filas.flat)", () => {
      expect(() =>
        exportarExcel(
          ["Col"],
          [[["grupo1-fila1"], ["grupo1-fila2"]], [["grupo2-fila1"]]],
          "reporte"
        )
      ).not.toThrow();
    });
  });

  describe("mecanismo de descarga", () => {
    it("crea un object URL con el blob HTML", () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it("dispara el click en el anchor para iniciar la descarga", () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it("revoca el object URL tras la descarga", () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("añade el anchor al body y luego lo elimina", () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    });
  });

  describe("nombre del archivo", () => {
    it("incluye el nombreArchivo y la fecha de hoy en formato ISO", () => {
      const today = new Date().toISOString().slice(0, 10);
      exportarExcel(["Col"], [[["dato"]]], "ventas");
      expect(mockAnchor.download).toBe(`ventas-${today}.xls`);
    });

    it("usa extensión .xls", () => {
      exportarExcel(["Col"], [[["dato"]]], "reporte");
      expect(mockAnchor.download).toMatch(/\.xls$/);
    });
  });

  describe("contenido del blob", () => {
    it("pasa un Blob con tipo application/vnd.ms-excel", () => {
      let capturedBlob: Blob | undefined;
      (global.URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(
        (blob: Blob) => {
          capturedBlob = blob;
          return "blob:mock-url";
        }
      );

      exportarExcel(["Col"], [[["dato"]]], "archivo");

      expect(capturedBlob).toBeDefined();
      expect(capturedBlob!.type).toContain("application/vnd.ms-excel");
    });
  });
});
