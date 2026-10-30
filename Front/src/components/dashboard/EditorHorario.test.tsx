import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import EditorHorario from "./EditorHorario";
import type { HorarioDiaDto } from "../../types";

function Envoltorio({ inicial, permitido }: { inicial: HorarioDiaDto[]; permitido?: (d: number) => { horaInicio: string; horaFin: string }[] | null }) {
  const [horarios, setHorarios] = useState(inicial);
  return (
    <>
      <EditorHorario
        horarios={horarios}
        onCambiar={setHorarios}
        idBase="t"
        intervaloInicial={{ horaInicio: "09:00", horaFin: "18:00" }}
        etiquetaCerrado="Cerrado"
        horarioPermitido={permitido}
      />
      <output data-testid="estado">{JSON.stringify(horarios)}</output>
    </>
  );
}

const estado = () => JSON.parse(screen.getByTestId("estado").textContent!) as HorarioDiaDto[];

describe("EditorHorario (OM-22)", () => {
  it("cada selector de hora dice día, inicio/fin y número de intervalo", () => {
    render(<Envoltorio inicial={[{ diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }] }]} />);
    expect(screen.getByRole("button", { name: /^Lunes, inicio del intervalo 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Lunes, fin del intervalo 1/ })).toBeInTheDocument();
  });

  it("un intervalo nuevo dura una hora a partir del anterior y el día sigue siendo válido", () => {
    render(<Envoltorio inicial={[{ diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }] }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar intervalo al lunes" }));
    expect(estado()[0].intervalos[1]).toEqual({ horaInicio: "14:00", horaFin: "15:00" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar intervalo 2 del lunes" }).className).toContain("min-h-[44px]");
  });

  it("no deja agregar un intervalo que pase del horario del negocio", () => {
    render(
      <Envoltorio
        inicial={[{ diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "19:00" }] }]}
        permitido={() => [{ horaInicio: "09:00", horaFin: "19:00" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Agregar intervalo al lunes" })).toBeDisabled();
    expect(screen.getByText("Horario del negocio: 9:00 a.m.–7:00 p.m.")).toBeInTheDocument();
  });

  it("explica qué intervalo está mal", () => {
    render(
      <Envoltorio
        inicial={[{ diaSemana: 2, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }, { horaInicio: "13:00", horaFin: "15:00" }] }]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("El intervalo 2 empieza antes de que termine el 1.");
  });

  it("aplica el horario de un día a los demás días abiertos", () => {
    render(
      <Envoltorio
        inicial={[
          { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }] },
          { diaSemana: 2, activo: true, intervalos: [{ horaInicio: "10:00", horaFin: "11:00" }] },
          { diaSemana: 0, activo: false, intervalos: [] },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a todos el horario del lunes" }));
    expect(estado()[1].intervalos).toEqual([{ horaInicio: "09:00", horaFin: "14:00" }]);
    expect(estado()[2]).toEqual({ diaSemana: 0, activo: false, intervalos: [] });
  });

  it("una sola acción 'Aplicar a todos' arriba, que copia el día elegido (M12)", () => {
    render(
      <Envoltorio
        inicial={[
          { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }] },
          { diaSemana: 2, activo: true, intervalos: [{ horaInicio: "10:00", horaFin: "11:00" }] },
          { diaSemana: 3, activo: true, intervalos: [{ horaInicio: "12:00", horaFin: "13:00" }] },
        ]}
      />,
    );
    expect(screen.getAllByRole("button", { name: /^Aplicar a todos/ })).toHaveLength(1);
    // El origen se elige en el selector de arriba; por defecto, el primer día abierto.
    fireEvent.change(document.querySelector("select")!, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a todos el horario del martes" }));
    expect(estado()[0].intervalos).toEqual([{ horaInicio: "10:00", horaFin: "11:00" }]);
    expect(estado()[2].intervalos).toEqual([{ horaInicio: "10:00", horaFin: "11:00" }]);
  });

  it("cada día es una fila compacta, sin acción de copiar propia (M12)", () => {
    render(
      <Envoltorio
        inicial={[
          { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }] },
          { diaSemana: 0, activo: false, intervalos: [] },
        ]}
      />,
    );
    const lunes = screen.getByRole("group", { name: "Lunes" });
    expect(lunes.className).not.toContain("rounded-lg border");
    expect(within(lunes).queryByRole("button", { name: /Aplicar/ })).toBeNull();
    expect(within(lunes).getByRole("button", { name: "Agregar intervalo al lunes" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Domingo" })).getByText("Cerrado")).toBeInTheDocument();
  });

  it("abrir un día cerrado le pone el intervalo inicial", () => {
    const onCambiar = vi.fn();
    render(
      <EditorHorario
        horarios={[{ diaSemana: 0, activo: false, intervalos: [] }]}
        onCambiar={onCambiar}
        idBase="x"
        intervaloInicial={{ horaInicio: "09:00", horaFin: "18:00" }}
        etiquetaCerrado="Cerrado"
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Domingo" }));
    expect(onCambiar).toHaveBeenCalledWith([{ diaSemana: 0, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "18:00" }] }]);
  });

  it("en el editor de un empleado, aplicar a los demás días recorta al horario del negocio y lo avisa", () => {
    render(
      <Envoltorio
        inicial={[
          { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "19:00" }] },
          { diaSemana: 6, activo: true, intervalos: [{ horaInicio: "10:00", horaFin: "12:00" }] },
        ]}
        permitido={(d) => (d === 6 ? [{ horaInicio: "10:00", horaFin: "14:00" }] : [{ horaInicio: "09:00", horaFin: "19:00" }])}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a todos el horario del lunes" }));
    expect(estado()[1].intervalos).toEqual([{ horaInicio: "10:00", horaFin: "14:00" }]);
    expect(screen.getByText(/Ajustado al horario del negocio en Sábado/)).toHaveAttribute("role", "status");
  });
});
