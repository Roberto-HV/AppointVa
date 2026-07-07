import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ExternalLink, User, Clock, DollarSign, FileText } from "lucide-react";
import { citasApi, ESTADOS } from "../../api/citas";

const ESTADO_ESTILOS: Record<number, { label: string; clase: string }> = {
  [ESTADOS.Pendiente]:    { label: "Pendiente",    clase: "bg-yellow-100 text-yellow-800" },
  [ESTADOS.Confirmada]:   { label: "Confirmada",   clase: "bg-blue-100 text-blue-800" },
  [ESTADOS.Completada]:   { label: "Completada",   clase: "bg-green-100 text-green-800" },
  [ESTADOS.Cancelada]:    { label: "Cancelada",    clase: "bg-red-100 text-red-800" },
  [ESTADOS.Inasistencia]: { label: "Inasistencia", clase: "bg-gray-100 text-gray-600" },
};

function buildGoogleCalUrl(
  titulo: string,
  inicio: Date,
  fin: Date,
  detalles: string,
) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(titulo)}` +
    `&dates=${fmt(inicio)}/${fmt(fin)}` +
    `&details=${encodeURIComponent(detalles)}`
  );
}

export default function CitaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: cita, isLoading, error } = useQuery({
    queryKey: ["cita", id],
    queryFn: () => citasApi.obtenerPorId(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !cita) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <p className="text-gray-500 mb-4">No se encontró la cita o no tienes acceso.</p>
        <button
          onClick={() => navigate("/dashboard/citas")}
          className="text-sm text-slate-700 hover:underline"
        >
          ← Volver a mis citas
        </button>
      </div>
    );
  }

  const inicio = new Date(cita.inicioEn);
  const fin    = new Date(cita.finEn);

  const fechaStr = inicio.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const horaStr = `${inicio.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} – ${fin.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;

  const estado = ESTADO_ESTILOS[cita.estado] ?? { label: cita.estadoTexto, clase: "bg-gray-100 text-gray-600" };

  const icalUrl = `${import.meta.env.VITE_API_URL}/publico/citas/${cita.codigoConfirmacion}/ical`;
  const googleCalUrl = buildGoogleCalUrl(
    `${cita.nombreServicio} — ${cita.nombreEmpleado}`,
    inicio,
    fin,
    `Cliente: ${cita.nombreCliente}\nTel: ${cita.telefonoCliente}${cita.notas ? `\nNotas: ${cita.notas}` : ""}`,
  );

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard/citas")}
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
          aria-label="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Detalle de cita</h1>
          <p className="text-xs text-gray-400 font-mono">{cita.codigoConfirmacion}</p>
        </div>
        <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${estado.clase}`}>
          {estado.label}
        </span>
      </div>

      {/* Tarjeta principal */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">

        {/* Servicio y profesional */}
        <div className="p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Servicio</p>
          <p className="text-lg font-semibold text-gray-900">{cita.nombreServicio}</p>
          {cita.nombreEmpleado && (
            <p className="text-sm text-gray-500 mt-0.5">con {cita.nombreEmpleado}</p>
          )}
        </div>

        {/* Fecha y hora */}
        <div className="p-5 flex gap-3">
          <Clock size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 capitalize">{fechaStr}</p>
            <p className="text-sm text-gray-500">{horaStr} · {cita.duracionMinutos} min</p>
          </div>
        </div>

        {/* Cliente */}
        <div className="p-5 flex gap-3">
          <User size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{cita.nombreCliente}</p>
            <p className="text-sm text-gray-500">{cita.telefonoCliente}</p>
            {cita.emailCliente && <p className="text-sm text-gray-500">{cita.emailCliente}</p>}
          </div>
        </div>

        {/* Precio */}
        <div className="p-5 flex gap-3">
          <DollarSign size={18} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">
              {cita.precio.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
            </p>
            {cita.pagada && (
              <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                Pagada{cita.metodoPago ? ` · ${cita.metodoPago}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Notas */}
        {cita.notas && (
          <div className="p-5 flex gap-3">
            <FileText size={18} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600">{cita.notas}</p>
          </div>
        )}
      </div>

      {/* Botones de calendario */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Calendar size={16} />
          Agregar al calendario
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={googleCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 flex-1 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            <ExternalLink size={15} />
            Google Calendar
          </a>
          <a
            href={icalUrl}
            download
            className="flex items-center justify-center gap-2 flex-1 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            <Calendar size={15} />
            Guardar en calendario
          </a>
        </div>
      </div>
    </div>
  );
}
