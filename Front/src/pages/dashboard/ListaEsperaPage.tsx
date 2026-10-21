import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Trash2, CheckCircle, Bell, Ban, Phone, Mail, Calendar, User, Tag } from "lucide-react";
import { listaEsperaApi, type EntradaListaEspera } from "../../api/listaEspera";
import { useToastStore } from "../../store/toastStore";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import ErrorCarga from "../../components/ui/ErrorCarga";
import { SiWhatsapp } from "react-icons/si";
import { negociosApi } from "../../api/negocios";
import { urlAvisoListaEsperaWhatsApp } from "../../utils/whatsapp";

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
  // Expirar a alguien ya avisado no se puede deshacer fielmente (volver a
  // "Avisado" reescribe la fecha del aviso), así que ese caso se confirma antes.
  const [entradaExpirar, setEntradaExpirar] = useState<EntradaListaEspera | null>(null);

  const { data: lista = [], isLoading, isError, refetch, isFetching } = useQuery({
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

  // Nombre y enlace del negocio para el mensaje de WhatsApp (misma clave que el layout).
  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil-layout"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 5,
  });

  const mutCambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string; anterior?: string; nombre?: string }) =>
      listaEsperaApi.cambiarEstado(id, estado),
    onSuccess: (_r, { id, estado, anterior, nombre }) => {
      qc.invalidateQueries({ queryKey: ["lista-espera"] });
      setEntradaExpirar(null);
      // "Esperando" → "Expirado" se revierte sin perder nada: el backend solo
      // cambia el estado. Es el único cambio que ofrece "Deshacer".
      if (estado === "Expirado" && anterior === "Esperando") {
        toast(`${nombre ?? "La entrada"} quedó como expirada`, "exito", {
          accion: { etiqueta: "Deshacer", onClick: () => mutCambiarEstado.mutate({ id, estado: "Esperando" }) },
        });
      } else {
        toast("Estado actualizado");
      }
    },
    onError: () => toast("No se pudo actualizar el estado. Intenta de nuevo.", "error"),
  });

  const expirar = (entrada: EntradaListaEspera) => {
    if (entrada.estado === "Esperando") {
      mutCambiarEstado.mutate({ id: entrada.id, estado: "Expirado", anterior: "Esperando", nombre: entrada.nombreCliente });
    } else {
      setEntradaExpirar(entrada);
    }
  };

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
          { label: "Total", value: listaCompleta.length, color: "text-slate-700 dark:text-slate-300" },
          { label: "Esperando", value: cuantos("Esperando"), color: "text-status-pending-fg" },
          { label: "Avisados", value: cuantos("Notificado"), color: "text-status-completed-fg" },
          { label: "Confirmados", value: cuantos("Confirmado"), color: "text-status-confirmed-fg" },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
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
        <div className="space-y-3" aria-busy="true" aria-label="Cargando lista de espera">
          {[0, 1, 2].map((i) => <div key={i} className="h-[92px] rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : isError ? (
        <ErrorCarga mensaje="No se pudo cargar la lista de espera." onReintentar={() => refetch()} reintentando={isFetching} />
      ) : lista.length === 0 ? (
        <EmptyState
          variante={filtroEstado ? "sinResultados" : "vacio"}
          icon={filtroEstado ? undefined : <Clock size={40} strokeWidth={1.5} />}
          title={filtroEstado
            ? `Ningún registro con estado "${ESTADOS_CONFIG[filtroEstado]?.label ?? filtroEstado}"`
            : "No hay entradas en la lista de espera"}
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
              onExpirar={() => expirar(entrada)}
              urlWhatsApp={entrada.telefonoCliente?.replace(/\D/g, "")
                ? urlAvisoListaEsperaWhatsApp(entrada, perfil?.nombre, perfil?.slug)
                : null}
              pendiente={mutCambiarEstado.isPending && mutCambiarEstado.variables?.id === entrada.id}
              onEliminar={() => setEntradaEliminar(entrada)}
            />
          ))}
          {paginada.totalPaginas > 1 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
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

      <ConfirmarAccion
        abierto={!!entradaExpirar}
        titulo="Marcar como expirado"
        mensaje={entradaExpirar && (
          <p>{`${entradaExpirar.nombreCliente} ya fue avisado. Si lo marcas como expirado no podrás volver a "Avisado" con la fecha original.`}</p>
        )}
        etiquetaConfirmar="Marcar como expirado"
        pendiente={mutCambiarEstado.isPending}
        onConfirmar={() => entradaExpirar && mutCambiarEstado.mutate({ id: entradaExpirar.id, estado: "Expirado" })}
        onCerrar={() => setEntradaExpirar(null)}
      />
    </div>
  );
}

function EntradaCard({
  entrada,
  onCambiarEstado,
  onExpirar,
  onEliminar,
  pendiente,
  urlWhatsApp,
}: {
  entrada: EntradaListaEspera;
  /** Sin teléfono no hay enlace y queda solo "Marcar como avisado". */
  urlWhatsApp: string | null;
  onCambiarEstado: (estado: string) => void;
  onExpirar: () => void;
  onEliminar: () => void;
  pendiente: boolean;
}) {
  const cfg = ESTADOS_CONFIG[entrada.estado] ?? ESTADOS_CONFIG.Esperando;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Info principal */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{entrada.nombreCliente}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
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
              <Tag size={13} aria-hidden="true" /> {entrada.servicioNombre}
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

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Registrado: {formatFecha(entrada.fechaCreacion)}
          {entrada.fechaNotificacion &&
            ` · Avisado: ${formatFecha(entrada.fechaNotificacion)}`}
        </p>
      </div>

      {/* Acciones: todas con texto o nombre; antes "expirar" y "eliminar" eran iconos mudos. */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* OM-06 (decisión 6): con teléfono, el aviso abre WhatsApp con el
            mensaje listo y registra el estado "Avisado". Sin teléfono solo se
            puede registrar que el negocio ya avisó por otro medio. */}
        {entrada.estado === "Esperando" && urlWhatsApp && (
          <a
            href={urlWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (pendiente) { e.preventDefault(); return; }
              onCambiarEstado("Notificado");
            }}
            aria-disabled={pendiente || undefined}
            title="Abre WhatsApp con el mensaje listo y registra el aviso."
            className="min-h-[44px] lg:min-h-[36px] flex items-center gap-1.5 px-3 text-sm bg-status-completed-bg text-status-completed-fg hover:opacity-90 aria-disabled:opacity-50 rounded-lg transition font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SiWhatsapp size={14} aria-hidden="true" /> Avisar por WhatsApp
          </a>
        )}
        {entrada.estado === "Esperando" && !urlWhatsApp && (
          <button
            type="button"
            onClick={() => onCambiarEstado("Notificado")}
            disabled={pendiente}
            title="Registra que ya avisaste al cliente. No envía ningún mensaje."
            className="min-h-[44px] lg:min-h-[36px] flex items-center gap-1 px-3 text-sm bg-status-completed-bg text-status-completed-fg hover:opacity-90 disabled:opacity-50 rounded-lg transition font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell size={14} aria-hidden="true" /> Marcar como avisado
          </button>
        )}
        {entrada.estado === "Notificado" && (
          <button
            type="button"
            onClick={() => onCambiarEstado("Confirmado")}
            disabled={pendiente}
            title="Marcar como confirmado"
            className="min-h-[44px] lg:min-h-[36px] flex items-center gap-1 px-3 text-sm bg-status-confirmed-bg text-status-confirmed-fg hover:opacity-90 disabled:opacity-50 rounded-lg transition font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckCircle size={14} aria-hidden="true" /> Confirmar
          </button>
        )}
        {(entrada.estado === "Esperando" || entrada.estado === "Notificado") && (
          <button
            type="button"
            onClick={onExpirar}
            disabled={pendiente}
            aria-label={`Marcar a ${entrada.nombreCliente} como expirado`}
            className="min-h-[44px] lg:min-h-[36px] flex items-center gap-1 px-3 text-sm border border-border text-foreground hover:bg-muted disabled:opacity-50 rounded-lg transition font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Ban size={14} aria-hidden="true" /> Expirar
          </button>
        )}
        <button
          type="button"
          onClick={onEliminar}
          aria-label={`Eliminar a ${entrada.nombreCliente} de la lista`}
          title="Eliminar"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
