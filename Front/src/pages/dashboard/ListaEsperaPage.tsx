import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Trash2, CheckCircle, Bell, Ban, Phone, Mail, Calendar, User, Scissors } from "lucide-react";
import { listaEsperaApi, type EntradaListaEspera } from "../../api/listaEspera";
import { useToastStore } from "../../store/toastStore";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";

// Tokens de estado (`--status-*`), que ya cambian con el tema.
const ESTADOS_CONFIG: Record<string, { label: string; color: string }> = {
  Esperando: { label: "Esperando", color: "bg-status-pending-bg text-status-pending-fg" },
  Notificado: { label: "Avisado", color: "bg-status-completed-bg text-status-completed-fg" },
  Confirmado: { label: "Confirmado", color: "bg-status-confirmed-bg text-status-confirmed-fg" },
  Expirado: { label: "Expirado", color: "bg-status-absent-bg text-status-absent-fg" },
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
  const [entradaEliminar, setEntradaEliminar] = useState<EntradaListaEspera | null>(null);

  const { data: lista = [], isLoading, isError } = useQuery({
    queryKey: ["lista-espera", filtroEstado],
    queryFn: () => listaEsperaApi.obtener(filtroEstado || undefined),
  });

  // Los KPIs siempre cuentan sobre la lista completa. Antes contaban sobre la
  // lista ya filtrada por el servidor, así que al filtrar "Esperando" los demás
  // contadores caían a 0 y "Total" pasaba a ser el subtotal del filtro. Sin
  // filtro activo esta query comparte clave con la de arriba y no pide nada.
  const { data: listaCompleta = [] } = useQuery({
    queryKey: ["lista-espera", ""],
    queryFn: () => listaEsperaApi.obtener(undefined),
  });

  const mutCambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) =>
      listaEsperaApi.cambiarEstado(id, estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-espera"] });
      toast("Estado actualizado");
    },
    onError: () => toast("No se pudo actualizar el estado. Intenta de nuevo.", "error"),
  });

  const mutEliminar = useMutation({
    mutationFn: (id: string) => listaEsperaApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lista-espera"] });
      setEntradaEliminar(null);
      toast("Entrada eliminada");
    },
    onError: () => toast("No se pudo eliminar la entrada. Intenta de nuevo.", "error"),
  });

  const cuantos = (estado: string) => listaCompleta.filter((e) => e.estado === estado).length;

  // En el cliente: los KPIs de arriba ya exigen la lista completa (`listaCompleta`),
  // así que pedirle páginas al servidor no ahorraría ninguna descarga. Los
  // contadores siguen leyendo el conjunto entero, no la página.
  const paginada = usePaginacionLocal(lista);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <EncabezadoPagina
        titulo="Lista de espera"
        subtitulo="Clientes que quieren una cita cuando se libere un espacio"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: listaCompleta.length, color: "text-gray-700 dark:text-gray-300" },
          { label: "Esperando", value: cuantos("Esperando"), color: "text-status-pending-fg" },
          { label: "Avisados", value: cuantos("Notificado"), color: "text-status-completed-fg" },
          { label: "Confirmados", value: cuantos("Confirmado"), color: "text-status-confirmed-fg" },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <FiltroBarra
        etiqueta="Filtros de lista de espera"
        className="mb-0"
        onLimpiar={() => setFiltroEstado("")}
        campos={[
          {
            tipo: "select",
            id: "estado",
            etiqueta: "Estado",
            valor: filtroEstado,
            onChange: setFiltroEstado,
            etiquetaNeutra: "Todos",
            opciones: ["Esperando", "Notificado", "Confirmado", "Expirado"]
              .map((e) => ({ valor: e, etiqueta: ESTADOS_CONFIG[e]?.label ?? e })),
          },
        ]}
      />


      {/* Tabla */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">Cargando...</div>
      ) : isError ? (
        <div role="alert" className="text-center py-16 text-red-700 dark:text-red-400">No se pudo cargar la lista de espera.</div>
      ) : lista.length === 0 ? (
        <EmptyState
          variante={filtroEstado ? "sinResultados" : "vacio"}
          icon={filtroEstado ? undefined : <Clock size={40} strokeWidth={1.5} />}
          title="No hay entradas en la lista de espera"
          onLimpiarFiltros={filtroEstado ? () => setFiltroEstado("") : undefined}
        />
      ) : (
        <div className="space-y-3">
          {paginada.visibles.map((entrada) => (
            <EntradaCard
              key={entrada.id}
              entrada={entrada}
              onCambiarEstado={(estado) =>
                mutCambiarEstado.mutate({ id: entrada.id, estado })
              }
              onEliminar={() => setEntradaEliminar(entrada)}
            />
          ))}
          {paginada.totalPaginas > 1 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
              <Pagination
                pagina={paginada.pagina}
                totalPaginas={paginada.totalPaginas}
                total={paginada.total}
                labelTotal="entradas"
                onCambiar={paginada.setPagina}
                cargando={isLoading}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmarAccion
        abierto={!!entradaEliminar}
        titulo="Eliminar de la lista de espera"
        mensaje={entradaEliminar && (
          <p>{`${entradaEliminar.nombreCliente} saldrá de la lista de espera.`}</p>
        )}
        etiquetaConfirmar="Eliminar entrada"
        destructiva
        pendiente={mutEliminar.isPending}
        onConfirmar={() => entradaEliminar && mutEliminar.mutate(entradaEliminar.id)}
        onCerrar={() => setEntradaEliminar(null)}
      />
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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Info principal */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{entrada.nombreCliente}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
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

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Registrado: {formatFecha(entrada.fechaCreacion)}
          {entrada.fechaNotificacion &&
            ` · Avisado: ${formatFecha(entrada.fechaNotificacion)}`}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        {/* OM-06 (pendiente de decisión): este botón solo registra que el
            negocio ya avisó al cliente; no envía ningún mensaje. */}
        {entrada.estado === "Esperando" && (
          <button
            type="button"
            onClick={() => onCambiarEstado("Notificado")}
            title="Registra que ya avisaste al cliente. No envía ningún mensaje."
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-status-completed-bg text-status-completed-fg hover:opacity-90 rounded-lg transition font-medium"
          >
            <Bell size={14} aria-hidden="true" /> Marcar como avisado
          </button>
        )}
        {entrada.estado === "Notificado" && (
          <button
            onClick={() => onCambiarEstado("Confirmado")}
            title="Marcar como confirmado"
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-status-confirmed-bg text-status-confirmed-fg hover:opacity-90 rounded-lg transition font-medium"
          >
            <CheckCircle size={14} /> Confirmar
          </button>
        )}
        {(entrada.estado === "Esperando" || entrada.estado === "Notificado") && (
          <button
            onClick={() => onCambiarEstado("Expirado")}
            title="Marcar como expirado"
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <Ban size={15} />
          </button>
        )}
        <button
          onClick={onEliminar}
          title="Eliminar"
          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
