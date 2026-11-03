import { useState } from "react";
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
import { slugDesdeNombre } from "../../../utils/negociosAdmin";
import { BOTON_PIE_PRIMARIO, CAMPO_ERROR, CAMPO_MODAL, CAMPO_OK } from "./estilos";

const schemaNegocio = z
  .object({
    nombre: z.string().min(2, "Nombre requerido"),
    slug: z
      .string()
      .min(2, "Slug requerido")
      .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
    telefono: z.string().optional(),
    email: z.string().email("Correo inválido").optional().or(z.literal("")),
    descripcion: z.string().optional(),
    planId: z.string().optional(),
    // Lote 5 (I8): el propietario en el mismo alta, invitado por correo.
    invitarPropietario: z.boolean(),
    propietarioNombre: z.string().optional(),
    propietarioApellido: z.string().optional(),
    propietarioEmail: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.invitarPropietario) return;
    if ((d.propietarioNombre ?? "").trim().length < 2)
      ctx.addIssue({ code: "custom", path: ["propietarioNombre"], message: "Nombre requerido" });
    if (!z.string().email().safeParse((d.propietarioEmail ?? "").trim()).success)
      ctx.addIssue({ code: "custom", path: ["propietarioEmail"], message: "Correo inválido" });
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

const ETIQUETA = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

function FormNuevoNegocio({ planes, onCreado }: { planes: PlanDto[]; onCreado: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const formNegocio = useForm<NegocioForm>({
    resolver: zodResolver(schemaNegocio),
    defaultValues: { invitarPropietario: true },
  });
  const errores = formNegocio.formState.errors;
  // Misma comprobación en vivo que el registro público (AP-23).
  const slugNuevo = useDisponibilidadSlug(formNegocio.watch("slug"));
  const invitar = formNegocio.watch("invitarPropietario");

  // I8: el slug se propone a partir del nombre hasta que el admin lo edita a mano.
  const [slugEditado, setSlugEditado] = useState(false);
  const registroNombre = formNegocio.register("nombre");
  const registroSlug = formNegocio.register("slug");

  const { mutate: crearNegocio, isPending: creandoNegocio } = useMutation({
    mutationFn: (d: NegocioForm) =>
      adminApi.crearNegocio({
        nombre: d.nombre,
        slug: d.slug,
        telefono: d.telefono || undefined,
        descripcion: d.descripcion || undefined,
        email: d.email || undefined,
        planId: d.planId || undefined,
        propietario: d.invitarPropietario
          ? {
              nombre: (d.propietarioNombre ?? "").trim(),
              apellido: (d.propietarioApellido ?? "").trim(),
              email: (d.propietarioEmail ?? "").trim(),
            }
          : undefined,
      }),
    onSuccess: (creado) => {
      qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
      onCreado();
      formNegocio.reset();
      if (creado.invitacionEnviada === false) {
        toast(
          `Negocio creado. No pudimos enviar la invitación a ${creado.propietarioEmail}: usa "Enviar enlace de contraseña" en su ficha.`,
          "error",
        );
      } else if (creado.invitacionEnviada) {
        toast(`Negocio creado. Enviamos la invitación a ${creado.propietarioEmail}.`);
      } else {
        toast("Negocio creado correctamente");
      }
    },
    // El servidor explica el motivo (p. ej. un identificador ya en uso o el correo apagado).
    onError: (err: unknown) => toast(mensajeError(err, "Error al crear el negocio. Intenta de nuevo."), "error"),
  });

  return (
    <form onSubmit={formNegocio.handleSubmit((d) => crearNegocio(d))} className="space-y-4" noValidate>
      <div>
        <label htmlFor="nuevo-nombre" className={ETIQUETA}>Nombre *</label>
        <input
          id="nuevo-nombre"
          {...registroNombre}
          onChange={(e) => {
            registroNombre.onChange(e);
            if (!slugEditado) formNegocio.setValue("slug", slugDesdeNombre(e.target.value), { shouldValidate: formNegocio.formState.isSubmitted });
          }}
          placeholder="Barbería Luis"
          className={`${CAMPO_MODAL} ${errores.nombre ? CAMPO_ERROR : CAMPO_OK}`}
        />
        {errores.nombre && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errores.nombre.message}</p>}
      </div>

      <div>
        <label htmlFor="nuevo-slug" className={ETIQUETA}>
          Slug *{" "}
          <span className="font-normal text-slate-400">
            (aparece en la URL: /b/<strong>slug</strong>)
          </span>
        </label>
        <input
          id="nuevo-slug"
          {...registroSlug}
          onChange={(e) => {
            setSlugEditado(true);
            registroSlug.onChange(e);
          }}
          placeholder="barberia-luis"
          className={`${CAMPO_MODAL} font-mono ${errores.slug ? CAMPO_ERROR : CAMPO_OK}`}
        />
        {errores.slug ? (
          <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errores.slug.message}</p>
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
          <label htmlFor="nuevo-telefono" className={ETIQUETA}>Teléfono</label>
          <input id="nuevo-telefono" {...formNegocio.register("telefono")} className={`${CAMPO_MODAL} ${CAMPO_OK}`} />
        </div>
        <div>
          <label htmlFor="nuevo-email" className={ETIQUETA}>Correo del negocio</label>
          <input id="nuevo-email" type="email" {...formNegocio.register("email")} className={`${CAMPO_MODAL} ${CAMPO_OK}`} />
        </div>
      </div>

      <div>
        <label htmlFor="nuevo-plan" className={ETIQUETA}>Plan</label>
        <Select id="nuevo-plan" {...formNegocio.register("planId")} className="w-full">
          <option value="">Sin plan asignado</option>
          {planes.map((p: PlanDto) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {formatPrecio(p.precioMensual)}/mes · {p.maxEmpleados} empleados
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="nuevo-descripcion" className={ETIQUETA}>Descripción</label>
        <textarea
          id="nuevo-descripcion"
          rows={2}
          {...formNegocio.register("descripcion")}
          className={`${CAMPO_MODAL} ${CAMPO_OK} resize-none`}
        />
      </div>

      {/* I8: antes había que buscar la tarjeta y abrir "Propietario" aparte. */}
      <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Propietario</legend>
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            {...formNegocio.register("invitarPropietario")}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-700"
          />
          <span>
            Invitar al propietario ahora
            <span className="block text-xs text-muted-foreground">
              Le enviaremos un enlace para crear su contraseña. Tú no la ves ni la defines.
            </span>
          </span>
        </label>
        {invitar && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="nuevo-prop-nombre" className={ETIQUETA}>Nombre *</label>
                <input
                  id="nuevo-prop-nombre"
                  {...formNegocio.register("propietarioNombre")}
                  className={`${CAMPO_MODAL} ${errores.propietarioNombre ? CAMPO_ERROR : CAMPO_OK}`}
                />
                {errores.propietarioNombre && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errores.propietarioNombre.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="nuevo-prop-apellido" className={ETIQUETA}>Apellido</label>
                <input id="nuevo-prop-apellido" {...formNegocio.register("propietarioApellido")} className={`${CAMPO_MODAL} ${CAMPO_OK}`} />
              </div>
            </div>
            <div>
              <label htmlFor="nuevo-prop-email" className={ETIQUETA}>Correo de acceso del propietario *</label>
              <input
                id="nuevo-prop-email"
                type="email"
                {...formNegocio.register("propietarioEmail")}
                className={`${CAMPO_MODAL} ${errores.propietarioEmail ? CAMPO_ERROR : CAMPO_OK}`}
              />
              {errores.propietarioEmail && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errores.propietarioEmail.message}</p>
              )}
            </div>
          </>
        )}
      </fieldset>

      {/* En la hoja del teléfono el pie queda fijo abajo (I13). */}
      <ModalAcciones apilado>
        <button
          type="submit"
          disabled={creandoNegocio || slugNuevo === "taken" || slugNuevo === "checking"}
          className={BOTON_PIE_PRIMARIO}
        >
          {creandoNegocio ? "Creando…" : invitar ? "Crear negocio e invitar" : "Crear negocio"}
        </button>
      </ModalAcciones>
    </form>
  );
}
