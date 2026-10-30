import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import ModalAcciones from "../ui/ModalAcciones";
import { BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "../ui/botonesModal";
import { clientesApi } from "../../api/clientes";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { useToastStore } from "../../store/toastStore";
import { mensajeError } from "../../utils/errores";
import { validarEmailCliente } from "../../utils/validaciones";
import type { ClienteDto } from "../../types";

// ── Editar los datos de un cliente ───────────────────────────────────────────
//
// Vive en Clientes porque los datos son del cliente, no de una cita: antes se
// editaban desde la hoja de acciones de una cita. El servidor normaliza el
// teléfono a sólo dígitos y responde 409 si el teléfono o el correo ya son de
// otro cliente del negocio.

const TELEFONO_RE = /^\+?[\d\s\-().]+$/;

function validarTelefono(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (!TELEFONO_RE.test(t)) return "Solo dígitos, +, - o espacios";
  const digitos = t.replace(/\D/g, "").length;
  if (digitos < 7 || digitos > 15) return "Entre 7 y 15 dígitos";
  return "";
}

const CAMPO =
  "w-full min-h-[44px] lg:min-h-[40px] px-3 py-2 rounded-lg border text-sm outline-none bg-background text-foreground " +
  "focus:border-accent-brand focus-visible:ring-2 focus-visible:ring-ring";
const CAMPO_OK = `${CAMPO} border-input dark:border-slate-600`;
const CAMPO_ERROR = `${CAMPO} border-red-400 bg-red-50 dark:bg-red-900/20`;

interface Props {
  cliente: ClienteDto | null;
  onCerrar: () => void;
  onGuardado?: (actualizado: ClienteDto) => void;
}

export default function EditarClienteModal({ cliente, onCerrar, onGuardado }: Props) {
  const terms = useSectorTerms();
  return (
    <Modal abierto={!!cliente} onCerrar={onCerrar} titulo={`Editar ${terms.cliente.toLowerCase()}`} ancho="sm">
      {cliente && <Formulario key={cliente.id} cliente={cliente} onCerrar={onCerrar} onGuardado={onGuardado} />}
    </Modal>
  );
}

function Formulario({ cliente, onCerrar, onGuardado }: Props & { cliente: ClienteDto }) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  const cliente1 = terms.cliente.toLowerCase();
  const [nombre, setNombre] = useState(cliente.nombreCompleto);
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [errorTelefono, setErrorTelefono] = useState("");
  const [errorEmail, setErrorEmail] = useState("");

  const guardar = useMutation({
    mutationFn: (dto: { nombreCompleto: string; telefono: string; email: string }) =>
      clientesApi.actualizar(cliente.id, dto),
    onSuccess: (actualizado) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["clientes-actividad"] });
      qc.invalidateQueries({ queryKey: ["cliente-directo"] });
      // Las citas muestran nombre y teléfono del cliente.
      qc.invalidateQueries({ queryKey: ["citas"] });
      toast(`Datos del ${cliente1} actualizados`);
      onGuardado?.(actualizado);
      onCerrar();
    },
    onError: (err: unknown) => {
      const duplicado = isAxiosError(err) && err.response?.status === 409;
      toast(mensajeError(err, duplicado
        ? `Ese teléfono o correo ya está registrado con otro ${cliente1}`
        : `No se pudo actualizar el ${cliente1}`), "error");
    },
  });

  const sinCambios =
    nombre.trim() === cliente.nombreCompleto &&
    telefono.trim() === (cliente.telefono ?? "") &&
    email.trim() === (cliente.email ?? "");

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const errTel = validarTelefono(telefono);
    const errMail = validarEmailCliente(email);
    setErrorTelefono(errTel);
    setErrorEmail(errMail);
    if (errTel || errMail || !nombre.trim()) return;
    guardar.mutate({ nombreCompleto: nombre.trim(), telefono: telefono.trim(), email: email.trim() });
  };

  return (
    <form className="space-y-4" onSubmit={enviar} noValidate>
      <div>
        <label htmlFor="cliente-nombre" className="block text-sm font-medium text-foreground mb-1">
          Nombre <span className="text-red-700 dark:text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="cliente-nombre"
          type="text"
          required
          maxLength={100}
          autoComplete="off"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre completo"
          className={CAMPO_OK}
        />
      </div>
      <div>
        <label htmlFor="cliente-telefono" className="block text-sm font-medium text-foreground mb-1">
          Teléfono <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <input
          id="cliente-telefono"
          type="tel"
          inputMode="tel"
          maxLength={20}
          autoComplete="off"
          aria-invalid={!!errorTelefono || undefined}
          aria-describedby={errorTelefono ? "cliente-telefono-error" : undefined}
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value);
            if (errorTelefono) setErrorTelefono(validarTelefono(e.target.value));
          }}
          onBlur={() => setErrorTelefono(validarTelefono(telefono))}
          placeholder="Ej: 55 1234 5678"
          className={errorTelefono ? CAMPO_ERROR : CAMPO_OK}
        />
        {errorTelefono && (
          <p id="cliente-telefono-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertTriangle size={12} aria-hidden="true" /> {errorTelefono}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="cliente-email" className="block text-sm font-medium text-foreground mb-1">
          Correo <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <input
          id="cliente-email"
          type="email"
          maxLength={256}
          autoComplete="off"
          aria-invalid={!!errorEmail || undefined}
          aria-describedby={errorEmail ? "cliente-email-error" : undefined}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorEmail) setErrorEmail(validarEmailCliente(e.target.value));
          }}
          onBlur={() => setErrorEmail(validarEmailCliente(email))}
          placeholder="correo@ejemplo.com"
          className={errorEmail ? CAMPO_ERROR : CAMPO_OK}
        />
        {errorEmail && (
          <p id="cliente-email-error" className="text-red-700 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
            <AlertTriangle size={12} aria-hidden="true" /> {errorEmail}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {`Los cambios se ven en todas las ${terms.citas.toLowerCase()} de este ${cliente1}.`}
      </p>
      <ModalAcciones>
        <button type="button" onClick={onCerrar} className={BOTON_MODAL_SECUNDARIO}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!nombre.trim() || sinCambios || guardar.isPending}
          className={BOTON_MODAL_PRIMARIO}
        >
          {guardar.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </ModalAcciones>
    </form>
  );
}
