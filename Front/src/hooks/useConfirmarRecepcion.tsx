import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DialogoConfirmarRecepcion from "../components/dashboard/ConfirmarRecepcion";
import { RUTA_RECEPCION, type EstadoRecepcion } from "../lib/recepcion";

/**
 * Entrada al modo recepción (I6): `abrir()` muestra la confirmación y, al
 * aceptarla, navega a la pantalla de recepción ya confirmada. `dialogo` se
 * pinta una vez en la pantalla que usa el hook.
 */
export function useConfirmarRecepcion() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const dialogo = (
    <DialogoConfirmarRecepcion
      abierto={abierto}
      onCerrar={() => setAbierto(false)}
      onConfirmar={() => {
        setAbierto(false);
        const estado: EstadoRecepcion = { recepcionConfirmada: true };
        navigate(RUTA_RECEPCION, { state: estado });
      }}
    />
  );
  return { abrir: () => setAbierto(true), dialogo };
}
