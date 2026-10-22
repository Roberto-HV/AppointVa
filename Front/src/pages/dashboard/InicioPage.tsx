import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CheckCircle2, ChevronDown, Circle, X, Scissors, Users, CalendarDays, Clock, TrendingUp, Store, Images, ExternalLink, History } from "lucide-react";
import { clientesApi } from "../../api/clientes";
import type { CitaDto, ClienteCitaDto } from "../../types";
import { NotificacionBanner } from "../../components/ui/NotificacionBanner";
import { dashboardApi } from "../../api/dashboard";
import { citasApi } from "../../api/citas";
import { negociosApi } from "../../api/negocios";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { useAuthStore } from "../../store/authStore";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import Modal from "../../components/ui/Modal";
import AccionesCita, { HojaAccionesCita, type VistaHoja } from "../../components/dashboard/AccionesCita";
import { InsigniaPorCerrar } from "../../components/dashboard/TarjetaCita";
import { colorCategoria, EJE_TICK, REJILLA } from "../../lib/temaGraficas";
import { citaAbierta, citaPorCerrar, estiloEstadoCita } from "../../lib/estadoCita";
import { hoy as hoyLocal, inicioSemana as inicioSemanaLocal, finSemana as finSemanaLocal, fechaLocal } from "../../utils/fechas";
import { formatPrecio, formatPrecioCorto, formatFechaHoraResumen as formatFechaHora, capitalizarPrimera } from "../../utils/formatters";
import EncabezadoHoy from "../../components/dashboard/EncabezadoHoy";
import TarjetaPrimeraReserva from "../../components/dashboard/PrimeraReserva";
import { usePrimeraReserva } from "../../lib/primeraReserva";
import { getSectorTerms } from "../../hooks/useSectorTerms";
import { saludoDelDia } from "../../lib/fraseHoy";

// Una cifra en línea: etiqueta y valor con cifras tabulares, sin tarjeta.
function Cifra({ label, valor }: { label: string; valor: string | number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-semibold text-foreground tabular-nums">{valor}</span>
    </span>
  );
}

// Citas e ingresos del periodo en una sola línea de texto: antes eran dos filas
// de tres tarjetas, seis ceros grandes en un día sin reservas.
function ResumenPeriodo({ grupo, cifras }: { grupo: string; cifras: { label: string; valor: string | number }[] }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="font-semibold text-foreground">{grupo}</span>
      {cifras.map((c, i) => (
        <span key={c.label} className="inline-flex items-baseline gap-3">
          {i > 0 && <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>}
          <Cifra label={c.label} valor={c.valor} />
        </span>
      ))}
    </p>
  );
}

// ── Wizard de onboarding ──────────────────────────────────────────────────────
interface OnboardingProps {
  negocioId: string;
  slug: string;
  tieneServicios: boolean;
  tieneHorarios: boolean;
  tieneEmpleados: boolean;
  tieneDescripcion: boolean;
  tieneGaleria: boolean;
  cargando: boolean;
  visible: boolean;
  onClose: () => void;
}

function WizardOnboarding({ negocioId, slug, tieneServicios, tieneHorarios, tieneEmpleados, tieneDescripcion, tieneGaleria, cargando, visible, onClose }: OnboardingProps) {
  const keyEnlace = `enlace-visto-${negocioId}`;
  const [enlaceVisto, setEnlaceVisto] = useState(() => !!localStorage.getItem(keyEnlace));
  const [expandida, setExpandida] = useState(false);

  if (!visible || cargando) return null;

  const pasos = [
    { hecho: true,             icono: CheckCircle2,  label: "Cuenta creada",              desc: "Tu negocio está registrado en AppointVa",                    accion: null },
    { hecho: tieneServicios,   icono: Scissors,      label: "Agrega servicios",           desc: "Define los servicios que ofreces y sus precios",              accion: { href: "/dashboard/servicios", texto: "Ir a Servicios" } },
    { hecho: tieneHorarios,    icono: CalendarDays,  label: "Configura tus horarios",     desc: "Sin horarios configurados tus clientes no podrán reservar",   accion: { href: "/dashboard/perfil?tab=horarios", texto: "Ir a Horarios" } },
    { hecho: tieneEmpleados,   icono: Users,         label: "Agrega tu equipo",           desc: "Registra empleados para asignar citas",                       accion: { href: "/dashboard/empleados", texto: "Ir a Empleados" } },
    { hecho: tieneDescripcion, icono: Store,         label: "Completa tu perfil",         desc: "Agrega descripción y foto para que los clientes te conozcan",  accion: { href: "/dashboard/perfil", texto: "Ir a Perfil" } },
    { hecho: tieneGaleria,     icono: Images,        label: "Sube fotos a tu galería",    desc: "Las imágenes generan confianza y atraen más clientes",         accion: { href: "/dashboard/galeria", texto: "Ir a Galería" } },
    { hecho: enlaceVisto,      icono: ExternalLink,  label: "Prueba tu página de reservas", desc: "Visita tu página y comprueba que todo se ve bien",           accion: { href: `/b/${slug}`, texto: "Ver mi página", externo: true, onClick: () => { localStorage.setItem(keyEnlace, "1"); setEnlaceVisto(true); } } },
  ];

  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = Math.round((hechos / pasos.length) * 100);
  const siguiente = pasos.find((p) => !p.hecho);
  const idLista = `pasos-onboarding-${negocioId}`;

  const enlacePaso = (p: (typeof pasos)[number]) => {
    if (!p.accion) return null;
    const cls = "shrink-0 min-h-[44px] lg:min-h-[36px] inline-flex items-center text-xs font-semibold text-slate-700 dark:text-slate-100 bg-slate-700/10 dark:bg-slate-600 hover:bg-slate-700/20 dark:hover:bg-slate-500 px-3 rounded-lg transition";
    return p.accion.externo ? (
      <a href={p.accion.href} target="_blank" rel="noopener noreferrer" onClick={p.accion.onClick} className={cls}>
        {p.accion.texto}
      </a>
    ) : (
      <Link to={p.accion.href} className={cls}>{p.accion.texto}</Link>
    );
  };

  // Va debajo de la agenda y empieza plegada: un resumen con el progreso y el
  // siguiente paso. Antes ocupaba la parte alta y empujaba la agenda del día
  // fuera de la pantalla.
  return (
    <section aria-label="Configura tu negocio" className="bg-white dark:bg-slate-800 rounded-xl border border-slate-700/20 dark:border-slate-700 p-4 mb-6 relative">
      <button type="button" onClick={onClose} aria-label="Cerrar la guía de inicio" className="absolute top-1 right-1 w-11 h-11 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
        <X size={16} />
      </button>

      <div className="flex items-center justify-between gap-3 mb-2 pr-10">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Configura tu negocio</h3>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{hechos}/{pasos.length} completados</span>
      </div>
      <div
        className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mb-3"
        role="progressbar"
        aria-label="Progreso de la configuración"
        aria-valuemin={0}
        aria-valuemax={pasos.length}
        aria-valuenow={hechos}
      >
        <div className="bg-accent-brand h-1.5 rounded-full transition-all duration-500 ease-calma" style={{ width: `${pct}%` }} />
      </div>

      {siguiente ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex-1 min-w-[10rem]">
            <p className="text-xs text-slate-500 dark:text-slate-400">Siguiente paso</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{siguiente.label}</p>
          </div>
          {enlacePaso(siguiente)}
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">Tu negocio está listo para recibir reservas.</p>
      )}

      <button
        type="button"
        aria-expanded={expandida}
        aria-controls={idLista}
        onClick={() => setExpandida((v) => !v)}
        className="mt-2 -ml-2 min-h-[44px] lg:min-h-[36px] inline-flex items-center gap-1 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
      >
        {expandida ? "Ocultar pasos" : "Ver todos los pasos"}
        <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${expandida ? "rotate-180" : ""}`} />
      </button>

      {expandida && (
        <ul id={idLista} className="mt-2 space-y-2">
          {pasos.map((p, i) => (
            <li key={i} className={`flex items-start gap-3 p-3 rounded-lg ${p.hecho ? "bg-slate-50 dark:bg-slate-700" : "bg-slate-700/5 dark:bg-slate-700/40 border border-slate-700/10 dark:border-slate-600"}`}>
              <div className={`mt-0.5 shrink-0 ${p.hecho ? "text-emerald-500" : "text-slate-700 dark:text-slate-300"}`}>
                {p.hecho ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${p.hecho ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-800 dark:text-slate-200"}`}>
                  {p.label}
                  {p.hecho && <span className="sr-only"> (completado)</span>}
                </p>
                {!p.hecho && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.desc}</p>}
              </div>
              {!p.hecho && enlacePaso(p)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Pantalla de bienvenida ────────────────────────────────────────────────────
function BienvenidaScreen({
  tieneServicios,
  tieneHorarios,
  onSkip,
}: {
  tieneServicios: boolean;
  tieneHorarios: boolean;
  onSkip: () => void;
}) {
  const hechos = [tieneServicios, tieneHorarios].filter(Boolean).length;
  const pasos = [
    {
      done: tieneServicios,
      Icono: Scissors,
      titulo: "Agrega tu primer servicio",
      desc: "Define qué ofreces, su duración y precio. Sin servicios, nadie puede reservar.",
      href: "/dashboard/servicios",
      cta: "Agregar servicio",
    },
    {
      done: tieneHorarios,
      Icono: CalendarDays,
      titulo: "Configura tus horarios",
      desc: "Indica cuándo estás disponible. Elige días y horas de atención.",
      href: "/dashboard/perfil?tab=horarios",
      cta: "Configurar horarios",
    },
  ];

  return (
    <div className="max-w-lg mx-auto py-8 animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-700 mb-4 shadow-lg">
          <Store size={26} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1.5">
          Tu página está casi lista
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {2 - hechos === 1 ? "Falta 1 paso" : "Faltan 2 pasos"} para que tus clientes puedan reservar.
        </p>
      </div>

      <div className="flex items-center justify-between mb-5 px-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{hechos} de 2 completados</span>
        <div className="flex gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-10 rounded-full transition-all duration-500 ${
                i < hechos ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {pasos.map((paso, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              paso.done
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                paso.done ? "bg-emerald-500" : "bg-slate-100 dark:bg-slate-700"
              }`}
            >
              {paso.done ? (
                <CheckCircle2 size={20} className="text-white" />
              ) : (
                <paso.Icono size={18} className="text-slate-600 dark:text-slate-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-bold mb-0.5 ${
                  paso.done
                    ? "text-emerald-700 dark:text-emerald-400 line-through"
                    : "text-slate-800 dark:text-slate-200"
                }`}
              >
                {paso.titulo}
              </p>
              {!paso.done && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{paso.desc}</p>
              )}
            </div>
            {!paso.done && (
              <Link
                to={paso.href}
                className="shrink-0 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-600 text-white text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-500 transition whitespace-nowrap"
              >
                {paso.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
        >
          Saltar por ahora
        </button>
      </div>
    </div>
  );
}

// ── Vista del propietario ─────────────────────────────────────────────────────
function VistaPropietario({ nombre }: { nombre: string }) {
  const [dias, setDias] = useState(14);
  // Con "reducir movimiento" los tiles aparecen sin escalonado (y los contadores sin animar).
  const reducirMovimiento = useReducedMotion();
  const usuario = useAuthStore((s) => s.usuario);
  const keyOnboarding = usuario?.negocioId ? `onboarding-ok-${usuario.negocioId}` : "";
  const [mostrarWizard, setMostrarWizard] = useState(() => keyOnboarding ? !localStorage.getItem(keyOnboarding) : false);
  // Fecha local: en UTC-6, `toISOString()` ya es "mañana" desde las 18:00.
  const hoy = hoyLocal();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-resumen"],
    queryFn: dashboardApi.obtenerResumen,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 10,
  });

  const { data: tendencia = [], isSuccess: tendenciaLista } = useQuery({
    queryKey: ["dashboard-tendencia", dias],
    queryFn: () => dashboardApi.obtenerTendencia(dias),
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados-wizard"],
    queryFn: () => empleadosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios-wizard"],
    queryFn: () => serviciosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: horarios = [] } = useQuery({
    queryKey: ["horarios-wizard"],
    queryFn: () => negociosApi.obtenerHorarios(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: galeria = [] } = useQuery({
    queryKey: ["galeria-wizard"],
    queryFn: negociosApi.obtenerGaleria,
    staleTime: 1000 * 60 * 10,
  });

  const tieneServicios = servicios.length > 0;
  const tieneHorarios = horarios.some(h => h.activo);
  const enBienvenida = mostrarWizard && (!tieneServicios || !tieneHorarios);

  const { data: citasDeHoy = [], isLoading: cargandoAgenda, isError: errorAgenda, refetch: reintentarAgenda } = useQuery({
    queryKey: ["citas-agenda-hoy", hoy],
    queryFn: () => citasApi.obtenerTodas({ desde: hoy, hasta: hoy, tamano: 100 }),
    select: (p) => [...p.datos].sort((a, b) => new Date(a.inicioEn).getTime() - new Date(b.inicioEn).getTime()),
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const bookingUrl = negocio?.slug ? `${window.location.origin}/b/${negocio.slug}` : "";
  const terminosSector = getSectorTerms(negocio?.sector);
  const primeraReserva = usePrimeraReserva(
    usuario?.negocioId,
    { resumen: data, citasHoy: citasDeHoy, tendencia },
    !!data && !isError && !cargandoAgenda && !errorAgenda && tendenciaLista,
  );

  // La guía de inicio va después de la agenda de hoy, no encima.
  const guiaInicio = negocio && usuario?.negocioId ? (
    <WizardOnboarding
      negocioId={usuario.negocioId}
      slug={negocio.slug ?? ""}
      tieneServicios={tieneServicios}
      tieneHorarios={tieneHorarios}
      tieneEmpleados={empleados.length > 0}
      tieneDescripcion={!!negocio.descripcion}
      tieneGaleria={galeria.length > 0}
      cargando={isLoading}
      visible={mostrarWizard}
      onClose={() => { localStorage.setItem(keyOnboarding, "1"); setMostrarWizard(false); }}
    />
  ) : null;

  return (
    <div className="p-4 sm:p-8">
      <NotificacionBanner />

      {/* Encabezado: una oración con el día de hoy y, debajo, su línea de tiempo */}
      <EncabezadoHoy
        nombre={nombre}
        nombreNegocio={negocio?.nombre}
        citasHoy={cargandoAgenda || errorAgenda || enBienvenida ? undefined : citasDeHoy}
        proximasCitas={data?.proximasCitas}
        terminos={{ cita: terminosSector.cita.toLowerCase(), citas: terminosSector.citas.toLowerCase() }}
        bookingUrl={bookingUrl}
        pie={!mostrarWizard && keyOnboarding ? (
          <button
            onClick={() => { localStorage.removeItem(keyOnboarding); setMostrarWizard(true); }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition"
          >
            Ver guía de inicio
          </button>
        ) : null}
      />

      {primeraReserva.celebracion && !enBienvenida && (
        <TarjetaPrimeraReserva
          celebracion={primeraReserva.celebracion}
          conConfeti={primeraReserva.recienDetectada}
          color={negocio?.colorPrimario}
          nombreNegocio={negocio?.nombre}
          bookingUrl={bookingUrl}
          onCerrar={primeraReserva.cerrar}
        />
      )}

      {isError && !data && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center mb-6">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">No se pudo cargar el resumen del negocio</p>
          <button onClick={() => refetch()} className="mt-3 min-h-[44px] px-4 rounded-lg text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition">Reintentar</button>
        </div>
      )}

      {enBienvenida ? (
        <BienvenidaScreen
          tieneServicios={tieneServicios}
          tieneHorarios={tieneHorarios}
          onSkip={() => { localStorage.setItem(keyOnboarding, "1"); setMostrarWizard(false); }}
        />
      ) : (
        <>
          {isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 sm:h-24 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 sm:h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </>
      ) : data ? (
        <>
          {/* La próxima cita ya la nombra el encabezado; sus acciones están en la agenda. */}
          {/* Agenda de hoy */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Agenda de hoy</h2>
                <span className="text-xs text-muted-foreground">
                  {capitalizarPrimera(new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }))}
                </span>
              </div>
              <Link
                to="/dashboard/citas"
                className="min-h-[44px] lg:min-h-[36px] inline-flex items-center px-3 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition"
              >
                Ver todas las citas
              </Link>
            </div>
            {cargandoAgenda ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : errorAgenda ? (
              <div className="text-center py-6" role="alert">
                <p className="text-sm text-red-700 dark:text-red-400">No se pudo cargar la agenda de hoy.</p>
                <button onClick={() => reintentarAgenda()} className="mt-2 min-h-[44px] px-4 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">Reintentar</button>
              </div>
            ) : citasDeHoy.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nada agendado para hoy.</p>
            ) : (
              <div className="space-y-1.5">
                {citasDeHoy.map((c) => {
                  const hora = new Date(c.inicioEn).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
                  // Solo se atenúa lo que ya está cerrado; una cita pasada que sigue
                  // abierta es trabajo pendiente y conserva su contraste.
                  const atenuada = new Date(c.finEn) < new Date() && !citaAbierta(c.estadoTexto);
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl transition ${
                        atenuada ? "opacity-70" : "bg-slate-50 dark:bg-slate-700/40"
                      }`}
                    >
                      <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300 w-16 shrink-0">{hora}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{c.nombreCliente}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.nombreServicio} · {c.nombreEmpleado}</p>
                      </div>
                      <EstadoBadge estado={c.estadoTexto} />
                      <InsigniaPorCerrar cita={c} />
                      <AccionesCita cita={c} nombreNegocio={negocio?.nombre} whatsapp={false} className="ml-auto" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {guiaInicio}

          <motion.div
            initial={reducirMovimiento ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="bg-card border border-border rounded-xl px-4 py-3 mb-6 flex flex-col gap-1.5 lg:flex-row lg:flex-wrap lg:gap-x-8"
          >
            <ResumenPeriodo
              grupo="Citas"
              cifras={[
                { label: "Hoy", valor: data.citasHoy },
                { label: "Semana", valor: data.citasSemana },
                { label: "Mes", valor: data.citasMes },
              ]}
            />
            <ResumenPeriodo
              grupo="Ingresos"
              cifras={[
                { label: "Hoy", valor: formatPrecio(data.ingresosHoy) },
                { label: "Semana", valor: formatPrecio(data.ingresosSemana) },
                { label: "Mes", valor: formatPrecio(data.ingresosMes) },
              ]}
            />
          </motion.div>

          {/* Gráfica de tendencia */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ingresos y citas por día</h2>
              {/*
                No usa FiltroBarra: es un control del encabezado de la gráfica,
                no un filtro de la página, y meterlo en una barra con su propio
                "Limpiar filtros" pesaría más de lo que ordena. Solo adopta el
                estilo de los atajos de período de FiltroRangoFechas.
              */}
              <div role="group" aria-label="Días de la tendencia" className="flex flex-wrap gap-1.5">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={dias === d}
                    onClick={() => setDias(d)}
                    className={`min-h-[44px] lg:min-h-[36px] px-3 inline-flex items-center rounded-lg border text-sm lg:text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40 ${
                      dias === d
                        ? "bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {/* Una línea plana en cero no informa nada: en su lugar, una frase. */}
            {!tendencia.some((d) => d.ingresos > 0 || d.citas > 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aún no hay citas ni ingresos en estos días.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={tendencia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorCategoria(1)} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={colorCategoria(1)} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colorCategoria(7)} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={colorCategoria(7)} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...REJILLA} />
                  <XAxis dataKey="etiqueta" tick={EJE_TICK} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ingresos" tickFormatter={formatPrecioCorto} tick={EJE_TICK} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="citas" orientation="right" tick={EJE_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip
                    formatter={(val, name) =>
                      name === "ingresos" ? [formatPrecio(Number(val)), "Ingresos"] : [Number(val), "Citas"]
                    }
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(v) => v === "ingresos" ? "Ingresos" : "Citas"}
                  />
                  <Area yAxisId="ingresos" type="monotone" dataKey="ingresos" stroke={colorCategoria(1)} strokeWidth={2} fill="url(#gradIngresos)" dot={false} />
                  <Area yAxisId="citas" type="monotone" dataKey="citas" stroke={colorCategoria(7)} strokeWidth={2} fill="url(#gradCitas)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${data.topServicios.length > 0 ? "lg:col-span-2" : "lg:col-span-3"} bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5`}>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Próximas citas</h2>
              {data.proximasCitas.length === 0 ? (
                <p className="text-slate-400 dark:text-slate-500 text-sm">No hay citas próximas</p>
              ) : (
                <div className="space-y-3">
                  {data.proximasCitas.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.nombreCliente}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{c.nombreServicio} · {c.nombreEmpleado}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatFechaHora(c.inicioEn)}</p>
                      </div>
                      <EstadoBadge estado={c.estadoTexto} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sin datos no se muestran barras vacías: la tarjeta desaparece. */}
            {data.topServicios.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Top servicios</h2>
                <div className="space-y-3">
                  {data.topServicios.map((s, i) => (
                    <div key={s.nombre}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{i + 1}. {s.nombre}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{s.totalCitas} citas</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-accent-brand h-1.5 rounded-full"
                          style={{ width: `${Math.min((s.totalCitas / (data.topServicios[0]?.totalCitas || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
            </div>
            )}
          </div>
        </>
          ) : guiaInicio}
        </>
      )}
    </div>
  );
}

// ── Vista del empleado ────────────────────────────────────────────────────────
function VistaEmpleado({ nombre }: { nombre: string }) {
  const ahora = new Date();
  // Fechas locales: con `toISOString()` la agenda saltaba a mañana desde las 18:00 (UTC-6).
  const hoy = hoyLocal(ahora);
  const manana = fechaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1));
  const saludo = saludoDelDia(ahora);

  // Inicio y fin de semana (lunes–domingo)
  const inicioSemanaStr = inicioSemanaLocal(ahora);
  const finSemanaStr = finSemanaLocal(ahora);

  const [clienteSel, setClienteSel] = useState<{ id: string; nombre: string } | null>(null);
  // Tocar una cita de la agenda abre sus acciones; el historial es una de ellas.
  const [citaHoja, setCitaHoja] = useState<CitaDto | null>(null);
  const [vistaHoja, setVistaHoja] = useState<VistaHoja>("menu");
  const abrirHoja = (c: CitaDto, v: VistaHoja = "menu") => { setCitaHoja(c); setVistaHoja(v); };

  const { data: citasHoy = [], isLoading: cargandoHoy, isError: errorCitasHoy, refetch: reintentarHoy } = useQuery({
    queryKey: ["mis-citas-hoy", hoy],
    queryFn: () => citasApi.obtenerTodas({ desde: hoy, hasta: hoy }),
    select: (p) => p.datos,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: citasProximas = [], isLoading: cargandoProximas, isError: errorCitasProximas, refetch: reintentarProximas } = useQuery({
    queryKey: ["mis-citas-proximas", manana],
    queryFn: () => citasApi.obtenerTodas({ desde: manana }),
    select: (p) => p.datos,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: citasSemana = [] } = useQuery({
    queryKey: ["mis-citas-semana", inicioSemanaStr],
    queryFn: () => citasApi.obtenerTodas({ desde: inicioSemanaStr, hasta: finSemanaStr, tamano: 200 }),
    select: (p) => p.datos,
    staleTime: 0,
  });

  const { data: historialCliente = [], isLoading: cargandoHistorial, isError: errorHistorial } = useQuery({
    queryKey: ["historial-cliente", clienteSel?.id],
    queryFn: () => clientesApi.obtenerCitas(clienteSel!.id),
    enabled: !!clienteSel,
    staleTime: 1000 * 60,
  });

  const pendientesOConfirmadas = citasProximas.filter(
    (c) => c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada"
  ).slice(0, 10);

  // Stats semana
  const completadasSemana = citasSemana.filter((c) => c.estadoTexto === "Completada");
  const ingresosSemana = completadasSemana.reduce((s, c) => s + c.precio, 0);
  const totalSemana = citasSemana.filter((c) => c.estadoTexto !== "Cancelada" && c.estadoTexto !== "Inasistencia").length;

  // Stats computados
  const completadas = citasHoy.filter((c) => c.estadoTexto === "Completada");
  const ingresosHoy = completadas.reduce((s, c) => s + c.precio, 0);
  const citasOrdenadas = [...citasHoy].sort(
    (a, b) => new Date(a.inicioEn).getTime() - new Date(b.inicioEn).getTime()
  );

  // Próxima cita pendiente/confirmada de hoy
  const proxima = citasOrdenadas.find(
    (c) =>
      new Date(c.inicioEn) > ahora &&
      (c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada")
  );
  const msProxima = proxima ? new Date(proxima.inicioEn).getTime() - ahora.getTime() : 0;
  const minProxima = Math.round(msProxima / 60000);
  const etiquetaProxima =
    msProxima <= 0 ? "En curso"
    : minProxima < 60 ? `En ${minProxima} min`
    : `En ${Math.floor(minProxima / 60)}h${minProxima % 60 > 0 ? ` ${minProxima % 60}min` : ""}`;

  const horaTexto = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <div className="p-4 sm:p-8">
      {/* Banner de activación de notificaciones push */}
      <NotificacionBanner />

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-0.5">{saludo}</p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100 leading-none">{nombre}</h1>
      </div>

      {/* Stats hoy */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Citas hoy</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
            {cargandoHoy ? "—" : citasHoy.length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Completadas</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
            {cargandoHoy ? "—" : completadas.length}
          </p>
        </div>
        <div className="bg-slate-900 rounded-2xl p-3 sm:p-4">
          <p className="text-xs font-medium text-slate-300 mb-1.5">Ingresos</p>
          <p className="text-xl font-bold text-white leading-none">
            {cargandoHoy ? "—" : formatPrecioCorto(ingresosHoy)}
          </p>
        </div>
      </div>

      {/* Resumen semanal */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-status-confirmed-bg flex items-center justify-center shrink-0">
          <TrendingUp size={18} className="text-status-confirmed-fg" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Esta semana</p>
          <p className="text-sm text-foreground">
            <span className="font-bold">{completadasSemana.length}</span> completadas de{" "}
            <span className="font-bold">{totalSemana}</span> citas
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Ingresos</p>
          <p className="text-base font-bold text-foreground">
            {formatPrecioCorto(ingresosSemana)}
          </p>
        </div>
      </div>

      {/* Próxima cita del día */}
      {!cargandoHoy && proxima && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">Próxima cita</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground truncate">{proxima.nombreCliente}</p>
              <p className="text-sm text-muted-foreground truncate">{proxima.nombreServicio} · {proxima.duracionMinutos} min</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">{etiquetaProxima}</p>
              <p className="text-xs text-muted-foreground">{horaTexto(proxima.inicioEn)}</p>
            </div>
            <AccionesCita cita={proxima} whatsapp={false} className="w-full sm:w-auto" />
          </div>
        </div>
      )}

      {/* Agenda del día */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Agenda de hoy</h2>
          <span className="text-xs bg-slate-700/10 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-semibold px-2.5 py-1 rounded-full">
            {cargandoHoy ? "..." : citasHoy.length}
          </span>
        </div>
        {cargandoHoy ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : errorCitasHoy ? (
          <div className="text-center py-4" role="alert">
            <p className="text-sm text-red-700 dark:text-red-400">No se pudo cargar tu agenda.</p>
            <button onClick={() => reintentarHoy()} className="mt-2 min-h-[44px] px-4 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">Reintentar</button>
          </div>
        ) : citasOrdenadas.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm py-2">No tienes citas hoy.</p>
        ) : (
          <div className="space-y-2">
            {citasOrdenadas.map((c) => {
              const inicio = new Date(c.inicioEn);
              const fin = new Date(inicio.getTime() + c.duracionMinutos * 60000);
              const enCurso = inicio <= ahora && ahora < fin && citaAbierta(c.estadoTexto);
              const cerrada = !citaAbierta(c.estadoTexto);
              // Terminó y sigue abierta: etiqueta "Por cerrar" y la acción principal a la vista.
              const porCerrar = citaPorCerrar(c, ahora);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-1 rounded-xl transition-colors ${
                    enCurso
                      ? "bg-status-confirmed-bg border border-status-confirmed-dot"
                      : cerrada
                      ? "bg-transparent border border-border"
                      : "bg-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => abrirHoja(c)}
                    aria-haspopup="dialog"
                    aria-label={`${horaTexto(c.inicioEn)} ${c.nombreCliente}, ${c.nombreServicio}${porCerrar ? ", por cerrar" : ""}. Ver acciones`}
                    className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="shrink-0 text-right w-[52px]">
                      <p className={`text-xs font-bold ${enCurso ? "text-status-confirmed-fg" : "text-foreground"}`}>
                        {horaTexto(c.inicioEn)}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.duracionMinutos} min</p>
                    </div>
                    <div className={`w-1 h-10 rounded-full shrink-0 ${estiloEstadoCita(c.estadoTexto).punto}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.nombreCliente}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.nombreServicio}</p>
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                      <EstadoBadge estado={c.estadoTexto} />
                      {porCerrar && <InsigniaPorCerrar cita={c} ahora={ahora} />}
                      <p className="text-xs font-semibold text-muted-foreground">{formatPrecio(c.precio)}</p>
                    </div>
                  </button>
                  <AccionesCita
                    cita={c}
                    whatsapp={false}
                    primaria={porCerrar}
                    className="pr-1"
                    onAbrirHoja={(v) => abrirHoja(c, v)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Próximas citas (mañana en adelante) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Próximas citas</h2>
        {cargandoProximas ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : errorCitasProximas ? (
          <div className="text-center py-4" role="alert">
            <p className="text-sm text-red-700 dark:text-red-400">No se pudieron cargar tus próximas citas.</p>
            <button onClick={() => reintentarProximas()} className="mt-2 min-h-[44px] px-4 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition">Reintentar</button>
          </div>
        ) : pendientesOConfirmadas.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">Sin citas próximas</p>
        ) : (
          <div className="divide-y divide-border">
            {pendientesOConfirmadas.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.nombreCliente}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.nombreServicio}</p>
                  <p className="text-xs text-muted-foreground">{formatFechaHora(c.inicioEn)}</p>
                </div>
                <EstadoBadge estado={c.estadoTexto} />
              </div>
            ))}
          </div>
        )}
      </div>

      <HojaAccionesCita
        cita={citaHoja}
        vistaInicial={vistaHoja}
        onCerrar={() => setCitaHoja(null)}
        accionesExtra={citaHoja?.clienteId ? [{
          id: "historial",
          etiqueta: "Ver historial del cliente",
          Icono: History,
          onSelect: () => setClienteSel({ id: citaHoja.clienteId, nombre: citaHoja.nombreCliente }),
        }] : []}
      />

      {/* Historial del cliente: Modal (Radix) da foco, Escape y tema oscuro */}
      <Modal
        abierto={!!clienteSel}
        onCerrar={() => setClienteSel(null)}
        titulo={clienteSel ? `Historial de ${clienteSel.nombre}` : "Historial"}
        ancho="md"
      >
        <div className="space-y-2">
          {cargandoHistorial ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)
          ) : errorHistorial ? (
            <p className="text-sm text-red-700 dark:text-red-400 text-center py-8" role="alert">No se pudo cargar el historial</p>
          ) : historialCliente.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Primera visita del cliente</p>
          ) : (
            historialCliente.map((h: ClienteCitaDto) => (
              <div key={h.id} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <Clock size={14} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{h.nombreServicio}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.inicioEn).toLocaleDateString("es-MX", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                    {h.nombreEmpleado ? ` · ${h.nombreEmpleado}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs font-semibold text-foreground">{formatPrecio(h.precio)}</p>
                  <EstadoBadge estado={h.estadoTexto} />
                </div>
              </div>
            ))
          )}
          {historialCliente.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1">
              <History size={12} aria-hidden="true" />
              {historialCliente.length} visita{historialCliente.length !== 1 ? "s" : ""} en total
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function InicioPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const nombre = usuario?.nombreCompleto?.split(" ")[0] ?? "";

  if (usuario?.rol === "Empleado") return <VistaEmpleado nombre={nombre} />;
  return <VistaPropietario nombre={nombre} />;
}
