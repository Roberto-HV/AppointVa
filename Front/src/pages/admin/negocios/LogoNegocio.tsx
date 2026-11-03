import type { NegocioMetricasDto } from "../../../api/admin";

/** Logo del negocio o sus iniciales, en la tarjeta, la tabla y la ficha. */
export default function LogoNegocio({
  negocio,
  tamano = "md",
}: {
  negocio: Pick<NegocioMetricasDto, "nombre" | "logoUrl">;
  tamano?: "sm" | "md" | "lg";
}) {
  const iniciales = negocio.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const caja = tamano === "sm" ? "w-8 h-8 rounded-lg" : tamano === "lg" ? "w-14 h-14 rounded-xl" : "w-10 h-10 rounded-xl";
  return (
    <span className={`${caja} bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0`}>
      {negocio.logoUrl ? (
        // Decorativa: el nombre del negocio siempre va al lado.
        <img src={negocio.logoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden="true" className={`${tamano === "sm" ? "text-xs" : "text-sm"} font-bold text-slate-600 dark:text-slate-300`}>{iniciales}</span>
      )}
    </span>
  );
}
