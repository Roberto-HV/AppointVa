import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type NegocioMetricasDto } from "../../../api/admin";
import Modal from "../../../components/ui/Modal";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import { useToastStore } from "../../../store/toastStore";
import { esColorHexValido } from "../../../utils/negociosAdmin";
import { BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO, CAMPO_ERROR, CAMPO_MODAL, CAMPO_OK } from "./estilos";

/** Color primario del panel del negocio. Arranca en el color guardado cada vez que se abre. */
export default function ModalColores({
  negocio,
  abierto,
  onCerrar,
}: {
  negocio: NegocioMetricasDto | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Colores del negocio" ancho="sm">
      {negocio && <EditorColores negocio={negocio} onCerrar={onCerrar} />}
    </Modal>
  );
}

function EditorColores({ negocio, onCerrar }: { negocio: NegocioMetricasDto; onCerrar: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [colorPrimario, setColorPrimario] = useState(negocio.colorPrimario ?? "#334155");

  const { mutate: actualizarColores, isPending: guardandoColores } = useMutation({
    mutationFn: () =>
      adminApi.actualizarColores(negocio.id, {
        colorPrimario: colorPrimario || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
      onCerrar();
      toast("Colores actualizados");
    },
    onError: () => toast("Error al guardar los colores. Intenta de nuevo.", "error"),
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Personaliza los colores del panel de{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-200">{negocio.nombre}</span>.
      </p>
      <div>
        <label htmlFor="color-primario" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Color primario
        </label>
        <div className="flex gap-3 items-center">
          <input id="color-primario" type="color" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)}
            className="w-12 h-12 shrink-0 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-800" />
          <input type="text" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)}
            aria-label="Color primario en hexadecimal"
            aria-invalid={!esColorHexValido(colorPrimario) || undefined}
            aria-describedby={!esColorHexValido(colorPrimario) ? "color-primario-error" : undefined}
            className={`${CAMPO_MODAL} ${esColorHexValido(colorPrimario) ? CAMPO_OK : CAMPO_ERROR} flex-1 min-w-0 font-mono uppercase`}
            maxLength={7} placeholder="#334155" />
          <div aria-hidden="true" className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0" style={{ backgroundColor: colorPrimario }} />
        </div>
        {!esColorHexValido(colorPrimario) && (
          <p id="color-primario-error" role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">
            Escribe un color con el formato #RRGGBB, por ejemplo #334155.
          </p>
        )}
      </div>
      <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/60">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Vista previa</p>
        <div className="flex flex-col gap-1">
          {["Inicio", "Citas", "Empleados", "Servicios"].map((item, i) => (
            <div key={item} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={i === 0 ? { backgroundColor: colorPrimario, color: "#fff" } : { color: "#6b7280" }}>
              <div className="w-4 h-4 rounded bg-current opacity-30" />
              {item}
            </div>
          ))}
        </div>
      </div>
      <ModalAcciones>
        <button onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>
          Cancelar
        </button>
        <button onClick={() => actualizarColores()} disabled={guardandoColores || !esColorHexValido(colorPrimario)} className={BOTON_PIE_PRIMARIO}>
          {guardandoColores ? "Guardando…" : "Guardar colores"}
        </button>
      </ModalAcciones>
    </div>
  );
}
