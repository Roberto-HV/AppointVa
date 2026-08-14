import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientesApi } from "../../api/clientes";
import { negociosApi } from "../../api/negocios";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import Modal from "../../components/ui/Modal";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { exportarExcel } from "../../utils/exportarExcel";
import type { ClienteDto } from "../../types";
import { formatPrecio, formatFecha, formatFechaHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import { useToastStore } from "../../store/toastStore";
import { SiWhatsapp } from "react-icons/si";
import { UserX, Eye } from "lucide-react";

type TabClientes = "todos" | "inactivos";
const TAMANO = 30;
const OPCIONES_DIAS = [30, 60, 90, 180] as const;

export default function ClientesPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabClientes>("todos");
  const [buscar, setBuscar] = useState("");
  const [buscarActivo, setBuscarActivo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [clienteSel, setClienteSel] = useState<ClienteDto | null>(null);
  const [notas, setNotas] = useState("");
  const [notasGuardadas, setNotasGuardadas] = useState(false);
  const [diasInactivo, setDiasInactivo] = useState<typeof OPCIONES_DIAS[number]>(60);

  const { data: paginaClientes, isLoading } = useQuery({
    queryKey: ["clientes", buscarActivo, pagina],
    queryFn: () => clientesApi.obtenerTodos(buscarActivo || undefined, pagina, TAMANO),
  });

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  const { data: todosParaInactivos = [], isLoading: cargandoInactivos } = useQuery({
    queryKey: ["clientes-inactivos-base"],
    queryFn: () => clientesApi.obtenerTodos(undefined, 1, 500),
    enabled: tab === "inactivos",
    staleTime: 2 * 60 * 1000,
    select: (p) => p.datos,
  });

  const ahora = useMemo(() => new Date(), []);

  const clientesInactivos = useMemo(() => {
    const umbral = new Date(ahora.getTime() - diasInactivo * 24 * 60 * 60 * 1000);
    return todosParaInactivos
      .filter((c) => c.ultimaCitaEn && new Date(c.ultimaCitaEn) < umbral)
      .sort((a, b) => new Date(a.ultimaCitaEn!).getTime() - new Date(b.ultimaCitaEn!).getTime());
  }, [todosParaInactivos, diasInactivo, ahora]);

  const whatsappReactivacion = (c: ClienteDto) => {
    const tel = c.telefono.replace(/\D/g, "");
    const negocioNombre = negocio?.nombre ?? "nosotros";
    const link = negocio?.slug ? `${window.location.origin}/b/${negocio.slug}` : "";
    const dias = Math.floor((ahora.getTime() - new Date(c.ultimaCitaEn!).getTime()) / (1000 * 60 * 60 * 24));
    const nombre = c.nombreCompleto.split(" ")[0];
    const msg =
      `Hola ${nombre} 👋, hace ${dias} días que no te vemos en *${negocioNombre}*.\n\n` +
      `¡Nos encantaría verte de nuevo! Reserva tu próxima cita fácilmente aquí:\n${link}\n\n` +
      `¡Te esperamos! 😊`;
    return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
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
  }, [clienteDirecto]);

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

  const buscarClientes = () => { setPagina(1); setBuscarActivo(buscar); };

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{terms.clientes}</h1>
        {tab === "todos" && clientes.length > 0 && (
          <button
            onClick={exportarClientes}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition dark:text-gray-400 dark:border-slate-600"
          >
            Exportar Excel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1 gap-1 mb-6">
        {([["todos", "Todos"], ["inactivos", "Inactivos"]] as [TabClientes, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
              tab === key
                ? "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Inactivos ── */}
      {tab === "inactivos" && (
        <div className="space-y-5">
          {/* Selector de días */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Sin visitar en:</span>
            <div className="flex gap-1">
              {OPCIONES_DIAS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDiasInactivo(d)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                    diasInactivo === d
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                  }`}
                >
                  {d} días
                </button>
              ))}
            </div>
          </div>

          {cargandoInactivos ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : clientesInactivos.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center">
              <UserX size={36} className="mx-auto mb-3 text-gray-300 dark:text-slate-600" />
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sin clientes inactivos
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Todos tus clientes han visitado en los últimos {diasInactivo} días
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {clientesInactivos.length} cliente{clientesInactivos.length !== 1 ? "s" : ""} sin visitar en más de {diasInactivo} días
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-700">
                {clientesInactivos.map((c) => {
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
                      <div className="text-right shrink-0 mr-2">
                        <p className="text-sm font-bold text-amber-500">{dias} días</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">sin visitar</p>
                      </div>
                      {c.telefono && (
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
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Todos ── */}
      {tab === "todos" && (<>
      {/* Buscador */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscarClientes()}
          placeholder="Buscar por nombre o teléfono..."
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
        />
        <button
          onClick={buscarClientes}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition"
        >
          Buscar
        </button>
        {buscarActivo && (
          <button
            onClick={() => { setBuscar(""); setBuscarActivo(""); setPagina(1); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-gray-400 dark:text-gray-500">Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center dark:bg-slate-800 dark:border-slate-700">
          {buscarActivo ? (
            <>
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-700">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="font-medium text-gray-700 mb-1 dark:text-gray-300">Sin resultados</p>
              <p className="text-sm text-gray-400 mb-4 dark:text-gray-500">No hay clientes que coincidan con tu búsqueda</p>
              <button
                onClick={() => { setBuscar(""); setBuscarActivo(""); setPagina(1); }}
                className="text-slate-700 text-sm font-medium hover:underline"
              >
                Ver todos los clientes
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-700">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="font-medium text-gray-700 mb-1 dark:text-gray-300">{`Aún no hay ${terms.clientes.toLowerCase()}`}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">{`Los ${terms.clientes.toLowerCase()} aparecerán aquí automáticamente cuando hagan su primera reserva`}</p>
            </>
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
