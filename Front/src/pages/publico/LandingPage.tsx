import { Link } from "react-router-dom";
import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const GOLD = "#C8A961";
const SLATE_700 = "#334155";
const DARK = "#0F172A";

// ─── Scroll-reveal hook (no external deps) ────────────────────────────────────
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

// ─── SVG icons (Heroicons outline) ────────────────────────────────────────────
const Ico = ({ d, className = "w-5 h-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const dCalendar = "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5";
const dBell = "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0";
const dUsers = "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z";
const dTag = "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z";
const dStar = "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z";
const dChart = "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z";
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
        {/* Logo */}
        <Link to="/" className="text-xl font-black tracking-tight select-none">
          <span className="text-slate-900">Appoint</span>
          <span style={{ color: GOLD }}>Va</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          <a href="#caracteristicas" className="hover:text-slate-900 transition-colors">Características</a>
          <a href="#como-funciona" className="hover:text-slate-900 transition-colors">Cómo funciona</a>
          <a href="#precios" className="hover:text-slate-900 transition-colors">Precios</a>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg">
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="px-5 py-2 text-sm font-bold text-white rounded-xl bg-slate-700 hover:bg-slate-800 transition-colors"
          >
            Comenzar gratis →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <Ico d={open ? dClose : dMenu} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 flex flex-col gap-3 shadow-lg">
          <a href="#caracteristicas" className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Características</a>
          <a href="#como-funciona" className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Cómo funciona</a>
          <a href="#precios" className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>Precios</a>
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <Link to="/login" className="py-2.5 text-sm font-medium text-center text-slate-600 border border-slate-200 rounded-xl">Iniciar sesión</Link>
            <Link to="/registro" className="py-2.5 text-sm font-bold text-center text-white rounded-xl bg-slate-700">Comenzar gratis →</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Phone mockup with CSS-only booking UI ────────────────────────────────────
function PhoneMockup() {
  const slots = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];
  const days = [{ d: "Sa", n: 5 }, { d: "Do", n: 6 }, { d: "Lu", n: 7 }, { d: "Ma", n: 8 }];

  return (
    <div className="relative select-none pointer-events-none">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 blur-3xl opacity-25 scale-90 -z-10"
        style={{ backgroundColor: GOLD, borderRadius: "50%" }}
      />

      {/* Floating notification */}
      <div className="absolute -top-5 -right-4 z-20 bg-white rounded-2xl shadow-2xl shadow-slate-200 px-3.5 py-2.5 flex items-center gap-2.5 min-w-max">
        <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-sm">🔔</div>
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-none mb-0.5">Nueva cita confirmada</p>
          <p className="text-[10px] text-slate-400">Hace 2 minutos</p>
        </div>
      </div>

      {/* Rating badge */}
      <div className="absolute -bottom-3 -left-4 z-20 bg-white rounded-2xl shadow-2xl shadow-slate-200 px-3.5 py-2.5 flex items-center gap-2">
        <span className="text-base">⭐</span>
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-none mb-0.5">4.9 / 5.0</p>
          <p className="text-[10px] text-slate-400">128 reseñas</p>
        </div>
      </div>

      {/* Phone shell */}
      <div className="relative w-[255px] rounded-[2.8rem] bg-[#0A0A0A] p-[11px] shadow-2xl ring-1 ring-white/5">
        {/* Volume buttons */}
        <div className="absolute -left-[3px] top-[76px] w-[3px] h-8 rounded-l-full bg-[#1a1a1a]" />
        <div className="absolute -left-[3px] top-[120px] w-[3px] h-6 rounded-l-full bg-[#1a1a1a]" />
        {/* Power button */}
        <div className="absolute -right-[3px] top-[100px] w-[3px] h-12 rounded-r-full bg-[#1a1a1a]" />

        {/* Screen */}
        <div className="rounded-[2.2rem] bg-[#F9FAFB] overflow-hidden h-[510px] flex flex-col">

          {/* Status bar */}
          <div className="flex justify-between items-center px-6 pt-3 pb-1">
            <span className="text-[11px] font-bold text-slate-700">9:41</span>
            {/* Dynamic island */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[14px] w-[80px] h-[22px] rounded-full bg-black" />
            <div className="flex gap-1.5 items-center">
              {/* Signal bars */}
              <svg viewBox="0 0 16 12" className="w-3.5 h-3 fill-slate-700">
                <rect x="0" y="7" width="2.5" height="5" rx="0.5" />
                <rect x="4.5" y="4.5" width="2.5" height="7.5" rx="0.5" />
                <rect x="9" y="2" width="2.5" height="10" rx="0.5" />
                <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" />
              </svg>
              {/* Battery */}
              <svg viewBox="0 0 24 12" className="w-5 h-3 fill-slate-700">
                <rect x="0" y="1" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <rect x="20.5" y="4" width="2" height="4" rx="0.5" />
                <rect x="2" y="3" width="14" height="6" rx="1" />
              </svg>
            </div>
          </div>

          {/* App header */}
          <div className="mx-3 mt-2 mb-1 px-3 py-2.5 bg-white rounded-2xl border border-slate-100 flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #a8862e)` }}
            >
              BL
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-900 leading-none mb-0.5">Barbería Luis</p>
              <p className="text-[9px] text-slate-400 truncate">appointva.com/b/barberia-luis</p>
            </div>
          </div>

          {/* Progress steps */}
          <div className="flex gap-1 px-4 mb-2">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: s <= 3 ? GOLD : "#E2E8F0" }} />
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 px-4 flex flex-col min-h-0">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Elige tu horario</p>

            {/* Service chip */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl mb-3 self-start"
              style={{ backgroundColor: "#FEF9EC", border: `1px solid #F3E0A0` }}
            >
              <span className="text-[10px]">✂</span>
              <span className="text-[10px] font-bold" style={{ color: "#92701A" }}>Corte · 45 min · $250 MXN</span>
            </div>

            {/* Day selector */}
            <div className="grid grid-cols-4 gap-1 mb-3">
              {days.map(({ d, n }, i) => (
                <div
                  key={d}
                  className="rounded-xl py-1.5 text-center"
                  style={i === 2
                    ? { backgroundColor: GOLD }
                    : { backgroundColor: "#F1F5F9" }
                  }
                >
                  <p className="text-[9px] font-bold" style={{ color: i === 2 ? "#fff" : "#64748B" }}>{d}</p>
                  <p className="text-[11px] font-black" style={{ color: i === 2 ? "#fff" : "#334155" }}>{n}</p>
                </div>
              ))}
            </div>

            {/* Time slots */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {slots.map((t, i) => {
                const selected = i === 4;
                const unavailable = i === 2;
                return (
                  <div
                    key={t}
                    className="text-center py-1.5 rounded-xl text-[10px] font-bold"
                    style={{
                      backgroundColor: selected ? GOLD : unavailable ? "#F8FAFC" : "white",
                      color: selected ? "white" : unavailable ? "#CBD5E1" : "#334155",
                      border: selected ? "none" : unavailable ? "1px solid #E2E8F0" : "1px solid #E2E8F0",
                      textDecoration: unavailable ? "line-through" : "none",
                    }}
                  >
                    {t}
                  </div>
                );
              })}
            </div>

            {/* Professional */}
            <div className="flex items-center gap-2 px-2 py-2 bg-white rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0">LG</div>
              <div>
                <p className="text-[10px] font-bold text-slate-800 leading-none mb-0.5">Luis García</p>
                <p className="text-[9px] text-slate-400">Tu barbero favorito</p>
              </div>
              <div className="ml-auto">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">✓</span>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="px-4 pb-5 pt-3">
            <div
              className="w-full py-2.5 rounded-2xl text-[12px] font-black text-white text-center"
              style={{ backgroundColor: SLATE_700 }}
            >
              Confirmar reserva →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }: { icon: ReactNode; title: string; desc: string; delay?: number }) {
  const fade = useFadeInUp(delay);
  return (
    <div
      ref={fade.ref}
      style={fade.style}
      className="group p-6 rounded-2xl border border-slate-100 bg-white hover:border-amber-200 hover:shadow-lg hover:shadow-amber-50 transition-all duration-300"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: "#FEF9EC", color: GOLD }}
      >
        {icon}
      </div>
      <h3 className="font-bold text-slate-900 mb-2 text-[15px]">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────
function StepCard({ number, title, desc, delay }: { number: string; title: string; desc: string; delay: number }) {
  const fade = useFadeInUp(delay);
  return (
    <div ref={fade.ref} style={fade.style} className="text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg mb-6 mx-auto relative z-10 shadow-lg"
        style={{ backgroundColor: SLATE_700, boxShadow: `0 8px 24px -4px ${SLATE_700}55` }}
      >
        {number}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────
function PricingCard({
  name, price, employees, citas, features, highlighted = false, delay = 0,
}: {
  name: string; price: number; employees: number; citas: string;
  features: string[]; highlighted?: boolean; delay?: number;
}) {
  const fade = useFadeInUp(delay);
  return (
    <div
      ref={fade.ref}
      style={{
        ...fade.style,
        backgroundColor: highlighted ? DARK : "white",
        transform: `${fade.style.transform} ${highlighted ? "scale(1.04)" : ""}`,
      }}
      className={`relative flex flex-col p-7 rounded-2xl border transition-all duration-300 ${
        highlighted
          ? "border-transparent shadow-2xl"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      {highlighted && (
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-black text-slate-900 whitespace-nowrap"
          style={{ backgroundColor: GOLD }}
        >
          Más popular
        </div>
      )}

      <div className="mb-6">
        <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${highlighted ? "text-amber-400" : "text-slate-400"}`}>
          {name}
        </p>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className={`text-5xl font-black ${highlighted ? "text-white" : "text-slate-900"}`}>
            ${price.toLocaleString()}
          </span>
          <span className="text-sm text-slate-400">/mes</span>
        </div>
        <p className={`text-xs ${highlighted ? "text-slate-400" : "text-slate-400"}`}>
          {employees} empleados · {citas} citas/mes
        </p>
      </div>

      <ul className="flex flex-col gap-3 mb-8 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-shrink-0" style={{ color: GOLD }}>
              <Ico d={dCheck} className="w-3.5 h-3.5" />
            </span>
            <span className={`text-sm leading-snug ${highlighted ? "text-slate-300" : "text-slate-600"}`}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/registro"
        className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
        style={{
          backgroundColor: highlighted ? GOLD : SLATE_700,
          color: highlighted ? DARK : "white",
        }}
      >
        Empezar con {name} →
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
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
        <section className="relative pt-36 pb-28 md:pt-44 md:pb-36 overflow-hidden">
          {/* Subtle dot grid background */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage: "radial-gradient(#33415520 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Fade overlay bottom */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent -z-10" />

          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Text column */}
              <div>
                {/* Eyebrow badge */}
                <div
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-8"
                  style={{ backgroundColor: "#FEF9EC", color: "#92701A", border: `1px solid #F3E0A0` }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: GOLD, boxShadow: `0 0 6px ${GOLD}` }}
                  />
                  Para negocios de servicios · México 🇲🇽
                </div>

                {/* Headline */}
                <h1 className="font-black leading-[1.02] tracking-tight mb-7" style={{ fontSize: "clamp(3rem, 6vw, 4.25rem)" }}>
                  Tu agenda
                  <br />
                  online.
                  <br />
                  <span style={{ color: GOLD }}>Sin llamadas.</span>
                </h1>

                {/* Subheadline */}
                <p className="text-lg text-slate-500 leading-relaxed max-w-[440px] mb-10">
                  AppointVa crea una página de reservas propia para tu negocio. Tus clientes agendan
                  cuando quieran — tú recibes notificaciones y gestionas todo desde un panel limpio.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mb-8">
                  <Link
                    to="/registro"
                    className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-bold text-white rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: SLATE_700, boxShadow: `0 4px 16px -2px ${SLATE_700}44` }}
                  >
                    Comenzar gratis
                    <Ico d={dArrow} className="w-4 h-4" />
                  </Link>
                  <a
                    href="#precios"
                    className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                  >
                    Ver precios
                  </a>
                </div>

                {/* Trust line */}
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Ico d={dShield} className="w-3.5 h-3.5 text-emerald-400" />
                  Sin tarjeta de crédito · Configuración en 5 minutos · Cancela cuando quieras
                </p>
              </div>

              {/* Phone column */}
              <div className="flex justify-center md:justify-end">
                <div className="av-float">
                  <PhoneMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
        <section className="border-y border-slate-100 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { val: "5 min",   label: "Configuración inicial" },
              { val: "24 / 7", label: "Reservas en línea" },
              { val: "0 %",    label: "Sin comisión por cita" },
              { val: "$199",   label: "Desde MXN/mes" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center md:text-left">
                <p className="text-3xl font-black text-slate-900 mb-1 tabular-nums">{val}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ──────────────────────────────────────────────────────── */}
        <section id="caracteristicas" className="py-28 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD }}>
                Características
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5 leading-tight">
                Todo lo que necesitas,
                <br />nada de lo que no.
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">
                Un sistema completo para gestionar tu negocio de servicios, sin complejidad innecesaria.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard delay={0}   icon={<Ico d={dCalendar} />} title="Booking público 24/7" desc="Tu página en /b/tu-negocio, siempre activa. Clientes reservan en cualquier momento sin llamadas ni mensajes." />
              <FeatureCard delay={80}  icon={<Ico d={dBell} />}     title="Notificaciones automáticas" desc="Confirmaciones y recordatorios por email y WhatsApp. Cero intervención manual, cero citas olvidadas." />
              <FeatureCard delay={160} icon={<Ico d={dUsers} />}    title="Equipo con horarios propios" desc="Cada empleado tiene su agenda independiente. Los clientes eligen servicio, profesional y horario en pasos." />
              <FeatureCard delay={0}   icon={<Ico d={dTag} />}      title="Descuentos y códigos" desc="Crea promociones para nuevos clientes o temporadas. Fideliza con un código y sin complejidad extra." />
              <FeatureCard delay={80}  icon={<Ico d={dStar} />}     title="Reseñas automáticas" desc="Solicita opiniones tras cada cita completada. Construye tu reputación en piloto automático." />
              <FeatureCard delay={160} icon={<Ico d={dChart} />}    title="Reportes en tiempo real" desc="Citas, ingresos y clientes de este mes. Visualiza el crecimiento y exporta a Excel con un clic." />
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section id="como-funciona" className="py-28 bg-slate-50 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-20">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD }}>
                Cómo funciona
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5">Listo en 3 pasos</h2>
              <p className="text-slate-500 text-base">Sin técnicos, sin contratos, sin complicaciones.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12 md:gap-8 relative">
              {/* Connector line — desktop only */}
              <div className="hidden md:block absolute top-7 left-[calc(16.67%+3.5rem)] right-[calc(16.67%+3.5rem)] h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <StepCard delay={0}   number="01" title="Crea tu cuenta" desc="Registra tu negocio, agrega servicios, empleados y horarios. Sin tarjeta de crédito, listo en 5 minutos." />
              <StepCard delay={120} number="02" title="Comparte tu link" desc="Publica appointva.com/b/tu-negocio en tu Instagram, WhatsApp o Bio. Tus clientes ya pueden reservar." />
              <StepCard delay={240} number="03" title="Gestiona tu agenda" desc="Recibe notificaciones de cada cita. Dashboard limpio con calendario, historial y reportes en tiempo real." />
            </div>
          </div>
        </section>

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <section id="precios" className="py-28 scroll-mt-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: GOLD }}>
                Precios
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-5">Sin sorpresas al final del mes</h2>
              <p className="text-slate-500 text-base max-w-md mx-auto">
                Un precio fijo, todo incluido. Sin comisiones por cita, sin módulos extras.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 items-start md:items-center">
              <PricingCard
                delay={0} name="Básico" price={199} employees={3} citas="200"
                features={[
                  "Portal de reservas público",
                  "3 empleados",
                  "200 citas por mes",
                  "Notificaciones por email",
                  "Dashboard y calendario",
                  "Gestión de clientes",
                ]}
              />
              <PricingCard
                delay={100} name="Pro" price={399} employees={10} citas="1,000" highlighted
                features={[
                  "Todo lo del plan Básico",
                  "10 empleados",
                  "1,000 citas por mes",
                  "Notificaciones por WhatsApp",
                  "Códigos de descuento",
                  "Lista de espera",
                  "Galería de fotos",
                  "Reseñas automáticas",
                ]}
              />
              <PricingCard
                delay={200} name="Premium" price={799} employees={50} citas="10,000"
                features={[
                  "Todo lo del plan Pro",
                  "50 empleados",
                  "10,000 citas por mes",
                  "Formularios de admisión",
                  "Reportes avanzados",
                  "Soporte prioritario",
                ]}
              />
            </div>

            <p className="text-center text-sm text-slate-400 mt-10">
              ¿Necesitas algo personalizado?{" "}
              <a
                href="mailto:hola@appointva.com"
                className="font-semibold text-slate-600 hover:text-slate-900 transition-colors underline underline-offset-2"
              >
                hola@appointva.com
              </a>
            </p>
          </div>
        </section>

        {/* ── DARK CTA ──────────────────────────────────────────────────────── */}
        <section style={{ backgroundColor: DARK }} className="py-28 relative overflow-hidden">
          {/* Subtle radial glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: GOLD }}
          />
          <div className="relative max-w-2xl mx-auto px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ color: GOLD }}>
              Empieza hoy
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
              ¿Listo para dejar de perder citas por llamadas?
            </h2>
            <p className="text-slate-400 mb-10 text-lg">
              Únete en 5 minutos. Sin tarjeta de crédito.
            </p>
            <Link
              to="/registro"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-black text-base transition-all hover:scale-105 hover:opacity-95 active:scale-95 shadow-2xl"
              style={{ backgroundColor: GOLD, color: DARK, boxShadow: `0 20px 60px -10px ${GOLD}55` }}
            >
              Crear mi agenda gratis
              <Ico d={dArrow} className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <footer style={{ backgroundColor: "#070E1A" }} className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span className="text-xl font-black">
                <span className="text-white">Appoint</span>
                <span style={{ color: GOLD }}>Va</span>
              </span>
              <span className="text-xs text-slate-600">Sistema de gestión de citas · México</span>
            </div>

            <nav className="flex items-center gap-6 text-sm text-slate-500">
              <Link to="/privacidad" className="hover:text-slate-300 transition-colors">Privacidad</Link>
              <Link to="/terminos" className="hover:text-slate-300 transition-colors">Términos</Link>
              <a href="mailto:hola@appointva.com" className="hover:text-slate-300 transition-colors">
                hola@appointva.com
              </a>
            </nav>

            <p className="text-xs text-slate-600">© 2026 AppointVa</p>
          </div>
        </footer>
      </div>
    </>
  );
}
