import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportarExcel } from "./exportarExcel";

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

vi.mock("exceljs", () => {
  const makeCell = () => ({
    fill: undefined as unknown,
    font: undefined as unknown,
    alignment: undefined as unknown,
    border: undefined as unknown,
    value: undefined as unknown,
  });
  const makeRow = () => ({
    height: 0,
    eachCell: vi.fn((cb: (c: ReturnType<typeof makeCell>) => void) => cb(makeCell())),
    getCell: vi.fn(() => makeCell()),
  });
  const makeSheet = () => ({
    addRow: vi.fn(() => makeRow()),
    getRow: vi.fn(() => makeRow()),
    getColumn: vi.fn(() => ({ width: 0 })),
    mergeCells: vi.fn(),
    headerFooter: { oddFooter: "" },
    views: [] as unknown[],
    columns: [] as unknown[],
  });

  class MockWorkbook {
    creator = "";
    private _sheet = makeSheet();
    addWorksheet = vi.fn(() => this._sheet);
    xlsx = {
      writeBuffer: vi.fn(() => Promise.resolve(new Uint8Array([80, 75]).buffer as ArrayBuffer)),
    };
  }

  return { default: { Workbook: MockWorkbook } };
});

describe("exportarExcel", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let mockAnchor: HTMLAnchorElement;

  beforeEach(() => {
    clickSpy = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    mockAnchor = originalCreateElement("a") as HTMLAnchorElement;
    mockAnchor.click = clickSpy as unknown as () => void;

    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return mockAnchor;
      return originalCreateElement(tag);
    });

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => node as ChildNode);
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node as ChildNode);

    (globalThis as any).URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    (globalThis as any).URL.revokeObjectURL = vi.fn();
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

    it("no lanza con caracteres especiales en encabezados y celdas", () => {
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
    it("crea un object URL con el blob xlsx", async () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      await flushPromises();
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it("dispara el click en el anchor para iniciar la descarga", async () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      await flushPromises();
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it("revoca el object URL tras la descarga", async () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      await flushPromises();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("añade el anchor al body y luego lo elimina", async () => {
      exportarExcel(["Col"], [[["dato"]]], "archivo");
      await flushPromises();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    });
  });

  describe("nombre del archivo", () => {
    it("incluye el nombreArchivo y la fecha de hoy en formato ISO", async () => {
      const today = new Date().toISOString().slice(0, 10);
      exportarExcel(["Col"], [[["dato"]]], "ventas");
      await flushPromises();
      expect(mockAnchor.download).toBe(`ventas-${today}.xlsx`);
    });

    it("usa extensión .xlsx", async () => {
      exportarExcel(["Col"], [[["dato"]]], "reporte");
      await flushPromises();
      expect(mockAnchor.download).toMatch(/\.xlsx$/);
    });
  });

  describe("contenido del blob", () => {
    it("pasa un Blob con tipo openxmlformats-officedocument.spreadsheetml.sheet", async () => {
      let capturedBlob: Blob | undefined;
      ((globalThis as any).URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation(
        (blob: Blob) => {
          capturedBlob = blob;
          return "blob:mock-url";
        }
      );

      exportarExcel(["Col"], [[["dato"]]], "archivo");
      await flushPromises();

      expect(capturedBlob).toBeDefined();
      expect(capturedBlob!.type).toContain("openxmlformats-officedocument.spreadsheetml.sheet");
    });
  });
});
