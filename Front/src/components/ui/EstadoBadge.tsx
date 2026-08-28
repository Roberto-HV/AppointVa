import { Clock, CheckCircle2, CheckCheck, XCircle, UserX } from "lucide-react";
import type { ComponentType } from "react";

const CONFIG: Record<string, {
  border: string; text: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  pulse?: boolean;
}> = {
  Pendiente:    { border: "border-amber-500/50 dark:border-amber-400/40", text: "text-amber-600 dark:text-amber-300",  Icon: Clock },
  Confirmada:   { border: "border-green-600/50 dark:border-green-400/40", text: "text-green-700 dark:text-green-400",  Icon: CheckCircle2, pulse: true },
  Completada:   { border: "border-blue-600/50 dark:border-blue-400/40",   text: "text-blue-700 dark:text-blue-400",    Icon: CheckCheck },
  Cancelada:    { border: "border-red-600/50 dark:border-red-400/40",     text: "text-red-600 dark:text-red-400",      Icon: XCircle },
  Inasistencia: { border: "border-gray-400/40 dark:border-slate-400/30",  text: "text-gray-500 dark:text-slate-400",   Icon: UserX },
};

export default function EstadoBadge({ estado }: { estado: string }) {
  const cfg = CONFIG[estado] ?? { border: "border-gray-400/40", text: "text-gray-500", Icon: Clock };
  const { border, text, Icon, pulse } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-[1.5px] bg-transparent ${border} ${text}`}>
      <Icon size={11} className={`shrink-0 ${pulse ? "animate-pulse" : ""}`} />
      {estado}
    </span>
  );
}
