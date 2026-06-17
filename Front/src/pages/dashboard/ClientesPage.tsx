import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientesApi } from "../../api/clientes";
import Modal from "../../components/ui/Modal";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { exportarExcel } from "../../utils/exportarExcel";
import type { ClienteDto } from "../../types";
import { formatPrecio, formatFecha, formatFechaHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import { useToastStore } from "../../store/toastStore";

const TAMANO = 30;

export default function ClientesPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [buscar, setBuscar] = useState("");
  const [buscarActivo, setBuscarActivo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [clienteSel, setClienteSel] = useState<ClienteDto | null>(null);
  const [notas, setNotas] = useState("");
  const [notasGuardadas, setNotasGuardadas] = useState(false);

  const { data: paginaClientes, isLoading } = useQuery({
    queryKey: ["clientes", buscarActivo, pagina],
    queryFn: () => clientesApi.obtenerTodos(buscarActivo || undefined, pagina, TAMANO),
  });

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
    exportarExcel(enc, [filas], "clientes", "Clientes");
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        {clientes.length > 0 && (
          <button
            onClick={exportarClientes}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
          >
            Exportar Excel
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscarClientes()}
          placeholder="Buscar por nombre o teléfono..."
          className="flex-1 max-w-sm px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
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
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-gray-400">Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          {buscarActivo ? (
            <>
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="font-medium text-gray-700 mb-1">Sin resultados</p>
              <p className="text-sm text-gray-400 mb-4">No hay clientes que coincidan con tu búsqueda</p>
              <button
                onClick={() => { setBuscar(""); setBuscarActivo(""); setPagina(1); }}
                className="text-slate-700 text-sm font-medium hover:underline"
              >
                Ver todos los clientes
              </button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="font-medium text-gray-700 mb-1">Aún no hay clientes</p>
              <p className="text-sm text-gray-400">Los clientes aparecerán aquí automáticamente cuando hagan su primera reserva</p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{totalClientes} cliente{totalClientes !== 1 ? "s" : ""}</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Contacto</th>
                  <th className="text-center px-5 py-3 font-medium">Citas</th>
                  <th className="text-center px-5 py-3 font-medium">Inasistencias</th>
                  <th className="text-left px-5 py-3 font-medium">Última visita</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-700">
                            {c.nombreCompleto.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="font-medium text-gray-800">{c.nombreCompleto}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-gray-700">{c.telefono}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-semibold text-gray-800">{c.totalCitas}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {c.cantidadInasistencias > 0 ? (
                        <span className="font-medium text-red-500">{c.cantidadInasistencias}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-sm">
                      {c.ultimaCitaEn ? formatFecha(c.ultimaCitaEn) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => abrirCliente(c)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-700/10 text-slate-700 hover:bg-slate-700/20 transition"
                      >
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
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
                <p className="font-medium text-gray-800">{clienteSel.telefono}</p>
              </div>
              {clienteSel.email && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">Correo</p>
                  <p className="font-medium text-gray-800 truncate">{clienteSel.email}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Total citas</p>
                <p className="font-bold text-gray-800 text-lg">{clienteSel.totalCitas}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Inasistencias</p>
                <p className={`font-bold text-lg ${clienteSel.cantidadInasistencias > 0 ? "text-red-500" : "text-gray-800"}`}>
                  {clienteSel.cantidadInasistencias}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Cliente desde</p>
                <p className="font-medium text-gray-800">{formatFecha(clienteSel.fechaCreacion)}</p>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas internas
                <span className="text-gray-400 font-normal ml-1">(solo visible para ti)</span>
              </label>
              <textarea
                value={notas}
                onChange={(e) => { setNotas(e.target.value); setNotasGuardadas(false); }}
                rows={3}
                placeholder="Preferencias, alergias, observaciones..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none"
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
              <p className="text-sm font-semibold text-gray-700 mb-2">Historial de citas</p>
              {cargandoCitas ? (
                <p className="text-sm text-gray-400">Cargando historial...</p>
              ) : citasCliente.length === 0 ? (
                <p className="text-sm text-gray-400">Sin citas registradas</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {citasCliente.map((cita) => (
                    <div key={cita.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{cita.nombreServicio}</p>
                        <p className="text-xs text-gray-400">
                          {cita.nombreEmpleado} · {formatFechaHora(cita.inicioEn)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-gray-700">{formatPrecio(cita.precio)}</span>
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
