import { Link } from "react-router-dom";
import { useState } from "react";
import { PRECIOS_PLANES } from "../../lib/precios";
import { ACTIVACION_FAQ, ACTIVACION_PLAZO, ACTIVACION_RESUMEN } from "../../lib/activacion";
import { AVISO_NOTIFICACIONES } from "../../lib/notificaciones";
import { FaqItem } from "../../components/landing/FaqItem";
import { CtaFinal } from "../../components/landing/CtaFinal";
import { Navbar } from "../../components/landing/Navbar";
import { FeatureCard } from "../../components/landing/FeatureCard";
import { PricingCard } from "../../components/landing/PricingCard";
import { Ico } from "../../components/landing/Ico";
import { dArrow, dBell, dCalendar, dShield, dUsers } from "../../components/landing/iconos";
import { ACENTO, GOLD, SLATE_700 } from "../../components/landing/constantes";

// ─── Main page ────────────────────────────────────────────────────────────────
export function LandingPageSalud() {
  const [billedAnnually, setBilledAnnually] = useState(false);

  return (
    <>
      <style>{`
        @keyframes av-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-14px) rotate(0.5deg); }
          66% { transform: translateY(-8px) rotate(-0.5deg); }
        }
        .av-float { animation: av-float 8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .av-float { animation: none; }
        }
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
        ::selection { background: #47556933; }
      `}</style>

      <div className="min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
        <Navbar
          secciones={[
            { href: "#caracteristicas", etiqueta: "Características" },
            { href: "#preguntas", etiqueta: "Preguntas" },
            { href: "#precios", etiqueta: "Precios" },
          ]}
          otraLanding={{ to: "/", etiqueta: "¿Tienes un salón o barbería?" }}
          registro="/registro?sector=salud"
        />

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(#33415520 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent -z-10" />

          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-8" style={{ backgroundColor: "#F1F5F9", color: "#334155", border: "1px solid #E2E8F0" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Para profesionales de la salud · México
              </div>

              <h1 className="font-black leading-[1.02] tracking-tight mb-7" style={{ fontSize: "clamp(3rem, 6vw, 4.25rem)" }}>
                La agenda más simple
                <br />
                para tu
                <br />
                <span style={{ color: ACENTO }}>consultorio.</span>
              </h1>

              <p className="text-lg text-slate-500 leading-relaxed max-w-[440px] mb-10">
                Recordatorios automáticos, booking online 24/7 y control total de tus pacientes.
                Sin complicaciones, sin comisiones.
              </p>

              <div className="flex flex-wrap gap-3 mb-8">
                <Link
                  to="/registro?sector=salud"
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                  style={{ backgroundColor: SLATE_700, boxShadow: `0 4px 16px -2px ${SLATE_700}44` }}
                >
                  Crear mi cuenta
                  <Ico d={dArrow} className="w-4 h-4" />
                </Link>
                <a href="#precios" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95">
                  Ver precios
                </a>
              </div>

              {/* Trust strip — sin calificación: el producto aún no tiene reseñas que la respalden. */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Ico d={dShield} className="w-3 h-3 text-emerald-400 shrink-0" />
                  Sin tarjeta · Sin comisiones · Cancela cuando quieras
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── IDEAL PARA ────────────────────────────────────────────────────── */}
        <section className="border-y border-slate-100 bg-slate-50/60 py-5">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-center md:justify-between">
              <p className="text-xs font-semibold text-slate-400 whitespace-nowrap uppercase tracking-widest">Ideal para</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Dentistas", "Psicólogos", "Terapeutas", "Nutriólogos", "Optometristas"].map(cat => (
                  <span key={cat} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-200">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────────────── */}
        <section id="caracteristicas" className="py-28 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: ACENTO }}>Características</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5 leading-tight">
                Todo lo que necesitas,
                <br />nada de lo que no.
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">Un sistema completo para gestionar tu consultorio, sin complejidad innecesaria.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard
                delay={0}
                icon={<Ico d={dCalendar} />}
                title="Booking online 24/7"
                desc="Tus pacientes agendan sin llamarte, a cualquier hora."
              />
              <FeatureCard
                delay={80}
                icon={<Ico d={dBell} />}
                title="Recordatorios automáticos"
                desc="Reduce inasistencias con recordatorios automáticos por correo."
              />
              <FeatureCard
                delay={160}
                icon={<Ico d={dUsers} />}
                title="Historial de pacientes"
                desc="Todo el historial de consultas de cada paciente en un lugar."
              />
            </div>
          </div>
        </section>

        {/* "Negocios reales" oculto hasta tener un cliente del sector salud (decisión 16, AP-22). */}

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <section id="precios" className="py-28 bg-white scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: ACENTO }}>Precios</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5">Sin sorpresas al final del mes</h2>
              <p className="text-slate-500 text-base max-w-md mx-auto">Un precio fijo, todo incluido. Sin comisiones por cita, sin módulos extras.</p>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center mb-12">
              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
                <button
                  type="button"
                  aria-pressed={!billedAnnually}
                  onClick={() => setBilledAnnually(false)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${!billedAnnually ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  aria-pressed={billedAnnually}
                  onClick={() => setBilledAnnually(true)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${billedAnnually ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Anual
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full transition-colors ${billedAnnually ? "bg-white/15 text-slate-200" : "bg-emerald-100 text-emerald-600"}`}>
                    Hasta −20%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 items-stretch">
              <PricingCard
                registro="/registro?sector=salud"
                delay={0} name="Básico" price={PRECIOS_PLANES.basico.mensual} annualPrice={PRECIOS_PLANES.basico.anual} employees={2}
                billedAnnually={billedAnnually}
                features={["Portal de reservas público", "2 empleados", "Notificaciones por email", "Dashboard y calendario", "Campana de notificaciones", "Gestión de clientes"]}
              />
              <PricingCard
                registro="/registro?sector=salud"
                delay={100} name="Pro" price={PRECIOS_PLANES.pro.mensual} annualPrice={PRECIOS_PLANES.pro.anual} employees={4}
                highlighted billedAnnually={billedAnnually}
                features={[
                  "Todo lo del plan Básico",
                  "Hasta 4 profesionales",
                  "Historial completo de pacientes",
                  "Exportar reportes en Excel",
                  "Recordatorios por correo",
                  "Personalización de colores"
                ]}
              />
              <PricingCard
                registro="/registro?sector=salud"
                delay={200} name="Premium" price={PRECIOS_PLANES.premium.mensual} employees={50} comingSoon
                billedAnnually={billedAnnually}
                features={["Todo lo del plan Pro", "Formularios de admisión", "Reportes avanzados", "Soporte prioritario"]}
              />
            </div>

            {/* Misma explicación de la activación manual que la landing principal (AP-02, AP-22). */}
            <p className="text-center text-sm text-slate-600 mt-10 max-w-2xl mx-auto">{ACTIVACION_RESUMEN}</p>

            <p className="text-center text-sm text-slate-500 mt-4">
              ¿Necesitas algo personalizado?{" "}
              <a href="mailto:hola@appointva.com" className="font-semibold text-slate-600 hover:text-slate-900 transition-colors underline underline-offset-2">
                hola@appointva.com
              </a>
            </p>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section id="preguntas" className="py-28 bg-slate-50 scroll-mt-20">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: ACENTO }}>FAQ</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">Lo que más nos preguntan</h2>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-8">
              <FaqItem
                defaultOpen
                q="¿Mis pacientes necesitan descargar una app o crear una cuenta?"
                a="No. Tus pacientes agendan desde la página de tu consultorio en cualquier navegador, sin registrarse ni instalar nada. Eligen el servicio, el horario y confirman."
              />
              <FaqItem
                q="¿Cómo se avisa a mis pacientes de su cita?"
                a={AVISO_NOTIFICACIONES}
              />
              <FaqItem
                q="¿Puedo atender con varios profesionales y horarios distintos?"
                a="Sí. Cada profesional tiene su propio horario y los servicios que ofrece. Tus pacientes eligen con quién agendar o dejan que el sistema asigne a alguien disponible."
              />
              <FaqItem
                q="¿Cómo funciona el proceso de activación después de registrarme?"
                a={ACTIVACION_FAQ}
              />
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
        <CtaFinal
          to="/registro?sector=salud"
          titulo="¿Listo para que tus pacientes agenden sin llamarte?"
          subtitulo={`Sin tarjeta de crédito. Activamos tu consultorio ${ACTIVACION_PLAZO}.`}
        />

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <footer style={{ backgroundColor: "#070E1A" }} className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="grid md:grid-cols-4 gap-10 mb-10">
              <div className="md:col-span-2">
                <span className="text-xl font-black">
                  <span className="text-white">Appoint</span>
                  <span style={{ color: GOLD }}>Va</span>
                </span>
                <p className="text-sm text-slate-500 mt-3 max-w-xs leading-relaxed">
                  Agenda online para negocios de servicios en México. Sin llamadas, sin WhatsApps, sin complicaciones.
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">Producto</p>
                <nav className="flex flex-col gap-2.5">
                  <a href="#caracteristicas" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Características</a>
                  <a href="#preguntas" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Preguntas</a>
                  <a href="#precios" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Precios</a>
                  <Link to="/registro?sector=salud" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Registrarse</Link>
                  <Link to="/login" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Iniciar sesión</Link>
                </nav>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">Legal y contacto</p>
                <nav className="flex flex-col gap-2.5">
                  <Link to="/privacidad" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacidad</Link>
                  <Link to="/terminos" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Términos</Link>
                  <a href="mailto:hola@appointva.com" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">hola@appointva.com</a>
                </nav>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-600">© 2026 AppointVa · Hecho en México</p>
              <p className="text-xs text-slate-600">Sistema de gestión de citas para negocios de servicios</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
