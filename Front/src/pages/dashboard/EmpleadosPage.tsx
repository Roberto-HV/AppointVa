import { useEffect, useId, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useEntradaAnimada } from "../../hooks/useEntradaAnimada";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Eye, EyeOff, Pencil, Clock, CalendarX, Mail, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { negociosApi } from "../../api/negocios";
import { citasApi } from "../../api/citas";
import Modal from "../../components/ui/Modal";
import ModalAcciones from "../../components/ui/ModalAcciones";
import {
  BOTON_MODAL_PRIMARIO,
  BOTON_MODAL_SECUNDARIO,
  BOTON_MODAL_PELIGRO_SUAVE,
} from "../../components/ui/botonesModal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import DialogoEliminarConCitas from "../../components/dashboard/DialogoEliminarConCitas";
import EditorHorario from "../../components/dashboard/EditorHorario";
import { errorDelDia } from "../../lib/horario";
import { claseCampo, CLASE_ERROR_CAMPO } from "../../lib/clasesCampo";
import { DatePicker, TimePicker, citasABusySlots } from "../../components/ui/DateTimePicker";
import { Skeleton, SkeletonCards } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import ErrorCarga from "../../components/ui/ErrorCarga";
import { FiltroBarra } from "../../components/ui/filtros";
import Pagination from "../../components/ui/Pagination";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { useToastStore } from "../../store/toastStore";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import { useConfirmarDescarte } from "../../hooks/useCambiosSinGuardar";
import { mensajeError } from "../../utils/errores";
import { hoy } from "../../utils/fechas";
import { useSubirImagen } from "../../hooks/useSubirImagen";
import { ACCEPT_IMAGEN } from "../../lib/imagenes";
import ProgresoSubida from "../../components/ui/ProgresoSubida";
import type { EmpleadoDto, HorarioDiaDto } from "../../types";

// Quitar un bloqueo de la lista del modal: acción destructiva discreta, sin borde,
// del mismo alto que el resto de botones (44px táctil, 36px en escritorio).
const BOTON_QUITAR_BLOQUEO =
  "inline-flex items-center justify-center gap-2 min-h-[44px] lg:min-h-[36px] rounded-lg font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 " +
  "focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed " +
  "text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20";

const HORARIO_BASE: HorarioDiaDto[] = Array.from({ length: 7 }, (_, i) => ({
  diaSemana: i,
  activo: i >= 1 && i <= 6,
  intervalos: i >= 1 && i <= 6 ? [{ horaInicio: "09:00", horaFin: "19:00" }] : [],
}));

/**
 * Completa con el horario base los días que el servidor no devuelve (un
 * empleado recién creado aún no tiene ninguno).
 *
 * Solo se usa con una respuesta real: si la carga falla, el modal muestra el
 * error y no deja guardar. Antes el fallo cargaba HORARIO_BASE como si fuera el
 * horario del empleado, y un "Guardar" lo sobrescribía entero.
 */
function completarHorario(guardado: HorarioDiaDto[]): HorarioDiaDto[] {
  return HORARIO_BASE.map((base) => {
    const existente = guardado.find((x) => x.diaSemana === base.diaSemana);
    return existente ?? { ...base, intervalos: base.intervalos.map((iv) => ({ ...iv })) };
  });
}

const schemaEmpleado = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  biografia: z.string().max(300).optional(),
  servicioIds: z.array(z.string()),
});
type EmpleadoForm = z.infer<typeof schemaEmpleado>;

const schemaInvitar = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type InvitarForm = z.infer<typeof schemaInvitar>;

const schemaBloqueo = z.object({
  fechaInicio: z.string().min(1, "Selecciona una fecha"),
  horaInicio:  z.string().min(1, "Selecciona una hora"),
  fechaFin:    z.string().min(1, "Selecciona una fecha"),
  horaFin:     z.string().min(1, "Selecciona una hora"),
  motivo:      z.string().optional(),
}).refine((d) => {
  if (!d.fechaInicio || !d.horaInicio || !d.fechaFin || !d.horaFin) return true;
  const inicio = new Date(`${d.fechaInicio}T${d.horaInicio}`);
  const fin    = new Date(`${d.fechaFin}T${d.horaFin}`);
  return (fin.getTime() - inicio.getTime()) >= 60 * 60 * 1000;
}, { message: "El bloqueo debe durar al menos 1 hora", path: ["horaFin"] });
type BloqueoForm = z.infer<typeof schemaBloqueo>;

export default function EmpleadosPage() {
  const entrada = useEntradaAnimada();
  const terms = useSectorTerms();
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [busqueda, setBusqueda] = useState("");
  const [modalEmpleado, setModalEmpleado] = useState(false);
  const [modalInvitar, setModalInvitar] = useState(false);
  const [modalHorario, setModalHorario] = useState(false);
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [empleadoEdit, setEmpleadoEdit] = useState<EmpleadoDto | null>(null);
  const [empleadoInvitar, setEmpleadoInvitar] = useState<EmpleadoDto | null>(null);
  const [empleadoHorario, setEmpleadoHorario] = useState<EmpleadoDto | null>(null);
  const [empleadoBloqueo, setEmpleadoBloqueo] = useState<EmpleadoDto | null>(null);
  const [horarioLocal, setHorarioLocal] = useState<HorarioDiaDto[]>([]);
  // Lo cargado del servidor, para saber si el dueño cambió algo antes de cerrar.
  const [horarioOriginal, setHorarioOriginal] = useState<HorarioDiaDto[] | null>(null);
  // Sube en cada apertura del modal de horario; forma parte de la clave de la query.
  const [aperturaHorario, setAperturaHorario] = useState(0);
  const [bloqueoEliminar, setBloqueoEliminar] = useState<{ id: string; texto: string } | null>(null);
  const descarte = useConfirmarDescarte();
  const idDia = useId();
  const [errorInvitar, setErrorInvitar] = useState("");
  const [mostrarPasswordInvitar, setMostrarPasswordInvitar] = useState(false);
  const [empleadoEliminar, setEmpleadoEliminar] = useState<EmpleadoDto | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const empleadoFotoIdRef = useRef<string | null>(null);

  // B13: también los desactivados, para poder reactivarlos. La clave cuelga de
  // ["empleados"], así que invalidarla refresca también los selectores de otras
  // pantallas, que solo piden los activos.
  const { data: empleadosData, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["empleados", { incluirInactivos: true }],
    queryFn: () => empleadosApi.obtenerTodos(true),
  });
  const empleados = useMemo(() => empleadosData ?? [], [empleadosData]);
  // Un fallo del servidor sin datos previos no es un equipo vacío: "Agregar
  // primer empleado" invitaba a dar de alta otra vez a todo el equipo.
  const errorCarga = isError && !empleadosData;

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const empleadosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? empleados.filter((e) => e.nombre.toLowerCase().includes(q)) : empleados;
  }, [empleados, busqueda]);

  // Paginación en el cliente: la plantilla de un negocio no crece sin límite y
  // `obtenerTodos` ya se consume entera en los selectores de otras pantallas,
  // así que moverla al servidor no ahorraría la carga, solo la duplicaría.
  const paginaEmpleados = usePaginacionLocal(empleadosFiltrados);

  const { data: bloqueos = [], isLoading: cargandoBloqueos } = useQuery({
    queryKey: ["bloqueos", empleadoBloqueo?.id],
    queryFn: () => empleadosApi.obtenerBloqueos(empleadoBloqueo!.id),
    enabled: modalBloqueo && !!empleadoBloqueo,
  });

  // El horario se carga con el modal ya abierto y su propio estado de carga y
  // error. Cada apertura usa su propia clave (`aperturaHorario`): al reabrir,
  // incluso para el mismo empleado, se pide de nuevo y llega un `data` nuevo,
  // así el efecto de abajo siempre inicializa el estado local y nunca se edita
  // una copia vieja. `gcTime: 0` descarta las aperturas anteriores.
  const horarioQuery = useQuery({
    queryKey: ["horario-empleado", empleadoHorario?.id, aperturaHorario],
    queryFn: () => empleadosApi.obtenerHorario(empleadoHorario!.id),
    enabled: modalHorario && !!empleadoHorario,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!horarioQuery.data) return;
    const completo = completarHorario(horarioQuery.data);
    setHorarioLocal(completo);
    setHorarioOriginal(completo);
  }, [horarioQuery.data]);

  const horarioCargado = horarioOriginal !== null && horarioQuery.isSuccess;
  const horarioSucio = horarioCargado && JSON.stringify(horarioLocal) !== JSON.stringify(horarioOriginal);

  const { data: horariosNegocio = [] } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: negociosApi.obtenerHorarios,
  });

  const formBloqueo = useForm<BloqueoForm>({ resolver: zodResolver(schemaBloqueo) });

  const fbFechaInicio = formBloqueo.watch("fechaInicio");
  const fbFechaFin    = formBloqueo.watch("fechaFin");

  const { data: citasDiaInicio = [] } = useQuery({
    queryKey: ["citas-dia", empleadoBloqueo?.id, fbFechaInicio],
    queryFn: () => citasApi.obtenerTodas({
      empleadoId: empleadoBloqueo!.id,
      desde: fbFechaInicio,
      hasta: fbFechaInicio,
      tamano: 50,
    }).then((r) => r.datos),
    enabled: modalBloqueo && !!empleadoBloqueo && fbFechaInicio.length > 0,
  });

  const { data: citasDiaFin = [] } = useQuery({
    queryKey: ["citas-dia", empleadoBloqueo?.id, fbFechaFin],
    queryFn: () => citasApi.obtenerTodas({
      empleadoId: empleadoBloqueo!.id,
      desde: fbFechaFin,
      hasta: fbFechaFin,
      tamano: 50,
    }).then((r) => r.datos),
    enabled: modalBloqueo && !!empleadoBloqueo && fbFechaFin.length > 0 && fbFechaFin !== fbFechaInicio,
  });

  const busySlotsInicio = citasABusySlots(citasDiaInicio);
  const busySlotsFin    = citasABusySlots(fbFechaFin === fbFechaInicio ? citasDiaInicio : citasDiaFin);

  // Hora actual redondeada al siguiente slot de 30 min ("HH:MM")
  const ahoraMin = (): string => {
    const n = new Date();
    const total = n.getHours() * 60 + n.getMinutes();
    const siguiente = Math.ceil(total / 30) * 30;
    return `${String(Math.floor(siguiente / 60) % 24).padStart(2,"0")}:${String(siguiente % 60).padStart(2,"0")}`;
  };

  // Devuelve { min, max } para el picker de hora dado una fecha
  const rangoHorario = (fecha: string): { min: string; max: string } | null => {
    if (!fecha) return null;
    const dia = new Date(fecha + "T12:00").getDay();
    const h = horariosNegocio.find((x) => x.diaSemana === dia);
    // Fecha local: con `toISOString()` desde las 18:00 en México "hoy" ya era
    // mañana y el mínimo de la hora de hoy dejaba de aplicarse.
    const fechaHoy = hoy();
    const activeIntervals = h?.activo ? h.intervalos : [];
    const minNegocio = activeIntervals[0]?.horaInicio ?? "00:00";
    const maxNegocio = activeIntervals[activeIntervals.length - 1]?.horaFin ?? "23:30";
    const minEfectivo = fecha === fechaHoy
      ? (ahoraMin() > minNegocio ? ahoraMin() : minNegocio)
      : minNegocio;
    return { min: minEfectivo, max: maxNegocio };
  };

  const formEmpleado = useForm<EmpleadoForm>({
    resolver: zodResolver(schemaEmpleado),
    defaultValues: { servicioIds: [] },
  });

  const formInvitar = useForm<InvitarForm>({ resolver: zodResolver(schemaInvitar) });

  const abrirCrear = () => {
    setEmpleadoEdit(null);
    formEmpleado.reset({ nombre: "", telefono: "", email: "", biografia: "", servicioIds: [] });
    setModalEmpleado(true);
  };

  const abrirEditar = (emp: EmpleadoDto) => {
    setEmpleadoEdit(emp);
    formEmpleado.reset({
      nombre: emp.nombre, telefono: emp.telefono ?? "", email: emp.email ?? "",
      biografia: emp.biografia ?? "", servicioIds: emp.servicioIds,
    });
    setModalEmpleado(true);
  };

  const abrirInvitar = (emp: EmpleadoDto) => {
    setEmpleadoInvitar(emp);
    formInvitar.reset({ email: emp.email ?? "" });
    setErrorInvitar("");
    setModalInvitar(true);
  };

  // Abre al instante; el horario llega por `horarioQuery`.
  const abrirHorario = (emp: EmpleadoDto) => {
    setEmpleadoHorario(emp);
    setHorarioLocal([]);
    setHorarioOriginal(null);
    setAperturaHorario((n) => n + 1);
    setModalHorario(true);
  };

  const abrirBloqueo = (emp: EmpleadoDto) => {
    setEmpleadoBloqueo(emp);
    formBloqueo.reset({ fechaInicio: "", horaInicio: "", fechaFin: "", horaFin: "", motivo: "" });
    setModalBloqueo(true);
  };

  const fotoEmpleado = useSubirImagen({
    subir: (archivo, id, onProgreso) => empleadosApi.subirFoto(id!, archivo, onProgreso),
    onExito: () => { qc.invalidateQueries({ queryKey: ["empleados"] }); toast("Foto actualizada"); },
    mensajeFallo: "No se pudo subir la foto. Intenta de nuevo.",
  });

  const { mutate: guardarEmpleado, isPending: guardando } = useMutation({
    mutationFn: (data: EmpleadoForm) =>
      empleadoEdit
        ? empleadosApi.actualizar(empleadoEdit.id, data)
        : empleadosApi.crear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setModalEmpleado(false);
      toast(`${terms.empleado} guardado`);
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, `No se pudo guardar el ${terms.empleado.toLowerCase()}. Intenta de nuevo.`), "error");
    },
  });

  const { mutate: eliminar, isPending: eliminandoEmpleado } = useMutation({
    mutationFn: (id: string) => empleadosApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setEmpleadoEliminar(null);
      toast(`${terms.empleado} eliminado`);
    },
    // 409: el servidor también bloquea el borrado con citas futuras y explica por qué.
    onError: (err: unknown) => toast(mensajeError(err, `No se pudo eliminar el ${terms.empleado.toLowerCase()}. Intenta de nuevo.`), "error"),
  });

  // B13 (decisión 7): desactivar es la baja reversible. Sale de reservas y de
  // recepción; sus citas ya agendadas no cambian.
  const desactivar = useMutation({
    mutationFn: (id: string) => empleadosApi.desactivar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setEmpleadoEliminar(null);
      toast(`${terms.empleado} desactivado`);
    },
    onError: (err: unknown) => toast(mensajeError(err, `No se pudo desactivar el ${terms.empleado.toLowerCase()}. Intenta de nuevo.`), "error"),
  });

  // 402 si reactivarlo pasa el límite de empleados del plan: el servidor lo explica.
  const reactivar = useMutation({
    mutationFn: (id: string) => empleadosApi.reactivar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empleados"] });
      toast(`${terms.empleado} reactivado`);
    },
    onError: (err: unknown) => toast(mensajeError(err, `No se pudo reactivar el ${terms.empleado.toLowerCase()}. Intenta de nuevo.`), "error"),
  });
  const reactivandoId = reactivar.isPending ? reactivar.variables : undefined;

  const { mutate: guardarHorario, isPending: guardandoHorario } = useMutation({
    // Lo que se guarda llega como variables desde el clic, no del closure:
    // useMutation actualiza `mutationFn` en un efecto, y un clic justo tras el
    // render que carga el horario usaría la versión anterior (`[]`) y
    // borraría el horario del empleado.
    mutationFn: ({ id, horarios }: { id: string; horarios: HorarioDiaDto[] }) =>
      empleadosApi.actualizarHorario(id, horarios),
    onSuccess: () => { setModalHorario(false); setHorarioOriginal(null); toast("Horario guardado"); },
    onError: (err) => toast(mensajeError(err, "No se pudo guardar el horario. Intenta de nuevo."), "error"),
  });

  const { mutate: invitar, isPending: invitando } = useMutation({
    mutationFn: ({ email, password }: InvitarForm) =>
      empleadosApi.invitar(empleadoInvitar!.id, email, password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empleados"] }); setModalInvitar(false); toast("Acceso creado"); },
    onError: (err: unknown) => {
      setErrorInvitar(mensajeError(err, "No se pudo crear la cuenta. Intenta de nuevo."));
    },
  });

  const { mutate: crearBloqueo, isPending: creandoBloqueo } = useMutation({
    mutationFn: (data: BloqueoForm) =>
      empleadosApi.crearBloqueo(empleadoBloqueo!.id, {
        inicioEn: `${data.fechaInicio}T${data.horaInicio}`,
        finEn:    `${data.fechaFin}T${data.horaFin}`,
        motivo:   data.motivo || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bloqueos", empleadoBloqueo?.id] });
      formBloqueo.reset({ fechaInicio: "", horaInicio: "", fechaFin: "", horaFin: "", motivo: "" });
      toast("Bloqueo agregado");
    },
    onError: () => toast("No se pudo agregar el bloqueo. Intenta de nuevo.", "error"),
  });

  const { mutate: eliminarBloqueo, isPending: eliminandoBloqueo } = useMutation({
    mutationFn: (bloqueoId: string) =>
      empleadosApi.eliminarBloqueo(empleadoBloqueo!.id, bloqueoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bloqueos", empleadoBloqueo?.id] });
      setBloqueoEliminar(null);
      toast("Bloqueo eliminado");
    },
    onError: () => toast("No se pudo eliminar el bloqueo. Intenta de nuevo.", "error"),
  });

  const serviciosSeleccionados = formEmpleado.watch("servicioIds") ?? [];

  const toggleServicio = (id: string) => {
    const actuales = serviciosSeleccionados;
    formEmpleado.setValue(
      "servicioIds",
      actuales.includes(id) ? actuales.filter((s) => s !== id) : [...actuales, id]
    );
  };

  function formatBloqueo(iso: string) {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).replace(/\bDe\b/g, "de");
  }

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-4"
        titulo={terms.empleados}
        subtitulo="Altas, horarios de atención y accesos al sistema"
        acciones={
          <BotonAccion onClick={abrirCrear}>
            + Nuevo {terms.empleado.toLowerCase()}
          </BotonAccion>
        }
      />

      {empleados.length > 0 && (
        <FiltroBarra
          etiqueta={`Filtros de ${terms.empleados.toLowerCase()}`}
          busqueda={{
            valor: busqueda,
            onChange: setBusqueda,
            etiqueta: `Buscar ${terms.empleado.toLowerCase()}`,
            placeholder: "Buscar por nombre...",
          }}
          campos={[]}
          onLimpiar={() => setBusqueda("")}
        />
      )}

      {isLoading ? (
        <SkeletonCards cantidad={4} />
      ) : errorCarga ? (
        <ErrorCarga
          mensaje={`No se pudieron cargar los ${terms.empleados.toLowerCase()}.`}
          onReintentar={() => refetch()}
          reintentando={isFetching}
        />
      ) : empleados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center dark:bg-slate-800 dark:border-slate-700">
          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-700">
            <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.196-3.793M9 20H4v-2a4 4 0 015.196-3.793M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="font-medium text-slate-700 mb-1 dark:text-slate-300">Aún no tienes {terms.empleados.toLowerCase()}</p>
          <p className="text-sm text-slate-400 mb-5 dark:text-slate-500">Agrega a tu equipo para que puedan recibir citas</p>
          <BotonAccion onClick={abrirCrear}>
            Agregar primer {terms.empleado.toLowerCase()}
          </BotonAccion>
        </div>
      ) : empleadosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
          <EmptyState
            variante="sinResultados"
            title="Sin resultados"
            description={`Ningún ${terms.empleado.toLowerCase()} coincide con "${busqueda.trim()}"`}
            onLimpiarFiltros={() => setBusqueda("")}
            labelLimpiarFiltros="Limpiar búsqueda"
          />
        </div>
      ) : (
        <>
        {/* Entrada escalonada solo al montar (no al paginar ni filtrar) y nunca con
            movimiento reducido (OM-33). */}
        <motion.div
          {...entrada}
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {paginaEmpleados.visibles.map((emp) => (
            <motion.div
              key={emp.id}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }}
              className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col gap-4 dark:bg-slate-800 dark:border-slate-700"
            >
              <div className="flex gap-4">
                {/* Un botón, no un div: se enfoca con Tab, y la insignia de la cámara
                    está siempre a la vista, también en pantallas táctiles sin hover. */}
                <div className="shrink-0 w-14 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center shrink-0 relative group dark:bg-slate-700 disabled:opacity-60
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => { empleadoFotoIdRef.current = emp.id; fotoInputRef.current?.click(); }}
                    disabled={fotoEmpleado.subiendoEn(emp.id)}
                    aria-label={`Cambiar foto de ${emp.nombre}`}
                    title="Cambiar foto"
                  >
                    <span className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                      {emp.fotoUrl
                        ? <img src={emp.fotoUrl} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xl font-bold text-slate-400">{emp.nombre.charAt(0)}</span>
                      }
                    </span>
                    <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-card border border-border text-muted-foreground flex items-center justify-center shadow-sm group-hover:text-foreground transition">
                      <Camera size={13} />
                    </span>
                  </button>
                  {fotoEmpleado.subiendoEn(emp.id) && (
                    <ProgresoSubida porcentaje={fotoEmpleado.progresoDe(emp.id) ?? null} etiqueta={`Subiendo foto de ${emp.nombre}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-800 truncate dark:text-slate-200">{emp.nombre}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${emp.activo ? "bg-status-confirmed-bg text-status-confirmed-fg" : "bg-status-absent-bg text-status-absent-fg"}`}>
                      {emp.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  {emp.email && <p className="text-xs text-slate-400 truncate dark:text-slate-500">{emp.email}</p>}
                  {emp.telefono && <p className="text-xs text-slate-400 dark:text-slate-500">{emp.telefono}</p>}
                  <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">{emp.servicioIds.length} {emp.servicioIds.length === 1 ? terms.servicio : terms.servicios} asignados</p>
                </div>
              </div>

              {/* Acciones a todo el ancho de la tarjeta y pegadas a su pie (`mt-auto`),
                  así quedan a la misma altura en tarjetas vecinas. Rejilla fija de dos
                  columnas iguales: Editar ocupa la primera fila y las otras cuatro, con
                  Eliminar al final, completan dos filas sin huérfanos en ningún ancho. */}
              <div className="mt-auto grid grid-cols-2 gap-2" role="group" aria-label={`Acciones de ${emp.nombre}`}>
                {/* Inactivo: Reactivar ocupa su propia fila completa encima de Editar,
                    así la rejilla de dos columnas sigue sin huérfanos. */}
                {!emp.activo && (
                  <button
                    type="button"
                    onClick={() => reactivar.mutate(emp.id)}
                    disabled={reactivandoId === emp.id}
                    aria-label={`Reactivar a ${emp.nombre}`}
                    className={`${BOTON_MODAL_SECUNDARIO} col-span-2`}
                  >
                    <RotateCcw size={15} className="text-muted-foreground" aria-hidden="true" /> {reactivandoId === emp.id ? "Reactivando…" : "Reactivar"}
                  </button>
                )}
                <button type="button" onClick={() => abrirEditar(emp)} className={`${BOTON_MODAL_PRIMARIO} col-span-2`}>
                  <Pencil size={15} aria-hidden="true" /> Editar
                </button>
                <button type="button" onClick={() => abrirHorario(emp)} className={BOTON_MODAL_SECUNDARIO}>
                  <Clock size={15} className="text-muted-foreground" aria-hidden="true" /> Horarios
                </button>
                <button type="button" onClick={() => abrirBloqueo(emp)} className={BOTON_MODAL_SECUNDARIO}>
                  <CalendarX size={15} className="text-muted-foreground" aria-hidden="true" /> Bloqueos
                </button>
                <button type="button" onClick={() => abrirInvitar(emp)} className={BOTON_MODAL_SECUNDARIO}>
                  <Mail size={15} className="text-muted-foreground" aria-hidden="true" /> Invitar
                </button>
                <button type="button" onClick={() => setEmpleadoEliminar(emp)} className={BOTON_MODAL_PELIGRO_SUAVE}>
                  <Trash2 size={15} aria-hidden="true" /> Eliminar
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
        {/* Fuera de la tarjeta: la lista es una rejilla de tarjetas sueltas, no
            una tabla con borde al que pegar el paginador. */}
        {paginaEmpleados.totalPaginas > 1 && (
          <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <Pagination
              pagina={paginaEmpleados.pagina}
              totalPaginas={paginaEmpleados.totalPaginas}
              total={paginaEmpleados.total}
              labelTotal={terms.empleados.toLowerCase()}
              onCambiar={paginaEmpleados.setPagina}
              cargando={isLoading}
            />
          </div>
        )}
        </>
      )}

      {/* Modal crear/editar empleado */}
      <Modal
        abierto={modalEmpleado}
        onCerrar={() => descarte.pedirCierre(formEmpleado.formState.isDirty, () => setModalEmpleado(false))}
        titulo={empleadoEdit ? `Editar ${terms.empleado.toLowerCase()}` : `Nuevo ${terms.empleado.toLowerCase()}`}
      >
        <form onSubmit={formEmpleado.handleSubmit((d) => guardarEmpleado(d))} className="space-y-4">
          {(["nombre", "telefono", "email", "biografia"] as const).map((campo) => {
            const labels: Record<string, string> = {
              nombre: "Nombre *", telefono: "Teléfono", email: "Correo", biografia: "Biografía",
            };
            const err = formEmpleado.formState.errors[campo];
            return (
              <div key={campo}>
                <label htmlFor={`${idDia}-emp-${campo}`} className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{labels[campo]}</label>
                {campo === "biografia" ? (
                  <textarea id={`${idDia}-emp-${campo}`} rows={2} {...formEmpleado.register(campo)}
                    aria-invalid={!!err || undefined}
                    aria-describedby={err ? `${idDia}-emp-${campo}-error` : undefined}
                    className={claseCampo(!!err, "resize-none")} />
                ) : (
                  <input id={`${idDia}-emp-${campo}`} type={campo === "email" ? "email" : "text"} {...formEmpleado.register(campo)}
                    aria-invalid={!!err || undefined}
                    aria-describedby={err ? `${idDia}-emp-${campo}-error` : undefined}
                    className={claseCampo(!!err)} />
                )}
                {err && <p id={`${idDia}-emp-${campo}-error`} className={CLASE_ERROR_CAMPO}>{err.message}</p>}
              </div>
            );
          })}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">{terms.servicios} que ofrece</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {servicios.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={serviciosSeleccionados.includes(s.id)}
                    onChange={() => toggleServicio(s.id)}
                    className="accent-slate-700" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{s.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={guardando} className={`${BOTON_MODAL_PRIMARIO} w-full`}>
            {guardando ? "Guardando..." : empleadoEdit ? "Guardar cambios" : "Crear empleado"}
          </button>
        </form>
      </Modal>

      {/* Modal horarios */}
      <Modal
        abierto={modalHorario}
        onCerrar={() => descarte.pedirCierre(horarioSucio, () => { setModalHorario(false); setHorarioOriginal(null); })}
        titulo={`Horarios — ${empleadoHorario?.nombre}`}
      >
        <div className="space-y-3">
          {horarioQuery.isError ? (
            <div role="alert" className="rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
              <p className="flex items-center gap-2 font-medium">
                <AlertCircle size={16} className="text-destructive shrink-0" aria-hidden="true" />
                No se pudo cargar el horario
              </p>
              <p className="mt-1 text-muted-foreground">
                Para no sobrescribir el horario actual, no se puede editar hasta que cargue.
              </p>
              <button
                type="button"
                onClick={() => horarioQuery.refetch()}
                disabled={horarioQuery.isFetching}
                className="mt-3 min-h-[44px] lg:min-h-[36px] px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {horarioQuery.isFetching ? "Reintentando..." : "Reintentar"}
              </button>
            </div>
          ) : !horarioCargado ? (
            <div aria-busy="true" aria-label="Cargando horario" className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : (
            <EditorHorario
              horarios={horarioLocal}
              onCambiar={setHorarioLocal}
              idBase={idDia}
              intervaloInicial={{ horaInicio: "09:00", horaFin: "19:00" }}
              etiquetaCerrado="Descanso"
              horarioPermitido={(dia) => {
                const negDia = horariosNegocio.find((d) => d.diaSemana === dia);
                return negDia?.activo ? negDia.intervalos : null;
              }}
            />
          )}

          <button
            onClick={() => guardarHorario({ id: empleadoHorario!.id, horarios: horarioLocal })}
            disabled={!horarioCargado || guardandoHorario || horarioLocal.some((h) => !!errorDelDia(h))}
            className={`${BOTON_MODAL_PRIMARIO} w-full mt-2`}
          >
            {guardandoHorario ? "Guardando..." : "Guardar horario"}
          </button>
        </div>
      </Modal>

      {/* Modal bloqueos */}
      <Modal
        abierto={modalBloqueo}
        onCerrar={() => descarte.pedirCierre(formBloqueo.formState.isDirty, () => setModalBloqueo(false))}
        titulo={`Bloqueos — ${empleadoBloqueo?.nombre}`}
      >
        <div>
          {/* Lista bloqueos actuales */}
          <div className="mb-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 dark:text-slate-400">Bloqueos activos</p>
            {cargandoBloqueos ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Cargando...</p>
            ) : bloqueos.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Sin bloqueos registrados</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {bloqueos.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 bg-status-pending-bg rounded-lg pl-3 pr-1 py-1">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {formatBloqueo(b.inicioEn)} → {formatBloqueo(b.finEn)}
                      </p>
                      {b.motivo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.motivo}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => b.id && setBloqueoEliminar({ id: b.id, texto: `${formatBloqueo(b.inicioEn)} → ${formatBloqueo(b.finEn)}` })}
                      aria-label={`Eliminar bloqueo ${formatBloqueo(b.inicioEn)} a ${formatBloqueo(b.finEn)}`}
                      className={`${BOTON_QUITAR_BLOQUEO} shrink-0 px-2.5 text-xs`}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario nuevo bloqueo */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3 dark:text-slate-400">Agregar bloqueo</p>
            <form onSubmit={formBloqueo.handleSubmit((d) => crearBloqueo(d))} className="space-y-3">
              {/* Inicio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Inicio *</label>
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    value={formBloqueo.watch("fechaInicio") ?? ""}
                    onChange={(v) => {
                      formBloqueo.setValue("fechaInicio", v, { shouldValidate: true });
                      formBloqueo.setValue("horaInicio", "");
                    }}
                    error={formBloqueo.formState.errors.fechaInicio?.message}
                  />
                  <TimePicker
                    value={formBloqueo.watch("horaInicio") ?? ""}
                    onChange={(v) => formBloqueo.setValue("horaInicio", v, { shouldValidate: true })}
                    minTime={rangoHorario(formBloqueo.watch("fechaInicio"))?.min}
                    maxTime={rangoHorario(formBloqueo.watch("fechaInicio"))?.max}
                    busySlots={busySlotsInicio}
                    error={formBloqueo.formState.errors.horaInicio?.message}
                  />
                </div>
              </div>

              {/* Fin */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Fin *</label>
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    value={formBloqueo.watch("fechaFin") ?? ""}
                    onChange={(v) => {
                      formBloqueo.setValue("fechaFin", v, { shouldValidate: true });
                      formBloqueo.setValue("horaFin", "");
                    }}
                    minDate={formBloqueo.watch("fechaInicio")}
                    error={formBloqueo.formState.errors.fechaFin?.message}
                  />
                  <TimePicker
                    value={formBloqueo.watch("horaFin") ?? ""}
                    onChange={(v) => formBloqueo.setValue("horaFin", v, { shouldValidate: true })}
                    minTime={(() => {
                      const fi = formBloqueo.watch("fechaInicio");
                      const ff = formBloqueo.watch("fechaFin");
                      const hi = formBloqueo.watch("horaInicio");
                      const rango = rangoHorario(ff);
                      const minNegocio = rango?.min;
                      if (fi === ff && hi) {
                        const [hh, mm] = hi.split(":").map(Number);
                        const total = hh * 60 + mm + 60;
                        if (total >= 24 * 60) return minNegocio;
                        const minPorInicio = `${String(Math.floor(total / 60)).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
                        return minNegocio && minNegocio > minPorInicio ? minNegocio : minPorInicio;
                      }
                      return minNegocio;
                    })()}
                    maxTime={rangoHorario(formBloqueo.watch("fechaFin"))?.max}
                    busySlots={busySlotsFin}
                    error={formBloqueo.formState.errors.horaFin?.message}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
                  Motivo <span className="text-slate-400 font-normal dark:text-slate-500">(opcional)</span>
                </label>
                <input
                  type="text"
                  {...formBloqueo.register("motivo")}
                  placeholder="Ej. Vacaciones, cita médica..."
                  className={claseCampo(false)}
                />
              </div>
              <button
                type="submit"
                disabled={creandoBloqueo}
                className={`${BOTON_MODAL_PRIMARIO} w-full`}
              >
                {creandoBloqueo ? "Guardando..." : "Agregar bloqueo"}
              </button>
            </form>
          </div>
        </div>
      </Modal>

      {/* Eliminar empleado (decisión 7, OM-17): bloqueado mientras tenga citas
          abiertas desde hoy (el servidor las cuenta y también lo bloquea, B13).
          Desactivar (reversible) es la acción principal. */}
      <DialogoEliminarConCitas
        abierto={!!empleadoEliminar}
        titulo={`Eliminar ${terms.empleado.toLowerCase()}`}
        filtro={empleadoEliminar ? { empleadoId: empleadoEliminar.id } : null}
        terminoCitas={{ singular: terms.cita.toLowerCase(), plural: terms.citas.toLowerCase() }}
        mensaje={empleadoEliminar && (
          <>
            <p className="mb-1">
              {"¿Seguro que deseas eliminar a "}<span className="font-semibold text-foreground">{empleadoEliminar.nombre}</span>?
            </p>
            <p>{`El ${terms.empleado.toLowerCase()} dejará de aparecer y no podrá recibir nuevas citas. Esta acción no se puede deshacer.`}</p>
          </>
        )}
        alternativa={empleadoEliminar?.activo ? {
          etiqueta: "Desactivar",
          descripcion: `Si solo quieres que deje de recibir ${terms.citas.toLowerCase()}, desactívalo: no aparecerá en tu página de reservas ni en recepción y, si tiene cuenta, perderá el acceso al panel. Puedes reactivarlo cuando quieras.`,
          pendiente: desactivar.isPending,
          onSelect: () => desactivar.mutate(empleadoEliminar.id),
        } : undefined}
        etiquetaEliminar={`Eliminar ${terms.empleado.toLowerCase()}`}
        eliminando={eliminandoEmpleado}
        onEliminar={() => empleadoEliminar && eliminar(empleadoEliminar.id)}
        onCerrar={() => setEmpleadoEliminar(null)}
      />

      {/* Input oculto para foto de empleado */}
      <input
        ref={fotoInputRef}
        type="file"
        accept={ACCEPT_IMAGEN}
        className="hidden"
        onChange={(e) => {
          if (empleadoFotoIdRef.current) fotoEmpleado.alElegir(e, empleadoFotoIdRef.current);
          else e.target.value = "";
        }}
      />

      {/* Modal invitar */}
      <Modal abierto={modalInvitar} onCerrar={() => descarte.pedirCierre(formInvitar.formState.isDirty, () => setModalInvitar(false))} titulo="Invitar acceso al sistema" ancho="sm">
        <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">
          Crea una cuenta para que <strong>{empleadoInvitar?.nombre}</strong> pueda iniciar sesión.
        </p>
        <form onSubmit={formInvitar.handleSubmit((d) => invitar(d))} className="space-y-4">
          <div>
            <label htmlFor={`${idDia}-inv-email`} className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Correo de acceso *</label>
            <input id={`${idDia}-inv-email`} type="email" {...formInvitar.register("email")}
              aria-invalid={!!formInvitar.formState.errors.email || undefined}
              aria-describedby={formInvitar.formState.errors.email ? `${idDia}-inv-email-error` : undefined}
              className={claseCampo(!!formInvitar.formState.errors.email)} />
            {formInvitar.formState.errors.email && (
              <p id={`${idDia}-inv-email-error`} className={CLASE_ERROR_CAMPO}>{formInvitar.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label htmlFor={`${idDia}-inv-password`} className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Contraseña inicial *</label>
            <div className="relative">
              <input
                id={`${idDia}-inv-password`}
                type={mostrarPasswordInvitar ? "text" : "password"}
                {...formInvitar.register("password")}
                aria-invalid={!!formInvitar.formState.errors.password || undefined}
                aria-describedby={formInvitar.formState.errors.password ? `${idDia}-inv-password-error` : undefined}
                className={claseCampo(!!formInvitar.formState.errors.password, "pr-12")}
              />
              {/* Con nombre y en el orden de tabulación: antes era un icono mudo con tabIndex=-1. */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMostrarPasswordInvitar((v) => !v)}
                aria-label={mostrarPasswordInvitar ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={mostrarPasswordInvitar}
                className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {mostrarPasswordInvitar ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            {formInvitar.formState.errors.password && (
              <p id={`${idDia}-inv-password-error`} className={CLASE_ERROR_CAMPO}>{formInvitar.formState.errors.password.message}</p>
            )}
          </div>
          {errorInvitar && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{errorInvitar}</div>
          )}
          <ModalAcciones>
            <button type="button" className={BOTON_MODAL_SECUNDARIO}
              onClick={() => descarte.pedirCierre(formInvitar.formState.isDirty, () => setModalInvitar(false))}>
              Cancelar
            </button>
            <button type="submit" disabled={invitando} className={BOTON_MODAL_PRIMARIO}>
              {invitando ? "Creando cuenta..." : "Crear cuenta de acceso"}
            </button>
          </ModalAcciones>
        </form>
      </Modal>

      {/* Quitar un bloqueo reabre esas horas a reservas en línea. */}
      <ConfirmarAccion
        abierto={!!bloqueoEliminar}
        titulo="Eliminar bloqueo"
        mensaje={bloqueoEliminar && (
          <p>
            {`Se quitará el bloqueo del ${bloqueoEliminar.texto}. Esas horas volverán a estar disponibles para reservar con ${empleadoBloqueo?.nombre ?? `este ${terms.empleado.toLowerCase()}`}.`}
          </p>
        )}
        etiquetaConfirmar="Eliminar bloqueo"
        destructiva
        pendiente={eliminandoBloqueo}
        onConfirmar={() => bloqueoEliminar && eliminarBloqueo(bloqueoEliminar.id)}
        onCerrar={() => setBloqueoEliminar(null)}
      />

      {descarte.dialogo}
    </div>
  );
}
