import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { adminApi, type NegocioMetricasDto } from "../../../api/admin";
import Modal from "../../../components/ui/Modal";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import { useToastStore } from "../../../store/toastStore";
import { mensajeError } from "../../../utils/errores";
import { BOTON_PIE_PRIMARIO, CAMPO_ERROR, CAMPO_MODAL, CAMPO_OK } from "./estilos";

const schemaPropietario = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  apellido: z.string().default(""),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type PropietarioForm = z.infer<typeof schemaPropietario>;

/**
 * Propietario del negocio: si ya existe, restablecer su contraseña; si no,
 * crear su cuenta. El contenido se monta al abrir, así que cada apertura empieza
 * con los campos y el error en blanco.
 */
export default function ModalPropietario({
  negocio,
  abierto,
  onCerrar,
}: {
  negocio: NegocioMetricasDto | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Propietario" ancho="sm">
      {negocio && <ContenidoPropietario negocio={negocio} onTerminar={onCerrar} />}
    </Modal>
  );
}

function ContenidoPropietario({ negocio, onTerminar }: { negocio: NegocioMetricasDto; onTerminar: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [errorPropietario, setErrorPropietario] = useState("");
  const [mostrarPasswordProp, setMostrarPasswordProp] = useState(false);
  const [nuevaPasswordProp, setNuevaPasswordProp] = useState("");
  const [confirmarPasswordProp, setConfirmarPasswordProp] = useState("");
  const [mostrarNuevaPassword, setMostrarNuevaPassword] = useState(false);
  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] = useState(false);
  const [resetandoPassword, setResetandoPassword] = useState(false);
  const formPropietario = useForm<PropietarioForm>({
    resolver: zodResolver(schemaPropietario) as Resolver<PropietarioForm>,
    defaultValues: { nombre: "", apellido: "", email: "", password: "" },
  });

  const { mutate: crearPropietario, isPending: creandoPropietario } = useMutation({
    mutationFn: (d: PropietarioForm) =>
      adminApi.crearPropietario(negocio.id, {
        email: d.email,
        password: d.password,
        nombre: d.nombre,
        apellido: d.apellido ?? "",
      }),
    onSuccess: (_, d) => {
      // La ficha y la tabla muestran al propietario: se recargan con él.
      qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
      onTerminar();
      formPropietario.reset();
      toast(`Propietario creado: ${d.email}`);
    },
    onError: (err: unknown) => {
      setErrorPropietario(mensajeError(err, "No se pudo crear el propietario."));
    },
  });

  const handleRestablecerPassword = async () => {
    if (nuevaPasswordProp.length < 6) return;
    if (nuevaPasswordProp !== confirmarPasswordProp) {
      setErrorPropietario("Las contraseñas no coinciden.");
      return;
    }
    setResetandoPassword(true);
    try {
      await adminApi.restablecerPasswordPropietario(negocio.id, nuevaPasswordProp);
      setNuevaPasswordProp("");
      setConfirmarPasswordProp("");
      onTerminar();
      toast("Contraseña restablecida correctamente");
    } catch (err) {
      setErrorPropietario(mensajeError(err, "No se pudo restablecer la contraseña."));
    } finally {
      setResetandoPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      {negocio.propietarioEmail ? (
        <>
          {/* Existing propietario card */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              {negocio.propietarioNombre && (
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 truncate">
                  {negocio.propietarioNombre}
                </p>
              )}
              <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                {negocio.propietarioEmail}
              </p>
            </div>
          </div>

          {/* Password reset section */}
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Establece una nueva contraseña para el acceso de{" "}
              <strong className="text-slate-700 dark:text-slate-200">{negocio.nombre}</strong>.
            </p>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nueva contraseña
            </label>
            <div className="relative mb-3">
              <input
                type={mostrarNuevaPassword ? "text" : "password"}
                value={nuevaPasswordProp}
                onChange={e => setNuevaPasswordProp(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={`${CAMPO_MODAL} ${CAMPO_OK} pr-10`}
              />
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setMostrarNuevaPassword(v => !v)}
                aria-label={mostrarNuevaPassword ? "Ocultar la nueva contraseña" : "Mostrar la nueva contraseña"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {mostrarNuevaPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirmar contraseña
            </label>
            <div className="relative mb-3">
              <input
                type={mostrarConfirmarPassword ? "text" : "password"}
                value={confirmarPasswordProp}
                onChange={e => setConfirmarPasswordProp(e.target.value)}
                placeholder="Repite la contraseña"
                className={`${CAMPO_MODAL} ${CAMPO_OK} pr-10`}
              />
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setMostrarConfirmarPassword(v => !v)}
                aria-label={mostrarConfirmarPassword ? "Ocultar la confirmación" : "Mostrar la confirmación"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {mostrarConfirmarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errorPropietario && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-3">
                {errorPropietario}
              </div>
            )}
            <ModalAcciones apilado>
              <button
                onClick={handleRestablecerPassword}
                disabled={resetandoPassword || nuevaPasswordProp.length < 6 || confirmarPasswordProp.length < 6}
                className={BOTON_PIE_PRIMARIO}
              >
                {resetandoPassword ? "Restableciendo…" : "Restablecer contraseña"}
              </button>
            </ModalAcciones>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Crea la cuenta de acceso para el propietario de{" "}
            <strong className="text-slate-700 dark:text-slate-200">{negocio.nombre}</strong>.
          </p>
          <form onSubmit={formPropietario.handleSubmit((d) => crearPropietario(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
                <input
                  {...formPropietario.register("nombre")}
                  className={`${CAMPO_MODAL} ${formPropietario.formState.errors.nombre ? CAMPO_ERROR : CAMPO_OK}`}
                />
                {formPropietario.formState.errors.nombre && (
                  <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.nombre.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Apellido</label>
                <input
                  {...formPropietario.register("apellido")}
                  className={`${CAMPO_MODAL} ${CAMPO_OK}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo de acceso *</label>
              <input
                type="email"
                {...formPropietario.register("email")}
                className={`${CAMPO_MODAL} ${formPropietario.formState.errors.email ? CAMPO_ERROR : CAMPO_OK}`}
              />
              {formPropietario.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña inicial *</label>
              <div className="relative">
                <input
                  type={mostrarPasswordProp ? "text" : "password"}
                  {...formPropietario.register("password")}
                  className={`${CAMPO_MODAL} pr-10 ${formPropietario.formState.errors.password ? CAMPO_ERROR : CAMPO_OK}`}
                />
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setMostrarPasswordProp(v => !v)}
                  aria-label={mostrarPasswordProp ? "Ocultar la contraseña" : "Mostrar la contraseña"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  {mostrarPasswordProp ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formPropietario.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.password.message}</p>
              )}
            </div>
            {errorPropietario && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg px-3 py-2">
                {errorPropietario}
              </div>
            )}
            <ModalAcciones apilado>
              <button
                type="submit"
                disabled={creandoPropietario}
                className={BOTON_PIE_PRIMARIO}
              >
                {creandoPropietario ? "Creando cuenta…" : "Crear propietario"}
              </button>
            </ModalAcciones>
          </form>
        </>
      )}
    </div>
  );
}
