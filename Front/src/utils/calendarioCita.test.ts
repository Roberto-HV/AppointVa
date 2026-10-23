import { describe, it, expect } from "vitest";
import { baseApiAbsoluta, urlIcalCita } from "./calendarioCita";

describe("urlIcalCita", () => {
  it("usa la base de producción tal cual, por https", () => {
    expect(urlIcalCita("507E5262", "https://appointva.onrender.com/api", "https://appointva.com"))
      .toBe("https://appointva.onrender.com/api/publico/citas/507E5262/ical");
  });

  it("resuelve una base relativa contra el origen de la página (proxy de Vite)", () => {
    expect(urlIcalCita("507E5262", "/api", "http://localhost:5178"))
      .toBe("http://localhost:5178/api/publico/citas/507E5262/ical");
  });

  it("no duplica barras ni deja el código sin codificar", () => {
    expect(urlIcalCita("A B/1", "https://api.test/api/", "https://x.test"))
      .toBe("https://api.test/api/publico/citas/A%20B%2F1/ical");
  });

  it("sin VITE_API_URL cae en /api del mismo origen", () => {
    expect(baseApiAbsoluta("", "https://appointva.com")).toBe("https://appointva.com/api");
  });

  it("nunca usa webcal://", () => {
    expect(urlIcalCita("X", "https://appointva.onrender.com/api", "https://appointva.com")).not.toMatch(/^webcal:/);
  });
});
