import { Link } from "react-router-dom";
import LogoMarca from "./LogoMarca";

export default function PublicFooter() {
  return (
    <footer className="mt-10 pb-8 flex flex-col items-center gap-2 print:hidden">
      <LogoMarca variante="pequeno" className="h-6 opacity-25" />
      <p className="text-[11px] text-slate-400">
        © {new Date().getFullYear()} AppointVa · Todos los derechos reservados
      </p>
      <div className="flex items-center gap-3">
        <Link
          to="/privacidad"
          className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline transition"
        >
          Política de privacidad
        </Link>
        <span className="text-slate-300 text-[11px]">·</span>
        <Link
          to="/terminos"
          className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline transition"
        >
          Términos de uso
        </Link>
      </div>
    </footer>
  );
}
