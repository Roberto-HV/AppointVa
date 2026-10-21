import ConfirmarAccion from "./ConfirmarAccion";

// Pregunta única para cualquier cambio sin guardar (modal o página). La usan
// `useConfirmarDescarte` y `useProtegerNavegacion` de `hooks/useCambiosSinGuardar`.

const TITULO = "¿Descartar cambios?";
const MENSAJE = "Tienes cambios sin guardar. Si sales ahora, se perderán.";

export default function DialogoDescartarCambios({ abierto, onDescartar, onVolver }: {
  abierto: boolean;
  onDescartar: () => void;
  onVolver: () => void;
}) {
  return (
    <ConfirmarAccion
      abierto={abierto}
      titulo={TITULO}
      mensaje={MENSAJE}
      etiquetaConfirmar="Descartar cambios"
      etiquetaVolver="Seguir editando"
      destructiva
      onConfirmar={onDescartar}
      onCerrar={onVolver}
    />
  );
}
