import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { intakePublicoApi, type CampoIntake } from "../../api/intake";
import { descuentosPublicoApi, type DescuentoValidado } from "../../api/descuentos";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible, ImagenGaleria, ResenaPublica } from "../../types";
import IndicadorPasos from "../../components/booking/IndicadorPasos";
import PasoServicio from "../../components/booking/PasoServicio";
import PasoEmpleado, { SIN_PREFERENCIA_ID } from "../../components/booking/PasoEmpleado";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import PasoDatosCliente, { type DatosClienteForm } from "../../components/booking/PasoDatosCliente";
import { Star, X, UserCircle, UserCheck, Tag, AlertCircle } from "lucide-react";
import WhatsAppIcon from "../../components/icons/WhatsAppIcon";

// Convierte #RRGGBB a "R G B" (canales para CSS variables con opacity)
function hexToChannels(hex: string): string {
  const h = (hex ?? "#C8A961").replace("#", "").padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
function adjustHex(hex: string, factor: number): string {
  const h = (hex ?? "#C8A961").replace("#", "").padEnd(6, "0");
  return "#" + [0, 2, 4]
    .map((i) => Math.min(255, Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * factor)))
      .toString(16).padStart(2, "0"))
    .join("");
}

function GaleriaSection({ imagenes }: { imagenes: ImagenGaleria[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (!imagenes.length) return null;
  return (
    <>
      <div className="overflow-x-auto pb-2 -mx-4 px-4 mb-5">
        <div className="flex gap-2" style={{ width: "max-content" }}>
          {imagenes.map((img) => (
            <button
              key={img.id}
              onClick={() => setLightbox(img.url)}
              className="shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-gray-100 hover:opacity-90 transition"
            >
              <img src={img.url} alt={img.descripcion ?? ""} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </>
  );
}

function ResenasSection({ resenas, promedio, total }: { resenas: ResenaPublica[]; promedio: number; total: number }) {
  if (!resenas.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} size={14} fill={promedio >= s ? "#C8A961" : "none"} stroke="#C8A961" strokeWidth={1.5} />
          ))}
        </div>
        <span className="text-sm font-semibold text-gray-700">{promedio.toFixed(1)}</span>
        <span className="text-xs text-gray-400">({total} reseñas)</span>
      </div>
      <div className="space-y-3">
        {resenas.slice(0, 5).map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-800">{r.nombreCliente}</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={11} fill={r.rating >= s ? "#C8A961" : "none"} stroke="#C8A961" strokeWidth={1.5} />
                ))}
              </div>
            </div>
            {r.comentario && <p className="text-xs text-gray-500 leading-relaxed">{r.comentario}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

const PASOS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos"];

function IntakeCampoInput({
  campo,
  valor,
  onChange,
}: {
  campo: CampoIntake;
  valor: string;
  onChange: (v: string) => void;
}) {
  const label = (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {campo.etiqueta}
      {campo.requerido && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  if (campo.tipo === "Checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={valor === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="accent-primary w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            {campo.etiqueta}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </span>
        </label>
      </div>
    );
  }

  if (campo.tipo === "Seleccion") {
    let opciones: string[] = [];
    try {
      const raw = campo.opciones ?? "";
      opciones = raw.includes("[")
        ? JSON.parse(raw)
        : raw.split(",").map((o) => o.trim()).filter(Boolean);
    } catch { /* keep empty */ }
    return (
      <div>
        {label}
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
        >
          <option value="">Selecciona una opción</option>
          {opciones.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>
    );
  }

  if (campo.tipo === "MultilineTexto") {
    return (
      <div>
        {label}
        <textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      />
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [paso, setPaso] = useState(1);
  const [servicio, setServicio] = useState<ServicioPublico | null>(null);
  const [empleado, setEmpleado] = useState<EmpleadoPublico | null>(null);
  const [slot, setSlot] = useState<SlotDisponible | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  // Sub-flujo paso 4: elegir → buscar | listo
  const [modoCliente, setModoCliente] = useState<"elegir" | "buscar" | "listo">("elegir");
  const [emailBusqueda, setEmailBusqueda] = useState("");
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [datosPreRellenos, setDatosPreRellenos] = useState<Partial<DatosClienteForm> | null>(null);

  // Intake sub-step (between paso 3 and paso 4)
  const [mostrarIntake, setMostrarIntake] = useState(false);
  const [respuestasIntake, setRespuestasIntake] = useState<Record<string, string>>({});

  // Promo code
  const [mostrarCupon, setMostrarCupon] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoValidado | null>(null);
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState("");

  const { data: negocio, isLoading, isError } = useQuery({
    queryKey: ["negocio", slug],
    queryFn: () => publicoApi.obtenerNegocio(slug!),
    enabled: !!slug,
  });

  const { data: camposIntake = [] } = useQuery<CampoIntake[]>({
    queryKey: ["intake-publico", slug, servicio?.id],
    queryFn: () => intakePublicoApi.getCampos(slug!, servicio?.id),
    enabled: !!slug && !!servicio,
  });

  const irSiguiente = () => {
    if (paso === 3 && slot && camposIntake.length > 0 && !mostrarIntake) {
      setMostrarIntake(true);
      return;
    }
    setMostrarIntake(false);
    setPaso((p) => Math.min(p + 1, 4));
    setModoCliente("elegir");
  };

  const irAtras = () => {
    if (mostrarIntake) {
      setMostrarIntake(false);
      return;
    }
    if (paso === 4 && modoCliente !== "elegir") {
      if (modoCliente === "listo") { setDatosPreRellenos(null); setEmailBusqueda(""); }
      setModoCliente("elegir");
      setErrorBusqueda("");
      return;
    }
    setPaso((p) => p - 1);
    if (paso === 4) { setModoCliente("elegir"); setDatosPreRellenos(null); setEmailBusqueda(""); }
    if (paso === 3) setSlot(null);
    if (paso === 2) setEmpleado(null);
  };

  const buscarCliente = async () => {
    if (!emailBusqueda || !slug) return;
    setBuscandoCliente(true);
    setErrorBusqueda("");
    try {
      const datos = await publicoApi.buscarClienteDatos(emailBusqueda, slug);
      setDatosPreRellenos(datos);
      setModoCliente("listo");
    } catch {
      setErrorBusqueda("No encontramos citas con ese correo. Puedes continuar como invitado.");
    } finally {
      setBuscandoCliente(false);
    }
  };

  const sinPreferencia = empleado?.id === SIN_PREFERENCIA_ID;

  const validarCupon = async () => {
    if (!codigoInput.trim() || !slug) return;
    setValidandoCupon(true);
    setErrorCupon("");
    try {
      const descuento = await descuentosPublicoApi.validar(codigoInput.trim(), slug);
      setDescuentoAplicado(descuento);
      setMostrarCupon(false);
      setCodigoInput("");
    } catch {
      setErrorCupon("Código inválido, expirado o agotado.");
    } finally {
      setValidandoCupon(false);
    }
  };

  const confirmarCita = async (datos: DatosClienteForm) => {
    if (!negocio || !servicio || !empleado || !slot) return;
    setErrorEnvio("");
    setEnviando(true);
    try {
      const empleadoIdFinal = sinPreferencia ? (slot.empleadoId ?? "") : empleado.id;
      const cita = await publicoApi.crearCita({
        negocioSlug: slug!,
        servicioId: servicio.id,
        empleadoId: empleadoIdFinal,
        inicioEn: slot.inicio,
        nombreCliente: datos.nombreCliente,
        telefonoCliente: datos.telefonoCliente,
        emailCliente: datos.emailCliente || undefined,
        notas: datos.notas || undefined,
        codigoDescuento: descuentoAplicado?.codigo,
      });
      if (Object.keys(respuestasIntake).length > 0) {
        const resps = Object.entries(respuestasIntake).map(([campoIntakeId, valor]) => ({
          campoIntakeId,
          valor,
        }));
        try {
          await intakePublicoApi.guardarRespuestas(cita.id, resps);
        } catch {
          // intake save failure is non-blocking
        }
      }
      navigate(`/b/${slug}/confirmacion/${cita.codigoConfirmacion}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      if (status === 409 || msg?.toLowerCase().includes("disponible") || msg?.toLowerCase().includes("ocupado")) {
        setErrorEnvio("Este horario ya fue reservado por alguien más. Por favor elige otra fecha u hora.");
        setPaso(3);
        setSlot(null);
      } else {
        setErrorEnvio(msg ?? "No se pudo confirmar la cita. Intenta de nuevo.");
      }
      setEnviando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-36 bg-gray-200 animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4 mx-auto" />
          {[1,2,3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium mb-1">No se pudo cargar la página</p>
          <p className="text-gray-400 text-sm mb-4">Verifica tu conexión e intenta de nuevo.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2 rounded-lg transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 font-medium">Negocio no encontrado</p>
          <p className="text-gray-400 text-sm">Verifica el enlace e intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  const color = negocio.colorPrimario ?? "#C8A961";
  const bookingTheme = {
    "--color-primary":       hexToChannels(color),
    "--color-primary-dark":  hexToChannels(adjustHex(color, 0.8)),
    "--color-primary-light": hexToChannels(adjustHex(color, 1.45)),
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-gray-50" style={bookingTheme}>
      {/* Header del negocio */}
      <div className="relative">
        {negocio.portadaUrl ? (
          <div className="h-36 overflow-hidden">
            <img src={negocio.portadaUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
          </div>
        ) : (
          <div
            className="h-36"
            style={{ background: negocio.colorPrimario ?? "#C8A961" }}
          />
        )}

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end gap-3">
          {negocio.logoUrl && (
            <img
              src={negocio.logoUrl}
              alt={negocio.nombre}
              className="w-14 h-14 rounded-xl border-2 border-white object-cover shadow shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-xl font-bold drop-shadow">{negocio.nombre}</h1>
            {negocio.descripcion && (
              <p className="text-white/80 text-xs mt-0.5 line-clamp-1">{negocio.descripcion}</p>
            )}
            {(negocio.telefonoWhatsApp || negocio.telefono) && (
              <a
                href={`https://wa.me/${(negocio.telefonoWhatsApp || negocio.telefono || "").replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-white/90 hover:text-white text-xs transition"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
                {negocio.telefonoWhatsApp || negocio.telefono}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex justify-end mb-2">
          <a
            href={`/b/${negocio.slug}/mis-citas`}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Ver mis citas
          </a>
        </div>
        <IndicadorPasos pasoActual={paso} pasos={PASOS} />

        {/* Mini-resumen de selecciones previas */}
        {paso >= 2 && (servicio || empleado) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2 mb-4 flex-wrap">
            {servicio && (
              <span className="font-medium text-gray-700">{servicio.nombre}</span>
            )}
            {servicio && empleado && <span className="text-gray-300">·</span>}
            {empleado && paso >= 3 && (
              <span className="font-medium text-gray-700">
                {sinPreferencia
                  ? (slot?.empleadoNombre ?? "Cualquier disponible")
                  : empleado.nombre}
              </span>
            )}
          </div>
        )}

        {/* Pasos — wrapper con animación de transición */}
        <div key={`${paso}-${mostrarIntake ? "intake" : modoCliente}`} className="animate-step-in">

        {/* Paso 1 */}
        {paso === 1 && (
          <>
            {/* Galería */}
            {negocio.galeria?.length > 0 && <GaleriaSection imagenes={negocio.galeria} />}

            <PasoServicio
              servicios={negocio.servicios}
              seleccionado={servicio}
              onSeleccionar={setServicio}
            />
            <button
              onClick={irSiguiente}
              disabled={!servicio}
              className="mt-6 w-full bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
            >
              Continuar
            </button>

            {/* Reseñas */}
            {negocio.resenas?.length > 0 && (
              <ResenasSection
                resenas={negocio.resenas}
                promedio={negocio.promedioResenas}
                total={negocio.totalResenas}
              />
            )}
          </>
        )}

        {/* Paso 2 */}
        {paso === 2 && servicio && (
          <>
            <PasoEmpleado
              empleados={negocio.empleados}
              servicioId={servicio.id}
              seleccionado={empleado}
              onSeleccionar={setEmpleado}
            />
            <div className="mt-6 flex gap-3">
              <button onClick={irAtras} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition">
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={!empleado}
                className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Paso 3 */}
        {paso === 3 && servicio && empleado && (
          <>
            <PasoFechaHora
              servicioId={servicio.id}
              empleadoId={sinPreferencia ? null : empleado.id}
              seleccionado={slot}
              onSeleccionar={setSlot}
            />
            {slot && (negocio.horasCancelacion ?? 0) > 0 && (
              <div className="mt-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="shrink-0" />
                <span>
                  Cancelación gratuita hasta{" "}
                  <strong>
                    {negocio.horasCancelacion} hora{negocio.horasCancelacion !== 1 ? "s" : ""}
                  </strong>{" "}
                  antes de la cita.
                </span>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={irAtras} className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition">
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={!slot}
                className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Paso 3 — Intake (sub-paso entre hora y datos) */}
        {paso === 3 && mostrarIntake && camposIntake.length > 0 && (
          <>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-800">Antes de continuar…</h2>
              <p className="text-sm text-gray-400 mt-1">
                Por favor responde estas preguntas adicionales para tu cita.
              </p>
            </div>
            <div className="space-y-4">
              {camposIntake.map((campo) => (
                <IntakeCampoInput
                  key={campo.id}
                  campo={campo}
                  valor={respuestasIntake[campo.id] ?? ""}
                  onChange={(v) =>
                    setRespuestasIntake((prev) => ({ ...prev, [campo.id]: v }))
                  }
                />
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={irAtras}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Atrás
              </button>
              <button
                onClick={irSiguiente}
                disabled={camposIntake
                  .filter((c) => c.requerido)
                  .some((c) => !respuestasIntake[c.id]?.trim())}
                className="flex-1 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* Paso 4 — elegir modo */}
        {paso === 4 && modoCliente === "elegir" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">¿Ya has reservado antes?</h2>
            <p className="text-sm text-gray-400 mb-6">Busca tus datos para no volver a escribirlos, o continúa como nuevo cliente.</p>
            <div className="space-y-3">
              <button
                onClick={() => setModoCliente("buscar")}
                className="w-full flex items-center gap-4 bg-white border-2 border-gray-100 hover:border-primary/40 rounded-xl p-4 text-left transition group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 transition">
                  <UserCircle size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Soy cliente recurrente</p>
                  <p className="text-xs text-gray-400 mt-0.5">Busca tus datos con tu correo</p>
                </div>
              </button>
              <button
                onClick={() => setModoCliente("listo")}
                className="w-full flex items-center gap-4 bg-gray-900 hover:bg-gray-700 rounded-xl p-4 text-left transition"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <UserCheck size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Continuar como invitado</p>
                  <p className="text-xs text-white/50 mt-0.5">Ingresa tus datos manualmente</p>
                </div>
              </button>
            </div>
            <button onClick={irAtras} className="mt-5 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition">
              ← Atrás
            </button>
          </div>
        )}

        {/* Paso 4 — buscar datos */}
        {paso === 4 && modoCliente === "buscar" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Buscar mis datos</h2>
            <p className="text-sm text-gray-400 mb-5">Ingresa el correo con el que reservaste anteriormente.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={emailBusqueda}
                onChange={(e) => { setEmailBusqueda(e.target.value); setErrorBusqueda(""); }}
                onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              />
              {errorBusqueda && <p className="text-red-500 text-xs mt-1.5">{errorBusqueda}</p>}
            </div>
            <button
              onClick={buscarCliente}
              disabled={buscandoCliente || !emailBusqueda.includes("@")}
              className="mt-4 w-full bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
            >
              {buscandoCliente ? "Buscando..." : "Buscar"}
            </button>
            <button onClick={irAtras} className="mt-3 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition">
              ← Atrás
            </button>
          </div>
        )}

        {/* Paso 4 — formulario (invitado o datos pre-rellenos) */}
        {paso === 4 && modoCliente === "listo" && servicio && empleado && slot && (
          <>
            {datosPreRellenos && (
              <div className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-700 font-medium">¡Datos encontrados! Verifica que sean correctos.</p>
              </div>
            )}
            {/* Código de descuento */}
            <div className="mb-4">
              {descuentoAplicado ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag size={15} className="text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-green-700">
                        Código <span className="font-mono">{descuentoAplicado.codigo}</span> aplicado
                      </p>
                      <p className="text-xs text-green-600">
                        {descuentoAplicado.tipo === "Porcentaje"
                          ? `${descuentoAplicado.valor}% de descuento`
                          : `$${descuentoAplicado.valor} de descuento`}
                        {servicio && (
                          <span>
                            {" — precio final: $"}
                            {descuentoAplicado.tipo === "Porcentaje"
                              ? (servicio.precio * (1 - descuentoAplicado.valor / 100)).toFixed(2)
                              : Math.max(0, servicio.precio - descuentoAplicado.valor).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDescuentoAplicado(null)}
                    className="text-green-500 hover:text-green-700 ml-3 shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : mostrarCupon ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={codigoInput}
                      onChange={(e) => { setCodigoInput(e.target.value.toUpperCase()); setErrorCupon(""); }}
                      onKeyDown={(e) => e.key === "Enter" && validarCupon()}
                      placeholder="PROMO20"
                      maxLength={50}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                    />
                    <button
                      onClick={validarCupon}
                      disabled={validandoCupon || !codigoInput.trim()}
                      className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:opacity-90 transition"
                    >
                      {validandoCupon ? "..." : "Aplicar"}
                    </button>
                  </div>
                  {errorCupon && <p className="text-red-500 text-xs">{errorCupon}</p>}
                  <button
                    onClick={() => { setMostrarCupon(false); setCodigoInput(""); setErrorCupon(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setMostrarCupon(true)}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  ¿Tienes un código de descuento?
                </button>
              )}
            </div>

            {/* Confirmación pendiente */}
            {negocio && !negocio.autoConfirmar && (
              <div className="mb-4 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="shrink-0" />
                <span>Tu cita quedará <strong>pendiente de confirmación</strong> por el negocio.</span>
              </div>
            )}

            <PasoDatosCliente
              servicio={servicio}
              empleado={empleado}
              slot={slot}
              enviando={enviando}
              datosIniciales={datosPreRellenos ?? undefined}
              onEnviar={confirmarCita}
            />
            {errorEnvio && (
              <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-700">No se pudo agendar la cita</p>
                  <p className="text-sm text-red-600 mt-0.5">{errorEnvio}</p>
                </div>
              </div>
            )}
            <button onClick={irAtras} className="mt-3 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition">
              ← Atrás
            </button>
          </>
        )}

        </div>{/* fin animate-step-in */}
      </div>
    </div>
  );
}
