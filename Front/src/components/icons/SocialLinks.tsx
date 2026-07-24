import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";

interface Props {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  /** "header": iconos pequeños sobre fondo oscuro translúcido (booking header)
   *  "card": iconos medianos con colores de marca (tarjeta de confirmación) */
  variant?: "header" | "card";
}

export default function SocialLinks({ instagramUrl, facebookUrl, tiktokUrl, variant = "card" }: Props) {
  if (!instagramUrl && !facebookUrl && !tiktokUrl) return null;

  const isHeader = variant === "header";
  const btnCls = isHeader ? "w-6 h-6 rounded-lg" : "w-8 h-8 rounded-lg";
  const iconCls = isHeader ? "w-3.5 h-3.5 text-white" : "w-4 h-4 text-white";
  const neutralBg = "rgba(255,255,255,0.10)";

  return (
    <div className={`flex ${isHeader ? "gap-1.5" : "gap-2"}`}>
      {instagramUrl && (
        <a href={instagramUrl} target="_blank" rel="noreferrer"
          className={`${btnCls} flex items-center justify-center transition hover:opacity-80`}
          style={{ background: isHeader ? neutralBg : "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)" }}>
          <SiInstagram className={iconCls} />
        </a>
      )}
      {facebookUrl && (
        <a href={facebookUrl} target="_blank" rel="noreferrer"
          className={`${btnCls} flex items-center justify-center transition hover:opacity-80`}
          style={{ background: isHeader ? neutralBg : "#1877F2" }}>
          <SiFacebook className={iconCls} />
        </a>
      )}
      {tiktokUrl && (
        <a href={tiktokUrl} target="_blank" rel="noreferrer"
          className={`${btnCls} flex items-center justify-center transition hover:opacity-80`}
          style={{ background: isHeader ? neutralBg : "#000" }}>
          <SiTiktok className={iconCls} />
        </a>
      )}
    </div>
  );
}
