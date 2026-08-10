import { Clock, CheckCircle2, CheckCheck, XCircle, UserX } from "lucide-react";
import type { ComponentType } from "react";

const CONFIG: Record<string, {
  bg: string; text: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  pulse?: boolean;
}> = {
  Pendiente:    { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", Icon: Clock },
  Confirmada:   { bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400",  Icon: CheckCircle2, pulse: true },
  Completada:   { bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400",    Icon: CheckCheck },
  Cancelada:    { bg: "bg-red-100 dark:bg-red-900/30",      text: "text-red-600 dark:text-red-400",      Icon: XCircle },
  Inasistencia: { bg: "bg-gray-100 dark:bg-slate-700",      text: "text-gray-500 dark:text-gray-400",    Icon: UserX },
};

export default function EstadoBadge({ estado }: { estado: string }) {
  const cfg = CONFIG[estado] ?? { bg: "bg-gray-100", text: "text-gray-500", Icon: Clock };
  const { bg, text, Icon, pulse } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <Icon size={11} className={`shrink-0 ${pulse ? "animate-pulse" : ""}`} />
      {estado}
    </span>
  );
}
