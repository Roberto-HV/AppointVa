import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle } from "lucide-react";
import { adminApi, type PlanDto } from "../../../api/admin";
import Modal from "../../../components/ui/Modal";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import Select from "../../../components/ui/Select";
import { useDisponibilidadSlug } from "../../../hooks/useDisponibilidadSlug";
import { useToastStore } from "../../../store/toastStore";
import { formatPrecio } from "../../../utils/formatters";
import { mensajeError } from "../../../utils/errores";
import { BOTON_PIE_PRIMARIO, CAMPO_ERROR, CAMPO_MODAL, CAMPO_OK } from "./estilos";

const schemaNegocio = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  slug: z
    .string()
    .min(2, "Slug requerido")
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  descripcion: z.string().optional(),
  planId: z.string().optional(),
});
type NegocioForm = z.infer<typeof schemaNegocio>;

export default function ModalNuevoNegocio({
  abierto,
  onCerrar,
  planes,
}: {
  abierto: boolean;
  onCerrar: () => void;
  planes: PlanDto[];
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Nuevo negocio">
      {/* El contenido se monta al abrir: el formulario empieza vacío cada vez. */}
      <FormNuevoNegocio planes={planes} onCreado={onCerrar} />
    </Modal>
  );
}

function FormNuevoNegocio({ planes, onCreado }: { planes: PlanDto[]; onCreado: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const formNegocio = useForm<NegocioForm>({ resolver: zodResolver(schemaNegocio) });
  // Misma comprobación en vivo que el registro público (AP-23).
  const slugNuevo = useDisponibilidadSlug(formNegocio.watch("slug"));

  const { mutate: crearNegocio, isPending: creandoNegocio } = useMutation({
    mutationFn: (d: NegocioForm) =>
      adminApi.crearNegocio({
        ...d,
        email: d.email || undefined,
        planId: d.planId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
      onCreado();
      formNegocio.reset();
      toast("Negocio creado correctamente");
    },
    // El servidor explica el motivo (p. ej. un identificador ya en uso).
    onError: (err: unknown) => toast(mensajeError(err, "Error al crear el negocio. Intenta de nuevo."), "error"),
  });

  return (
    <form onSubmit={formNegocio.handleSubmit((d) => crearNegocio(d))} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
        <input
          {...formNegocio.register("nombre")}
          placeholder="Barbería Luis"
          className={`${CAMPO_MODAL} ${formNegocio.formState.errors.nombre ? CAMPO_ERROR : CAMPO_OK}`}
        />
        {formNegocio.formState.errors.nombre && (
          <p className="text-red-500 text-xs mt-1">{formNegocio.formState.errors.nombre.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Slug *{" "}
          <span className="font-normal text-slate-400">
            (aparece en la URL: /b/<strong>slug</strong>)
          </span>
        </label>
        <input
          {...formNegocio.register("slug")}
          placeholder="barberia-luis"
          className={`${CAMPO_MODAL} font-mono ${formNegocio.formState.errors.slug ? CAMPO_ERROR : CAMPO_OK}`}
        />
        {formNegocio.formState.errors.slug ? (
          <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formNegocio.formState.errors.slug.message}</p>
        ) : (
          <p className="text-xs mt-1 min-h-[1rem]" aria-live="polite">
            {slugNuevo === "checking" && <span className="text-muted-foreground">Verificando…</span>}
            {slugNuevo === "available" && (
              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                <CheckCircle size={12} aria-hidden="true" /> Disponible
              </span>
            )}
            {slugNuevo === "taken" && (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle size={12} aria-hidden="true" /> Ya está en uso — elige otro
              </span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
          <input
            {...formNegocio.register("telefono")}
            className={`${CAMPO_MODAL} ${CAMPO_OK}`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo</label>
          <input
            type="email"
            {...formNegocio.register("email")}
            className={`${CAMPO_MODAL} ${CAMPO_OK}`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plan</label>
        <Select {...formNegocio.register("planId")} className="w-full">
          <option value="">Sin plan asignado</option>
          {planes.map((p: PlanDto) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {formatPrecio(p.precioMensual)}/mes · {p.maxEmpleados} empleados
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
        <textarea
          rows={2}
          {...formNegocio.register("descripcion")}
          className={`${CAMPO_MODAL} ${CAMPO_OK} resize-none`}
        />
      </div>

      {/* En la hoja del teléfono el pie queda fijo abajo (I13). */}
      <ModalAcciones apilado>
        <button
          type="submit"
          disabled={creandoNegocio || slugNuevo === "taken" || slugNuevo === "checking"}
          className={BOTON_PIE_PRIMARIO}
        >
          {creandoNegocio ? "Creando..." : "Crear negocio"}
        </button>
      </ModalAcciones>
    </form>
  );
}
