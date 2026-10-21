import { describe, expect, it } from "vitest";
import { htmlHojaQr } from "./impresionQr";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("htmlHojaQr (OM-28)", () => {
  it("incluye el QR, el nombre del negocio y la URL", () => {
    const html = htmlHojaQr({ negocio: "Salón Ana", url: "https://app.test/b/salon-ana", qrDataUrl: PNG });
    expect(html).toContain(`<img src="${PNG}"`);
    expect(html).toContain("<h1>Salón Ana</h1>");
    expect(html).toContain("https://app.test/b/salon-ana");
  });

  it("escapa el nombre que escribe el usuario", () => {
    const html = htmlHojaQr({ negocio: "<script>alert(1)</script>", url: "https://x", qrDataUrl: PNG });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("descarta una imagen que no sea un PNG en data URL", () => {
    const html = htmlHojaQr({ negocio: "A", url: "https://x", qrDataUrl: 'javascript:alert(1)"' });
    expect(html).not.toContain("<img");
  });
});
