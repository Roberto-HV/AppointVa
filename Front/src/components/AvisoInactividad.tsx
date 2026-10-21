import Modal from "./ui/Modal";

interface Props {
  abierto: boolean;
  onSeguir: () => void;
  onCerrarSesion: () => void;
}

/**
 * Aviso de `useInactividadTimeout` antes del cierre automático de sesión.
 * Lo usan DashboardLayout y AdminLayout; cerrar el aviso cuenta como seguir.
 */
export default function AvisoInactividad({ abierto, onSeguir, onCerrarSesion }: Props) {
  return (
    <Modal abierto={abierto} onCerrar={onSeguir} titulo="¿Sigues ahí?" ancho="sm">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Por seguridad, tu sesión se cerrará en 1 minuto por inactividad. Lo que no hayas guardado se perderá.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={onCerrarSesion}
            className="min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={onSeguir}
            className="min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Seguir conectado
          </button>
        </div>
      </div>
    </Modal>
  );
}
