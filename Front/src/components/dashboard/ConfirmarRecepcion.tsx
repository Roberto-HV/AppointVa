import ConfirmarAccion from "../ui/ConfirmarAccion";

interface Props {
  abierto: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}

/**
 * Confirmación antes de entrar al modo recepción (I6): dice qué pasa con la
 * sesión y qué hará falta para volver. Ver `lib/recepcion.ts`.
 */
export default function DialogoConfirmarRecepcion({ abierto, onConfirmar, onCerrar }: Props) {
  return (
    <ConfirmarAccion
      abierto={abierto}
      titulo="¿Activar el modo recepción?"
      mensaje={
        <div className="space-y-2">
          <p>
            Esta pantalla quedará como recepción: mostrará solo la agenda de hoy y tu sesión
            del panel se cerrará en este navegador.
          </p>
          <p>
            Para volver al panel tendrás que escribir la contraseña de tu cuenta (y el código de
            verificación, si tienes activada la verificación en dos pasos).
          </p>
        </div>
      }
      etiquetaConfirmar="Activar recepción"
      onConfirmar={onConfirmar}
      onCerrar={onCerrar}
    />
  );
}
