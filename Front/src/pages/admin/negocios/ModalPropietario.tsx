import { useState, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, MailCheck, MailWarning } from "lucide-react";
import { adminApi, type NegocioMetricasDto } from "../../../api/admin";
import Modal from "../../../components/ui/Modal";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import { esCancelacion } from "../../../lib/pruebaReautenticacion";
import { mensajeError } from "../../../utils/errores";
import { useReautenticacion } from "./useReautenticacion";
import { BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO, CAMPO_ERROR, CAMPO_MODAL, CAMPO_OK } from "./estilos";

const schemaPropietario = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido"),
  apellido: z.string().default(""),
  email: z.string().trim().email("Correo inválido"),
});
type PropietarioForm = z.infer<typeof schemaPropietario>;

/**
 * Propietario del negocio (lote 5, I4). El admin ya no escribe contraseñas de
 * nadie: si el propietario existe, se le manda el enlace para elegir una nueva
 * (pide reautenticación); si no, se crea su cuenta y se le invita por correo.
 * El contenido se monta al abrir, así que cada apertura empieza en blanco.
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
      {negocio && (negocio.propietarioEmail
        ? <EnlaceContrasena negocio={negocio} onTerminar={onCerrar} />
        : <InvitarPropietario negocio={negocio} onTerminar={onCerrar} />)}
    </Modal>
  );
}

/** Confirmación final: qué se envió y a quién. */
function Enviado({ titulo, children, aviso = false, onTerminar }: {
  titulo: string;
  children: ReactNode;
  aviso?: boolean;
  onTerminar: () => void;
}) {
  const Icono = aviso ? MailWarning : MailCheck;
  return (
    <div className="space-y-4">
      <div role="status" className="text-center">
        <span className={`mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center ${
          aviso ? "bg-amber-50 dark:bg-amber-900/30" : "bg-emerald-50 dark:bg-emerald-900/30"
        }`}>
          <Icono size={22} aria-hidden="true" className={aviso ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"} />
        </span>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{children}</div>
      </div>
      <ModalAcciones apilado>
        <button type="button" onClick={onTerminar} className={BOTON_PIE_PRIMARIO}>Listo</button>
      </ModalAcciones>
    </div>
  );
}

function ErrorEnLinea({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">
      {mensaje}
    </p>
  );
}

function EnlaceContrasena({ negocio, onTerminar }: { negocio: NegocioMetricasDto; onTerminar: () => void }) {
  const email = negocio.propietarioEmail!;
  const reautenticacion = useReautenticacion(`enviar un enlace de contraseña a ${email}`);
  const [error, setError] = useState("");

  const enviar = useMutation({
    mutationFn: () => reautenticacion.conReautenticacion((prueba) => adminApi.enviarEnlaceContrasena(negocio.id, prueba)),
    onMutate: () => setError(""),
    onError: (err) => {
      if (esCancelacion(err)) return;
      setError(mensajeError(err, "No se pudo enviar el enlace. Intenta de nuevo."));
    },
  });

  if (reautenticacion.formulario) return reautenticacion.formulario;

  if (enviar.isSuccess) {
    return (
      <Enviado titulo="Enlace enviado" onTerminar={onTerminar}>
        <p>
          Le llegará a <span className="font-medium text-foreground break-all">{enviar.data.email}</span>. Vence en 24 horas.
        </p>
        {!enviar.data.esInvitacion && <p className="mt-1">Su contraseña actual sigue funcionando hasta que elija la nueva.</p>}
      </Enviado>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
        <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          {negocio.propietarioNombre && (
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{negocio.propietarioNombre}</p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{email}</p>
        </div>
      </div>

      <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
        <p>
          ¿No puede entrar? Le enviaremos un enlace para que elija una contraseña nueva. Tú no la ves ni la escribes.
        </p>
        <p>Su contraseña actual sigue funcionando hasta que la cambie. El enlace vence en 24 horas.</p>
      </div>

      {error && <ErrorEnLinea mensaje={error} />}

      <ModalAcciones>
        <button type="button" onClick={onTerminar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
        <button type="button" onClick={() => enviar.mutate()} disabled={enviar.isPending} className={BOTON_PIE_PRIMARIO}>
          {enviar.isPending ? "Enviando…" : "Enviar enlace para restablecer"}
        </button>
      </ModalAcciones>
    </div>
  );
}

function InvitarPropietario({ negocio, onTerminar }: { negocio: NegocioMetricasDto; onTerminar: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const form = useForm<PropietarioForm>({
    resolver: zodResolver(schemaPropietario) as Resolver<PropietarioForm>,
    defaultValues: { nombre: "", apellido: "", email: "" },
  });

  const crear = useMutation({
    mutationFn: (d: PropietarioForm) =>
      adminApi.crearPropietario(negocio.id, { email: d.email, nombre: d.nombre, apellido: d.apellido ?? "" }),
    onMutate: () => setError(""),
    // La ficha y la tabla muestran al propietario: se recargan con él.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] }),
    onError: (err: unknown) => setError(mensajeError(err, "No se pudo crear el propietario.")),
  });

  if (crear.isSuccess) {
    return crear.data.invitacionEnviada ? (
      <Enviado titulo="Invitación enviada" onTerminar={onTerminar}>
        <p>
          <span className="font-medium text-foreground break-all">{crear.data.email}</span> recibirá un enlace para crear su contraseña. Vence en 24 horas.
        </p>
      </Enviado>
    ) : (
      <Enviado titulo="Cuenta creada, sin invitación" aviso onTerminar={onTerminar}>
        <p>{crear.data.mensaje}</p>
      </Enviado>
    );
  }

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Crea la cuenta del propietario de{" "}
        <strong className="text-slate-800 dark:text-slate-200">{negocio.nombre}</strong>. Le enviaremos un enlace para que elija su contraseña.
      </p>
      <form onSubmit={form.handleSubmit((d) => crear.mutate(d))} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prop-nombre" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
            <input
              id="prop-nombre"
              {...form.register("nombre")}
              className={`${CAMPO_MODAL} ${form.formState.errors.nombre ? CAMPO_ERROR : CAMPO_OK}`}
            />
            {form.formState.errors.nombre && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{form.formState.errors.nombre.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="prop-apellido" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Apellido</label>
            <input id="prop-apellido" {...form.register("apellido")} className={`${CAMPO_MODAL} ${CAMPO_OK}`} />
          </div>
        </div>
        <div>
          <label htmlFor="prop-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Correo de acceso *</label>
          <input
            id="prop-email"
            type="email"
            {...form.register("email")}
            className={`${CAMPO_MODAL} ${form.formState.errors.email ? CAMPO_ERROR : CAMPO_OK}`}
          />
          {form.formState.errors.email && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>
        {error && <ErrorEnLinea mensaje={error} />}
        <ModalAcciones apilado>
          <button type="submit" disabled={crear.isPending} className={BOTON_PIE_PRIMARIO}>
            {crear.isPending ? "Enviando invitación…" : "Crear e invitar"}
          </button>
        </ModalAcciones>
      </form>
    </>
  );
}
