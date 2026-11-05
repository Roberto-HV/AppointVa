import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TarjetaNegocio from "./TarjetaNegocio";

const base = {
  nombre: "Salón Test",
  promedioResenas: 4.67,
  totalResenas: 12,
  direccion: "Av. Juárez 10, Centro",
  telefono: "55 1234 5678",
  telefonoWhatsApp: "5512345678",
  // Martes: 10–14 y 15–19.
  horario: [
    { diaSemana: 2, horaInicio: "10:00", horaFin: "14:00" },
    { diaSemana: 2, horaInicio: "15:00", horaFin: "19:00" },
  ],
  zonaHoraria: null,
};
const martesMediodia = new Date(2026, 9, 20, 12);

describe("TarjetaNegocio", () => {
  it("muestra calificación, dirección con mapa y contacto", () => {
    render(<TarjetaNegocio negocio={base} ahora={martesMediodia} />);
    const ficha = screen.getByRole("complementary", { name: "Información del negocio" });
    expect(ficha).toHaveTextContent("Salón Test");
    expect(ficha).toHaveTextContent("4.7");
    expect(ficha).toHaveTextContent("(12 reseñas)");
    expect(screen.getByText("Av. Juárez 10, Centro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver en el mapa/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Av.%20Ju%C3%A1rez%2010%2C%20Centro",
    );
    expect(screen.getByRole("link", { name: /Llamar al/ })).toHaveAttribute("href", "tel:5512345678");
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/525512345678");
  });

  it("en pleno turno dice que está abierto, a qué hora cierra y el horario de hoy", () => {
    render(<TarjetaNegocio negocio={base} ahora={martesMediodia} />);
    expect(screen.getByText("Abierto ahora")).toBeInTheDocument();
    expect(screen.getByText("Cierra a las 14:00")).toBeInTheDocument();
    expect(screen.getByText("Hoy: 10:00 – 14:00 · 15:00 – 19:00")).toBeInTheDocument();
  });

  it("un día sin turnos dice «Cerrado hoy» y la semana marca los días cerrados", () => {
    render(<TarjetaNegocio negocio={base} ahora={new Date(2026, 9, 21, 12)} />);
    expect(screen.getByText("Cerrado hoy")).toBeInTheDocument();
    expect(screen.getByText("Horario de la semana")).toBeInTheDocument();
    expect(screen.getAllByText("Cerrado")).toHaveLength(6);
  });

  it("sin datos opcionales no inventa nada: ni estrellas, ni horario, ni contacto", () => {
    render(
      <TarjetaNegocio
        negocio={{ nombre: "Salón Test", promedioResenas: 0, totalResenas: 0, horario: [] }}
        acciones={<button disabled>Continuar</button>}
      />,
    );
    expect(screen.queryByText(/reseña/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Abierto|Cerrado/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Elige un servicio para continuar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });
});
