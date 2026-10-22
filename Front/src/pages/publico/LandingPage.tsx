import { Bell, Scissors, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef, type RefObject } from "react";
import { PRECIOS_PLANES, MONEDA } from "../../lib/precios";
import { ACTIVACION_FAQ, ACTIVACION_PLAZO, ACTIVACION_PLAZO_HORAS } from "../../lib/activacion";
import { AVISO_NOTIFICACIONES } from "../../lib/notificaciones";
import { useFadeInUp } from "../../components/landing/useFadeInUp";
import { FaqItem } from "../../components/landing/FaqItem";
import { CtaFinal } from "../../components/landing/CtaFinal";
import { Navbar } from "../../components/landing/Navbar";
import { FeatureCard } from "../../components/landing/FeatureCard";
import { PricingCard } from "../../components/landing/PricingCard";
import { Ico } from "../../components/landing/Ico";
import { dArrow, dBell, dCalendar, dChart, dShield, dStar, dTag, dUsers } from "../../components/landing/iconos";
import { ACENTO, GOLD, SLATE_700 } from "../../components/landing/constantes";

// ─── Phone mockup ─────────────────────────────────────────────────────────────
function PhoneMockup() {
  const slots = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];
  const days = [{ d: "Sa", n: 5 }, { d: "Do", n: 6 }, { d: "Lu", n: 7 }, { d: "Ma", n: 8 }];

  return (
    <div className="relative select-none pointer-events-none">
      <div className="absolute inset-0 blur-3xl opacity-25 scale-90 -z-10" style={{ backgroundColor: "#94A3B8", borderRadius: "50%" }} />

      <div className="absolute -top-5 -right-4 z-20 bg-white rounded-2xl shadow-2xl shadow-slate-200 px-3.5 py-2.5 flex items-center gap-2.5 min-w-max">
        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center"><Bell size={14} className="text-emerald-700" aria-hidden="true" /></div>
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-none mb-0.5">Nueva cita confirmada</p>
          <p className="text-[10px] text-slate-400">Hace 2 minutos</p>
        </div>
      </div>

      <div className="relative w-[255px] rounded-[2.8rem] bg-[#0A0A0A] p-[11px] shadow-2xl ring-1 ring-white/5">
        <div className="absolute -left-[3px] top-[76px] w-[3px] h-8 rounded-l-full bg-[#1a1a1a]" />
        <div className="absolute -left-[3px] top-[120px] w-[3px] h-6 rounded-l-full bg-[#1a1a1a]" />
        <div className="absolute -right-[3px] top-[100px] w-[3px] h-12 rounded-r-full bg-[#1a1a1a]" />

        <div className="rounded-[2.2rem] bg-[#F9FAFB] overflow-hidden h-[510px] flex flex-col">
          <div className="flex justify-between items-center px-6 pt-3 pb-1">
            <span className="text-[11px] font-bold text-slate-700">9:41</span>
            <div className="absolute left-1/2 -translate-x-1/2 top-[14px] w-[80px] h-[22px] rounded-full bg-black" />
            <div className="flex gap-1.5 items-center">
              <svg viewBox="0 0 16 12" className="w-3.5 h-3 fill-slate-700">
                <rect x="0" y="7" width="2.5" height="5" rx="0.5" />
                <rect x="4.5" y="4.5" width="2.5" height="7.5" rx="0.5" />
                <rect x="9" y="2" width="2.5" height="10" rx="0.5" />
                <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" />
              </svg>
              <svg viewBox="0 0 24 12" className="w-5 h-3 fill-slate-700">
                <rect x="0" y="1" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <rect x="20.5" y="4" width="2" height="4" rx="0.5" />
                <rect x="2" y="3" width="14" height="6" rx="1" />
              </svg>
            </div>
          </div>

          <div className="mx-3 mt-2 mb-1 px-3 py-2.5 bg-white rounded-2xl border border-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #475569, #1E293B)" }}>BL</div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-900 leading-none mb-0.5">Barbería Luis</p>
              <p className="text-[9px] text-slate-400 truncate">appointva.com/b/barberia-luis</p>
            </div>
          </div>

          <div className="flex gap-1 px-4 mb-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: s <= 3 ? SLATE_700 : "#E2E8F0" }} />
            ))}
          </div>

          <div className="flex-1 px-4 flex flex-col min-h-0">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Elige tu horario</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl mb-3 self-start" style={{ backgroundColor: "#F1F5F9", border: "1px solid #E2E8F0" }}>
              <Scissors size={11} aria-hidden="true" style={{ color: SLATE_700 }} />
              <span className="text-[10px] font-bold" style={{ color: SLATE_700 }}>{`Corte · 45 min · $250 ${MONEDA}`}</span>
            </div>

            <div className="grid grid-cols-4 gap-1 mb-3">
              {days.map(({ d, n }, i) => (
                <div key={d} className="rounded-xl py-1.5 text-center" style={i === 2 ? { backgroundColor: SLATE_700 } : { backgroundColor: "#F1F5F9" }}>
                  <p className="text-[9px] font-bold" style={{ color: i === 2 ? "#fff" : "#64748B" }}>{d}</p>
                  <p className="text-[11px] font-black" style={{ color: i === 2 ? "#fff" : "#334155" }}>{n}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {slots.map((t, i) => {
                const selected = i === 4;
                const unavailable = i === 2;
                return (
                  <div key={t} className="text-center py-1.5 rounded-xl text-[10px] font-bold" style={{ backgroundColor: selected ? SLATE_700 : unavailable ? "#F8FAFC" : "white", color: selected ? "white" : unavailable ? "#CBD5E1" : "#334155", border: selected ? "none" : "1px solid #E2E8F0", textDecoration: unavailable ? "line-through" : "none" }}>
                    {t}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 px-2 py-2 bg-white rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0">LG</div>
              <div>
                <p className="text-[10px] font-bold text-slate-800 leading-none mb-0.5">Luis García</p>
                <p className="text-[9px] text-slate-400">Tu barbero favorito</p>
              </div>
              <div className="ml-auto"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><Check size={10} strokeWidth={3} aria-hidden="true" /></span></div>
            </div>
          </div>

          <div className="px-4 pb-5 pt-3">
            <div className="w-full py-2.5 rounded-2xl text-[12px] font-black text-white text-center" style={{ backgroundColor: SLATE_700 }}>Confirmar reserva →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────
function StepCard({ number, title, desc, delay }: { number: string; title: string; desc: string; delay: number }) {
  const fade = useFadeInUp(delay);
  return (
    <div ref={fade.ref} style={fade.style} className="text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg mb-6 mx-auto relative z-10 shadow-lg" style={{ backgroundColor: SLATE_700, boxShadow: `0 8px 24px -4px ${SLATE_700}55` }}>
        {number}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

// ─── Negocio real ─────────────────────────────────────────────────────────────
// Fila completa dentro de una columna: la lista se lee intencional con dos
// negocios y admite un tercero sin rehacer la retícula.
function NegocioCard({ nombre, tipo, slug, initials, delay = 0 }: {
  nombre: string; tipo: string; slug: string; initials: string; delay?: number;
}) {
  const fade = useFadeInUp(delay);
  return (
    <div ref={fade.ref} style={fade.style}>
      <Link
        to={`/b/${slug}`}
        aria-label={`Abrir la página de reservas de ${nombre}`}
        className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100/50 transition-all duration-300"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-black text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #475569, #1E293B)" }}>
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 leading-tight">{nombre}</p>
          <p className="text-xs text-slate-400 mt-1 leading-snug">{tipo}</p>
          <p className="text-xs text-slate-400 mt-1.5 truncate">appointva.com/b/{slug}</p>
        </div>

        <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
          <span className="hidden sm:inline">Ver su página</span>
          <Ico d={dArrow} className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}

// ─── Sticky CTA (solo móvil) ──────────────────────────────────────────────────
// Visible entre el final del hero y el CTA oscuro, para que los dos no se apilen.
function useStickyCta(
  heroRef: RefObject<HTMLElement | null>,
  finalCtaRef: RefObject<HTMLElement | null>,
) {
  const [heroOut, setHeroOut] = useState(false);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setHeroOut(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [heroRef]);

  useEffect(() => {
    const el = finalCtaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setFinalCtaVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [finalCtaRef]);

  return heroOut && !finalCtaVisible;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [billedAnnually, setBilledAnnually] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const finalCtaRef = useRef<HTMLElement>(null);
  const showStickyCta = useStickyCta(heroRef, finalCtaRef);

  return (
    <>
      <style>{`
        @keyframes av-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-14px) rotate(0.5deg); }
          66% { transform: translateY(-8px) rotate(-0.5deg); }
        }
        .av-float { animation: av-float 8s ease-in-out infinite; }
        @keyframes av-sticky-in {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .av-sticky-in { animation: av-sticky-in .28s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .av-float, .av-sticky-in { animation: none; }
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
            { href: "#como-funciona", etiqueta: "Cómo funciona" },
            { href: "#precios", etiqueta: "Precios" },
          ]}
          otraLanding={{ to: "/salud", etiqueta: "¿Tienes un consultorio?" }}
          registro="/registro"
        />

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative pt-36 pb-24 md:pt-44 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(#33415520 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent -z-10" />

          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-8" style={{ backgroundColor: "#F1F5F9", color: "#334155", border: "1px solid #E2E8F0" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  Para negocios de servicios · México
                </div>

                <h1 className="font-black leading-[1.02] tracking-tight mb-7" style={{ fontSize: "clamp(3rem, 6vw, 4.25rem)" }}>
                  Tu agenda
                  <br />
                  online.
                  <br />
                  <span style={{ color: ACENTO }}>Sin llamadas.</span>
                </h1>

                <p className="text-lg text-slate-500 leading-relaxed max-w-[440px] mb-10">
                  AppointVa crea una página de reservas propia para tu negocio. Tus clientes agendan
                  cuando quieran — tú recibes notificaciones y gestionas todo desde un panel limpio.
                </p>

                {/* min-w iguala el ancho de los dos botones pese a que sus etiquetas difieren. */}
                <div className="flex flex-wrap gap-3 mb-8">
                  <Link
                    to="/registro"
                    className="inline-flex items-center justify-center min-w-[180px] px-7 py-3.5 text-sm font-bold text-white rounded-xl border border-transparent transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: SLATE_700, boxShadow: `0 4px 16px -2px ${SLATE_700}44` }}
                  >
                    Crear mi cuenta
                  </Link>
                  <a href="#precios" className="inline-flex items-center justify-center min-w-[180px] px-7 py-3.5 text-sm font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95">
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

              <div className="flex justify-center md:justify-end">
                <div className="av-float"><PhoneMockup /></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <section className="border-t border-slate-100 bg-white">
          <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { val: `< ${ACTIVACION_PLAZO_HORAS} h`, label: "Hábiles para activar tu negocio" },
              { val: "24/7",    label: "Tu booking disponible para clientes" },
              { val: "$0",      label: "Comisión por cada cita agendada" },
              { val: `$${PRECIOS_PLANES.basico.mensual}`, label: `${MONEDA} al mes, todo incluido` },
            ].map(({ val, label }) => (
              <div key={label} className="text-center md:text-left">
                <p className="text-3xl font-black text-slate-900 mb-1 tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>{val}</p>
                <p className="text-sm text-slate-500 leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── INDUSTRIAS ────────────────────────────────────────────────────── */}
        <section className="border-y border-slate-100 bg-slate-50/60 py-5">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-center md:justify-between">
              <p className="text-xs font-semibold text-slate-400 whitespace-nowrap uppercase tracking-widest">Ideal para</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Barberías", "Salones de belleza", "Clínicas", "Spas", "Talleres de uñas"].map(cat => (
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
              <p className="text-slate-500 max-w-lg mx-auto text-base">Un sistema completo para gestionar tu negocio de servicios, sin complejidad innecesaria.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard delay={0}   icon={<Ico d={dCalendar} />} title="Booking público 24/7" desc="Tu página en /b/tu-negocio, siempre activa. Clientes reservan en cualquier momento sin llamadas ni mensajes." />
              <FeatureCard delay={80}  icon={<Ico d={dBell} />}     title="Notificaciones automáticas" desc="Confirmaciones y recordatorios por email. Campana en el dashboard con historial de nuevas citas y cancelaciones en tiempo real." />
              <FeatureCard delay={160} icon={<Ico d={dUsers} />}    title="Equipo con horarios propios" desc="Cada empleado tiene su agenda independiente. Los clientes eligen servicio, profesional y horario." />
              <FeatureCard delay={0}   icon={<Ico d={dTag} />}      title="Descuentos y códigos" desc="Crea promociones para nuevos clientes o temporadas. Fideliza con un código y sin complejidad extra." />
              <FeatureCard delay={80}  icon={<Ico d={dStar} />}     title="Reseñas automáticas" desc="Solicita opiniones tras cada cita completada. Construye tu reputación en piloto automático." />
              <FeatureCard delay={160} icon={<Ico d={dChart} />}    title="Reportes en tiempo real" desc="Citas, ingresos y clientes de este mes. Visualiza el crecimiento y exporta a Excel con un clic." />
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section id="como-funciona" className="py-28 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-20">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: ACENTO }}>Cómo funciona</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5">Listo en 3 pasos</h2>
              <p className="text-slate-500 text-base">Sin técnicos, sin contratos, sin complicaciones.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12 md:gap-8 relative">
              <div className="hidden md:block absolute top-7 left-[calc(16.67%+3.5rem)] right-[calc(16.67%+3.5rem)] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
              <StepCard delay={0}   number="01" title="Crea tu cuenta" desc={`Registra tu negocio y agrega servicios, empleados y horarios. Sin tarjeta de crédito; activamos tu negocio ${ACTIVACION_PLAZO}.`} />
              <StepCard delay={120} number="02" title="Comparte tu link" desc="Publica appointva.com/b/tu-negocio en tu Instagram, WhatsApp o Bio. Cuando tu negocio esté activo, tus clientes reservan desde ahí." />
              <StepCard delay={240} number="03" title="Gestiona tu agenda" desc="Recibe notificaciones de cada cita. Dashboard limpio con calendario, historial y reportes en tiempo real." />
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <section id="precios" className="py-28 bg-slate-50 scroll-mt-20">
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
                registro="/registro"
                delay={0} name="Básico" price={PRECIOS_PLANES.basico.mensual} annualPrice={PRECIOS_PLANES.basico.anual} employees={2}
                billedAnnually={billedAnnually}
                features={["Portal de reservas público", "2 empleados", "Notificaciones por email", "Dashboard y calendario", "Campana de notificaciones", "Gestión de clientes"]}
              />
              <PricingCard
                registro="/registro"
                delay={100} name="Pro" price={PRECIOS_PLANES.pro.mensual} annualPrice={PRECIOS_PLANES.pro.anual} employees={4}
                highlighted billedAnnually={billedAnnually}
                features={["Todo lo del plan Básico", "4 empleados", "Módulo de pagos integrado", "Recibos digitales", "Conexión a periféricos de pago", "Códigos de descuento"]}
              />
              <PricingCard
                registro="/registro"
                delay={200} name="Premium" price={PRECIOS_PLANES.premium.mensual} employees={50} comingSoon
                billedAnnually={billedAnnually}
                features={["Todo lo del plan Pro", "Formularios de admisión", "Reportes avanzados", "Soporte prioritario"]}
              />
            </div>

            <p className="text-center text-sm text-slate-400 mt-10">
              ¿Necesitas algo personalizado?{" "}
              <a href="mailto:hola@appointva.com" className="font-semibold text-slate-600 hover:text-slate-900 transition-colors underline underline-offset-2">
                hola@appointva.com
              </a>
            </p>
          </div>
        </section>

        {/* ── NEGOCIOS REALES ───────────────────────────────────────────────── */}
        <section className="py-24 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="text-center lg:text-left">
                <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: ACENTO }}>Negocios reales</p>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5 leading-tight">
                  Negocios que ya reservan con AppointVa
                </h2>
                <p className="text-slate-500 text-base max-w-sm mx-auto lg:mx-0">
                  Abre su página y reserva como lo haría tu cliente.
                </p>
              </div>

              {/* min-w-0: sin esto el ítem de grid toma el ancho de su contenido y se sale del padding. */}
              <div className="flex flex-col gap-4 min-w-0">
                <NegocioCard
                  delay={0}
                  nombre="Aramis Manzo Salón"
                  tipo="Salón de belleza"
                  slug="aramis-manzo-salon"
                  initials="AM"
                />
                <NegocioCard
                  delay={120}
                  nombre="Lashes_crisantemo"
                  tipo="Estudio de pestañas · Zacatepec, Tejupilco"
                  slug="lashescrisantemo"
                  initials="LC"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section className="py-28 bg-slate-50 scroll-mt-20">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: ACENTO }}>FAQ</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">Lo que más nos preguntan</h2>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-8">
              <FaqItem
                defaultOpen
                q="¿Necesito saber programar o tener experiencia técnica?"
                a="No. Si sabes usar WhatsApp, puedes usar AppointVa. La configuración inicial es sencilla: agregas tus servicios, tus horarios y listo. No hay que instalar nada ni contratar a un técnico."
              />
              <FaqItem
                q="¿Mis clientes necesitan descargarse una app o crear una cuenta?"
                a="No. Tus clientes reservan directamente desde tu página personalizada en cualquier navegador, sin registrarse ni instalar nada. Solo entran, eligen horario y confirman."
              />
              <FaqItem
                q="¿Puedo manejar varios empleados con horarios diferentes?"
                a="Sí. Cada empleado tiene su propio calendario con sus horarios y los servicios que ofrece. Tus clientes pueden elegir específicamente con quién quieren agendar, o dejar que el sistema asigne automáticamente."
              />
              <FaqItem
                q="¿Cómo funciona el proceso de activación después de registrarme?"
                a={ACTIVACION_FAQ}
              />
              <FaqItem
                q="¿Cómo se avisa a mis clientes de su cita?"
                a={AVISO_NOTIFICACIONES}
              />
            </div>
          </div>
        </section>

        {/* ── DARK CTA ──────────────────────────────────────────────────────── */}
        <CtaFinal
          ref={finalCtaRef}
          to="/registro"
          titulo="¿Listo para dejar de perder citas por llamadas?"
          subtitulo={`Sin tarjeta de crédito. Activamos tu negocio ${ACTIVACION_PLAZO}.`}
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
                  <a href="#como-funciona" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Cómo funciona</a>
                  <a href="#precios" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Precios</a>
                  <Link to="/registro" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Registrarse</Link>
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

        {/* ── STICKY CTA (móvil) ────────────────────────────────────────────── */}
        {showStickyCta && (
          <div className="md:hidden fixed bottom-0 inset-x-0 z-40 av-sticky-in border-t border-slate-200 bg-white/95 backdrop-blur-lg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_-10px_rgba(15,23,42,0.35)]">
            <Link
              to="/registro"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white active:scale-[0.98] transition-transform"
              style={{ backgroundColor: SLATE_700 }}
            >
              Crear mi cuenta
              <Ico d={dArrow} className="w-4 h-4" />
            </Link>
            <p className="mt-2 text-center text-[11px] text-slate-400">Sin tarjeta · Cancela cuando quieras</p>
          </div>
        )}
      </div>
    </>
  );
}
