import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible } from "../../types";
import IndicadorPasos from "../../components/booking/IndicadorPasos";
import PasoServicio from "../../components/booking/PasoServicio";
import PasoEmpleado, { SIN_PREFERENCIA_ID } from "../../components/booking/PasoEmpleado";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import PasoDatosCliente, { type DatosClienteForm } from "../../components/booking/PasoDatosCliente";

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
              <p className="text-red-500 text-sm text-center mt-3">{errorEnvio}</p>
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
