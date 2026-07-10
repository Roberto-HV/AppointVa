import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible } from "../../types";
import { SIN_PREFERENCIA_ID } from "./PasoEmpleado";
import { formatPrecio, formatFechaLarga as formatFecha } from "../../utils/formatters";
import { CalendarDays, User, Clock, Tag } from "lucide-react";

const schema = z.object({
  nombreCliente: z.string().min(2, "Ingresa tu nombre completo"),
  telefonoCliente: z.string().min(10, "Ingresa un teléfono válido de 10 dígitos").max(15).regex(/^\+?[\d\s\-().]+$/, "Solo dígitos, +, - o espacios"),
  emailCliente: z.string().email("Correo inválido").optional().or(z.literal("")),
  notas: z.string().max(300).optional(),
});

export type DatosClienteForm = z.infer<typeof schema>;

interface Props {
  servicio: ServicioPublico;
  empleado: EmpleadoPublico;
  slot: SlotDisponible;
  enviando: boolean;
  datosIniciales?: Partial<DatosClienteForm>;
  onEnviar: (datos: DatosClienteForm) => void;
  color?: string;
}

export default function PasoDatosCliente({ servicio, empleado, slot, enviando, datosIniciales, onEnviar, color = "#334155" }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<DatosClienteForm>({
    resolver: zodResolver(schema),
    defaultValues: datosIniciales,
    mode: "onBlur",
  });

  const nombreEmpleado = empleado.id === SIN_PREFERENCIA_ID
    ? (slot.empleadoNombre ?? "Cualquier disponible")
    : empleado.nombre;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Tus datos</h2>
      <p className="text-sm text-slate-500 mb-5">Casi listo — solo necesitamos saber quién eres</p>

      {/* Resumen visual de la cita */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Resumen de tu cita</p>
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Tag size={13} className="text-white/70" />
            </div>
            <div>
              <p className="text-sm font-semibold">{servicio.nombre}</p>
              <p className="text-xs text-slate-400">{servicio.duracionMinutos} min</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <User size={13} className="text-white/70" />
            </div>
            <p className="text-sm font-medium text-slate-200">{nombreEmpleado}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <CalendarDays size={13} className="text-white/70" />
            </div>
            <p className="text-sm font-medium text-slate-200">{formatFecha(slot.inicio)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Clock size={13} className="text-white/70" />
            </div>
            <p className="text-sm font-medium text-slate-200">{slot.horaTexto}</p>
          </div>
          <div className="border-t border-white/10 pt-2.5 flex justify-between items-center">
            <span className="text-sm text-slate-400">Total a pagar</span>
            <span className="text-lg font-bold text-white">{formatPrecio(servicio.precio)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onEnviar)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Nombre completo *
          </label>
          <input
            {...register("nombreCliente")}
            placeholder="Tu nombre completo"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition bg-white
              focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700
              ${errors.nombreCliente ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.nombreCliente && (
            <p className="text-red-500 text-xs mt-1.5">{errors.nombreCliente.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Teléfono *
          </label>
          <input
            {...register("telefonoCliente")}
            type="tel"
            placeholder="55 1234 5678"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition bg-white
              focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700
              ${errors.telefonoCliente ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.telefonoCliente && (
            <p className="text-red-500 text-xs mt-1.5">{errors.telefonoCliente.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Correo electrónico <span className="text-slate-400 font-normal normal-case">(opcional)</span>
          </label>
          <input
            {...register("emailCliente")}
            type="email"
            placeholder="correo@ejemplo.com"
            className={`w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition bg-white
              ${errors.emailCliente ? "border-red-300 bg-red-50" : "border-slate-200"}`}
          />
          {errors.emailCliente && (
            <p className="text-red-500 text-xs mt-1.5">{errors.emailCliente.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
            Notas <span className="text-slate-400 font-normal normal-case">(opcional)</span>
          </label>
          <textarea
            {...register("notas")}
            rows={2}
            placeholder="Alguna indicación especial..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-slate-700/20 focus:border-slate-700 transition resize-none bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all text-sm tracking-wide hover:opacity-90"
          style={{ background: color }}
        >
          {enviando ? "Confirmando…" : "Confirmar cita"}
        </button>
      </form>
    </div>
  );
}
