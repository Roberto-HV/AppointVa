import { useState, useEffect, useMemo, useId } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientesApi } from "../../api/clientes";
import { negociosApi } from "../../api/negocios";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import Modal from "../../components/ui/Modal";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { exportarExcel } from "../../utils/exportarExcel";
import type { ClienteDto } from "../../types";
import { formatPrecio, formatFecha, formatFechaCorta, formatFechaHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import { useToastStore } from "../../store/toastStore";
import { SiWhatsapp } from "react-icons/si";
import { UserX, UserCheck, Eye, Users } from "lucide-react";
import Select from "../../components/ui/Select";
import EmptyState from "../../components/ui/EmptyState";
import BotonAccion, { AccionesPagina } from "../../components/ui/BotonAccion";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal, TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";

type TabClientes = "todos" | "activos" | "inactivos";
const TAMANO = TAMANO_PAGINA;
const OPCIONES_DIAS = [30, 60, 90, 180] as const;
/** Tope del análisis de actividad: es un filtro de cliente sobre una sola página. */
const TAMANO_ACTIVIDAD = 500;

export default function ClientesPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabClientes>("todos");
  const [buscarActivo, setBuscarActivo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [clienteSel, setClienteSel] = useState<ClienteDto | null>(null);
  const [notas, setNotas] = useState("");
  const [notasGuardadas, setNotasGuardadas] = useState(false);
  const [diasInactivo, setDiasInactivo] = useState<typeof OPCIONES_DIAS[number]>(60);
  const idActividad = useId();

  const { data: paginaClientes, isLoading } = useQuery({
    queryKey: ["clientes", buscarActivo, pagina],
    queryFn: () => clientesApi.obtenerTodos(buscarActivo || undefined, pagina, TAMANO),
  });

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  const { data: baseActividad = [], isLoading: cargandoActividad } = useQuery({
    queryKey: ["clientes-actividad-base"],
    queryFn: () => clientesApi.obtenerTodos(undefined, 1, TAMANO_ACTIVIDAD),
    enabled: tab !== "todos",
    staleTime: 2 * 60 * 1000,
    select: (p) => p.datos,
  });

  const ahora = useMemo(() => new Date(), []);

  /**
   * Los tres grupos salen del mismo recorrido para que sumen siempre el total
   * analizado. "Sin visitas" no es un descarte: `ultimaCitaEn` es nulo solo
   * cuando el cliente existe en el directorio pero nunca se le agendó una cita,
   * y ese cliente no es activo (no ha venido) ni es reactivable (no hay nada a
   * qué volver, ni fecha desde la cual contar días). Va aparte y se muestra.
   */
  const { activos, inactivos, sinVisitas } = useMemo(() => {
    const umbral = ahora.getTime() - diasInactivo * 24 * 60 * 60 * 1000;
    const activos: ClienteDto[] = [];
    const inactivos: ClienteDto[] = [];
    const sinVisitas: ClienteDto[] = [];
    for (const c of baseActividad) {
      if (!c.ultimaCitaEn) sinVisitas.push(c);
      else if (new Date(c.ultimaCitaEn).getTime() < umbral) inactivos.push(c);
      else activos.push(c);
    }
    inactivos.sort((a, b) => new Date(a.ultimaCitaEn!).getTime() - new Date(b.ultimaCitaEn!).getTime());
    activos.sort((a, b) => new Date(b.ultimaCitaEn!).getTime() - new Date(a.ultimaCitaEn!).getTime());
    return { activos, inactivos, sinVisitas };
  }, [baseActividad, diasInactivo, ahora]);

  const listaActividad = tab === "activos" ? activos : inactivos;
  // Estos dos modos dibujaban los hasta 500 clientes del análisis de una sola
  // vez. Se paginan en el cliente porque el recorrido que reparte activos,
  // inactivos y sin visitas necesita el arreglo completo: los tres conteos de
  // la línea de cuadre siguen saliendo de ahí, no de la página.
  const paginaActividad = usePaginacionLocal(listaActividad);

  const formatWaPhone = (tel: string) => {
    const digits = tel.replace(/\D/g, "");
    if (digits.startsWith("52") && digits.length >= 12) return digits;
    return `52${digits}`;
  };

  const whatsappReactivacion = (c: ClienteDto) => {
    const negocioNombre = negocio?.nombre ?? "nosotros";
    const link = negocio?.slug ? `${window.location.origin}/b/${negocio.slug}` : "";
    const dias = Math.floor((ahora.getTime() - new Date(c.ultimaCitaEn!).getTime()) / (1000 * 60 * 60 * 24));
    const nombre = c.nombreCompleto.split(" ")[0];
    const msg =
      `Hola ${nombre} 👋, hace ${dias} días que no te vemos en *${negocioNombre}*.\n\n` +
      `¡Nos encantaría verte de nuevo! Reserva tu próxima cita fácilmente aquí:\n${link}\n\n` +
      `¡Te esperamos! 😊`;
    return `https://wa.me/${formatWaPhone(c.telefono)}?text=${encodeURIComponent(msg)}`;
  };

  // Auto-abrir detalle si viene clienteId en la URL (e.g. desde CitasPage)
  const clienteIdParam = searchParams.get("clienteId");
  const { data: clienteDirecto } = useQuery({
    queryKey: ["cliente-directo", clienteIdParam],
    queryFn: () => clientesApi.obtenerPorId(clienteIdParam!),
    enabled: !!clienteIdParam && !clienteSel,
  });
  useEffect(() => {
    if (clienteDirecto && !clienteSel) {
      setClienteSel(clienteDirecto);
      setNotas(clienteDirecto.notas ?? "");
      setSearchParams({}, { replace: true });
    }
  }, [clienteDirecto, clienteSel, setSearchParams]);

  const clientes = paginaClientes?.datos ?? [];
  const totalClientes = paginaClientes?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalClientes / TAMANO));

  const { data: citasCliente = [], isLoading: cargandoCitas } = useQuery({
    queryKey: ["cliente-citas", clienteSel?.id],
    queryFn: () => clientesApi.obtenerCitas(clienteSel!.id),
    enabled: !!clienteSel,
  });

  const { mutate: guardarNotas, isPending: guardandoNotas } = useMutation({
    mutationFn: () => clientesApi.actualizarNotas(clienteSel!.id, notas || null),
    onSuccess: (actualizado) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setClienteSel(actualizado);
      setNotasGuardadas(true);
      setTimeout(() => setNotasGuardadas(false), 2500);
    },
    onError: () => toast("No se pudieron guardar las notas. Intenta de nuevo.", "error"),
  });

  const abrirCliente = (c: ClienteDto) => {
    setClienteSel(c);
    setNotas(c.notas ?? "");
    setNotasGuardadas(false);
  };

  const buscarClientes = (termino: string) => { setPagina(1); setBuscarActivo(termino); };
  const limpiarBusqueda = () => { setBuscarActivo(""); setPagina(1); };

  const exportarClientes = () => {
    const enc = ["Nombre", "Teléfono", "Correo", "Total citas", "Inasistencias", "Última visita", "Cliente desde"];
    const filas = clientes.map((c) => [
      c.nombreCompleto,
      c.telefono,
      c.email ?? "",
      c.totalCitas,
      c.cantidadInasistencias,
      c.ultimaCitaEn ? new Date(c.ultimaCitaEn).toLocaleDateString("es-MX") : "",
      new Date(c.fechaCreacion).toLocaleDateString("es-MX"),
    ]);
    exportarExcel(enc, [filas], "clientes", terms.clientes);
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{terms.clientes}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Directorio, historial y notas de cada {terms.cliente.toLowerCase()}
          </p>
        </div>
        {/* El aviso ámbar se queda: no decora, advierte que el archivo no trae
            todo el directorio. Lo que cambia es el número — decía siempre "30"
            aunque la página tuviera tres filas, y a 15 por página eso pasaría
            más seguido. Ahora cuenta las filas que realmente se exportan. */}
        {tab === "todos" && clientes.length > 0 && (
          <AccionesPagina className="flex-col items-end gap-0.5">
            <BotonAccion
              variante="secundaria"
              onClick={exportarClientes}
              title={`Exporta los ${clientes.length} ${terms.clientes.toLowerCase()} de esta página, no los ${totalClientes} del directorio`}
            >
              Exportar Excel
            </BotonAccion>
            <span className="text-[10px] text-amber-500 dark:text-amber-400">
              Solo esta página: {clientes.length} de {totalClientes}
            </span>
          </AccionesPagina>
        )}
      </div>

      {/* Una sola barra para los tres modos: "Activos" e "Inactivos" acotan el
          mismo listado en vez de abrir otra sección, así que son un filtro más
          —no pestañas— y se leen en la misma fila que la búsqueda. "Actividad"
          y no "Estado": "Estado" ya nombra el estado de la cita en el resto del
          dashboard. */}
      <FiltroBarra
        etiqueta={`Filtros de ${terms.clientes.toLowerCase()}`}
        busqueda={
          tab === "todos"
            ? {
                valor: buscarActivo,
                onChange: buscarClientes,
                etiqueta: `Buscar ${terms.cliente.toLowerCase()}`,
                placeholder: "Buscar por nombre o teléfono...",
              }
            : undefined
        }
        accion={
          <div className="w-full sm:w-auto">
            <span
              id={idActividad}
              className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5"
            >
              Actividad
            </span>
            <Select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabClientes)}
              aria-labelledby={idActividad}
              className="w-full sm:w-56"
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </Select>
          </div>
        }
        campos={
          tab !== "todos"
            ? [
                {
                  tipo: "pills",
                  id: "diasActividad",
                  // El umbral es el mismo en los dos modos, pero la frase no:
                  // "Sin visitar en 30 días" describe justo lo contrario de lo
                  // que se está listando cuando el modo es Activos.
                  etiqueta: tab === "activos" ? "Con visita en los últimos" : "Sin visitar en",
                  valor: String(diasInactivo),
                  onChange: (v) => setDiasInactivo(Number(v) as typeof OPCIONES_DIAS[number]),
                  valorNeutro: "60",
                  opciones: OPCIONES_DIAS.map((d) => ({ valor: String(d), etiqueta: `${d} días` })),
                },
              ]
            : []
        }
        onLimpiar={tab === "todos" ? limpiarBusqueda : () => setDiasInactivo(60)}
      />

      {/* ── Modos de actividad: Activos / Inactivos ── */}
      {tab !== "todos" && (
        <div className="space-y-5">
          {cargandoActividad ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* El resumen va antes del listado —y también cuando el grupo
                  elegido está vacío— porque es donde cuadran las cuentas: si
                  "sin visitas" solo apareciera junto a una lista con filas, el
                  grupo se volvería invisible justo cuando más desconcierta. */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {listaActividad.length} cliente{listaActividad.length !== 1 ? "s" : ""}{" "}
                    {tab === "activos"
                      ? `con visita en los últimos ${diasInactivo} días`
                      : `sin visitar en más de ${diasInactivo} días`}
                  </p>
                  <span className="text-[10px] text-amber-500 dark:text-amber-400">
                    El análisis se realiza sobre los últimos {TAMANO_ACTIVIDAD} clientes. Si tienes más, algunos pueden no aparecer.
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  De {baseActividad.length} analizados: {activos.length} activos, {inactivos.length} inactivos
                  y {sinVisitas.length} sin visitas registradas
                  {sinVisitas.length > 0 && " (nunca se les agendó una cita, así que no cuentan en ninguno de los dos grupos)"}.
                </p>
              </div>

              {listaActividad.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                  {tab === "activos" ? (
                    <EmptyState
                      icon={<UserCheck size={40} strokeWidth={1.5} />}
                      title={`Sin ${terms.clientes.toLowerCase()} activos`}
                      description={`Ningún ${terms.cliente.toLowerCase()} ha visitado en los últimos ${diasInactivo} días`}
                    />
                  ) : (
                    <EmptyState
                      icon={<UserX size={40} strokeWidth={1.5} />}
                      title={`Sin ${terms.clientes.toLowerCase()} inactivos`}
                      description={`Todos tus ${terms.clientes.toLowerCase()} han visitado en los últimos ${diasInactivo} días`}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700">
                {paginaActividad.visibles.map((c) => {
                  const dias = Math.floor(
                    (ahora.getTime() - new Date(c.ultimaCitaEn!).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                          {c.nombreCompleto.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.nombreCompleto}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {c.telefono} · {c.totalCitas} cita{c.totalCitas !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {tab === "activos" ? (
                        // Fecha y no "hace N días": `ultimaCitaEn` guarda el
                        // inicio de la última cita agendada, que puede estar en
                        // el futuro, y entonces el conteo saldría en negativo.
                        // Formato corto: la fecha larga se come el ancho del
                        // nombre en móvil.
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatFechaCorta(c.ultimaCitaEn!)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">última cita</p>
                        </div>
                      ) : (
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-sm font-bold text-amber-500">{dias} días</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">sin visitar</p>
                        </div>
                      )}
                      {tab === "inactivos" && c.telefono && (
                        <a
                          href={whatsappReactivacion(c)}
                          target="_blank"
                          rel="noreferrer"
                          title={`Enviar mensaje de reactivación a ${c.nombreCompleto}`}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs font-semibold rounded-lg transition"
                        >
                          <SiWhatsapp size={13} />
                          Reactivar
                        </a>
                      )}
                    </div>
                  );
                })}
                <Pagination
                  pagina={paginaActividad.pagina}
                  totalPaginas={paginaActividad.totalPaginas}
                  total={paginaActividad.total}
                  labelTotal={terms.clientes.toLowerCase()}
                  onCambiar={paginaActividad.setPagina}
                  cargando={cargandoActividad}
                />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Todos ── */}
      {tab === "todos" && (<>
      {/* Lista */}
      {isLoading ? (
        <p className="text-gray-400 dark:text-gray-500">Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
          {buscarActivo ? (
            <EmptyState
              variante="sinResultados"
              title="Sin resultados"
              description={`No hay ${terms.clientes.toLowerCase()} que coincidan con tu búsqueda`}
              onLimpiarFiltros={limpiarBusqueda}
              labelLimpiarFiltros={`Ver todos los ${terms.clientes.toLowerCase()}`}
            />
          ) : (
            <EmptyState
              icon={<Users size={40} strokeWidth={1.5} />}
              title={`Aún no hay ${terms.clientes.toLowerCase()}`}
              description={`Los ${terms.clientes.toLowerCase()} aparecerán aquí automáticamente cuando hagan su primera reserva`}
            />
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3 dark:text-gray-500">{totalClientes} {totalClientes !== 1 ? terms.clientes.toLowerCase() : terms.cliente.toLowerCase()}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto dark:bg-slate-800 dark:border-slate-700">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide dark:border-slate-700 dark:text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">{terms.cliente}</th>
                  <th className="text-left px-5 py-3 font-medium">Contacto</th>
                  <th className="text-center px-5 py-3 font-medium">{terms.citas}</th>
                  <th className="text-center px-5 py-3 font-medium">Inasistencias</th>
                  <th className="text-left px-5 py-3 font-medium">Última visita</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition dark:border-slate-700 dark:hover:bg-slate-700">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-700">
                            {c.nombreCompleto.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{c.nombreCompleto}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{c.telefono}</p>
                      {c.email && <p className="text-xs text-gray-400 dark:text-gray-500">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{c.totalCitas}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {c.cantidadInasistencias > 0 ? (
                        <span className="font-medium text-red-500">{c.cantidadInasistencias}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-sm dark:text-gray-400">
                      {c.ultimaCitaEn ? formatFecha(c.ultimaCitaEn) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => abrirCliente(c)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-700/10 text-slate-700 hover:bg-slate-700/20 dark:bg-slate-600/30 dark:text-slate-300 dark:hover:bg-slate-600/50 dark:border dark:border-slate-500 transition"
                      >
                        <Eye size={13} />
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          <Pagination
            pagina={pagina}
            totalPaginas={totalPaginas}
            total={totalClientes}
            labelTotal="clientes"
            onCambiar={setPagina}
            cargando={isLoading}
          />
          </div>
        </>
      )}

      </>)}

      {/* Modal detalle cliente */}
      <Modal
        abierto={!!clienteSel}
        onCerrar={() => setClienteSel(null)}
        titulo={clienteSel?.nombreCompleto ?? ""}
      >
        {clienteSel && (
          <div className="space-y-5">
            {/* Info básica */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                <p className="text-xs text-gray-400 mb-0.5 dark:text-gray-500">Teléfono</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{clienteSel.telefono}</p>
              </div>
              {clienteSel.email && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                  <p className="text-xs text-gray-400 mb-0.5 dark:text-gray-500">Correo</p>
                  <p className="font-medium text-gray-800 truncate dark:text-gray-200">{clienteSel.email}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                <p className="text-xs text-gray-400 mb-0.5 dark:text-gray-500">Total citas</p>
                <p className="font-bold text-gray-800 text-lg dark:text-gray-200">{clienteSel.totalCitas}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                <p className="text-xs text-gray-400 mb-0.5 dark:text-gray-500">Inasistencias</p>
                <p className={`font-bold text-lg ${clienteSel.cantidadInasistencias > 0 ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>
                  {clienteSel.cantidadInasistencias}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 col-span-2 dark:bg-slate-700">
                <p className="text-xs text-gray-400 mb-0.5 dark:text-gray-500">{`${terms.cliente} desde`}</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{formatFecha(clienteSel.fechaCreacion)}</p>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Notas internas
                <span className="text-gray-400 font-normal ml-1 dark:text-gray-500">(solo visible para ti)</span>
              </label>
              <textarea
                value={notas}
                onChange={(e) => { setNotas(e.target.value); setNotasGuardadas(false); }}
                rows={3}
                placeholder="Preferencias, alergias, observaciones..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
              />
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => guardarNotas()}
                  disabled={guardandoNotas || notas === (clienteSel.notas ?? "")}
                  className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition"
                >
                  {guardandoNotas ? "Guardando..." : "Guardar notas"}
                </button>
                {notasGuardadas && (
                  <span className="text-xs text-green-600 font-medium">¡Guardado!</span>
                )}
              </div>
            </div>

            {/* Historial citas */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300">Historial de citas</p>
              {cargandoCitas ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Cargando historial...</p>
              ) : citasCliente.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Sin citas registradas</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {citasCliente.map((cita) => (
                    <div key={cita.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate dark:text-gray-200">{cita.nombreServicio}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {cita.nombreEmpleado} · {formatFechaHora(cita.inicioEn)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatPrecio(cita.precio)}</span>
                        <EstadoBadge estado={cita.estadoTexto} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
