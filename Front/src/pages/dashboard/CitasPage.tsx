import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { citasApi, ESTADOS, METODOS_PAGO } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { api } from "../../api/axios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import Modal from "../../components/ui/Modal";
import CalendarioCitas from "../../components/dashboard/CalendarioCitas";
import { useToastStore } from "../../store/toastStore";
import type { CitaDto, SlotDisponible } from "../../types";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { Tooltip } from "../../components/ui/Tooltip";

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const METODO_ICONO: Record<string, string> = {
  Efectivo: "💵",
  Tarjeta: "💳",
  Transferencia: "🏦",
};

const TRANSICIONES: Record<string, { label: string; estado: number; clase: string }[]> = {
  Pendiente: [
    { label: "Confirmar",    estado: ESTADOS.Confirmada,   clase: "bg-green-500 text-white" },
    { label: "Cancelar",     estado: ESTADOS.Cancelada,    clase: "bg-red-500 text-white" },
  ],
  Confirmada: [
    { label: "Completar",    estado: ESTADOS.Completada,   clase: "bg-blue-500 text-white" },
    { label: "Inasistencia", estado: ESTADOS.Inasistencia, clase: "bg-gray-500 text-white" },
    { label: "Cancelar",     estado: ESTADOS.Cancelada,    clase: "bg-red-500 text-white" },
  ],
};

export default function CitasPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [desde, setDesde] = useState(() => new Date().toISOString().split("T")[0]);
  const [hasta, setHasta] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const TAMANO = 50;

  // Modal cambiar estado
  const [citaSel, setCitaSel] = useState<CitaDto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [nuevoEstado, setNuevoEstado] = useState<number | null>(null);

  // Modal reagendar
  const [citaReag, setCitaReag] = useState<CitaDto | null>(null);
  const [fechaReag, setFechaReag] = useState("");
  const [slotReag, setSlotReag] = useState("");

  // Modal pago
  const [citaPago, setCitaPago] = useState<CitaDto | null>(null);
  const [metodoPagoSel, setMetodoPagoSel] = useState<string>("");

  // Modal notas
  const [citaNotas, setCitaNotas] = useState<CitaDto | null>(null);
  const [notasTexto, setNotasTexto] = useState("");

  // Modal nueva cita
  const [modalNueva, setModalNueva] = useState(false);
  const [pasoCita, setPasoCita] = useState<1 | 2>(1);
  const [svcSel, setSvcSel] = useState("");
  const [empSel, setEmpSel] = useState("");
  const [fechaNueva, setFechaNueva] = useState("");
  const [slotNuevo, setSlotNuevo] = useState("");
  const [fCliente, setFCliente] = useState({ nombre: "", telefono: "", email: "", notas: "" });

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: pagCitas, isLoading } = useQuery({
    queryKey: ["citas", desde, hasta, empleadoId, pagina],
    queryFn: () => citasApi.obtenerTodas({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
      pagina,
      tamano: TAMANO,
    }),
    enabled: vista === "lista",
    placeholderData: (prev) => prev,
  });
  const citas = pagCitas?.datos ?? [];
  const totalCitas = pagCitas?.total ?? 0;
  const totalPaginas = Math.ceil(totalCitas / TAMANO) || 1;

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios"],
    queryFn: serviciosApi.obtenerTodos,
  });

  const empleadosFiltrados = svcSel
    ? empleados.filter((e) => e.servicioIds.includes(svcSel) && e.activo)
    : empleados.filter((e) => e.activo);

  const { data: slotsNueva = [], isFetching: cargandoSlotsNueva } = useQuery({
    queryKey: ["slots-nueva", svcSel, empSel, fechaNueva],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: svcSel, empleadoId: empSel, fecha: fechaNueva },
      });
      return data;
    },
    enabled: !!svcSel && !!empSel && !!fechaNueva,
  });

  const { data: slotsReag = [], isFetching: cargandoSlots } = useQuery({
    queryKey: ["slots-reag", citaReag?.id, fechaReag],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: citaReag!.servicioId, empleadoId: citaReag!.empleadoId, fecha: fechaReag },
      });
      return data;
    },
    enabled: !!citaReag && !!fechaReag,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: reagendar, isPending: reagendando } = useMutation({
    mutationFn: ({ id, inicioEn }: { id: string; inicioEn: string }) =>
      citasApi.reagendar(id, inicioEn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaReag(null); setFechaReag(""); setSlotReag("");
      toast("Cita reagendada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo reagendar la cita";
      toast(msg);
    },
  });

  const { mutate: marcarPagada, isPending: guardandoPago } = useMutation({
    mutationFn: ({ id, pagada, metodo }: { id: string; pagada: boolean; metodo?: string }) =>
      citasApi.marcarPagada(id, pagada, metodo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaPago(null);
      setMetodoPagoSel("");
      toast("Estado de pago actualizado");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo actualizar el pago";
      toast(msg);
    },
  });

  const { mutate: crearCita, isPending: creando } = useMutation({
    mutationFn: () => citasApi.crear({
      servicioId: svcSel,
      empleadoId: empSel,
      inicioEn: slotNuevo,
      nombreCliente: fCliente.nombre.trim(),
      telefonoCliente: fCliente.telefono.trim(),
      emailCliente: fCliente.email.trim() || undefined,
      notas: fCliente.notas.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setModalNueva(false);
      setPasoCita(1);
      setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
      setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
      toast("Cita creada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo crear la cita";
      toast(msg);
    },
  });

  const abrirNuevaCita = () => {
    setModalNueva(true);
    setPasoCita(1);
    setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
    setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
  };

  const { mutate: actualizarNotas, isPending: guardandoNotas } = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas: string | null }) =>
      citasApi.actualizarNotas(id, notas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaNotas(null);
      setNotasTexto("");
      toast("Notas guardadas");
    },
  });

  const { mutate: cambiarEstado, isPending } = useMutation({
    mutationFn: ({ id, estado, mot }: { id: string; estado: number; mot: string }) =>
      citasApi.cambiarEstado(id, { nuevoEstado: estado, motivo: mot || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaSel(null); setNuevoEstado(null); setMotivo("");
      toast("Estado actualizado");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo cambiar el estado";
      toast(msg);
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const abrirReagendar = (c: CitaDto) => { setCitaReag(c); setFechaReag(""); setSlotReag(""); };
  const abrirCambioEstado = (c: CitaDto) => { setCitaSel(c); setNuevoEstado(null); setMotivo(""); };

  const abrirPago = (c: CitaDto) => {
    setCitaPago(c);
    setMetodoPagoSel(c.metodoPago ?? "");
  };

  const abrirNotas = (c: CitaDto) => {
    setCitaNotas(c);
    setNotasTexto(c.notas ?? "");
  };

  const accionesCita = citaSel ? TRANSICIONES[citaSel.estadoTexto] ?? [] : [];

  const citasFiltradas = busqueda.trim()
    ? citas.filter((c) => {
        const q = busqueda.toLowerCase();
        return c.nombreCliente.toLowerCase().includes(q) || c.telefonoCliente.includes(q);
      })
    : citas;

  // ── CSV export ───────────────────────────────────────────────────────────────
  const exportarCSV = () => {
    const encabezado = ["Fecha", "Cliente", "Teléfono", "Servicio", "Profesional", "Precio", "Estado", "Pagada", "Método pago", "Notas"];
    const filas = citasFiltradas.map((c) => [
      new Date(c.inicioEn).toLocaleString("es-MX"),
      c.nombreCliente,
      c.telefonoCliente,
      c.nombreServicio,
      c.nombreEmpleado,
      c.precio.toFixed(2),
      c.estadoTexto,
      c.pagada ? "Sí" : "No",
      c.metodoPago ?? "",
      c.notas ?? "",
    ]);
    const csv = [encabezado, ...filas]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
          {citasFiltradas.length > 0 && vista === "lista" && (
            <button
              onClick={exportarCSV}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
            >
              Exportar CSV
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirNuevaCita}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition"
          >
            + Nueva cita
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setVista("lista")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                vista === "lista" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setVista("calendario")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                vista === "calendario" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Calendario
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap items-end">
        {vista === "lista" && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Buscar cliente</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o teléfono..."
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary w-44"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary" />
            </div>
          </>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Profesional</label>
          <select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setPagina(1); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary bg-white">
            <option value="">Todos</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        {vista === "lista" && (desde || hasta || empleadoId || busqueda) && (
          <button onClick={() => { setDesde(""); setHasta(""); setEmpleadoId(""); setBusqueda(""); setPagina(1); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Vista calendario */}
      {vista === "calendario" && (
        <CalendarioCitas empleadoId={empleadoId} onCitaClick={abrirCambioEstado} />
      )}

      {/* Vista lista */}
      {vista === "lista" && (
        isLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <tbody><SkeletonTableRows filas={6} columnas={8} /></tbody>
            </table>
          </div>
        ) : citasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400">No hay citas con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Servicio</th>
                  <th className="text-left px-5 py-3 font-medium">Profesional</th>
                  <th className="text-left px-5 py-3 font-medium">Fecha y hora</th>
                  <th className="text-right px-5 py-3 font-medium">Precio</th>
                  <th className="text-center px-5 py-3 font-medium">Pago</th>
                  <th className="text-center px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {citasFiltradas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{c.nombreCliente}</p>
                      <p className="text-xs text-gray-400">{c.telefonoCliente}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{c.nombreServicio}</td>
                    <td className="px-5 py-3 text-gray-700">{c.nombreEmpleado}</td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{formatFechaHora(c.inicioEn)}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800">{formatPrecio(c.precio)}</td>

                    {/* Columna de pago */}
                    <td className="px-5 py-3 text-center">
                      <Tooltip text={c.pagada ? "Ver detalle o revertir el pago" : "Registrar el pago de esta cita"}>
                        <button
                          onClick={() => abrirPago(c)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition ${
                            c.pagada
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {c.pagada
                            ? `✓ ${c.metodoPago ?? "Pagado"}`
                            : "Cobrar"}
                        </button>
                      </Tooltip>
                    </td>

                    <td className="px-5 py-3 text-center"><EstadoBadge estado={c.estadoTexto} /></td>

                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {/* Indicador de notas */}
                        <Tooltip text={c.notas ? "Ver o editar notas internas" : "Agregar una nota interna"}>
                          <button
                            onClick={() => abrirNotas(c)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition ${
                              c.notas
                                ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            📝
                          </button>
                        </Tooltip>
                        {(c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada") && (
                          <button
                            onClick={() => abrirReagendar(c)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition"
                          >
                            Reagendar
                          </button>
                        )}
                        {TRANSICIONES[c.estadoTexto] && (
                          <button
                            onClick={() => abrirCambioEstado(c)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                          >
                            Estado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
                <span>{totalCitas} citas · página {pagina} de {totalPaginas}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
                  >
                    ← Anterior
                  </button>
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
                    const num = inicio + i;
                    return (
                      <button
                        key={num}
                        onClick={() => setPagina(num)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                          num === pagina ? "bg-primary text-white" : "hover:bg-gray-50 border border-gray-200"
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Modal: Registrar / revertir pago ── */}
      <Modal abierto={!!citaPago} onCerrar={() => setCitaPago(null)} titulo="Pago de la cita" ancho="sm">
        {citaPago && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaPago.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaPago.nombreServicio}</span></p>
              <p><span className="text-gray-500">Total:</span> <span className="font-bold text-gray-900">{formatPrecio(citaPago.precio)}</span></p>
            </div>

            {citaPago.pagada ? (
              /* Ya pagada — mostrar info y opción de revertir */
              <>
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <span className="text-green-600 text-lg">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-green-700">Pago registrado</p>
                    {citaPago.metodoPago && (
                      <p className="text-xs text-green-600">
                        {METODO_ICONO[citaPago.metodoPago] ?? ""} {citaPago.metodoPago}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => marcarPagada({ id: citaPago.id, pagada: false })}
                  disabled={guardandoPago}
                  className="w-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 font-medium py-2.5 rounded-xl text-sm transition"
                >
                  {guardandoPago ? "Guardando..." : "Revertir pago"}
                </button>
              </>
            ) : (
              /* No pagada — seleccionar método */
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">¿Con qué método se pagó?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {METODOS_PAGO.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetodoPagoSel(m)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-medium transition ${
                          metodoPagoSel === m
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-xl">{METODO_ICONO[m]}</span>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => metodoPagoSel && marcarPagada({ id: citaPago.id, pagada: true, metodo: metodoPagoSel })}
                  disabled={!metodoPagoSel || guardandoPago}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
                >
                  {guardandoPago ? "Guardando..." : "Confirmar pago"}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal: Notas internas ── */}
      <Modal abierto={!!citaNotas} onCerrar={() => setCitaNotas(null)} titulo="Nota interna" ancho="sm">
        {citaNotas && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaNotas.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaNotas.nombreServicio}</span></p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Nota interna <span className="text-gray-400">(solo visible para el negocio)</span>
              </label>
              <textarea
                value={notasTexto}
                onChange={(e) => setNotasTexto(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Preferencias del cliente, indicaciones especiales, alergias..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{notasTexto.length}/1000</p>
            </div>
            <div className="flex gap-2">
              {citaNotas.notas && (
                <button
                  onClick={() => actualizarNotas({ id: citaNotas.id, notas: null })}
                  disabled={guardandoNotas}
                  className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-xl text-sm transition"
                >
                  Eliminar nota
                </button>
              )}
              <button
                onClick={() => actualizarNotas({ id: citaNotas.id, notas: notasTexto || null })}
                disabled={guardandoNotas || notasTexto === (citaNotas.notas ?? "")}
                className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {guardandoNotas ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Nueva cita ── */}
      <Modal abierto={modalNueva} onCerrar={() => setModalNueva(false)} titulo="Nueva cita" ancho="sm">
        {/* Paso 1 — Servicio, empleado, fecha, slot */}
        {pasoCita === 1 && (
          <div className="space-y-4">
            {/* Servicio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
              <select
                value={svcSel}
                onChange={(e) => { setSvcSel(e.target.value); setEmpSel(""); setFechaNueva(""); setSlotNuevo(""); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary bg-white"
              >
                <option value="">— Selecciona un servicio —</option>
                {servicios.filter((s) => s.activo).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {s.duracionMinutos} min · {formatPrecio(s.precio)}
                  </option>
                ))}
              </select>
            </div>

            {/* Empleado */}
            {svcSel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profesional</label>
                {empleadosFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-400">Ningún empleado ofrece este servicio</p>
                ) : (
                  <select
                    value={empSel}
                    onChange={(e) => { setEmpSel(e.target.value); setFechaNueva(""); setSlotNuevo(""); }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary bg-white"
                  >
                    <option value="">— Selecciona un profesional —</option>
                    {empleadosFiltrados.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Fecha */}
            {svcSel && empSel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaNueva}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => { setFechaNueva(e.target.value); setSlotNuevo(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
                />
              </div>
            )}

            {/* Slots */}
            {svcSel && empSel && fechaNueva && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Horario disponible</label>
                {cargandoSlotsNueva ? (
                  <p className="text-sm text-gray-400">Cargando horarios...</p>
                ) : slotsNueva.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {slotsNueva.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotNuevo(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotNuevo === s.inicio
                            ? "bg-primary text-white border-primary"
                            : "border-gray-200 text-gray-700 hover:border-primary"
                        }`}
                      >
                        {s.horaTexto}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => slotNuevo && setPasoCita(2)}
              disabled={!slotNuevo}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* Paso 2 — Datos del cliente */}
        {pasoCita === 2 && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{servicios.find((s) => s.id === svcSel)?.nombre}</span></p>
              <p><span className="text-gray-500">Profesional:</span> <span className="font-medium">{empleados.find((e) => e.id === empSel)?.nombre}</span></p>
              <p><span className="text-gray-500">Hora:</span> <span className="font-medium capitalize">{slotNuevo ? formatFechaHora(slotNuevo) : ""}</span></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={fCliente.nombre}
                onChange={(e) => setFCliente((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-red-400">*</span></label>
              <input
                type="tel"
                value={fCliente.telefono}
                onChange={(e) => setFCliente((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="10 dígitos"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(opcional — para recordatorio)</span>
              </label>
              <input
                type="email"
                value={fCliente.email}
                onChange={(e) => setFCliente((p) => ({ ...p, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nota interna <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={fCliente.notas}
                onChange={(e) => setFCliente((p) => ({ ...p, notas: e.target.value }))}
                rows={2}
                placeholder="Preferencias, indicaciones..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPasoCita(1)}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition"
              >
                ← Atrás
              </button>
              <button
                onClick={() => crearCita()}
                disabled={!fCliente.nombre.trim() || !fCliente.telefono.trim() || creando}
                className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {creando ? "Creando..." : "Crear cita"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Reagendar ── */}
      <Modal abierto={!!citaReag} onCerrar={() => setCitaReag(null)} titulo="Reagendar cita" ancho="sm">
        {citaReag && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaReag.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaReag.nombreServicio}</span></p>
              <p><span className="text-gray-500">Actual:</span> <span className="font-medium capitalize">{formatFechaHora(citaReag.inicioEn)}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha</label>
              <input
                type="date"
                value={fechaReag}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => { setFechaReag(e.target.value); setSlotReag(""); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
            {fechaReag && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo horario</label>
                {cargandoSlots ? (
                  <p className="text-sm text-gray-400">Cargando horarios disponibles...</p>
                ) : slotsReag.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {slotsReag.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotReag(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotReag === s.inicio
                            ? "bg-violet-600 text-white border-violet-600"
                            : "border-gray-200 text-gray-700 hover:border-violet-400"
                        }`}
                      >
                        {s.horaTexto}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => slotReag && reagendar({ id: citaReag.id, inicioEn: slotReag })}
              disabled={!slotReag || reagendando}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
            >
              {reagendando ? "Reagendando..." : "Confirmar reagendado"}
            </button>
          </div>
        )}
      </Modal>

      {/* ── Modal: Cambiar estado ── */}
      <Modal abierto={!!citaSel} onCerrar={() => setCitaSel(null)} titulo="Cambiar estado de la cita" ancho="sm">
        {citaSel && (
          <div>
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaSel.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaSel.nombreServicio}</span></p>
              <p><span className="text-gray-500">Hora:</span> <span className="font-medium capitalize">{formatFechaHora(citaSel.inicioEn)}</span></p>
              <p><span className="text-gray-500">Estado actual:</span> <span className="font-medium">{citaSel.estadoTexto}</span></p>
            </div>
            {accionesCita.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">Esta cita no puede cambiar de estado.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 mb-3">Selecciona el nuevo estado:</p>
                <div className="space-y-2 mb-4">
                  {accionesCita.map((acc) => (
                    <button key={acc.estado} onClick={() => setNuevoEstado(acc.estado)}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition border-2 ${
                        nuevoEstado === acc.estado
                          ? "border-gray-800 " + acc.clase
                          : "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}>
                      {acc.label}
                    </button>
                  ))}
                </div>
                {(nuevoEstado === ESTADOS.Cancelada || nuevoEstado === ESTADOS.Inasistencia) && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                      rows={2} placeholder="Motivo de la cancelación..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none" />
                  </div>
                )}
                <button
                  onClick={() => nuevoEstado && cambiarEstado({ id: citaSel.id, estado: nuevoEstado, mot: motivo })}
                  disabled={!nuevoEstado || isPending}
                  className="w-full bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition">
                  {isPending ? "Guardando..." : "Confirmar cambio"}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
