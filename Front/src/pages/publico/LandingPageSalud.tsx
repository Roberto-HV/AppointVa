import { Link } from "react-router-dom";
import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";

const GOLD = "#C8A961";
const SLATE_700 = "#334155";
const DARK = "#0F172A";

function useFadeInUp(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return {
    ref,
    style: {
      transition: `opacity .65s ease ${delay}ms, transform .65s ease ${delay}ms`,
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(24px)",
    } as CSSProperties,
  };
}

const Ico = ({ d, className = "w-5 h-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const dCalendar = "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5";
const dBell = "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0";
const dUsers = "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z";
const dStar = "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z";
const dCheck = "M4.5 12.75l6 6 9-13.5";
const dArrow = "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3";
const dMenu = "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5";
const dClose = "M6 18L18 6M6 6l12 12";
const dShield = "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z";

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled || open ? "bg-white/96 backdrop-blur-lg shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-[68px] flex items-center justify-between">
        <Link to="/" className="text-xl font-black tracking-tight select-none">
          <span className="text-slate-900">Appoint</span>
          <span style={{ color: GOLD }}>Va</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          <a href="#caracteristicas" className="hover:text-slate-900 transition-colors">Características</a>
          <a href="#testimonios" className="hover:text-slate-900 transition-colors">Testimonios</a>
          <a href="#precios" className="hover:text-slate-900 transition-colors">Precios</a>
          <span className="text-slate-200">·</span>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            ¿Tienes un salón o barbería? →
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg">
            Iniciar sesión
          </Link>
          <Link
            to="/registro?sector=salud"
            className="px-5 py-2 text-sm font-bold text-white rounded-xl transition-colors"
            style={{ backgroundColor: SLATE_700 }}
          >
            Empieza gratis →
          </Link>
        </div>

        <button
          className="md:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <Ico d={open ? dClose : dMenu} />
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 flex flex-col gap-3 shadow-lg">
          <a href="#caracteristicas" className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Características</a>
          <a href="#testimonios" className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Testimonios</a>
          <a href="#precios" className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Precios</a>
          <Link to="/" className="py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors" onClick={() => setOpen(false)}>¿Tienes un salón o barbería? →</Link>
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <Link to="/login" className="py-2.5 text-sm font-medium text-center text-slate-600 border border-slate-200 rounded-xl">Iniciar sesión</Link>
            <Link to="/registro?sector=salud" className="py-2.5 text-sm font-bold text-center text-white rounded-xl" style={{ backgroundColor: SLATE_700 }}>Empieza gratis →</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }: { icon: ReactNode; title: string; desc: string; delay?: number }) {
  const fade = useFadeInUp(delay);
  return (
    <div ref={fade.ref} style={fade.style} className="group p-6 rounded-2xl border border-slate-100 bg-white hover:border-amber-200 hover:shadow-lg hover:shadow-amber-50 transition-all duration-300">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: "#FEF9EC", color: GOLD }}>
        {icon}
      </div>
      <h3 className="font-bold text-slate-900 mb-2 text-[15px]">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── Testimonial card ─────────────────────────────────────────────────────────
function TestimonialCard({ quote, metric, name, role, initials, delay = 0 }: {
  quote: string; metric: string; name: string; role: string; initials: string; delay?: number;
}) {
  const fade = useFadeInUp(delay);
  return (
    <div ref={fade.ref} style={fade.style} className="flex flex-col p-7 rounded-2xl border border-slate-200 bg-white hover:border-amber-200 hover:shadow-lg hover:shadow-amber-50/50 transition-all duration-300">
      <div className="flex gap-0.5 mb-5">
        {[...Array(5)].map((_, i) => (
          <svg key={i} viewBox="0 0 24 24" className="w-4 h-4" fill={GOLD}>
            <path d={dStar} />
          </svg>
        ))}
      </div>
      <p className="text-slate-700 text-sm leading-relaxed flex-1 mb-5">"{quote}"</p>
      <div className="inline-flex items-center self-start px-2.5 py-1 rounded-lg text-xs font-bold mb-6" style={{ backgroundColor: "#FEF9EC", color: "#92701A", border: "1px solid #F3E0A0" }}>
        {metric}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${GOLD}, #a8862e)` }}>
          {initials}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{name}</p>
          <p className="text-xs text-slate-400">{role}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────
function PricingCard({
  name, price, annualPrice, employees, features, highlighted = false, delay = 0, comingSoon = false, billedAnnually = false,
}: {
  name: string; price: number; annualPrice?: number; employees: number;
  features: string[]; highlighted?: boolean; delay?: number; comingSoon?: boolean; billedAnnually?: boolean;
}) {
  const fade = useFadeInUp(delay);
  const displayPrice = billedAnnually && annualPrice ? annualPrice : price;
  return (
    <div
      ref={fade.ref}
      style={{ ...fade.style, backgroundColor: highlighted ? DARK : "white", transform: `${fade.style.transform} ${highlighted ? "scale(1.04)" : ""}` }}
      className={`relative flex flex-col p-7 rounded-2xl border transition-all duration-300 ${highlighted ? "border-transparent shadow-2xl" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
    >
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-black text-slate-900 whitespace-nowrap" style={{ backgroundColor: GOLD }}>
          Más popular
        </div>
      )}

      <div className="mb-6">
        <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${highlighted ? "text-amber-400" : "text-slate-400"}`}>{name}</p>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className={`text-5xl font-black tabular-nums ${highlighted ? "text-white" : "text-slate-900"}`}>${displayPrice.toLocaleString()}</span>
          <span className="text-sm text-slate-400">/mes</span>
        </div>
        {billedAnnually && annualPrice && (
          <p className="text-xs font-semibold mb-1" style={{ color: GOLD }}>
            Facturado anual · Ahorras ${((price - annualPrice) * 12).toLocaleString()}/año
          </p>
        )}
        <p className="text-xs text-slate-400">
          {employees} empleados
          {comingSoon && <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: "#F1F5F9", color: "#94A3B8", border: "1px solid #E2E8F0" }}>Próximamente</span>}
        </p>
      </div>

      <ul className="flex flex-col gap-3 mb-8 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-shrink-0" style={{ color: GOLD }}><Ico d={dCheck} className="w-3.5 h-3.5" /></span>
            <span className={`text-sm leading-snug ${highlighted ? "text-slate-300" : "text-slate-600"}`}>{f}</span>
          </li>
        ))}
      </ul>

      {comingSoon ? (
        <div className="block text-center py-3 rounded-xl text-sm font-bold cursor-not-allowed select-none" style={{ backgroundColor: highlighted ? "#1E293B" : "#F1F5F9", color: highlighted ? "#475569" : "#94A3B8", border: `1px solid ${highlighted ? "#334155" : "#E2E8F0"}` }}>
          Próximamente disponible
        </div>
      ) : (
        <Link to="/registro?sector=salud" className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: highlighted ? GOLD : SLATE_700, color: highlighted ? DARK : "white" }}>
          Empezar con {name} →
        </Link>
      )}
    </div>
  );
}

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
        html { scroll-behavior: smooth; }
        ::selection { background: #C8A96133; }
      `}</style>

      <div className="min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
        <Navbar />

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(#33415520 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent -z-10" />

          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-8" style={{ backgroundColor: "#FEF9EC", color: "#92701A", border: "1px solid #F3E0A0" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />
                Para profesionales de la salud · México 🇲🇽
              </div>

              <h1 className="font-black leading-[1.02] tracking-tight mb-7" style={{ fontSize: "clamp(3rem, 6vw, 4.25rem)" }}>
                La agenda más simple
                <br />
                para tu
                <br />
                <span style={{ color: GOLD }}>consultorio.</span>
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
                  Empieza gratis
                  <Ico d={dArrow} className="w-4 h-4" />
                </Link>
                <a href="#precios" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95">
                  Ver precios
                </a>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={GOLD}><path d={dStar} /></svg>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-700">4.9 / 5</span>
                </div>
                <span className="text-slate-200 hidden sm:block text-xs">·</span>
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD }}>Características</p>
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
                desc="Reduce inasistencias con recordatorios por correo y WhatsApp."
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

        {/* ── TESTIMONIOS ───────────────────────────────────────────────────── */}
        <section id="testimonios" className="py-28 bg-slate-50 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD }}>Testimonios</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5 leading-tight">
                Lo que dicen los profesionales
                <br />que lo usaron primero
              </h2>
              <p className="text-slate-500 text-base max-w-md mx-auto">Resultados reales de profesionales de la salud en México.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <TestimonialCard
                delay={0}
                quote="Antes llenaba la agenda por teléfono. Ahora mis pacientes agendan solos y yo solo confirmo."
                metric="Agenda sin llamadas"
                name="Dr. Alejandro Ríos"
                role="Consultorio Dental Ríos · Guadalajara"
                initials="AR"
              />
              <TestimonialCard
                delay={120}
                quote="El recordatorio automático redujo mis faltas a casi cero. Mis pacientes llegan más puntuales."
                metric="Faltas casi a cero"
                name="Lic. Sofía Montoya"
                role="Psicóloga independiente · CDMX"
                initials="SM"
              />
              <TestimonialCard
                delay={240}
                quote="Llevo el historial de cada paciente en AppointVa. Ya no busco entre apuntes."
                metric="Historial centralizado"
                name="Dr. Marco Herrera"
                role="Nutriólogo · Monterrey"
                initials="MH"
              />
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <section id="precios" className="py-28 bg-white scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD }}>Precios</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5">Sin sorpresas al final del mes</h2>
              <p className="text-slate-500 text-base max-w-md mx-auto">Un precio fijo, todo incluido. Sin comisiones por cita, sin módulos extras.</p>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center mb-12">
              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
                <button
                  onClick={() => setBilledAnnually(false)}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${!billedAnnually ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setBilledAnnually(true)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${billedAnnually ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Anual
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full transition-colors ${billedAnnually ? "bg-amber-400/20 text-amber-300" : "bg-emerald-100 text-emerald-600"}`}>
                    −20%
                  </span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 items-stretch">
              <PricingCard
                delay={0} name="Básico" price={249} annualPrice={199} employees={2}
                billedAnnually={billedAnnually}
                features={["Portal de reservas público", "2 empleados", "Notificaciones por email", "Dashboard y calendario", "Campana de notificaciones", "Gestión de clientes"]}
              />
              <PricingCard
                delay={100} name="Pro" price={449} employees={4}
                highlighted billedAnnually={billedAnnually}
                features={[
                  "Todo lo del plan Básico",
                  "Hasta 4 profesionales",
                  "Historial completo de pacientes",
                  "Exportar reportes en Excel",
                  "Recordatorios por WhatsApp",
                  "Personalización de colores"
                ]}
              />
              <PricingCard
                delay={200} name="Premium" price={799} employees={50} comingSoon
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
                  <a href="#testimonios" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Testimonios</a>
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
              <p className="text-xs text-slate-600">© 2026 AppointVa · Hecho en México 🇲🇽</p>
              <p className="text-xs text-slate-600">Sistema de gestión de citas para negocios de servicios</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
