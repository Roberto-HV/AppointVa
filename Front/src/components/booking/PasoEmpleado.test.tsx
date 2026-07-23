import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasoEmpleado, { SIN_PREFERENCIA_ID, SIN_PREFERENCIA } from "./PasoEmpleado";
import type { EmpleadoPublico } from "../../types";

const mockEmpleados: EmpleadoPublico[] = [
  {
    id: "emp-1",
    nombre: "Ana García",
    servicioIds: ["srv-1"],
    promedioResenas: 0,
    totalResenas: 0,
  },
  {
    id: "emp-2",
    nombre: "Luis Martínez",
    servicioIds: ["srv-1", "srv-2"],
    promedioResenas: 0,
    totalResenas: 0,
  },
  {
    id: "emp-3",
    nombre: "Carlos Ruiz",
    servicioIds: ["srv-2"],
    promedioResenas: 0,
    totalResenas: 0,
  },
];

describe("PasoEmpleado", () => {
  it("always shows the Sin preferencia option", () => {
    render(
      <PasoEmpleado
        empleados={mockEmpleados}
        servicioId="srv-1"
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Sin preferencia")).toBeInTheDocument();
  });

  it("renders employees filtered by servicioId", () => {
    render(
      <PasoEmpleado
        empleados={mockEmpleados}
        servicioId="srv-1"
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Luis Martínez")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Ruiz")).not.toBeInTheDocument();
  });

  it("calls onSeleccionar with the employee when an employee is clicked", () => {
    const onSeleccionar = vi.fn();
    render(
      <PasoEmpleado
        empleados={mockEmpleados}
        servicioId="srv-1"
        seleccionado={null}
        onSeleccionar={onSeleccionar}
      />
    );
    fireEvent.click(screen.getByText("Ana García"));
    expect(onSeleccionar).toHaveBeenCalledWith(mockEmpleados[0]);
  });

  it("calls onSeleccionar with SIN_PREFERENCIA when Sin preferencia is clicked", () => {
    const onSeleccionar = vi.fn();
    render(
      <PasoEmpleado
        empleados={mockEmpleados}
        servicioId="srv-1"
        seleccionado={null}
        onSeleccionar={onSeleccionar}
      />
    );
    fireEvent.click(screen.getByText("Sin preferencia"));
    expect(onSeleccionar).toHaveBeenCalledWith(
      expect.objectContaining({ id: SIN_PREFERENCIA_ID })
    );
  });

  it("shows a message when no employees are assigned to the service", () => {
    render(
      <PasoEmpleado
        empleados={mockEmpleados}
        servicioId="srv-999"
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(
      screen.getByText(/No hay profesionales asignados a este servicio/i)
    ).toBeInTheDocument();
  });
});
