import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { negociosApi } from "../../api/negocios";
import { citasApi } from "../../api/citas";
import Modal from "../../components/ui/Modal";
import { DatePicker, TimePicker, citasABusySlots } from "../../components/ui/DateTimePicker";
import { SkeletonCards } from "../../components/ui/Skeleton";
import { useToastStore } from "../../store/toastStore";
import type { EmpleadoDto, HorarioDto } from "../../types";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const HORARIO_BASE: HorarioDto[] = Array.from({ length: 7 }, (_, i) => ({
  diaSemana: i,
  horaInicio: "09:00",
  horaFin: "19:00",
  activo: i >= 1 && i <= 6,
}));

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
  const [horarioLocal, setHorarioLocal] = useState<HorarioDto[]>([]);
  const [errorInvitar, setErrorInvitar] = useState("");
  const [mostrarPasswordInvitar, setMostrarPasswordInvitar] = useState(false);
  const [empleadoEliminar, setEmpleadoEliminar] = useState<EmpleadoDto | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const empleadoFotoIdRef = useRef<string | null>(null);

  const { data: empleados = [], isLoading } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const { data: bloqueos = [], isLoading: cargandoBloqueos } = useQuery({
    queryKey: ["bloqueos", empleadoBloqueo?.id],
    queryFn: () => empleadosApi.obtenerBloqueos(empleadoBloqueo!.id),
    enabled: modalBloqueo && !!empleadoBloqueo,
  });

  const { data: horariosNegocio = [] } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: negociosApi.obtenerHorarios,
  });

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
    const hoy = new Date().toISOString().slice(0, 10);
    const minNegocio = (h?.activo ? h.horaInicio : null) ?? "00:00";
    const maxNegocio = (h?.activo ? h.horaFin    : null) ?? "23:30";
    const minEfectivo = fecha === hoy
      ? (ahoraMin() > minNegocio ? ahoraMin() : minNegocio)
      : minNegocio;
    return { min: minEfectivo, max: maxNegocio };
  };

  const formEmpleado = useForm<EmpleadoForm>({
    resolver: zodResolver(schemaEmpleado),
    defaultValues: { servicioIds: [] },
  });

  const formInvitar = useForm<InvitarForm>({ resolver: zodResolver(schemaInvitar) });

  const formBloqueo = useForm<BloqueoForm>({ resolver: zodResolver(schemaBloqueo) });

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

  const abrirHorario = async (emp: EmpleadoDto) => {
    setEmpleadoHorario(emp);
    try {
      const h = await empleadosApi.obtenerHorario(emp.id);
      const merged = HORARIO_BASE.map((base) => {
        const existente = h.find((x) => x.diaSemana === base.diaSemana);
        return existente ?? base;
      });
      setHorarioLocal(merged);
    } catch {
      setHorarioLocal(HORARIO_BASE.map((h) => ({ ...h })));
    }
    setModalHorario(true);
  };

  const abrirBloqueo = (emp: EmpleadoDto) => {
    setEmpleadoBloqueo(emp);
    formBloqueo.reset({ fechaInicio: "", horaInicio: "", fechaFin: "", horaFin: "", motivo: "" });
    setModalBloqueo(true);
  };

  const { mutate: subirFoto } = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => empleadosApi.subirFoto(id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empleados"] }); toast("Foto actualizada"); },
    onError: () => toast("No se pudo subir la foto. Intenta de nuevo.", "error"),
  });

  const { mutate: guardarEmpleado, isPending: guardando } = useMutation({
    mutationFn: (data: EmpleadoForm) =>
      empleadoEdit
        ? empleadosApi.actualizar(empleadoEdit.id, data)
        : empleadosApi.crear(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setModalEmpleado(false);
      toast(empleadoEdit ? "Empleado actualizado" : "Empleado creado");
    },
    onError: () => toast("No se pudo guardar el empleado. Intenta de nuevo.", "error"),
  });

  const { mutate: eliminar } = useMutation({
    mutationFn: (id: string) => empleadosApi.eliminar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empleados"] }); toast("Empleado eliminado"); },
    onError: () => toast("No se pudo eliminar el empleado. Intenta de nuevo.", "error"),
  });

  const { mutate: guardarHorario, isPending: guardandoHorario } = useMutation({
    mutationFn: () => empleadosApi.actualizarHorario(empleadoHorario!.id, horarioLocal),
    onSuccess: () => { setModalHorario(false); toast("Horario guardado"); },
    onError: () => toast("Error al guardar el horario. Intenta de nuevo."),
  });

  const { mutate: invitar, isPending: invitando } = useMutation({
    mutationFn: ({ email, password }: InvitarForm) =>
      empleadosApi.invitar(empleadoInvitar!.id, email, password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empleados"] }); setModalInvitar(false); toast("Cuenta creada exitosamente"); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      setErrorInvitar(msg ?? "No se pudo crear la cuenta. Intenta de nuevo.");
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

  const { mutate: eliminarBloqueo } = useMutation({
    mutationFn: (bloqueoId: string) =>
      empleadosApi.eliminarBloqueo(empleadoBloqueo!.id, bloqueoId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bloqueos", empleadoBloqueo?.id] }); toast("Bloqueo eliminado"); },
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
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).replace(/\bDe\b/g, "de");
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Empleados</h1>
        <button onClick={abrirCrear}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          + Nuevo empleado
        </button>
      </div>

      {empleados.length > 0 && (
        <div className="mb-5">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
          />
        </div>
      )}

      {isLoading ? (
        <SkeletonCards cantidad={4} />
      ) : empleados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.196-3.793M9 20H4v-2a4 4 0 015.196-3.793M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="font-medium text-gray-700 mb-1">Aún no tienes empleados</p>
          <p className="text-sm text-gray-400 mb-5">Agrega a tu equipo para que puedan recibir citas</p>
          <button
            onClick={abrirCrear}
            className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            Agregar primer empleado
          </button>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {empleados
            .filter((e) => !busqueda.trim() || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
            .map((emp) => (
            <motion.div
              key={emp.id}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }}
              className="bg-white rounded-xl border border-gray-100 p-5 flex gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div
                className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer"
                onClick={() => { empleadoFotoIdRef.current = emp.id; fotoInputRef.current?.click(); }}
                title="Cambiar foto"
              >
                {emp.fotoUrl
                  ? <img src={emp.fotoUrl} alt={emp.nombre} className="w-full h-full object-cover" />
                  : <span className="text-xl font-bold text-gray-300">{emp.nombre.charAt(0)}</span>
                }
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-gray-800 truncate">{emp.nombre}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${emp.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    {emp.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                {emp.email && <p className="text-xs text-gray-400 truncate">{emp.email}</p>}
                {emp.telefono && <p className="text-xs text-gray-400">{emp.telefono}</p>}
                <p className="text-xs text-gray-400 mt-1">{emp.servicioIds.length} servicios asignados</p>

                <div className="mt-3 space-y-1.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => abrirEditar(emp)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-slate-700/10 text-slate-700 hover:bg-slate-700/20 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => abrirHorario(emp)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                    >
                      Horarios
                    </button>
                    <button
                      onClick={() => abrirBloqueo(emp)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition"
                    >
                      Bloqueos
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => abrirInvitar(emp)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    >
                      Invitar acceso
                    </button>
                    <button
                      onClick={() => setEmpleadoEliminar(emp)}
                      className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal crear/editar empleado */}
      <Modal
        abierto={modalEmpleado}
        onCerrar={() => setModalEmpleado(false)}
        titulo={empleadoEdit ? "Editar empleado" : "Nuevo empleado"}
      >
        <form onSubmit={formEmpleado.handleSubmit((d) => guardarEmpleado(d))} className="space-y-4">
          {(["nombre", "telefono", "email", "biografia"] as const).map((campo) => {
            const labels: Record<string, string> = {
              nombre: "Nombre *", telefono: "Teléfono", email: "Correo", biografia: "Biografía",
            };
            const err = formEmpleado.formState.errors[campo];
            return (
              <div key={campo}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{labels[campo]}</label>
                {campo === "biografia" ? (
                  <textarea rows={2} {...formEmpleado.register(campo)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none" />
                ) : (
                  <input type={campo === "email" ? "email" : "text"} {...formEmpleado.register(campo)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700
                      ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`} />
                )}
                {err && <p className="text-red-500 text-xs mt-1">{err.message}</p>}
              </div>
            );
          })}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Servicios que ofrece</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {servicios.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={serviciosSeleccionados.includes(s.id)}
                    onChange={() => toggleServicio(s.id)}
                    className="accent-slate-700" />
                  <span className="text-sm text-gray-700">{s.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={guardando}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition">
            {guardando ? "Guardando..." : empleadoEdit ? "Guardar cambios" : "Crear empleado"}
          </button>
        </form>
      </Modal>

      {/* Modal horarios */}
      <Modal
        abierto={modalHorario}
        onCerrar={() => setModalHorario(false)}
        titulo={`Horarios — ${empleadoHorario?.nombre}`}
      >
        <div className="space-y-3">
          {horarioLocal.map((h, i) => (
            <div key={h.diaSemana} className={`rounded-lg border p-3 transition ${h.activo ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => {
                      const updated = [...horarioLocal];
                      updated[i] = { ...h, activo: !h.activo };
                      setHorarioLocal(updated);
                    }}
                    className={`w-9 h-5 rounded-full transition relative cursor-pointer shrink-0 ${h.activo ? "bg-slate-700" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${h.activo ? "left-4" : "left-0.5"}`} />
                  </div>
                  <span className={`text-sm font-medium ${h.activo ? "text-gray-800" : "text-gray-400"}`}>
                    {DIAS[h.diaSemana]}
                  </span>
                </label>
                {!h.activo && <span className="text-xs text-gray-400">Descanso</span>}
              </div>
              {h.activo && (
                <div className="flex items-center gap-3 ml-6">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">De</span>
                    <input
                      type="time" value={h.horaInicio}
                      onChange={(e) => {
                        const updated = [...horarioLocal];
                        updated[i] = { ...h, horaInicio: e.target.value };
                        setHorarioLocal(updated);
                      }}
                      className="px-2 py-1 rounded border border-gray-200 text-sm outline-none focus:border-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">a</span>
                    <input
                      type="time" value={h.horaFin}
                      onChange={(e) => {
                        const updated = [...horarioLocal];
                        updated[i] = { ...h, horaFin: e.target.value };
                        setHorarioLocal(updated);
                      }}
                      className="px-2 py-1 rounded border border-gray-200 text-sm outline-none focus:border-slate-700"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => guardarHorario()}
            disabled={guardandoHorario}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition mt-2"
          >
            {guardandoHorario ? "Guardando..." : "Guardar horario"}
          </button>
        </div>
      </Modal>

      {/* Modal bloqueos */}
      <Modal
        abierto={modalBloqueo}
        onCerrar={() => setModalBloqueo(false)}
        titulo={`Bloqueos — ${empleadoBloqueo?.nombre}`}
      >
        <div>
          {/* Lista bloqueos actuales */}
          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bloqueos activos</p>
            {cargandoBloqueos ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : bloqueos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin bloqueos registrados</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {bloqueos.map((b) => (
                  <div key={b.id} className="flex items-start justify-between gap-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 capitalize">
                        {formatBloqueo(b.inicioEn)} → {formatBloqueo(b.finEn)}
                      </p>
                      {b.motivo && <p className="text-xs text-gray-500 mt-0.5 truncate">{b.motivo}</p>}
                    </div>
                    <button
                      onClick={() => b.id && eliminarBloqueo(b.id)}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0 mt-0.5"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulario nuevo bloqueo */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Agregar bloqueo</p>
            <form onSubmit={formBloqueo.handleSubmit((d) => crearBloqueo(d))} className="space-y-3">
              {/* Inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin *</label>
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
                        const minPorInicio = `${String(Math.floor(total / 60) % 24).padStart(2,"0")}:${String(total % 60).padStart(2,"0")}`;
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  {...formBloqueo.register("motivo")}
                  placeholder="Ej. Vacaciones, cita médica..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
                />
              </div>
              <button
                type="submit"
                disabled={creandoBloqueo}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
              >
                {creandoBloqueo ? "Guardando..." : "Agregar bloqueo"}
              </button>
            </form>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar eliminar empleado */}
      <Modal abierto={!!empleadoEliminar} onCerrar={() => setEmpleadoEliminar(null)} titulo="Eliminar empleado" ancho="sm">
        {empleadoEliminar && (
          <div>
            <p className="text-sm text-gray-600 mb-1">
              ¿Seguro que deseas eliminar a <span className="font-semibold text-gray-900">{empleadoEliminar.nombre}</span>?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              El empleado dejará de aparecer y no podrá recibir nuevas citas. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setEmpleadoEliminar(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { eliminar(empleadoEliminar.id); setEmpleadoEliminar(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Input oculto para foto de empleado */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && empleadoFotoIdRef.current) subirFoto({ id: empleadoFotoIdRef.current, file: f });
          e.target.value = "";
        }}
      />

      {/* Modal invitar */}
      <Modal abierto={modalInvitar} onCerrar={() => setModalInvitar(false)} titulo="Invitar acceso al sistema" ancho="sm">
        <p className="text-sm text-gray-500 mb-4">
          Crea una cuenta para que <strong>{empleadoInvitar?.nombre}</strong> pueda iniciar sesión.
        </p>
        <form onSubmit={formInvitar.handleSubmit((d) => invitar(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo de acceso *</label>
            <input type="email" {...formInvitar.register("email")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700
                ${formInvitar.formState.errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`} />
            {formInvitar.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{formInvitar.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña inicial *</label>
            <div className="relative">
              <input
                type={mostrarPasswordInvitar ? "text" : "password"}
                {...formInvitar.register("password")}
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700
                  ${formInvitar.formState.errors.password ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMostrarPasswordInvitar((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {mostrarPasswordInvitar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {formInvitar.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{formInvitar.formState.errors.password.message}</p>
            )}
          </div>
          {errorInvitar && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{errorInvitar}</div>
          )}
          <button type="submit" disabled={invitando}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition">
            {invitando ? "Creando cuenta..." : "Crear cuenta de acceso"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
