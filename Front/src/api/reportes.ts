import { api } from "./axios";

export interface FiltrosReporteCitas {
  desde?: string;
  hasta?: string;
  empleadoId?: string;
  servicioId?: string;
  estado?: number;
}

export interface FilaCitaReporte {
  id: string;
  codigoConfirmacion: string;
  nombreCliente: string;
  telefonoCliente: string;
  emailCliente?: string;
  nombreServicio: string;
  nombreEmpleado: string;
  inicioEn: string;
  duracionMinutos: number;
  precio: number;
  pagada: boolean;
  metodoPago?: string;
  estado: number;
  estadoTexto: string;
  notas?: string;
}

export interface ReporteCitas {
  totalCitas: number;
  totalCompletadas: number;
  totalCanceladas: number;
  totalPendientes: number;
  totalInasistencias: number;
  totalIngresos: number;
  totalIngresosEfectivo: number;
  totalIngresosTarjeta: number;
  citas: FilaCitaReporte[];
}

export interface IngresosPorServicio {
  servicioId: string;
  nombreServicio: string;
  totalCitas: number;
  totalIngresos: number;
  porcentaje: number;
}

export interface IngresosPorEmpleado {
  empleadoId: string;
  nombreEmpleado: string;
  totalCitas: number;
  totalIngresos: number;
}

export interface IngresosPorDia {
  fecha: string;
  totalCitas: number;
  totalIngresos: number;
}

export interface ReporteIngresos {
  totalIngresos: number;
  totalCitasCompletadas: number;
  ticketPromedio: number;
  porServicio: IngresosPorServicio[];
  porEmpleado: IngresosPorEmpleado[];
  porDia: IngresosPorDia[];
}

export interface HeatmapHoras {
  matriz: number[][];   // [hora 0-23][dia 0=Lun 6=Dom]
  maximo: number;
  totalCitas: number;
  horaPico: string;
  diaPico: string;
}

export interface ReporteRetencion {
  totalClientes: number;
  clientesRecurrentes: number;
  clientesNuevos: number;
  tasaRetencion: number;
  ingresoMesActual: number;
  proyeccionMes: number;
  ingresoAgendado: number;
  diasRestantesMes: number;
}

export const reportesApi = {
  obtenerCitas: async (filtros?: FiltrosReporteCitas): Promise<ReporteCitas> => {
    const { data } = await api.get("/reportes/citas", { params: filtros });
    return data;
  },

  exportarCitasCsv: async (filtros?: FiltrosReporteCitas): Promise<void> => {
    const { data, headers } = await api.get("/reportes/citas/exportar", {
      params: filtros,
      responseType: "blob",
    });
    const cd = headers["content-disposition"] ?? "";
    const match = cd.match(/filename=([^;]+)/);
    const nombre = match ? match[1].trim() : "reporte_citas.csv";
    const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  },

  obtenerIngresos: async (desde?: string, hasta?: string): Promise<ReporteIngresos> => {
    const { data } = await api.get("/reportes/ingresos", { params: { desde, hasta } });
    return data;
  },

  obtenerHeatmap: async (desde?: string, hasta?: string): Promise<HeatmapHoras> => {
    const { data } = await api.get("/reportes/heatmap", { params: { desde, hasta } });
    return data;
  },

  obtenerRetencion: async (desde?: string, hasta?: string): Promise<ReporteRetencion> => {
    const { data } = await api.get("/reportes/retencion", { params: { desde, hasta } });
    return data;
  },
};
