import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSectorTerms, useSector } from "../../hooks/useSectorTerms";
import { tonoDeSector } from "../../lib/vozVacia";

import { hoy, inicioSemana, finSemana, inicioMes, finMes } from "../../utils/fechas";
import { CheckCircle2, RotateCcw, StickyNote, Receipt, Banknote, Star, Pencil, AlertTriangle, Monitor } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { citasApi, ESTADOS } from "../../api/citas";
import Tabs from "../../components/ui/Tabs";
import EmptyState from "../../components/ui/EmptyState";
import { FiltroBarra, campoActivo, type CampoFiltro } from "../../components/ui/filtros";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { negociosApi } from "../../api/negocios";
import { api } from "../../api/axios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import Modal from "../../components/ui/Modal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import AccionesCita, { HojaAccionesCita, type AccionExtraCita, type VistaHoja } from "../../components/dashboard/AccionesCita";
import TarjetaCita, { InsigniasCita } from "../../components/dashboard/TarjetaCita";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { invalidarCitas, useReagendarCita } from "../../hooks/useMutacionesCita";
import { urlResenaWhatsApp } from "../../utils/whatsapp";
import { DatePicker } from "../../components/ui/DateTimePicker";
import CalendarioCitas from "../../components/dashboard/CalendarioCitas";
import GanttCitas from "../../components/dashboard/GanttCitas";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import { useToastStore } from "../../store/toastStore";
import type { CitaDto, SlotDisponible } from "../../types";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { reportesApi } from "../../api/reportes";
import { formatPrecio, formatFechaHoraCorta as formatFechaHora, formatFechaCorta, formatHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import BotonAccion, { EnlaceAccion } from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";
import { leerParamsCitas } from "../../lib/paramsCitas";
import { mensajeError } from "../../utils/errores";
import { isAxiosError } from "axios";
import { z } from "zod";
import { usePermisos } from "../../hooks/usePermisos";
import { confirmarEnLote, resumenLote } from "../../lib/confirmarEnLote";


type VistaCitas = "lista" | "calendario" | "gantt";
const ESTADOS_FILTRO = ["Pendiente", "Confirmada", "Completada", "Cancelada", "Inasistencia"];

/**
 * `POST /citas` exige `TelefonoCliente` (`[Required]`, máx. 20): el teléfono
 * identifica al cliente del negocio, así que no puede ir vacío.
 */
const esquemaTelefonoCliente = z.string()
  .trim()
  .min(1, "Ingresa el teléfono del cliente")
  .max(20, "Máximo 20 caracteres")
  .regex(/^\+?[\d\s\-().]+$/, "Solo dígitos, +, - o espacios");

function validarTelefonoCliente(v: string): string {
  const r = esquemaTelefonoCliente.safeParse(v);
  return r.success ? "" : r.error.issues[0]?.message ?? "Teléfono no válido";
}

export default function CitasPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  const sector = useSector();
  const esMovil = useMediaQuery(CONSULTA_MOVIL);
  const permisos = usePermisos();

  // Vista, filtros y página viven en la URL: al volver del detalle de una cita
  // (o recargar) la lista sigue donde estaba, y otras pantallas pueden enlazar
  // a una lista filtrada (p. ej. `?estado=Pendiente`). Sin parámetro, el
  // período es hoy; un parámetro vacío significa "sin límite".
  const [params, setParams] = useSearchParams();
  const actualizarParams = (cambios: Record<string, string | null>) =>
    setParams((prev) => {
      const sig = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null) sig.delete(k);
        else sig.set(k, v);
      }
      return sig;
    }, { replace: true });

  const vistaParam = params.get("vista");
  const vista: VistaCitas = vistaParam === "calendario" || vistaParam === "gantt" ? vistaParam : "lista";
  const { desde, hasta, empleadoId, pagina, invalidos: paramsInvalidos } = leerParamsCitas(params, hoy());
  const busqueda = params.get("busqueda") ?? "";
  const estadoFiltro = ESTADOS_FILTRO.includes(params.get("estado") ?? "") ? params.get("estado")! : "";
  const TAMANO = TAMANO_PAGINA;

  // Un valor inválido en la URL (editada a mano o de un enlace viejo) se quita
  // para que la barra de direcciones refleje lo que realmente se muestra.
  const clavesInvalidas = paramsInvalidos.join(",");
  useEffect(() => {
    if (!clavesInvalidas) return;
    actualizarParams(Object.fromEntries(clavesInvalidas.split(",").map((k) => [k, null])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambian las claves inválidas
  }, [clavesInvalidas]);

  const setVista = (v: VistaCitas) => actualizarParams({ vista: v === "lista" ? null : v });
  const setPagina = (n: number) => actualizarParams({ pagina: n > 1 ? String(n) : null });
  /** Cambia filtros y vuelve a la página 1. */
  const filtrar = (cambios: Record<string, string | null>) => actualizarParams({ ...cambios, pagina: null });

  // Única hoja de acciones de la página: la abren el calendario, el Gantt, las
  // filas de la tabla y las tarjetas. Vive fuera del cambio tabla/tarjetas, así
  // que no se pierde (ni lo escrito en ella) al cruzar los 640px.
  const [citaAcciones, setCitaAcciones] = useState<CitaDto | null>(null);
  const [vistaAcciones, setVistaAcciones] = useState<VistaHoja>("menu");
  const abrirAcciones = (cita: CitaDto, vistaHoja: VistaHoja = "menu") => {
    setCitaAcciones(cita);
    setVistaAcciones(vistaHoja);
  };

  // Confirmación para anular un anticipo ya registrado
  const [citaAnularAnticipo, setCitaAnularAnticipo] = useState<CitaDto | null>(null);

  // Modal notas
  const [citaNotas, setCitaNotas] = useState<CitaDto | null>(null);
  const [notasTexto, setNotasTexto] = useState("");

  // Modal comprobante
  const [urlComprobante, setUrlComprobante] = useState<string | null>(null);

  // Modal repetir cita
  const [citaRepetir, setCitaRepetir] = useState<CitaDto | null>(null);
  const [slotRepetir, setSlotRepetir] = useState<SlotDisponible | null>(null);
  const [pasoRepetir, setPasoRepetir] = useState<1 | 2>(1);
  const [fClienteRepetir, setFClienteRepetir] = useState({ nombre: "", telefono: "", email: "", notas: "" });
  const [emailRepetirError, setEmailRepetirError] = useState("");

  // Modal nueva cita
  const [modalNueva, setModalNueva] = useState(false);
  const [pasoCita, setPasoCita] = useState<1 | 2>(1);
  const [svcSel, setSvcSel] = useState("");
  const [empSel, setEmpSel] = useState("");
  const [fechaNueva, setFechaNueva] = useState("");
  const [slotNuevo, setSlotNuevo] = useState("");
  const [fCliente, setFCliente] = useState({ nombre: "", telefono: "", email: "", notas: "" });
  const [emailClienteError, setEmailClienteError] = useState("");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Modal editar cliente
  const [citaEditar, setCitaEditar] = useState<CitaDto | null>(null);
  const [fEditar, setFEditar] = useState({ nombre: "", telefono: "", email: "" });
  const [emailEditarError, setEmailEditarError] = useState("");

  // Issue 12 — drag-to-reschedule confirmation
  const [confirmDrag, setConfirmDrag] = useState<{id: string; nombre: string; nuevoInicio: string; label: string} | null>(null);

  const [telefonoClienteError, setTelefonoClienteError] = useState("");

  const validarEmailCliente = (v: string) =>
    v.trim() && !EMAIL_RE.test(v.trim()) ? "Correo no válido (ej: nombre@dominio.com)" : "";

  // La búsqueda ya llega confirmada desde la barra; aquí solo vuelve a la página 1.
  const aplicarBusqueda = (v: string) => filtrar({ busqueda: v || null });

  // ── Queries ──────────────────────────────────────────────────────────────────
  const estadoNum = estadoFiltro ? ESTADOS[estadoFiltro as keyof typeof ESTADOS] : undefined;

  const {
    data: pagCitas, isLoading, isError: errorCitas, refetch: reintentarCitas, isFetching: actualizandoCitas, isPlaceholderData,
  } = useQuery({
    queryKey: ["citas", desde, hasta, empleadoId, busqueda, estadoFiltro, pagina],
    queryFn: () => citasApi.obtenerTodas({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
      busqueda: busqueda || undefined,
      estado: estadoNum,
      pagina,
      tamano: TAMANO,
    }),
    enabled: vista === "lista",
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const citas = pagCitas?.datos ?? [];
  // La hoja muestra la versión más reciente de la cita si está en la página actual
  // (misma clave → no se reinicia lo que se esté escribiendo).
  const citaHoja = citaAcciones ? (citas.find((c) => c.id === citaAcciones.id) ?? citaAcciones) : null;
  const totalCitas = pagCitas?.total ?? 0;
  const totalPaginas = Math.ceil(totalCitas / TAMANO) || 1;

  // Página fuera de rango (p. ej. `?pagina=40` con 3 páginas): se lleva a la última.
  const paginaFueraDeRango = !!pagCitas && !isPlaceholderData && !errorCitas && pagina > totalPaginas;
  useEffect(() => {
    if (paginaFueraDeRango) setPagina(totalPaginas);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setPagina cambia en cada render
  }, [paginaFueraDeRango, totalPaginas]);

  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil-layout"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 5,
  });
  const nombreNegocio = perfil?.nombre ?? "";
  const tienePagos = perfil?.moduloPagosHabilitado ?? false;

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const empleadosFiltrados = svcSel
    ? empleados.filter((e) => e.servicioIds.includes(svcSel) && e.activo)
    : empleados.filter((e) => e.activo);

  const { data: slotsNueva = [], isFetching: cargandoSlotsNueva, isError: errorSlotsNueva } = useQuery({
    queryKey: ["slots-nueva", svcSel, empSel, fechaNueva],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: svcSel, empleadoId: empSel, fecha: fechaNueva },
      });
      return data;
    },
    enabled: !!svcSel && !!empSel && !!fechaNueva,
  });



  // ── Mutations ────────────────────────────────────────────────────────────────
  // Solo para soltar una cita en el calendario: el resto de acciones vive en la hoja.
  const { mutate: reagendar } = useReagendarCita();

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
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setModalNueva(false);
      setPasoCita(1);
      setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
      setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
      setEmailClienteError("");
      setTelefonoClienteError("");
      toast(`${terms.cita} creada`);
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, `No se pudo crear la ${terms.cita.toLowerCase()}`), "error");
    },
  });

  const { mutate: editarCliente, isPending: editando } = useMutation({
    mutationFn: () => citasApi.editarCliente(citaEditar!.id, {
      nombreCompleto: fEditar.nombre.trim(),
      telefono: fEditar.telefono.trim(),
      email: fEditar.email.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setCitaEditar(null);
      toast("Datos del cliente actualizados");
    },
    onError: (err: unknown) => {
      const duplicado = isAxiosError(err) && err.response?.status === 409;
      toast(mensajeError(err, duplicado
          ? `Ese teléfono o correo ya está registrado con otro ${terms.cliente.toLowerCase()}`
          : "No se pudo actualizar el cliente"), "error");
    },
  });

  const abrirEditar = (c: CitaDto) => {
    setCitaEditar(c);
    setFEditar({ nombre: c.nombreCliente, telefono: c.telefonoCliente ?? "", email: c.emailCliente ?? "" });
    setEmailEditarError("");
  };

  const abrirNuevaCita = () => {
    setModalNueva(true);
    setPasoCita(1);
    setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
    setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
    setEmailClienteError("");
    setTelefonoClienteError("");
  };

  const abrirRepetirCita = (c: CitaDto) => {
    setCitaRepetir(c);
    setSlotRepetir(null);
    setPasoRepetir(1);
    setFClienteRepetir({
      nombre: c.nombreCliente,
      telefono: c.telefonoCliente,
      email: c.emailCliente ?? "",
      notas: "",
    });
    setEmailRepetirError("");
  };

  // Restaurar una nota es la operación inversa exacta (PATCH con el texto anterior).
  const { mutate: restaurarNota } = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas: string }) => citasApi.actualizarNotas(id, notas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      toast("Nota restaurada");
    },
    onError: () => toast("No se pudo restaurar la nota. Intenta de nuevo.", "error"),
  });

  const { mutate: actualizarNotas, isPending: guardandoNotas } = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas: string | null; anterior?: string | null }) =>
      citasApi.actualizarNotas(id, notas),
    onSuccess: (_, { id, notas, anterior }) => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaNotas(null);
      setNotasTexto("");
      if (notas === null && anterior) {
        // Borrar no pide confirmación: se puede deshacer desde el aviso.
        toast("Nota eliminada", "exito", {
          accion: { etiqueta: "Deshacer", onClick: () => restaurarNota({ id, notas: anterior }) },
        });
      } else {
        toast("Notas guardadas");
      }
    },
    onError: () => toast("No se pudieron guardar las notas. Intenta de nuevo.", "error"),
  });

  const { mutate: repetirCita, isPending: repitiendo } = useMutation({
    mutationFn: () => citasApi.crear({
      servicioId: citaRepetir!.servicioId,
      empleadoId: citaRepetir!.empleadoId,
      inicioEn: slotRepetir!.inicio,
      nombreCliente: fClienteRepetir.nombre.trim(),
      telefonoCliente: fClienteRepetir.telefono.trim(),
      emailCliente: fClienteRepetir.email.trim() || undefined,
      notas: fClienteRepetir.notas.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setCitaRepetir(null);
      setSlotRepetir(null);
      setPasoRepetir(1);
      setFClienteRepetir({ nombre: "", telefono: "", email: "", notas: "" });
      setEmailRepetirError("");
      toast(`${terms.cita} creada`);
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, `No se pudo crear la ${terms.cita.toLowerCase()}`), "error");
    },
  });

  const mutAnticipo = useMutation({
    mutationFn: ({ id, recibido }: { id: string; recibido: boolean }) =>
      citasApi.registrarAnticipo(id, recibido),
    onSuccess: (_, { recibido }) => {
      // Todas las vistas de citas: lista, calendario, Gantt, inicio y cobro.
      invalidarCitas(qc);
      setCitaAnularAnticipo(null);
      toast(recibido ? "Anticipo registrado" : "Anticipo anulado");
    },
    onError: () => toast("No se pudo actualizar el anticipo", "error"),
  });

  // ── Confirmar seleccionadas (decisión 14, DC-30) ─────────────────────────────
  // Solo citas Pendientes de la página visible. Para el Empleado la lista ya
  // trae solo sus citas, y el backend rechaza cambiar el estado de las ajenas.
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [progresoLote, setProgresoLote] = useState<{ hechas: number; total: number } | null>(null);
  // Al cambiar de página, filtros o vista, la selección se vacía (patrón de
  // "reiniciar estado al cambiar una clave", sin efecto).
  const claveLista = [desde, hasta, empleadoId, busqueda, estadoFiltro, pagina, vista].join("|");
  const [claveSeleccion, setClaveSeleccion] = useState(claveLista);
  if (claveSeleccion !== claveLista) {
    setClaveSeleccion(claveLista);
    setSeleccion(new Set());
  }
  const pendientesPagina = citas.filter((c) => c.estadoTexto === "Pendiente");
  const idsSeleccionados = pendientesPagina.filter((c) => seleccion.has(c.id)).map((c) => c.id);
  const todasSeleccionadas = pendientesPagina.length > 0 && idsSeleccionados.length === pendientesPagina.length;
  const alternarSeleccion = (id: string) =>
    setSeleccion((prev) => {
      const sig = new Set(prev);
      if (sig.has(id)) sig.delete(id);
      else sig.add(id);
      return sig;
    });
  const alternarTodas = () =>
    setSeleccion(todasSeleccionadas ? new Set() : new Set(pendientesPagina.map((c) => c.id)));

  // Un solo lote a la vez: el botón se deshabilita, pero el "Reintentar" del
  // toast podría lanzar otro mientras el primero sigue en curso.
  const loteEnCurso = useRef(false);
  const confirmarSeleccionadas = async (ids: string[]) => {
    if (ids.length === 0 || loteEnCurso.current) return;
    loteEnCurso.current = true;
    setProgresoLote({ hechas: 0, total: ids.length });
    const resultado = await confirmarEnLote(
      ids,
      (id) => citasApi.cambiarEstado(id, { nuevoEstado: ESTADOS.Confirmada }),
      (hechas, total) => setProgresoLote({ hechas, total }),
    );
    loteEnCurso.current = false;
    setProgresoLote(null);
    invalidarCitas(qc);
    // Las que fallaron siguen seleccionadas para reintentarlas.
    setSeleccion(new Set(resultado.fallidas));
    if (resultado.fallidas.length === 0) {
      toast(resumenLote(resultado), "exito");
    } else {
      toast(resumenLote(resultado), "error", {
        accion: { etiqueta: "Reintentar", onClick: () => void confirmarSeleccionadas(resultado.fallidas) },
      });
    }
  };

  // ── Filtros ──────────────────────────────────────────────────────────────────
  // Todo cambio de filtro vuelve a la página 1: quedarse en la 7 tras filtrar
  // devolvía una tabla vacía que parecía "sin resultados".
  const campoEmpleado: CampoFiltro = {
    tipo: "select",
    id: "empleado",
    etiqueta: terms.empleado,
    valor: empleadoId,
    onChange: (v) => filtrar({ empleadoId: v || null }),
    opciones: empleados.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
  };

  const campos: CampoFiltro[] = [
    campoEmpleado,
    {
      tipo: "select",
      id: "estado",
      etiqueta: "Estado",
      valor: estadoFiltro,
      onChange: (v) => filtrar({ estado: v || null }),
      etiquetaNeutra: "Todos",
      opciones: ESTADOS_FILTRO.map((e) => ({ valor: e, etiqueta: e })),
    },
    {
      tipo: "rangoFechas",
      id: "periodo",
      etiqueta: "Período",
      desde,
      hasta,
      onChange: (d, h) => filtrar({ desde: d, hasta: h }),
      presets: [
        { etiqueta: "Hoy", desde: hoy(), hasta: hoy() },
        { etiqueta: "Semana", desde: inicioSemana(), hasta: finSemana() },
        { etiqueta: "Mes", desde: inicioMes(), hasta: finMes() },
      ],
    },
  ];

  // Uno solo para la barra y para el estado vacío. Antes eran dos handlers
  // distintos y el del estado vacío se olvidaba de `empleadoId`.
  const limpiarFiltros = () => {
    filtrar({ desde: "", hasta: "", empleadoId: null, busqueda: null, estado: null });
  };

  const hayFiltrosActivos =
    Boolean(busqueda) || campos.some(campoActivo);
  // Solo el período acota la lista: el vacío es del rango, no de un filtro.
  const soloRango = !busqueda && campos.every((c) => c.tipo === "rangoFechas" || !campoActivo(c));

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const abrirNotas = (c: CitaDto) => {
    setCitaNotas(c);
    setNotasTexto(c.notas ?? "");
  };


  // ── Acciones extra de la hoja ────────────────────────────────────────────────
  // Lo que antes eran nueve iconos por fila vive en la hoja de acciones, con
  // texto. La fila solo deja WhatsApp, la acción principal y "Acciones".
  const anticipoEnCurso = (id: string) => mutAnticipo.isPending && mutAnticipo.variables?.id === id;
  // Hay algo que hacer con el anticipo: registrarlo, o anularlo si el rol puede
  // (el Empleado registra anticipos de sus citas, pero no los anula).
  const puedeAccionarAnticipo = (c: CitaDto) =>
    c.anticipoRequerido && !c.pagada && !(c.anticipoRecibido && !permisos.anularAnticipo);

  const accionesExtra = (c: CitaDto): AccionExtraCita[] => [
    {
      id: "notas",
      etiqueta: c.notas ? "Ver o editar nota interna" : "Agregar nota interna",
      Icono: StickyNote,
      marcador: !!c.notas,
      onSelect: () => abrirNotas(c),
    },
    // Editar cambia el registro global del cliente: solo Propietario (decisión 2).
    ...(permisos.editarCliente
      ? [{ id: "editar", etiqueta: `Editar datos del ${terms.cliente.toLowerCase()}`, Icono: Pencil, onSelect: () => abrirEditar(c) }]
      : []),
    ...(puedeAccionarAnticipo(c)
      ? [c.anticipoRecibido
          ? { id: "anticipo", etiqueta: "Anular anticipo", Icono: Banknote, onSelect: () => setCitaAnularAnticipo(c) }
          : {
              id: "anticipo",
              etiqueta: anticipoEnCurso(c.id)
                ? "Registrando anticipo…"
                : `Registrar anticipo de ${formatPrecio(c.montoAnticipo ?? 0)}`,
              Icono: Banknote,
              // Mientras el registro de esta cita está en curso no se puede volver
              // a enviar: la hoja se reabre con la acción deshabilitada.
              deshabilitada: anticipoEnCurso(c.id),
              onSelect: () => {
                if (mutAnticipo.isPending) return;
                mutAnticipo.mutate({ id: c.id, recibido: true });
              },
            }]
      : []),
    ...(c.comprobanteUrl
      ? [{ id: "comprobante", etiqueta: "Ver comprobante de anticipo", Icono: Receipt, onSelect: () => setUrlComprobante(c.comprobanteUrl!) }]
      : []),
    { id: "repetir", etiqueta: `Repetir ${terms.cita.toLowerCase()}`, Icono: RotateCcw, onSelect: () => abrirRepetirCita(c) },
    ...(c.estadoTexto === "Completada" && c.telefonoCliente
      ? [{ id: "resena", etiqueta: "Solicitar reseña por WhatsApp", Icono: Star, href: urlResenaWhatsApp(c, nombreNegocio, perfil?.slug) }]
      : []),
  ];

  // ── Excel export ─────────────────────────────────────────────────────────────
  const exportarCSV = () => {
    reportesApi.exportarCitasCsv({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
      estado: estadoNum,
    }).catch(() => toast("No se pudo exportar el reporte. Intenta de nuevo.", "error"));
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 overflow-x-hidden">
      {/* Encabezado */}
      <div className="mb-6 space-y-3">

        {/* Fila 1 — título + acciones desktop */}
        <EncabezadoPagina
          titulo={terms.citas}
          subtitulo="Agenda del día, confirmaciones y reprogramaciones"
          acciones={
            /* Recepción y Exportar siguen ocultas bajo `sm`: son atajos de
               mostrador y, con las tres visibles, a 390px la fila ocuparía más
               ancho que la pantalla. Crear la cita es la única que queda. */
            <>
              <EnlaceAccion
                to="/dashboard/kiosk"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex"
              >
                <Monitor size={16} aria-hidden="true" />
                Recepción
              </EnlaceAccion>
              {permisos.exportar && citas.length > 0 && vista === "lista" && (
                <BotonAccion
                  variante="secundaria"
                  onClick={exportarCSV}
                  className="hidden sm:inline-flex"
                >
                  Exportar Excel
                </BotonAccion>
              )}
              <BotonAccion onClick={abrirNuevaCita}>
                {`+ Nueva ${terms.cita.toLowerCase()}`}
              </BotonAccion>
            </>
          }
        />

        {/* Fila 2 — tabs */}
        <Tabs
          etiqueta={`Vista de ${terms.citas.toLowerCase()}`}
          valor={vista}
          onChange={setVista}
          opciones={[
            { id: "lista", label: "Lista" },
            { id: "calendario", label: "Calendario" },
            { id: "gantt", label: "Línea de tiempo" },
          ]}
        />

      </div>

      {/* Filtros — la vista calendario reusa el mismo campo de profesional */}
      {(vista === "lista" || (vista === "calendario" && empleados.length > 1)) && (
        <FiltroBarra
          etiqueta={`Filtros de ${terms.citas.toLowerCase()}`}
          busqueda={
            vista === "lista"
              ? {
                  valor: busqueda,
                  onChange: aplicarBusqueda,
                  etiqueta: "Buscar cliente",
                  placeholder: "Nombre o teléfono...",
                }
              : undefined
          }
          campos={vista === "lista" ? campos : [campoEmpleado]}
          onLimpiar={limpiarFiltros}
        />
      )}

      {/* Vista calendario */}
      {vista === "calendario" && (
        <CalendarioCitas
          empleadoId={empleadoId}
          terms={terms}
          onCitaClick={(c: CitaDto) => abrirAcciones(c)}
          onReagendar={(cita, nuevoInicio) => {
            const nueva = new Date(nuevoInicio).toLocaleString("es-MX", {
              weekday: "short", day: "numeric", month: "short",
              hour: "numeric", minute: "2-digit", hour12: true,
            });
            setConfirmDrag({ id: cita.id, nombre: cita.nombreCliente, nuevoInicio: nuevoInicio, label: nueva });
          }}
        />
      )}

      {/* Vista línea de tiempo (Gantt) */}
      {vista === "gantt" && (
        <GanttCitas onCitaClick={(c: CitaDto) => abrirAcciones(c)} terms={terms} />
      )}

      {/* Un fallo al refrescar no borra la lista que ya se ve, pero se avisa. */}
      {vista === "lista" && errorCitas && citas.length > 0 && (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-800 dark:text-red-300">
          <span>{`No se pudo actualizar la lista de ${terms.citas.toLowerCase()}. Lo que ves puede no estar al día.`}</span>
          <BotonAccion variante="secundaria" onClick={() => reintentarCitas()} disabled={actualizandoCitas}>
            {actualizandoCitas ? "Reintentando…" : "Reintentar"}
          </BotonAccion>
        </div>
      )}

      {/* Vista lista */}
      {vista === "lista" && (
        isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody><SkeletonTableRows filas={6} columnas={5} /></tbody>
            </table>
          </div>
        ) : errorCitas && citas.length === 0 ? (
          // Un fallo no debe leerse como "no hay citas": es lo más engañoso para una agenda.
          <div role="alert" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-10 text-center">
            <AlertTriangle size={28} className="mx-auto mb-2 text-red-700 dark:text-red-400" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{`No se pudieron cargar las ${terms.citas.toLowerCase()}.`}</p>
            <p className="text-sm text-muted-foreground mb-4">Revisa tu conexión e intenta de nuevo.</p>
            <BotonAccion variante="secundaria" onClick={() => reintentarCitas()} disabled={actualizandoCitas}>
              {actualizandoCitas ? "Reintentando…" : "Reintentar"}
            </BotonAccion>
          </div>
        ) : citas.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            {hayFiltrosActivos && !soloRango ? (
              <EmptyState
                variante="sinResultados"
                title={
                  estadoFiltro
                    ? `Sin ${terms.citas.toLowerCase()} ${estadoFiltro.toLowerCase()}s`
                    : `No hay ${terms.citas.toLowerCase()} en este rango`
                }
                onLimpiarFiltros={limpiarFiltros}
              />
            ) : (
              // Rango vacío sin filtros: una frase con voz del sector y una sola salida.
              <EmptyState
                voz="citasRango"
                tono={tonoDeSector(sector)}
                action={
                  <BotonAccion onClick={abrirNuevaCita}>
                    {`Nueva ${terms.cita.toLowerCase()}`}
                  </BotonAccion>
                }
              />
            )}
          </div>
        ) : esMovil ? (
          // Teléfono: tarjetas apiladas con las acciones a la vista. La tabla medía
          // 482px a 375px y dejaba WhatsApp y "Acciones" fuera de la pantalla.
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <ul className="divide-y divide-slate-100 dark:divide-slate-700" aria-label={terms.citas}>
              {citas.map((c) => (
                <li key={c.id} className="flex items-start">
                  {pendientesPagina.length > 0 && (
                    <div className="w-11 shrink-0 pt-2 pl-1">
                      {c.estadoTexto === "Pendiente" && (
                        <CasillaSeleccion
                          etiqueta={`Seleccionar ${terms.cita.toLowerCase()} de ${c.nombreCliente}`}
                          marcada={seleccion.has(c.id)}
                          onCambiar={() => alternarSeleccion(c.id)}
                          deshabilitada={!!progresoLote}
                        />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <TarjetaCita
                      cita={c}
                      accionesExtra={accionesExtra(c)}
                      nombreNegocio={nombreNegocio}
                      mostrarPago={tienePagos}
                      onAbrirHoja={(v) => abrirAcciones(c, v)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalCitas}
              labelTotal="citas"
              onCambiar={setPagina}
              cargando={isLoading}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-muted-foreground uppercase tracking-wide">
                  {pendientesPagina.length > 0 && (
                    <th className="w-11 pl-2 py-1">
                      <CasillaSeleccion
                        etiqueta={`Seleccionar todas las ${terms.citas.toLowerCase()} pendientes de esta página`}
                        marcada={todasSeleccionadas}
                        onCambiar={alternarTodas}
                        deshabilitada={!!progresoLote}
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Servicio</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">{terms.empleado}</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha y hora</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Precio</th>
                  {tienePagos && <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Pago</th>}
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                    {pendientesPagina.length > 0 && (
                      <td className="w-11 pl-2 py-1">
                        {c.estadoTexto === "Pendiente" && (
                          <CasillaSeleccion
                            etiqueta={`Seleccionar ${terms.cita.toLowerCase()} de ${c.nombreCliente}`}
                            marcada={seleccion.has(c.id)}
                            onCambiar={() => alternarSeleccion(c.id)}
                            deshabilitada={!!progresoLote}
                          />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{c.nombreCliente}</p>
                      <p className="text-xs text-muted-foreground">{c.telefonoCliente}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.nombreServicio}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.nombreEmpleado}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs sm:text-sm whitespace-nowrap">
                      <p>{formatFechaCorta(c.inicioEn)}</p>
                      <p className="text-muted-foreground">{formatHora(c.inicioEn)}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200 hidden sm:table-cell">{formatPrecio(c.precio)}</td>

                    {/* Columna de pago — solo lectura */}
                    {tienePagos && (
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {c.pagada ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <CheckCircle2 size={11} aria-hidden="true" /> {c.metodoPago ?? "Pagado"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Por pagar</span>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <EstadoBadge estado={c.estadoTexto} />
                        <InsigniasCita cita={c} />
                      </div>
                    </td>

                    {/* Acciones: las mismas en todas las anchuras; el resto vive en la hoja */}
                    <td className="px-2 sm:px-4 py-2 text-right">
                      <AccionesCita
                        cita={c}
                        accionesExtra={accionesExtra(c)}
                        nombreNegocio={nombreNegocio}
                        onAbrirHoja={(v) => abrirAcciones(c, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalCitas}
              labelTotal="citas"
              onCambiar={setPagina}
              cargando={isLoading}
            />
          </div>
        )
      )}


      {/* ── Barra de acciones en lote: fija abajo mientras haya selección ── */}
      {vista === "lista" && (idsSeleccionados.length > 0 || progresoLote) && (
        <div
          role="region"
          aria-label={`${terms.citas} seleccionadas`}
          className="sticky bottom-0 z-20 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg"
        >
          <p className="text-sm font-medium text-foreground" aria-live="polite">
            {progresoLote
              ? `Confirmando ${progresoLote.hechas} de ${progresoLote.total}…`
              : `${idsSeleccionados.length} ${idsSeleccionados.length === 1 ? "seleccionada" : "seleccionadas"}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <BotonAccion variante="secundaria" onClick={() => setSeleccion(new Set())} disabled={!!progresoLote}>
              Quitar selección
            </BotonAccion>
            <BotonAccion onClick={() => void confirmarSeleccionadas(idsSeleccionados)} disabled={!!progresoLote}>
              Confirmar seleccionadas
            </BotonAccion>
          </div>
        </div>
      )}

      {/* ── Modal: Editar cliente ── */}
      <Modal abierto={!!citaEditar} onCerrar={() => setCitaEditar(null)} titulo="Editar datos del cliente" ancho="sm">
        {citaEditar && (
          <div className="space-y-4">
            <div>
              <label htmlFor="editar-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nombre <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span>
              </label>
              <input
                id="editar-nombre"
                type="text"
                required
                value={fEditar.nombre}
                onChange={(e) => setFEditar((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand"
              />
            </div>
            <div>
              <label htmlFor="editar-telefono" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teléfono{" "}
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  {fEditar.telefono ? `(vaciar para desvincular esta ${terms.cita.toLowerCase()} del ${terms.cliente.toLowerCase()})` : "(sin teléfono — cita independiente)"}
                </span>
              </label>
              <input
                id="editar-telefono"
                type="tel"
                value={fEditar.telefono}
                onChange={(e) => setFEditar((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="Sin teléfono"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand"
              />
            </div>
            <div>
              <label htmlFor="editar-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Correo <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                id="editar-email"
                type="email"
                aria-invalid={!!emailEditarError || undefined}
                aria-describedby={emailEditarError ? "editar-email-error" : undefined}
                value={fEditar.email}
                onChange={(e) => {
                  setFEditar((p) => ({ ...p, email: e.target.value }));
                  setEmailEditarError(validarEmailCliente(e.target.value));
                }}
                placeholder="correo@ejemplo.com"
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-accent-brand dark:bg-slate-800 dark:text-slate-100 ${
                  emailEditarError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-600"
                }`}
              />
              {emailEditarError && <p id="editar-email-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" /> {emailEditarError}</p>}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              {`Esto actualiza los datos del ${terms.cliente.toLowerCase()} en todas sus ${terms.citas.toLowerCase()}.`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCitaEditar(null)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-sm transition"
              >
                Volver
              </button>
              <button
                onClick={() => { if (!emailEditarError) editarCliente(); }}
                disabled={!fEditar.nombre.trim() || editando || !!emailEditarError}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {editando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Notas internas ── */}
      <Modal abierto={!!citaNotas} onCerrar={() => setCitaNotas(null)} titulo="Nota interna" ancho="sm">
        {citaNotas && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-slate-500 dark:text-slate-400">Cliente:</span> <span className="font-medium dark:text-slate-200">{citaNotas.nombreCliente}</span></p>
              <p><span className="text-slate-500 dark:text-slate-400">Servicio:</span> <span className="font-medium dark:text-slate-200">{citaNotas.nombreServicio}</span></p>
            </div>
            <div>
              <label htmlFor="nota-interna" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Nota interna <span className="text-slate-400 dark:text-slate-500">(solo visible para el negocio)</span>
              </label>
              <textarea
                id="nota-interna"
                value={notasTexto}
                onChange={(e) => setNotasTexto(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Preferencias del cliente, indicaciones especiales, alergias..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-accent-brand resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 text-right mt-1">{notasTexto.length}/1000</p>
            </div>
            <div className="flex gap-2">
              {citaNotas.notas && (
                <button
                  onClick={() => actualizarNotas({ id: citaNotas.id, notas: null, anterior: citaNotas.notas })}
                  disabled={guardandoNotas}
                  className="px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 rounded-xl text-sm transition"
                >
                  Eliminar nota
                </button>
              )}
              <button
                onClick={() => actualizarNotas({ id: citaNotas.id, notas: notasTexto || null })}
                disabled={guardandoNotas || notasTexto === (citaNotas.notas ?? "")}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {guardandoNotas ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Nueva cita ── */}
      <Modal abierto={modalNueva} onCerrar={() => setModalNueva(false)} titulo={`Nueva ${terms.cita.toLowerCase()}`} ancho="md">
        {/* Paso 1 — Servicio, empleado, fecha, slot */}
        {pasoCita === 1 && (
          <div className="space-y-4">
            {/* Servicio */}
            <div>
              <p id="nueva-servicio" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Servicio</p>
              <div role="group" aria-labelledby="nueva-servicio" className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg divide-y divide-slate-100 dark:divide-slate-600">
                {servicios.filter((s) => s.activo).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={svcSel === s.id}
                    onClick={() => { setSvcSel(s.id); setEmpSel(""); setFechaNueva(""); setSlotNuevo(""); }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition ${
                      svcSel === s.id
                        ? "bg-slate-700 text-white"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className="font-medium">{s.nombre}</span>
                    <span className={`ml-2 text-xs ${svcSel === s.id ? "text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                      {s.duracionMinutos} min · {formatPrecio(s.precio)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Empleado */}
            {svcSel && (
              <div>
                <p id="nueva-profesional" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{terms.empleado}</p>
                {empleadosFiltrados.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Ningún empleado ofrece este servicio</p>
                ) : (
                  <div role="group" aria-labelledby="nueva-profesional" className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg divide-y divide-slate-100 dark:divide-slate-600">
                    {empleadosFiltrados.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={empSel === e.id}
                        onClick={() => { setEmpSel(e.id); setFechaNueva(""); setSlotNuevo(""); }}
                        className={`w-full text-left px-3 py-2.5 text-sm transition ${
                          empSel === e.id
                            ? "bg-slate-700 text-white"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {e.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fecha */}
            {svcSel && empSel && (
              <div>
                <DatePicker
                  label="Fecha"
                  value={fechaNueva}
                  minDate={hoy()}
                  onChange={(v) => { setFechaNueva(v); setSlotNuevo(""); }}
                />
              </div>
            )}

            {/* Slots */}
            {svcSel && empSel && fechaNueva && (
              <div>
                <p id="nueva-horario" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Horario disponible</p>
                {cargandoSlotsNueva ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">Cargando horarios...</p>
                ) : errorSlotsNueva ? (
                  <p className="text-xs text-red-700 dark:text-red-400 text-center py-2" role="alert">Error al cargar horarios. Intenta de nuevo.</p>
                ) : slotsNueva.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div role="group" aria-labelledby="nueva-horario" className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {slotsNueva.map((s) => (
                      <button
                        key={s.inicio}
                        type="button"
                        aria-pressed={slotNuevo === s.inicio}
                        onClick={() => setSlotNuevo(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotNuevo === s.inicio
                            ? "bg-slate-700 text-white border-slate-700"
                            : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-700 dark:hover:border-slate-400"
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
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Paso 2 — Datos del cliente */}
        {pasoCita === 2 && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-slate-500 dark:text-slate-400">Servicio:</span> <span className="font-medium dark:text-slate-200">{servicios.find((s) => s.id === svcSel)?.nombre}</span></p>
              <p><span className="text-slate-500 dark:text-slate-400">{`${terms.empleado}:`}</span> <span className="font-medium dark:text-slate-200">{empleados.find((e) => e.id === empSel)?.nombre}</span></p>
              <p><span className="text-slate-500 dark:text-slate-400">Hora:</span> <span className="font-medium dark:text-slate-200">{slotNuevo ? formatFechaHora(slotNuevo) : ""}</span></p>
            </div>

            <div>
              <label htmlFor="nueva-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del cliente <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span></label>
              <input
                id="nueva-nombre"
                type="text"
                required
                value={fCliente.nombre}
                onChange={(e) => setFCliente((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand"
              />
            </div>

            <div>
              <label htmlFor="nueva-telefono" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teléfono <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span>
              </label>
              <input
                id="nueva-telefono"
                type="tel"
                required
                aria-required="true"
                aria-invalid={!!telefonoClienteError || undefined}
                aria-describedby={telefonoClienteError ? "nueva-telefono-error" : undefined}
                value={fCliente.telefono}
                onChange={(e) => {
                  setFCliente((p) => ({ ...p, telefono: e.target.value }));
                  if (telefonoClienteError) setTelefonoClienteError(validarTelefonoCliente(e.target.value));
                }}
                onBlur={() => { if (fCliente.telefono) setTelefonoClienteError(validarTelefonoCliente(fCliente.telefono)); }}
                placeholder="10 dígitos"
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-accent-brand dark:bg-slate-800 dark:text-slate-100 ${
                  telefonoClienteError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-600"
                }`}
              />
              {telefonoClienteError && (
                <p id="nueva-telefono-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} aria-hidden="true" /> {telefonoClienteError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nueva-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email <span className="text-muted-foreground font-normal">(opcional — para recordatorio)</span>
              </label>
              <input
                id="nueva-email"
                type="email"
                aria-invalid={!!emailClienteError || undefined}
                aria-describedby={emailClienteError ? "nueva-email-error" : undefined}
                value={fCliente.email}
                onChange={(e) => {
                  setFCliente((p) => ({ ...p, email: e.target.value }));
                  if (emailClienteError) setEmailClienteError(validarEmailCliente(e.target.value));
                }}
                onBlur={() => setEmailClienteError(validarEmailCliente(fCliente.email))}
                placeholder="correo@ejemplo.com"
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-accent-brand dark:bg-slate-800 dark:text-slate-100 ${
                  emailClienteError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-600"
                }`}
              />
              {emailClienteError && (
                <p id="nueva-email-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} aria-hidden="true" /> {emailClienteError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="nueva-nota" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nota interna <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <textarea
                id="nueva-nota"
                value={fCliente.notas}
                onChange={(e) => setFCliente((p) => ({ ...p, notas: e.target.value }))}
                rows={2}
                placeholder="Preferencias, indicaciones..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPasoCita(1)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-sm transition"
              >
                Atrás
              </button>
              <button
                onClick={() => {
                  const errTel = validarTelefonoCliente(fCliente.telefono);
                  const err = validarEmailCliente(fCliente.email);
                  setTelefonoClienteError(errTel);
                  setEmailClienteError(err);
                  if (errTel) document.getElementById("nueva-telefono")?.focus();
                  if (!err && !errTel) crearCita();
                }}
                disabled={!fCliente.nombre.trim() || creando || !!emailClienteError}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {creando ? "Creando..." : `Crear ${terms.cita.toLowerCase()}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Ver comprobante ── */}
      <Modal abierto={!!urlComprobante} onCerrar={() => setUrlComprobante(null)} titulo="Comprobante de anticipo" ancho="sm">
        {urlComprobante && (
          <div className="space-y-3">
            <img
              src={urlComprobante}
              alt="Comprobante de anticipo"
              className="w-full rounded-xl border border-slate-100 object-contain max-h-[60vh]"
            />
            <a
              href={urlComprobante}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm text-slate-700 hover:underline font-medium"
            >
              Abrir imagen completa
            </a>
          </div>
        )}
      </Modal>

      {/* ── Hoja de acciones: calendario, Gantt, filas y tarjetas ── */}
      <HojaAccionesCita
        cita={citaHoja}
        vistaInicial={vistaAcciones}
        onCerrar={() => setCitaAcciones(null)}
        accionesExtra={citaHoja ? accionesExtra(citaHoja) : []}
        nombreNegocio={nombreNegocio}
      />

      {/* ── Anular anticipo: cambia lo que se cobra al final ── */}
      <ConfirmarAccion
        abierto={!!citaAnularAnticipo}
        titulo="Anular anticipo"
        mensaje={citaAnularAnticipo && (
          <p>
            {`¿Anular el anticipo de ${formatPrecio(citaAnularAnticipo.montoAnticipo ?? 0)} de `}
            <strong className="text-foreground">{citaAnularAnticipo.nombreCliente}</strong>
            {"? Al cobrar ya no se descontará del total."}
          </p>
        )}
        etiquetaConfirmar="Anular anticipo"
        destructiva
        pendiente={mutAnticipo.isPending}
        onConfirmar={() => citaAnularAnticipo && mutAnticipo.mutate({ id: citaAnularAnticipo.id, recibido: false })}
        onCerrar={() => setCitaAnularAnticipo(null)}
      />

      {/* ── Confirmar reagendado por arrastre (solo escritorio) ── */}
      <ConfirmarAccion
        abierto={!!confirmDrag}
        titulo={`Reagendar ${terms.cita.toLowerCase()}`}
        mensaje={confirmDrag && (
          <p>
            {`¿Mover la ${terms.cita.toLowerCase()} de `}
            <strong className="text-foreground">{confirmDrag.nombre}</strong>
            {` para el ${confirmDrag.label}?`}
          </p>
        )}
        etiquetaConfirmar="Mover"
        onConfirmar={() => { if (confirmDrag) reagendar({ id: confirmDrag.id, inicioEn: confirmDrag.nuevoInicio }); setConfirmDrag(null); }}
        onCerrar={() => setConfirmDrag(null)}
      />

      {/* ── Modal: Repetir cita ── */}
      <Modal abierto={!!citaRepetir} onCerrar={() => setCitaRepetir(null)} titulo={`Repetir ${terms.cita.toLowerCase()}`} ancho="sm">
        {citaRepetir && (
          <>
            {/* Paso 1 — elegir nueva fecha y slot */}
            {pasoRepetir === 1 && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-slate-500 dark:text-slate-400">Servicio:</span> <span className="font-medium dark:text-slate-200">{citaRepetir.nombreServicio}</span></p>
                  <p><span className="text-slate-500 dark:text-slate-400">{`${terms.empleado}:`}</span> <span className="font-medium dark:text-slate-200">{citaRepetir.nombreEmpleado}</span></p>
                  <p><span className="text-slate-500 dark:text-slate-400">Cliente:</span> <span className="font-medium dark:text-slate-200">{citaRepetir.nombreCliente}</span></p>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona la nueva fecha y horario:</p>
                <PasoFechaHora
                  servicioId={citaRepetir.servicioId}
                  empleadoId={citaRepetir.empleadoId}
                  seleccionado={slotRepetir}
                  onSeleccionar={setSlotRepetir}
                />
                <button
                  onClick={() => slotRepetir && setPasoRepetir(2)}
                  disabled={!slotRepetir}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* Paso 2 — confirmar datos del cliente */}
            {pasoRepetir === 2 && (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-slate-500 dark:text-slate-400">Servicio:</span> <span className="font-medium dark:text-slate-200">{citaRepetir.nombreServicio}</span></p>
                  <p><span className="text-slate-500 dark:text-slate-400">{`${terms.empleado}:`}</span> <span className="font-medium dark:text-slate-200">{citaRepetir.nombreEmpleado}</span></p>
                  <p><span className="text-slate-500 dark:text-slate-400">Hora:</span> <span className="font-medium dark:text-slate-200">{slotRepetir ? formatFechaHora(slotRepetir.inicio) : ""}</span></p>
                </div>
                <div>
                  <label htmlFor="repetir-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del cliente <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span></label>
                  <input
                    id="repetir-nombre"
                    type="text"
                    required
                    value={fClienteRepetir.nombre}
                    onChange={(e) => setFClienteRepetir((p) => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand"
                  />
                </div>
                <div>
                  <label htmlFor="repetir-telefono" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span></label>
                  <input
                    id="repetir-telefono"
                    type="tel"
                    required
                    value={fClienteRepetir.telefono}
                    onChange={(e) => setFClienteRepetir((p) => ({ ...p, telefono: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand"
                  />
                </div>
                <div>
                  <label htmlFor="repetir-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    id="repetir-email"
                    type="email"
                    aria-invalid={!!emailRepetirError || undefined}
                    aria-describedby={emailRepetirError ? "repetir-email-error" : undefined}
                    value={fClienteRepetir.email}
                    onChange={(e) => {
                      setFClienteRepetir((p) => ({ ...p, email: e.target.value }));
                      if (emailRepetirError) setEmailRepetirError(validarEmailCliente(e.target.value));
                    }}
                    onBlur={() => setEmailRepetirError(validarEmailCliente(fClienteRepetir.email))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-accent-brand dark:bg-slate-800 dark:text-slate-100 ${
                      emailRepetirError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-600"
                    }`}
                  />
                  {emailRepetirError && (
                    <p id="repetir-email-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} aria-hidden="true" /> {emailRepetirError}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="repetir-nota" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nota interna <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="repetir-nota"
                    value={fClienteRepetir.notas}
                    onChange={(e) => setFClienteRepetir((p) => ({ ...p, notas: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-sm outline-none focus:border-accent-brand resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoRepetir(1)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-sm transition"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={() => {
                      const err = validarEmailCliente(fClienteRepetir.email);
                      setEmailRepetirError(err);
                      if (!err) repetirCita();
                    }}
                    disabled={!fClienteRepetir.nombre.trim() || !fClienteRepetir.telefono.trim() || repitiendo || !!emailRepetirError}
                    className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
                  >
                    {repitiendo ? "Creando..." : `Crear ${terms.cita.toLowerCase()}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

/** Casilla de 44px para seleccionar citas en lote. */
function CasillaSeleccion({ etiqueta, marcada, onCambiar, deshabilitada }: {
  etiqueta: string; marcada: boolean; onCambiar: () => void; deshabilitada?: boolean;
}) {
  return (
    <label className="inline-flex h-11 w-11 items-center justify-center cursor-pointer">
      <input
        type="checkbox"
        aria-label={etiqueta}
        checked={marcada}
        onChange={onCambiar}
        disabled={deshabilitada}
        className="h-4 w-4 rounded border-slate-300 dark:border-slate-500 accent-slate-700 dark:accent-slate-400 disabled:opacity-40"
      />
    </label>
  );
}
