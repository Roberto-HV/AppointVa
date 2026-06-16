import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible, ImagenGaleria, ResenaPublica } from "../../types";
import IndicadorPasos from "../../components/booking/IndicadorPasos";
import PasoServicio from "../../components/booking/PasoServicio";
import PasoEmpleado, { SIN_PREFERENCIA_ID } from "../../components/booking/PasoEmpleado";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import PasoDatosCliente, { type DatosClienteForm } from "../../components/booking/PasoDatosCliente";
import { Star, X } from "lucide-react";

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

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [paso, setPaso] = useState(1);
  const [servicio, setServicio] = useState<ServicioPublico | null>(null);
  const [empleado, setEmpleado] = useState<EmpleadoPublico | null>(null);
  const [slot, setSlot] = useState<SlotDisponible | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  const { data: negocio, isLoading, isError } = useQuery({
    queryKey: ["negocio", slug],
    queryFn: () => publicoApi.obtenerNegocio(slug!),
    enabled: !!slug,
  });

  const irSiguiente = () => setPaso((p) => Math.min(p + 1, 4));
  const irAtras = () => {
    setPaso((p) => p - 1);
    if (paso === 3) setSlot(null);
    if (paso === 2) setEmpleado(null);
  };

  const sinPreferencia = empleado?.id === SIN_PREFERENCIA_ID;

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
      });
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

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div>
            <h1 className="text-white text-xl font-bold drop-shadow">{negocio.nombre}</h1>
            {negocio.descripcion && (
              <p className="text-white/80 text-xs mt-0.5 line-clamp-1">{negocio.descripcion}</p>
            )}
            {negocio.telefono && !negocio.descripcion && (
              <p className="text-white/80 text-xs">{negocio.telefono}</p>
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

        {/* Paso 4 */}
        {paso === 4 && servicio && empleado && slot && (
          <>
            <PasoDatosCliente
              servicio={servicio}
              empleado={empleado}
              slot={slot}
              enviando={enviando}
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
      </div>
    </div>
  );
}
