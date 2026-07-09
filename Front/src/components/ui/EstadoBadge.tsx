const COLORES: Record<string, string> = {
  Pendiente:    "bg-yellow-100 text-yellow-700",
  Confirmada:   "bg-green-100  text-green-700",
  Completada:   "bg-blue-100   text-blue-700",
  Cancelada:    "bg-red-100    text-red-600",
  Inasistencia: "bg-gray-100   text-gray-500",
};

const DOT: Record<string, string> = {
  Pendiente:    "bg-yellow-400",
  Confirmada:   "bg-green-500 animate-pulse",
  Completada:   "bg-blue-400",
  Cancelada:    "bg-red-400",
  Inasistencia: "bg-gray-400",
};

export default function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLORES[estado] ?? "bg-gray-100 text-gray-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[estado] ?? "bg-gray-400"}`} />
      {estado}
    </span>
  );
}
