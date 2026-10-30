import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Search, UserCheck, X } from "lucide-react";
import { z } from "zod";
import { citasApi } from "../../api/citas";
import { clientesApi } from "../../api/clientes";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { api } from "../../api/axios";
import { DatePicker } from "../ui/DateTimePicker";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { usePermisos } from "../../hooks/usePermisos";
import { useToastStore } from "../../store/toastStore";
import { fechaLocal, hoy } from "../../utils/fechas";
import { formatFechaHoraCorta, formatHora, formatPrecio } from "../../utils/formatters";
import { mensajeError } from "../../utils/errores";
import { validarEmailCliente } from "../../utils/validaciones";
import type { ClienteDto, SlotDisponible } from "../../types";

// ── Nueva cita ────────────────────────────────────────────────────────────────
//
// Era un asistente de dos pasos dentro de un modal de ~450px: la lista de
// servicios se desplazaba dentro del modal, no se veía en qué paso ibas y el
// cliente se capturaba siempre a mano (I4). Ahora es un panel lateral en
// escritorio (deja ver la agenda detrás, como el de Fresha) y pantalla completa
// en el teléfono, con cuatro pasos a la vista y buscador de clientes.
//
// La creación es la misma: `POST /citas` con servicio, empleado, inicio y los
// datos del cliente; el servidor identifica al cliente por su teléfono.

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

/** Con más servicios que estos, el paso 2 muestra un buscador. */
const SERVICIOS_SIN_BUSCADOR = 8;

/** Lo que llega desde un hueco de la agenda (I1). */
export interface PrecargaNuevaCita {
  inicio?: Date;
  empleadoId?: string;
}

type Paso = 1 | 2 | 3 | 4;

const CAMPO =
  "w-full px-3 py-2 min-h-[44px] lg:min-h-[40px] rounded-lg border text-sm outline-none focus:border-accent-brand bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";
const CAMPO_NORMAL = `${CAMPO} border-slate-200 dark:border-slate-600`;
const CAMPO_ERROR = `${CAMPO} border-red-400 bg-red-50 dark:bg-red-900/20`;
const OPCION =
  "w-full text-left px-3 min-h-[48px] py-2 rounded-xl border text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const OPCION_ELEGIDA = `${OPCION} bg-slate-700 text-white border-slate-700`;
const OPCION_LIBRE = `${OPCION} border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-800`;
const BOTON_PRIMARIO =
  "min-h-[44px] lg:min-h-[40px] px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const BOTON_SECUNDARIO =
  "min-h-[44px] lg:min-h-[40px] px-4 rounded-xl border border-border dark:border-slate-600 text-sm font-medium text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  precarga?: PrecargaNuevaCita;
}

export default function NuevaCitaPanel({ abierto, onCerrar, precarga }: Props) {
  const terms = useSectorTerms();
  const cita1 = terms.cita.toLowerCase();
  const titulo = `Nueva ${cita1}`;
  return (
    <DialogPrimitive.Root open={abierto} onOpenChange={(o) => { if (!o) onCerrar(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-800 outline-none lg:left-auto lg:w-[480px] lg:border-l lg:border-slate-200 dark:lg:border-slate-700 lg:shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:data-[state=open]:slide-in-from-right-8"
        >
          {/* Se monta de nuevo en cada apertura: siempre empieza en el paso 1. */}
          {abierto && <Contenido titulo={titulo} onCerrar={onCerrar} precarga={precarga} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Contenido({ titulo, onCerrar, precarga }: { titulo: string; onCerrar: () => void; precarga?: PrecargaNuevaCita }) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  const cita1 = terms.cita.toLowerCase();
  const permisos = usePermisos();
  // El directorio de clientes es del propietario (el API responde 403 al Empleado).
  const puedeBuscarClientes = !permisos.esEmpleado;

  const [paso, setPaso] = useState<Paso>(1);

  // Paso 1 — cliente
  const [busqueda, setBusqueda] = useState("");
  const [termino, setTermino] = useState("");
  const [clienteElegido, setClienteElegido] = useState<ClienteDto | null>(null);
  const [fCliente, setFCliente] = useState({ nombre: "", telefono: "", email: "" });
  const [telefonoError, setTelefonoError] = useState("");
  const [emailError, setEmailError] = useState("");

  // Paso 2 — servicio
  const [busquedaServicio, setBusquedaServicio] = useState("");
  const [svcSel, setSvcSel] = useState("");
  // Empleado del hueco: acota los servicios a los suyos hasta que se pida ver todos.
  const [empleadoFijo, setEmpleadoFijo] = useState(precarga?.empleadoId ?? "");

  // Paso 3 — empleado, fecha y hora
  const [empSel, setEmpSel] = useState(precarga?.empleadoId ?? "");
  const [fechaNueva, setFechaNueva] = useState(precarga?.inicio ? fechaLocal(precarga.inicio) : "");
  const [slotNuevo, setSlotNuevo] = useState("");

  // Paso 4 — confirmar
  const [notas, setNotas] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermino(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: empleados = [] } = useQuery({ queryKey: ["empleados"], queryFn: () => empleadosApi.obtenerTodos() });
  const { data: servicios = [] } = useQuery({ queryKey: ["servicios"], queryFn: () => serviciosApi.obtenerTodos() });

  const { data: resultadosClientes = [], isFetching: buscandoClientes, isError: errorClientes } = useQuery({
    queryKey: ["clientes-buscar", termino],
    queryFn: async () => (await clientesApi.obtenerTodos(termino, 1, 6)).datos,
    enabled: puedeBuscarClientes && termino.length >= 2,
    staleTime: 30_000,
  });

  const empleadoDelHueco = empleados.find((e) => e.id === empleadoFijo);
  const serviciosActivos = servicios.filter((s) => s.activo);
  const serviciosDelPaso = (empleadoDelHueco
    ? serviciosActivos.filter((s) => empleadoDelHueco.servicioIds.includes(s.id))
    : serviciosActivos
  ).filter((s) => !busquedaServicio.trim() || s.nombre.toLowerCase().includes(busquedaServicio.trim().toLowerCase()));

  const empleadosFiltrados = svcSel
    ? empleados.filter((e) => e.servicioIds.includes(svcSel) && e.activo)
    : empleados.filter((e) => e.activo);

  const { data: slots = [], isFetching: cargandoSlots, isError: errorSlots } = useQuery({
    queryKey: ["slots-nueva", svcSel, empSel, fechaNueva],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: svcSel, empleadoId: empSel, fecha: fechaNueva },
      });
      return data;
    },
    enabled: !!svcSel && !!empSel && !!fechaNueva,
  });

  // La hora del hueco se elige sola si ese horario está libre para el servicio.
  // Los horarios disponibles van en pasos de la duración del servicio (9:00,
  // 9:45, 10:30…), así que un clic a las 11:00 casi nunca coincide exacto: si
  // no, se propone el primero que empieza dentro de la hora siguiente.
  const horaPrecargada = precarga?.inicio?.getTime();
  const enElDiaDelHueco = horaPrecargada !== undefined && !!fechaNueva && fechaNueva === fechaLocal(precarga!.inicio!);
  const slotExacto = enElDiaDelHueco ? slots.find((s) => new Date(s.inicio).getTime() === horaPrecargada) : undefined;
  const slotCercano = enElDiaDelHueco && !slotExacto
    ? slots.find((s) => {
        const dif = new Date(s.inicio).getTime() - horaPrecargada!;
        return dif > 0 && dif < 60 * 60_000;
      })
    : undefined;
  const slotDelHueco = slotExacto ?? slotCercano;
  const slotEfectivo = slotNuevo || slotDelHueco?.inicio || "";
  const listoParaComparar = enElDiaDelHueco && !cargandoSlots && !errorSlots && !!svcSel && !!empSel;
  const huecoNoDisponible = listoParaComparar && !slotDelHueco;
  const huecoAjustado = listoParaComparar && !slotExacto && !!slotCercano && !slotNuevo;

  const servicio = servicios.find((s) => s.id === svcSel);
  const empleado = empleados.find((e) => e.id === empSel);

  const { mutate: crearCita, isPending: creando } = useMutation({
    mutationFn: () => citasApi.crear({
      servicioId: svcSel,
      empleadoId: empSel,
      inicioEn: slotEfectivo,
      nombreCliente: fCliente.nombre.trim(),
      telefonoCliente: fCliente.telefono.trim(),
      emailCliente: fCliente.email.trim() || undefined,
      notas: notas.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast(`${terms.cita} creada`);
      onCerrar();
    },
    onError: (err: unknown) => {
      toast(mensajeError(err, `No se pudo crear la ${cita1}`), "error");
    },
  });

  // ── Acciones de paso ─────────────────────────────────────────────────────────
  const elegirCliente = (c: ClienteDto) => {
    setClienteElegido(c);
    setFCliente({ nombre: c.nombreCompleto, telefono: c.telefono, email: c.email ?? "" });
    setTelefonoError("");
    setEmailError("");
    setBusqueda("");
    setTermino("");
  };

  const validarCliente = () => {
    const errTel = validarTelefonoCliente(fCliente.telefono);
    const errEmail = validarEmailCliente(fCliente.email);
    setTelefonoError(errTel);
    setEmailError(errEmail);
    if (errTel) document.getElementById("nueva-telefono")?.focus();
    return !errTel && !errEmail;
  };

  const elegirServicio = (id: string) => {
    setSvcSel(id);
    setSlotNuevo("");
    const ofrecen = empleados.filter((e) => e.activo && e.servicioIds.includes(id));
    // Se conserva el empleado si ofrece el servicio; si solo uno lo ofrece, se elige solo.
    if (!ofrecen.some((e) => e.id === empSel)) setEmpSel(ofrecen.length === 1 ? ofrecen[0].id : "");
    // Elegir el servicio es la respuesta del paso: se pasa directo al siguiente.
    setPaso(3);
  };

  const puedeAvanzar: Record<Paso, boolean> = {
    1: !!fCliente.nombre.trim() && !emailError,
    2: !!svcSel,
    3: !!slotEfectivo,
    4: !creando,
  };

  const avanzar = () => {
    if (paso === 1) { if (validarCliente()) setPaso(2); return; }
    if (paso === 2 && svcSel) { setPaso(3); return; }
    if (paso === 3 && slotEfectivo) { setPaso(4); return; }
    if (paso === 4) {
      // Mismas reglas que antes del envío: teléfono obligatorio, correo válido.
      if (!validarCliente()) { setPaso(1); return; }
      crearCita();
    }
  };

  const PASOS: { n: Paso; etiqueta: string }[] = [
    { n: 1, etiqueta: "Cliente" },
    { n: 2, etiqueta: "Servicio" },
    { n: 3, etiqueta: "Horario" },
    { n: 4, etiqueta: "Confirmar" },
  ];

  return (
    <>
      {/* Cabecera fija: título, cierre y pasos */}
      <div className="shrink-0 border-b border-slate-100 dark:border-slate-700 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-2">
          <DialogPrimitive.Title className="text-base font-semibold text-slate-800 dark:text-slate-100">{titulo}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Cerrar"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={18} aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5" aria-live="polite">
          {`Paso ${paso} de 4 · ${PASOS[paso - 1].etiqueta}`}
        </p>
        <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Pasos">
          {PASOS.map(({ n, etiqueta }) => {
            const hecho = n < paso;
            const actual = n === paso;
            return (
              <li key={n}>
                <button
                  type="button"
                  disabled={!hecho}
                  onClick={() => setPaso(n)}
                  aria-current={actual ? "step" : undefined}
                  className="w-full text-left group disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <span className={`block h-1 rounded-full ${hecho || actual ? "bg-slate-700 dark:bg-slate-300" : "bg-slate-200 dark:bg-slate-700"}`} />
                  <span className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${
                    actual ? "text-slate-800 dark:text-slate-100" : hecho ? "text-slate-600 dark:text-slate-300 group-hover:underline" : "text-slate-400 dark:text-slate-500"
                  }`}>
                    {hecho && <Check size={11} aria-hidden="true" />}
                    {etiqueta}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {precarga?.inicio && (
          <p className="mt-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-700/60 px-2.5 py-1.5 text-slate-600 dark:text-slate-300">
            {`Hueco elegido: ${formatFechaHoraCorta(precarga.inicio.toISOString())}`}
            {empleadoDelHueco ? ` · ${empleadoDelHueco.nombre}` : ""}
          </p>
        )}
      </div>

      {/* Cuerpo: el único que se desplaza */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 py-5 text-foreground">
        {paso === 1 && (
          <div className="space-y-4">
            {puedeBuscarClientes && (
              <div>
                <label htmlFor="nueva-buscar-cliente" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Buscar cliente
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="nueva-buscar-cliente"
                    type="search"
                    autoComplete="off"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre o teléfono"
                    className={`${CAMPO_NORMAL} pl-9`}
                  />
                </div>
                {termino.length >= 2 && (
                  <div className="mt-2" aria-live="polite">
                    {buscandoClientes ? (
                      <p className="text-xs text-muted-foreground">Buscando…</p>
                    ) : errorClientes ? (
                      <p className="text-xs text-red-700 dark:text-red-400" role="alert">No se pudo buscar. Captura sus datos abajo.</p>
                    ) : resultadosClientes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin coincidencias. Captura sus datos abajo.</p>
                    ) : (
                      <ul className="space-y-1.5" aria-label="Clientes encontrados">
                        {resultadosClientes.map((c) => (
                          <li key={c.id}>
                            <button type="button" onClick={() => elegirCliente(c)} className={OPCION_LIBRE}>
                              <span className="font-medium">{c.nombreCompleto}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{c.telefono}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {clienteElegido && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-status-confirmed-bg text-status-confirmed-fg px-3 py-2 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <UserCheck size={16} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{`Cliente existente: ${clienteElegido.nombreCompleto}`}</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setClienteElegido(null); setFCliente({ nombre: "", telefono: "", email: "" }); }}
                  className="shrink-0 text-xs font-semibold underline min-h-[36px] px-1"
                >
                  Cambiar
                </button>
              </div>
            )}

            {puedeBuscarClientes && !clienteElegido && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">O registra uno nuevo</p>
            )}

            <div>
              <label htmlFor="nueva-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nombre del cliente <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span>
              </label>
              <input
                id="nueva-nombre"
                type="text"
                required
                value={fCliente.nombre}
                onChange={(e) => setFCliente((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className={CAMPO_NORMAL}
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
                aria-invalid={!!telefonoError || undefined}
                aria-describedby={telefonoError ? "nueva-telefono-error" : undefined}
                value={fCliente.telefono}
                onChange={(e) => {
                  setFCliente((p) => ({ ...p, telefono: e.target.value }));
                  // Otro teléfono es otro cliente para el servidor.
                  if (clienteElegido && e.target.value.trim() !== clienteElegido.telefono) setClienteElegido(null);
                  if (telefonoError) setTelefonoError(validarTelefonoCliente(e.target.value));
                }}
                onBlur={() => { if (fCliente.telefono) setTelefonoError(validarTelefonoCliente(fCliente.telefono)); }}
                placeholder="10 dígitos"
                className={telefonoError ? CAMPO_ERROR : CAMPO_NORMAL}
              />
              {telefonoError && (
                <p id="nueva-telefono-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} aria-hidden="true" /> {telefonoError}
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
                aria-invalid={!!emailError || undefined}
                aria-describedby={emailError ? "nueva-email-error" : undefined}
                value={fCliente.email}
                onChange={(e) => {
                  setFCliente((p) => ({ ...p, email: e.target.value }));
                  if (emailError) setEmailError(validarEmailCliente(e.target.value));
                }}
                onBlur={() => setEmailError(validarEmailCliente(fCliente.email))}
                placeholder="correo@ejemplo.com"
                className={emailError ? CAMPO_ERROR : CAMPO_NORMAL}
              />
              {emailError && (
                <p id="nueva-email-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} aria-hidden="true" /> {emailError}
                </p>
              )}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-3">
            {empleadoDelHueco && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{`Servicios que ofrece ${empleadoDelHueco.nombre}`}</span>
                <button type="button" onClick={() => setEmpleadoFijo("")} className="font-semibold underline min-h-[36px]">
                  Ver todos los servicios
                </button>
              </div>
            )}
            {serviciosActivos.length > SERVICIOS_SIN_BUSCADOR && (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar servicio"
                  value={busquedaServicio}
                  onChange={(e) => setBusquedaServicio(e.target.value)}
                  placeholder="Buscar servicio"
                  className={`${CAMPO_NORMAL} pl-9`}
                />
              </div>
            )}
            <p id="nueva-servicio" className="sr-only">Servicio</p>
            {serviciosDelPaso.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Ningún servicio coincide.</p>
            ) : (
              <div role="group" aria-labelledby="nueva-servicio" className="space-y-2">
                {serviciosDelPaso.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={svcSel === s.id}
                    onClick={() => elegirServicio(s.id)}
                    className={svcSel === s.id ? OPCION_ELEGIDA : OPCION_LIBRE}
                  >
                    <span className="font-medium">{s.nombre}</span>
                    <span className={`ml-2 text-xs ${svcSel === s.id ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                      {s.duracionMinutos} min · {formatPrecio(s.precio)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-5">
            <div>
              <p id="nueva-profesional" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{terms.empleado}</p>
              {empleadosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Ningún empleado ofrece este servicio</p>
              ) : (
                <div role="group" aria-labelledby="nueva-profesional" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {empleadosFiltrados.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      aria-pressed={empSel === e.id}
                      onClick={() => { setEmpSel(e.id); setSlotNuevo(""); }}
                      className={empSel === e.id ? OPCION_ELEGIDA : OPCION_LIBRE}
                    >
                      {e.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {empSel && (
              <DatePicker
                label="Fecha"
                value={fechaNueva}
                minDate={hoy()}
                onChange={(v) => { setFechaNueva(v); setSlotNuevo(""); }}
              />
            )}

            {empSel && fechaNueva && (
              <div>
                <p id="nueva-horario" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Horario disponible</p>
                {huecoNoDisponible && (
                  <p className="mb-2 text-xs rounded-lg bg-status-pending-bg text-status-pending-fg px-2.5 py-1.5" role="status">
                    {`Las ${formatHora(precarga!.inicio!.toISOString())} no están disponibles para este servicio. Elige otro horario.`}
                  </p>
                )}
                {huecoAjustado && (
                  <p className="mb-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-2.5 py-1.5" role="status">
                    {`Las ${formatHora(precarga!.inicio!.toISOString())} no están libres para este servicio; te proponemos las ${formatHora(slotCercano!.inicio)}, el siguiente horario libre.`}
                  </p>
                )}
                {cargandoSlots ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Cargando horarios...</p>
                ) : errorSlots ? (
                  <p className="text-xs text-red-700 dark:text-red-400 text-center py-2" role="alert">Error al cargar horarios. Intenta de nuevo.</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div role="group" aria-labelledby="nueva-horario" className="grid grid-cols-3 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.inicio}
                        type="button"
                        aria-pressed={slotEfectivo === s.inicio}
                        onClick={() => setSlotNuevo(s.inicio)}
                        className={`min-h-[44px] lg:min-h-[40px] text-sm rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          slotEfectivo === s.inicio
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
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <dl className="rounded-xl bg-slate-50 dark:bg-slate-700/60 p-4 text-sm space-y-2">
              <FilaResumen etiqueta="Cliente" valor={`${fCliente.nombre.trim()} · ${fCliente.telefono.trim()}`} onCambiar={() => setPaso(1)} />
              <FilaResumen
                etiqueta="Servicio"
                valor={servicio ? `${servicio.nombre} · ${servicio.duracionMinutos} min · ${formatPrecio(servicio.precio)}` : ""}
                onCambiar={() => setPaso(2)}
              />
              <FilaResumen etiqueta={terms.empleado} valor={empleado?.nombre ?? ""} onCambiar={() => setPaso(3)} />
              <FilaResumen etiqueta="Fecha y hora" valor={slotEfectivo ? formatFechaHoraCorta(slotEfectivo) : ""} onCambiar={() => setPaso(3)} />
            </dl>
            <div>
              <label htmlFor="nueva-nota" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nota interna <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <textarea
                id="nueva-nota"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                placeholder="Preferencias, indicaciones..."
                className={`${CAMPO_NORMAL} resize-none`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pie fijo: Atrás y la acción del paso */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-700 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2">
        {paso > 1 ? (
          <button type="button" onClick={() => setPaso((paso - 1) as Paso)} className={BOTON_SECUNDARIO}>
            Atrás
          </button>
        ) : <span />}
        {/* En el paso 2 elegir un servicio ya avanza; el botón queda para volver a pasar. */}
        <button type="button" onClick={avanzar} disabled={!puedeAvanzar[paso]} className={BOTON_PRIMARIO}>
          {paso === 4 ? (creando ? "Creando..." : `Crear ${cita1}`) : "Continuar"}
        </button>
      </div>
    </>
  );
}

function FilaResumen({ etiqueta, valor, onCambiar }: { etiqueta: string; valor: string; onCambiar: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
        <dd className="font-medium text-slate-800 dark:text-slate-100 break-words">{valor}</dd>
      </div>
      <button
        type="button"
        onClick={onCambiar}
        aria-label={`Cambiar ${etiqueta.toLowerCase()}`}
        className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300 underline min-h-[36px] px-1"
      >
        Cambiar
      </button>
    </div>
  );
}
