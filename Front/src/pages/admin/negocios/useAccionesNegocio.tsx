import { useState } from "react";
import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { adminApi, type NegocioMetricasDto } from "../../../api/admin";
import ConfirmarAccion from "../../../components/ui/ConfirmarAccion";
import Modal from "../../../components/ui/Modal";
import { useToastStore } from "../../../store/toastStore";
import { useDatosNegocios } from "./useDatosNegocios";
import SuscripcionNegocio from "./SuscripcionNegocio";
import ModalPropietario from "./ModalPropietario";
import ModalColores from "./ModalColores";
import ModalEliminarNegocio from "./ModalEliminarNegocio";
import { CLAVE_ESTADO_NEGOCIO } from "./estilos";

type ModalAbierto = null | "suscripcion" | "propietario" | "colores" | "eliminar";

/**
 * Las acciones sobre un negocio y sus modales, en un solo lugar para la lista
 * (tarjetas y tabla), Facturación y la ficha. Antes vivían dentro de
 * `NegociosAdminPage`; al darle ficha a cada negocio (lote 4) se movieron aquí
 * tal cual: mismas llamadas auditadas, mismas confirmaciones, mismos avisos con
 * "Deshacer". Quien lo usa pinta `modales` una vez y llama a las acciones.
 */
export function useAccionesNegocio({ onEliminado }: { onEliminado?: (id: string) => void } = {}) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const { metricas, suscripcionMap, planes, errorPlanes, recargarPlanes } = useDatosNegocios();

  const [modal, setModal] = useState<ModalAbierto>(null);
  // Se conserva al cerrar, para que el modal no se vacíe durante la salida.
  const [negocioSel, setNegocioSel] = useState<NegocioMetricasDto | null>(null);
  const abrir = (tipo: Exclude<ModalAbierto, null>) => (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setModal(tipo);
  };
  const cerrarModal = () => setModal(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
    qc.invalidateQueries({ queryKey: ["admin-negocios"] });
  };

  // Cada negocio sabe si SU cambio de estado sigue en curso, aunque haya varios
  // a la vez: `variables` de useMutation solo guarda el último (AP-06, OM-30).
  const idsCambiandoEstado = new Set(
    useMutationState({
      filters: { mutationKey: CLAVE_ESTADO_NEGOCIO, status: "pending" },
      select: (m) => m.state.variables as string,
    })
  );

  const { mutate: mutarActivar } = useMutation({
    mutationKey: CLAVE_ESTADO_NEGOCIO,
    mutationFn: (id: string) => adminApi.activar(id),
    onSuccess: () => {
      invalidar();
      toast("Negocio activado");
    },
    onError: () => toast("Error al activar el negocio. Intenta de nuevo.", "error"),
  });

  // Desactivar saca de línea la página pública: se confirma antes (AP-06).
  const [negocioADesactivar, setNegocioADesactivar] = useState<NegocioMetricasDto | null>(null);
  const { mutate: mutarDesactivar } = useMutation({
    mutationKey: CLAVE_ESTADO_NEGOCIO,
    mutationFn: (id: string) => adminApi.desactivar(id),
    onSuccess: (_, id) => {
      invalidar();
      setNegocioADesactivar((n) => (n?.id === id ? null : n));
      toast("Negocio desactivado");
    },
    onError: () => toast("Error al desactivar el negocio. Intenta de nuevo.", "error"),
  });

  // Un segundo clic mientras la petición sigue en curso no envía otra.
  const activar = (id: string) => { if (!idsCambiandoEstado.has(id)) mutarActivar(id); };
  const desactivar = (id: string) => { if (!idsCambiandoEstado.has(id)) mutarDesactivar(id); };
  const desactivandoSeleccionado = !!negocioADesactivar && idsCambiandoEstado.has(negocioADesactivar.id);

  // Marcar un correo como verificado sin que el dueño abra el enlace se
  // confirma antes, y al terminar la tarjeta lo refleja (antes no se recargaba).
  const [negocioCorreoPorConfirmar, setNegocioCorreoPorConfirmar] = useState<NegocioMetricasDto | null>(null);
  const { mutate: confirmarEmail, isPending: confirmandoEmail } = useMutation({
    mutationFn: (id: string) => adminApi.confirmarEmail(id),
    onSuccess: () => {
      invalidar();
      setNegocioCorreoPorConfirmar(null);
      toast("Correo del propietario confirmado");
    },
    onError: () => toast("Error al confirmar el correo. Intenta de nuevo.", "error"),
  });

  // Los interruptores son reversibles: aplican al instante y el aviso ofrece
  // "Deshacer" (I2). Deshacer es otro cambio normal, con su propia entrada en la
  // auditoría, y su aviso ya no ofrece deshacer de nuevo.
  const { mutate: togglePagos } = useMutation({
    mutationFn: ({ id, habilitado }: { id: string; habilitado: boolean; nombre: string; deshacer?: boolean }) =>
      adminApi.toggleModuloPagos(id, habilitado),
    onSuccess: (_, { id, habilitado, nombre, deshacer }) => {
      qc.setQueryData(
        ["admin-negocios-metricas"],
        (old: NegocioMetricasDto[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, moduloPagosHabilitado: habilitado } : n))
      );
      const mensaje = `Módulo de pagos ${habilitado ? "habilitado" : "deshabilitado"} en ${nombre}`;
      if (deshacer) {
        toast(`Cambio deshecho: ${mensaje.charAt(0).toLowerCase()}${mensaje.slice(1)}`);
        return;
      }
      toast(mensaje, "exito", {
        accion: { etiqueta: "Deshacer", onClick: () => togglePagos({ id, habilitado: !habilitado, nombre, deshacer: true }) },
      });
    },
    onError: () => toast("Error al actualizar el módulo de pagos", "error"),
  });

  // Como togglePagos, se envía el valor absoluto (no "alternar"): deshacer desde
  // un aviso viejo o reintentar tras perder la respuesta no invierte el estado.
  const { mutate: toggleTester } = useMutation({
    mutationFn: ({ id, esTester }: { id: string; esTester: boolean; nombre: string; deshacer?: boolean }) =>
      adminApi.setTester(id, esTester),
    onSuccess: (data, { id, esTester, nombre, deshacer }) => {
      qc.setQueryData(
        ["admin-negocios-metricas"],
        (old: NegocioMetricasDto[] | undefined) =>
          (old ?? []).map((n) => (n.id === id ? { ...n, esTester: data.esTester } : n))
      );
      // Un tester sale (o vuelve) de las cifras de facturación.
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      const mensaje = `Modo tester ${data.esTester ? "activado" : "desactivado"} en ${nombre}`;
      if (deshacer) {
        toast(`Cambio deshecho: ${mensaje.charAt(0).toLowerCase()}${mensaje.slice(1)}`);
        return;
      }
      toast(mensaje, "exito", {
        accion: { etiqueta: "Deshacer", onClick: () => toggleTester({ id, esTester: !esTester, nombre, deshacer: true }) },
      });
    },
    onError: () => toast("Error al actualizar el modo tester", "error"),
  });

  const modales = (
    <>
      {/* Confirmación: desactivar negocio */}
      <ConfirmarAccion
        abierto={negocioADesactivar !== null}
        titulo={`¿Desactivar ${negocioADesactivar?.nombre ?? "el negocio"}?`}
        mensaje={
          <>
            <p>
              La página <span className="font-mono text-foreground">/b/{negocioADesactivar?.slug}</span> dejará
              de aceptar reservas y sus clientes no podrán verla hasta que vuelvas a activar el negocio.
            </p>
            <p className="mt-2">Las citas ya agendadas no se cancelan.</p>
          </>
        }
        etiquetaConfirmar="Desactivar negocio"
        destructiva
        pendiente={desactivandoSeleccionado}
        onConfirmar={() => negocioADesactivar && desactivar(negocioADesactivar.id)}
        onCerrar={() => { if (!desactivandoSeleccionado) setNegocioADesactivar(null); }}
      />

      {/* Confirmación: marcar el correo del propietario como verificado */}
      <ConfirmarAccion
        abierto={negocioCorreoPorConfirmar !== null}
        titulo="¿Confirmar el correo del propietario?"
        mensaje={
          <>
            <p>
              {negocioCorreoPorConfirmar?.propietarioEmail
                ? <>Marcarás <span className="font-medium text-foreground break-all">{negocioCorreoPorConfirmar.propietarioEmail}</span> como verificado</>
                : "Marcarás el correo del propietario como verificado"}{" "}
              sin que abra el enlace que le enviamos.
            </p>
            <p className="mt-2">Hazlo solo si ya comprobaste que el correo es suyo.</p>
          </>
        }
        etiquetaConfirmar="Confirmar correo"
        pendiente={confirmandoEmail}
        onConfirmar={() => negocioCorreoPorConfirmar && confirmarEmail(negocioCorreoPorConfirmar.id)}
        onCerrar={() => { if (!confirmandoEmail) setNegocioCorreoPorConfirmar(null); }}
      />

      {/* Modal: suscripción */}
      <Modal
        abierto={modal === "suscripcion"}
        onCerrar={cerrarModal}
        titulo={`Suscripción — ${negocioSel?.nombre ?? ""}`}
        ancho="lg"
      >
        {negocioSel && (
          <SuscripcionNegocio
            // La copia de `negocioSel` se tomó al abrir: tras cambiar el plan,
            // la pastilla marcada debe salir de los datos recargados.
            negocio={metricas.find((m) => m.id === negocioSel.id) ?? negocioSel}
            suscripcion={suscripcionMap[negocioSel.id]}
            planes={planes}
            errorPlanes={errorPlanes}
            onReintentarPlanes={() => recargarPlanes()}
          />
        )}
      </Modal>

      <ModalPropietario negocio={negocioSel} abierto={modal === "propietario"} onCerrar={cerrarModal} />
      <ModalEliminarNegocio
        negocio={negocioSel}
        abierto={modal === "eliminar"}
        onCerrar={cerrarModal}
        onEliminado={onEliminado}
        // "Desactivar en su lugar" (I3): la misma confirmación de siempre.
        onDesactivar={(neg) => { cerrarModal(); setNegocioADesactivar(neg); }}
      />
      <ModalColores negocio={negocioSel} abierto={modal === "colores"} onCerrar={cerrarModal} />
    </>
  );

  return {
    activar: (neg: NegocioMetricasDto) => activar(neg.id),
    pedirDesactivar: (neg: NegocioMetricasDto) => setNegocioADesactivar(neg),
    pedirConfirmarCorreo: (neg: NegocioMetricasDto) => setNegocioCorreoPorConfirmar(neg),
    abrirSuscripcion: abrir("suscripcion"),
    abrirPropietario: abrir("propietario"),
    abrirColores: abrir("colores"),
    abrirEliminar: abrir("eliminar"),
    togglePagos: (neg: NegocioMetricasDto, habilitado: boolean) => togglePagos({ id: neg.id, habilitado, nombre: neg.nombre }),
    toggleTester: (neg: NegocioMetricasDto) => toggleTester({ id: neg.id, esTester: !neg.esTester, nombre: neg.nombre }),
    /** Solo el negocio cuyo estado está cambiando queda en espera (AP-06). */
    cambiandoEstado: (id: string) => idsCambiandoEstado.has(id),
    modales,
  };
}

export type AccionesNegocio = ReturnType<typeof useAccionesNegocio>;
