import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible } from "../../types";
import { SIN_PREFERENCIA_ID } from "./PasoEmpleado";

const schema = z.object({
  nombreCliente: z.string().min(2, "Ingresa tu nombre completo"),
  telefonoCliente: z.string().min(10, "Ingresa un teléfono válido de 10 dígitos").max(15),
  emailCliente: z.string().email("Correo inválido").optional().or(z.literal("")),
  notas: z.string().max(300).optional(),
});

export type DatosClienteForm = z.infer<typeof schema>;

interface Props {
  servicio: ServicioPublico;
  empleado: EmpleadoPublico;
  slot: SlotDisponible;
  enviando: boolean;
  onEnviar: (datos: DatosClienteForm) => void;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).replace(/\bDe\b/g, "de");
}

function formatPrecio(precio: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(precio);
}

export default function PasoDatosCliente({ servicio, empleado, slot, enviando, onEnviar }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<DatosClienteForm>({
    resolver: zodResolver(schema),
  });

  const nombreEmpleado = empleado.id === SIN_PREFERENCIA_ID
    ? (slot.empleadoNombre ?? "Cualquier disponible")
    : empleado.nombre;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Tus datos</h2>

      {/* Resumen de la cita */}
      <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Servicio</span>
          <span className="font-medium text-gray-800">{servicio.nombre}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Con</span>
          <span className="font-medium text-gray-800">{nombreEmpleado}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha</span>
          <span className="font-medium text-gray-800 capitalize">{formatFecha(slot.inicio)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Hora</span>
          <span className="font-medium text-gray-800">{slot.horaTexto}</span>
        </div>
        <div className="border-t border-gray-200 pt-1.5 flex justify-between">
          <span className="text-gray-500">Total</span>
          <span className="font-bold text-primary">{formatPrecio(servicio.precio)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onEnviar)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
          <input
            {...register("nombreCliente")}
            placeholder="Tu nombre completo"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition
              ${errors.nombreCliente ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {errors.nombreCliente && <p className="text-red-500 text-xs mt-1">{errors.nombreCliente.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
          <input
            {...register("telefonoCliente")}
            type="tel"
            placeholder="55 1234 5678"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition
              ${errors.telefonoCliente ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {errors.telefonoCliente && <p className="text-red-500 text-xs mt-1">{errors.telefonoCliente.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            {...register("emailCliente")}
            type="email"
            placeholder="correo@ejemplo.com"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
          />
          {errors.emailCliente && <p className="text-red-500 text-xs mt-1">{errors.emailCliente.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            {...register("notas")}
            rows={2}
            placeholder="Alguna indicación especial..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
        >
          {enviando ? "Confirmando..." : "Confirmar cita"}
        </button>
      </form>
    </div>
  );
}
