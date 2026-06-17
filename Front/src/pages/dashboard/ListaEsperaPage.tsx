import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Trash2, CheckCircle, Bell, Ban, Phone, Mail, Calendar, User, Scissors } from "lucide-react";
import { listaEsperaApi, type EntradaListaEspera } from "../../api/listaEspera";
import { useToastStore } from "../../store/toastStore";

const ESTADOS_CONFIG: Record<string, { label: string; color: string }> = {
  Esperando: { label: "Esperando", color: "bg-yellow-100 text-yellow-700" },
  Notificado: { label: "Notificado", color: "bg-blue-100 text-blue-700" },
  Confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700" },
  Expirado: { label: "Expirado", color: "bg-gray-100 text-gray-500" },
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ListaEsperaPage() {
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const { data: lista = [], isLoading, isError } = useQuery({
    queryKey: ["lista-espera", filtroEstado],
    queryFn: () => listaEsperaApi.obtener(filtroEstado || undefined),
  });

  const mutCambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      listaEsperaApi.cambiarEstado(id, estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-espera"] });
      toast("Estado actualizado");
    },
  });

  const mutEliminar = useMutation({
    mutationFn: (id: string) => listaEsperaApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-espera"] });
      toast("Entrada eliminada");
    },
  });

  const esperando = lista.filter((e) => e.estado === "Esperando").length;
  const notificados = lista.filter((e) => e.estado === "Notificado").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lista de espera</h1>
        <p className="text-gray-500 text-sm mt-1">
          Clientes que quieren una cita cuando se libere un espacio
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: lista.length, color: "text-gray-700" },
          { label: "Esperando", value: esperando, color: "text-yellow-600" },
          { label: "Notificados", value: notificados, color: "text-blue-600" },
          {
            label: "Confirmados",
            value: lista.filter((e) => e.estado === "Confirmado").length,
            color: "text-green-600",
          },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        {["", "Esperando", "Notificado", "Confirmado", "Expirado"].map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 text-sm rounded-full border transition ${
              filtroEstado === e
                ? "bg-primary text-white border-primary"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {e || "Todos"}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : isError ? (
        <div className="text-center py-16 text-red-400">No se pudo cargar la lista de espera.</div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay entradas en la lista de espera</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((entrada) => (
            <EntradaCard
              key={entrada.id}
              entrada={entrada}
              onCambiarEstado={(estado) =>
                mutCambiarEstado.mutate({ id: entrada.id, estado })
              }
              onEliminar={() => {
                if (confirm("¿Eliminar esta entrada de la lista?"))
                  mutEliminar.mutate(entrada.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntradaCard({
  entrada,
  onCambiarEstado,
  onEliminar,
}: {
  entrada: EntradaListaEspera;
  onCambiarEstado: (estado: string) => void;
  onEliminar: () => void;
}) {
  const cfg = ESTADOS_CONFIG[entrada.estado] ?? ESTADOS_CONFIG.Esperando;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Info principal */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900">{entrada.nombreCliente}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Phone size={13} /> {entrada.telefonoCliente}
          </span>
          {entrada.emailCliente && (
            <span className="flex items-center gap-1">
              <Mail size={13} /> {entrada.emailCliente}
            </span>
          )}
          {entrada.servicioNombre && (
            <span className="flex items-center gap-1">
              <Scissors size={13} /> {entrada.servicioNombre}
            </span>
          )}
          {entrada.empleadoNombre && (
            <span className="flex items-center gap-1">
              <User size={13} /> {entrada.empleadoNombre}
            </span>
          )}
          {entrada.fechaPreferida && (
            <span className="flex items-center gap-1">
              <Calendar size={13} /> {formatFecha(entrada.fechaPreferida)}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Registrado: {formatFecha(entrada.fechaCreacion)}
          {entrada.fechaNotificacion &&
            ` · Notificado: ${formatFecha(entrada.fechaNotificacion)}`}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        {entrada.estado === "Esperando" && (
          <button
            onClick={() => onCambiarEstado("Notificado")}
            title="Marcar como notificado"
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition font-medium"
          >
            <Bell size={14} /> Notificar
          </button>
        )}
        {entrada.estado === "Notificado" && (
          <button
            onClick={() => onCambiarEstado("Confirmado")}
            title="Marcar como confirmado"
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition font-medium"
          >
            <CheckCircle size={14} /> Confirmar
          </button>
        )}
        {(entrada.estado === "Esperando" || entrada.estado === "Notificado") && (
          <button
            onClick={() => onCambiarEstado("Expirado")}
            title="Marcar como expirado"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <Ban size={15} />
          </button>
        )}
        <button
          onClick={onEliminar}
          title="Eliminar"
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
