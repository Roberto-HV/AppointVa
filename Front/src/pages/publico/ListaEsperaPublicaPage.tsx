import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { listaEsperaPublicoApi } from "../../api/listaEspera";
import type { NegocioPublico } from "../../types";
import { CheckCircle2, Clock, AlertCircle, ChevronLeft } from "lucide-react";
import PublicFooter from "../../components/PublicFooter";
import { hexToChannels, DEFAULT_COLOR, brandSolid } from "../../lib/colorUtils";
import { mensajeError } from "../../utils/errores";
import { useTituloPagina } from "../../hooks/useTituloPagina";

type FormState = "idle" | "submitting" | "success";

function VolverAlNegocio({ slug, nombre }: { slug: string; nombre: string }) {
  return (
    <Link
      to={`/b/${slug}`}
      className="inline-flex items-center gap-1 min-h-[44px] text-sm font-medium text-slate-700 hover:underline"
    >
      <ChevronLeft size={16} aria-hidden="true" />
      Volver a {nombre}
    </Link>
  );
}

function NegocioHeader({ negocio, color }: { negocio: NegocioPublico; color: string }) {
  return (
    <div
      className="relative overflow-hidden flex flex-col items-center justify-end px-5 pt-16 pb-5"
      style={{ background: "#0C0C0F" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 120% at 50% 0%, rgb(${hexToChannels(color)} / 0.22) 0%, transparent 65%)`,
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        {negocio.logoUrl ? (
          <img
            src={negocio.logoUrl}
            alt={negocio.nombre}
            className="w-14 h-14 rounded-2xl object-cover"
            style={{
              border: `1.5px solid rgb(${hexToChannels(color)} / 0.45)`,
              boxShadow: `0 2px 16px rgb(${hexToChannels(color)} / 0.28)`,
            }}
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{
              background: `rgb(${hexToChannels(color)} / 0.18)`,
              border: `1.5px solid rgb(${hexToChannels(color)} / 0.40)`,
            }}
          >
            {negocio.nombre.trim().charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-white font-black text-base leading-tight tracking-tight">
          {negocio.nombre}
        </h1>
      </div>
    </div>
  );
}

export default function ListaEsperaPublicaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const servicioId = searchParams.get("servicioId") ?? undefined;

  const [formState, setFormState] = useState<FormState>("idle");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const { data: negocio, isLoading, isError } = useQuery({
    queryKey: ["negocio", slug],
    queryFn: () => publicoApi.obtenerNegocio(slug!),
    enabled: !!slug,
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return count < 1;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setFormState("submitting");
    try {
      await listaEsperaPublicoApi.unirse({
        slug,
        nombreCliente: nombreCompleto,
        telefonoCliente: telefono,
        emailCliente: email || undefined,
        servicioId,
      });
      setFormState("success");
    } catch (err) {
      setError(mensajeError(err, "No se pudo unirte a la lista de espera. Intenta de nuevo."));
      setFormState("idle");
    }
  };

  useTituloPagina(negocio ? `Lista de espera · ${negocio.nombre}` : "Lista de espera");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-40 bg-slate-200 animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
            <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-12 bg-slate-200 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !negocio) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={26} className="text-amber-500" />
          </div>
          <p className="text-slate-700 font-semibold mb-1">Este negocio no está disponible</p>
          <p className="text-slate-400 text-sm">Verifica el enlace e intenta de nuevo.</p>
        </div>
      </div>
    );
  }

  const color = negocio.colorPrimario ?? DEFAULT_COLOR;
  // Mismo criterio que la reserva: un color de marca claro se oscurece hasta
  // que el texto blanco del botón tenga contraste suficiente (AP-19).
  const colorBoton = brandSolid(color);
  const servicio = servicioId ? negocio.servicios?.find((s) => s.id === servicioId) : undefined;

  if (!negocio.listaEsperaActiva) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NegocioHeader negocio={negocio} color={color} />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Clock size={26} className="text-slate-400" />
            </div>
            <p className="text-slate-800 font-semibold mb-1">Lista de espera no disponible</p>
            <p className="text-slate-500 text-sm">Esta lista de espera no está activa actualmente.</p>
          </div>
          <PublicFooter />
        </div>
      </div>
    );
  }

  if (formState === "success") {
    return (
      <div className="min-h-screen bg-slate-50">
        <NegocioHeader negocio={negocio} color={color} />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={26} className="text-emerald-500" />
            </div>
            <h2 className="text-slate-900 font-bold text-lg mb-2">¡Estás en la lista!</h2>
            {servicio && <p className="text-slate-700 text-sm font-medium mb-1">{servicio.nombre}</p>}
            <p className="text-slate-500 text-sm mb-4">
              Si se libera un lugar, {negocio.nombre} se pondrá en contacto contigo.
            </p>
            <VolverAlNegocio slug={negocio.slug ?? slug!} nombre={negocio.nombre} />
          </div>
          <PublicFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NegocioHeader negocio={negocio} color={color} />
      <div className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {servicio ? `Lista de espera para ${servicio.nombre}` : "Lista de espera"}
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Déjanos tus datos. Si se libera un lugar, {negocio.nombre} se pondrá en contacto contigo.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                required
                placeholder="Tu nombre completo"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                placeholder="Ej. 5512345678"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700 transition"
              />
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={formState === "submitting"}
              className="w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition text-sm tracking-wide hover:opacity-90"
              style={{ background: colorBoton }}
            >
              {formState === "submitting" ? "Uniéndome…" : "Unirme a la lista de espera"}
            </button>
          </form>
          <div className="mt-3 text-center">
            <VolverAlNegocio slug={negocio.slug ?? slug!} nombre={negocio.nombre} />
          </div>
        </div>
        <PublicFooter />
      </div>
    </div>
  );
}
