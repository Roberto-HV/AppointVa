import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ico } from "./Ico";
import { dClose, dMenu } from "./iconos";
import { GOLD, SLATE_700 } from "./constantes";

interface Props {
  /** Anclas de la propia página (p. ej. `#precios`). */
  secciones: { href: string; etiqueta: string }[];
  /** Enlace a la otra landing (`/` y `/salud` se enlazan entre sí). */
  otraLanding: { to: string; etiqueta: string };
  /** Destino de "Crear mi cuenta". */
  registro: string;
}

export function Navbar({ secciones, otraLanding, registro }: Props) {
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
        scrolled || open ? "bg-white/95 backdrop-blur-lg shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-[68px] flex items-center justify-between">
        <Link to="/" className="text-xl font-black tracking-tight select-none">
          <span className="text-slate-900">Appoint</span>
          <span style={{ color: GOLD }}>Va</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          {secciones.map((s) => (
            <a key={s.href} href={s.href} className="hover:text-slate-900 transition-colors">{s.etiqueta}</a>
          ))}
          <span className="text-slate-200">·</span>
          <Link to={otraLanding.to} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
            {otraLanding.etiqueta}
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors rounded-lg">
            Iniciar sesión
          </Link>
          <Link
            to={registro}
            className="px-5 py-2 text-sm font-bold text-white rounded-xl transition-colors"
            style={{ backgroundColor: SLATE_700 }}
          >
            Crear mi cuenta
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="menu-movil-landing"
        >
          <Ico d={open ? dClose : dMenu} />
        </button>
      </div>

      {open && (
        <div id="menu-movil-landing" className="md:hidden bg-white border-t border-slate-100 px-6 py-4 flex flex-col gap-3 shadow-lg">
          {secciones.map((s) => (
            <a key={s.href} href={s.href} className="py-2 text-sm font-medium text-slate-700" onClick={() => setOpen(false)}>{s.etiqueta}</a>
          ))}
          <Link to={otraLanding.to} className="py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors" onClick={() => setOpen(false)}>{otraLanding.etiqueta}</Link>
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <Link to="/login" className="py-2.5 text-sm font-medium text-center text-slate-600 border border-slate-200 rounded-xl">Iniciar sesión</Link>
            <Link to={registro} className="py-2.5 text-sm font-bold text-center text-white rounded-xl" style={{ backgroundColor: SLATE_700 }}>Crear mi cuenta</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
