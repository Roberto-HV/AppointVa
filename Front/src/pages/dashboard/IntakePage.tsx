import { useId, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ClipboardList, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { intakeApi, type CampoIntake } from "../../api/intake";
import { serviciosApi } from "../../api/servicios";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";
import ModalAcciones from "../../components/ui/ModalAcciones";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import ErrorCarga from "../../components/ui/ErrorCarga";
import EmptyState from "../../components/ui/EmptyState";
import { useConfirmarDescarte } from "../../hooks/useCambiosSinGuardar";
import { claseCampo, CLASE_ERROR_CAMPO } from "../../lib/clasesCampo";
import { leerOpciones, serializarOpciones } from "../../lib/opcionesIntake";

const TIPOS = [
  { value: "Texto", label: "Texto corto" },
  { value: "MultilineTexto", label: "Texto largo" },
  { value: "Seleccion", label: "Selección (lista)" },
  { value: "Checkbox", label: "Sí / No (checkbox)" },
];

interface FormState {
  etiqueta: string;
  tipo: string;
  /** Una entrada por opción: una opción puede llevar comas. */
  opciones: string[];
  requerido: boolean;
  servicioIds: string[];
}

const EMPTY: FormState = {
  etiqueta: "",
  tipo: "Texto",
  opciones: ["", ""],
  requerido: false,
  servicioIds: [],
};

function datosParaApi(data: FormState) {
  return {
    etiqueta: data.etiqueta,
    tipo: data.tipo,
    opciones: data.tipo === "Seleccion" ? serializarOpciones(data.opciones) : undefined,
    requerido: data.requerido,
    servicioIds: data.servicioIds.length > 0 ? data.servicioIds : undefined,
  };
}

export default function IntakePage() {
  const idForm = useId();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<CampoIntake | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errorOpciones, setErrorOpciones] = useState("");
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const { data: camposApi = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["intake-campos"],
    queryFn: () => intakeApi.getCampos(),
  });
  // Mismo orden que ve el cliente en la reserva.
  const campos = [...camposApi].sort((a, b) => a.orden - b.orden);

  // ── Reordenar (decisión 20, OM-15) ─────────────────────────────────────────
  // Botones Subir/Bajar (accesibles por teclado) que llaman a
  // PATCH /intake/campos/reordenar. El cambio se ve al instante y se revierte
  // si el servidor falla; el lector de pantalla anuncia la nueva posición.
  const [anuncioOrden, setAnuncioOrden] = useState("");
  const mutReordenar = useMutation({
    mutationFn: (nuevos: CampoIntake[]) =>
      intakeApi.reordenar(nuevos.map((c, i) => ({ id: c.id, orden: i + 1 }))),
    onMutate: async (nuevos) => {
      await qc.cancelQueries({ queryKey: ["intake-campos"] });
      const previos = qc.getQueryData<CampoIntake[]>(["intake-campos"]);
      qc.setQueryData<CampoIntake[]>(["intake-campos"], nuevos.map((c, i) => ({ ...c, orden: i + 1 })));
      return { previos };
    },
    onError: (_err, _nuevos, ctx) => {
      if (ctx?.previos) qc.setQueryData(["intake-campos"], ctx.previos);
      setAnuncioOrden("No se pudo cambiar el orden.");
      toast("No se pudo cambiar el orden de las preguntas. Intenta de nuevo.", "error");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["intake-campos"] }),
  });

  const mover = (idx: number, delta: -1 | 1) => {
    const destino = idx + delta;
    if (destino < 0 || destino >= campos.length || mutReordenar.isPending) return;
    const nuevos = [...campos];
    [nuevos[idx], nuevos[destino]] = [nuevos[destino], nuevos[idx]];
    const movido = nuevos[destino];
    mutReordenar.mutate(nuevos);
    setAnuncioOrden(`"${movido.etiqueta}" ahora es la pregunta ${destino + 1} de ${nuevos.length}.`);
    // Si el botón pulsado queda deshabilitado (llegó al extremo), el foco pasa al otro.
    requestAnimationFrame(() => {
      const mismo = document.querySelector<HTMLButtonElement>(`[data-mover="${movido.id}:${delta}"]`);
      const otro = document.querySelector<HTMLButtonElement>(`[data-mover="${movido.id}:${-delta}"]`);
      if (mismo && !mismo.disabled) mismo.focus();
      else otro?.focus();
    });
  };

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios-intake"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const mutCrear = useMutation({
    mutationFn: (data: FormState) => intakeApi.crearCampo(datosParaApi(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-campos"] });
      setShowForm(false);
      setForm(EMPTY);
      toast("Pregunta creada");
    },
    onError: () => toast("No se pudo crear la pregunta. Intenta de nuevo.", "error"),
  });

  const mutActualizar = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormState }) => intakeApi.actualizarCampo(id, datosParaApi(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-campos"] });
      setEditando(null);
      setShowForm(false);
      setForm(EMPTY);
      toast("Pregunta actualizada");
    },
    onError: () => toast("No se pudo actualizar la pregunta. Intenta de nuevo.", "error"),
  });

  const mutEliminar = useMutation({
    mutationFn: (id: string) => intakeApi.eliminarCampo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-campos"] });
      setCampoEliminar(null);
      toast("Pregunta eliminada");
    },
    onError: () => toast("No se pudo eliminar la pregunta. Intenta de nuevo.", "error"),
  });

  const [campoEliminar, setCampoEliminar] = useState<CampoIntake | null>(null);
  const descarte = useConfirmarDescarte();
  const formDe = (campo: CampoIntake): FormState => {
    const opciones = leerOpciones(campo.opciones);
    return {
      etiqueta: campo.etiqueta,
      tipo: campo.tipo,
      opciones: opciones.length > 0 ? opciones : ["", ""],
      requerido: campo.requerido,
      servicioIds: campo.servicioIds ?? [],
    };
  };
  // Lo que había al abrir el modal, para preguntar antes de perder lo escrito.
  const formularioInicial: FormState = editando ? formDe(editando) : EMPTY;
  const formularioSucio = showForm && JSON.stringify(form) !== JSON.stringify(formularioInicial);
  const cerrar = () => descarte.pedirCierre(formularioSucio, () => { setShowForm(false); setEditando(null); });

  function abrirCrear() {
    setEditando(null);
    setForm(EMPTY);
    setErrorOpciones("");
    setShowForm(true);
  }

  function abrirEditar(campo: CampoIntake) {
    setEditando(campo);
    setForm(formDe(campo));
    setErrorOpciones("");
    setShowForm(true);
  }

  function guardar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.etiqueta.trim()) return;
    if (form.tipo === "Seleccion" && !serializarOpciones(form.opciones)) {
      setErrorOpciones("Agrega al menos una opción.");
      return;
    }
    setErrorOpciones("");
    if (editando) {
      mutActualizar.mutate({ id: editando.id, data: form });
    } else {
      mutCrear.mutate(form);
    }
  }

  const cambiarOpcion = (i: number, valor: string) =>
    setForm({ ...form, opciones: form.opciones.map((o, j) => (j === i ? valor : o)) });
  const quitarOpcion = (i: number) =>
    setForm({ ...form, opciones: form.opciones.filter((_, j) => j !== i) });
  const agregarOpcion = () => setForm({ ...form, opciones: [...form.opciones, ""] });

  const id = (campo: string) => `${idForm}-${campo}`;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <EncabezadoPagina
        titulo="Cuestionario"
        subtitulo="Preguntas adicionales que verá el cliente al reservar"
        acciones={
          <BotonAccion onClick={abrirCrear}>
            <Plus size={16} /> Nueva pregunta
          </BotonAccion>
        }
      />

      {/* Form modal */}
      <Modal
        abierto={showForm}
        onCerrar={cerrar}
        titulo={editando ? "Editar pregunta" : "Nueva pregunta"}
      >
        <form noValidate onSubmit={guardar} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor={id("etiqueta")} className="text-sm font-medium text-slate-700 dark:text-slate-300">Pregunta / etiqueta</label>
              <input
                id={id("etiqueta")}
                value={form.etiqueta}
                onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                placeholder="Ej: ¿Tienes alguna alergia?"
                className={claseCampo(false, "mt-1")}
              />
            </div>

            <div>
              <label htmlFor={id("tipo")} className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de respuesta</label>
              <select
                id={id("tipo")}
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className={claseCampo(false, "mt-1")}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {form.tipo === "Seleccion" && (
              <fieldset aria-describedby={errorOpciones ? id("opciones-error") : undefined}>
                <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Opciones</legend>
                <ul className="mt-1 space-y-2">
                  {form.opciones.map((op, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <input
                        value={op}
                        onChange={(e) => cambiarOpcion(i, e.target.value)}
                        placeholder={`Opción ${i + 1}`}
                        aria-label={`Opción ${i + 1}`}
                        aria-invalid={(!!errorOpciones && !op.trim()) || undefined}
                        className={claseCampo(!!errorOpciones && !op.trim())}
                      />
                      {form.opciones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarOpcion(i)}
                          aria-label={`Quitar opción ${i + 1}`}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-muted-foreground hover:text-red-700 dark:hover:text-red-400 hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={agregarOpcion}
                  className="mt-1 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-foreground hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  + Agregar opción
                </button>
                {errorOpciones && <p id={id("opciones-error")} role="alert" className={CLASE_ERROR_CAMPO}>{errorOpciones}</p>}
              </fieldset>
            )}

            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Servicios (opcional — deja vacío para todos)
              </span>
              {servicios.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No hay servicios configurados</p>
              ) : (
                <div className="mt-1 space-y-1 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2">
                  {servicios.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <input
                        type="checkbox"
                        className="accent-slate-700 w-4 h-4"
                        checked={form.servicioIds.includes(s.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.servicioIds, s.id]
                            : form.servicioIds.filter((sid) => sid !== s.id);
                          setForm({ ...form, servicioIds: next });
                        }}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{s.nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requerido}
                onChange={(e) => setForm({ ...form, requerido: e.target.checked })}
                className="accent-slate-700 w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Respuesta obligatoria</span>
            </label>

            <VistaPrevia form={form} />
          </div>

          <ModalAcciones>
            <button
              type="button"
              onClick={cerrar}
              className="min-h-[44px] lg:min-h-[36px] px-4 text-sm text-foreground border border-border hover:bg-muted rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!form.etiqueta.trim() || mutCrear.isPending || mutActualizar.isPending}
              className="min-h-[44px] lg:min-h-[36px] inline-flex items-center justify-center gap-1 px-4 bg-slate-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check size={15} aria-hidden="true" />
              {editando ? "Guardar cambios" : "Crear pregunta"}
            </button>
          </ModalAcciones>
        </form>
      </Modal>

      {/* Lista de campos */}
      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando preguntas">
          {[0, 1, 2].map((i) => <div key={i} className="h-[60px] rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : isError ? (
        <ErrorCarga mensaje="No se pudieron cargar las preguntas." onReintentar={() => refetch()} reintentando={isFetching} />
      ) : campos.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          <EmptyState
            icon={<ClipboardList size={40} strokeWidth={1.5} />}
            title="No hay preguntas configuradas"
            description="Agrega preguntas que se mostrarán al cliente antes de confirmar su reserva"
          />
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Preguntas del formulario, en orden">
          {campos.map((campo, idx) => (
            <li key={campo.id}>
              <CampoRow
                campo={campo}
                orden={idx + 1}
                esPrimero={idx === 0}
                esUltimo={idx === campos.length - 1}
                reordenando={mutReordenar.isPending}
                onSubir={() => mover(idx, -1)}
                onBajar={() => mover(idx, 1)}
                onEditar={() => abrirEditar(campo)}
                onEliminar={() => setCampoEliminar(campo)}
              />
            </li>
          ))}
        </ol>
      )}

      <p className="sr-only" aria-live="polite" role="status">{anuncioOrden}</p>

      {campos.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          {campos.length} pregunta{campos.length !== 1 ? "s" : ""} — aparecen en el formulario de reserva en orden mostrado
        </p>
      )}

      <ConfirmarAccion
        abierto={!!campoEliminar}
        titulo="Eliminar pregunta"
        mensaje={campoEliminar && (
          <p>{`"${campoEliminar.etiqueta}" dejará de mostrarse en el formulario de reserva.`}</p>
        )}
        etiquetaConfirmar="Eliminar pregunta"
        destructiva
        pendiente={mutEliminar.isPending}
        onConfirmar={() => campoEliminar && mutEliminar.mutate(campoEliminar.id)}
        onCerrar={() => setCampoEliminar(null)}
      />
      {descarte.dialogo}
    </div>
  );
}

/** Cómo verá el cliente la pregunta (sin interacción). */
function VistaPrevia({ form }: { form: FormState }) {
  const etiqueta = form.etiqueta.trim() || "Tu pregunta";
  const opciones = form.opciones.map((o) => o.trim()).filter(Boolean);
  const clase = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground";
  return (
    <section aria-label="Vista previa" className="rounded-xl border border-dashed border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vista previa</p>
      <div aria-hidden="true">
        {form.tipo === "Checkbox" ? (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <span className="w-4 h-4 rounded border border-border bg-background" />
            {etiqueta}{form.requerido && " *"}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground mb-1">{etiqueta}{form.requerido && " *"}</p>
            {form.tipo === "Seleccion" ? (
              <div className={clase}>
                {opciones.length > 0 ? `Selecciona una opción (${opciones.join(" · ")})` : "Selecciona una opción"}
              </div>
            ) : (
              <div className={`${clase} ${form.tipo === "MultilineTexto" ? "h-16" : ""}`}>Respuesta del cliente</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const CLASE_BOTON_ICONO =
  "inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-slate-500 dark:text-slate-400 hover:text-foreground hover:bg-muted rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CampoRow({
  campo,
  orden,
  esPrimero,
  esUltimo,
  reordenando,
  onSubir,
  onBajar,
  onEditar,
  onEliminar,
}: {
  campo: CampoIntake;
  orden: number;
  esPrimero: boolean;
  esUltimo: boolean;
  reordenando: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const tipoLabel = TIPOS.find((t) => t.value === campo.tipo)?.label ?? campo.tipo;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="text-xs text-slate-500 dark:text-slate-400 w-5 shrink-0">{orden}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{campo.etiqueta}</p>
          {/* Neutra: el rojo es para errores, no para "obligatoria". */}
          {campo.requerido && (
            <span className="text-xs bg-muted text-foreground px-1.5 py-0.5 rounded font-medium">
              Obligatoria
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <span>{tipoLabel}</span>
          {campo.servicioNombres && campo.servicioNombres.length > 0 ? (
            <span>Solo para: {campo.servicioNombres.join(", ")}</span>
          ) : (
            <span>Todos los servicios</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onSubir}
          disabled={esPrimero || reordenando}
          data-mover={`${campo.id}:-1`}
          aria-label={`Subir pregunta "${campo.etiqueta}"`}
          title="Subir"
          className={CLASE_BOTON_ICONO}
        >
          <ArrowUp size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onBajar}
          disabled={esUltimo || reordenando}
          data-mover={`${campo.id}:1`}
          aria-label={`Bajar pregunta "${campo.etiqueta}"`}
          title="Bajar"
          className={CLASE_BOTON_ICONO}
        >
          <ArrowDown size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar pregunta "${campo.etiqueta}"`}
          title="Editar"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-slate-500 dark:text-slate-400 hover:text-foreground hover:bg-muted rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEliminar}
          aria-label={`Eliminar pregunta "${campo.etiqueta}"`}
          title="Eliminar"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
