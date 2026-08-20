import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ClipboardList, Check } from "lucide-react";
import { intakeApi, type CampoIntake } from "../../api/intake";
import { serviciosApi } from "../../api/servicios";
import { useToastStore } from "../../store/toastStore";
import Modal from "../../components/ui/Modal";

const TIPOS = [
  { value: "Texto", label: "Texto corto" },
  { value: "MultilineTexto", label: "Texto largo" },
  { value: "Seleccion", label: "Selección (lista)" },
  { value: "Checkbox", label: "Sí / No (checkbox)" },
];

interface FormState {
  etiqueta: string;
  tipo: string;
  opciones: string;
  requerido: boolean;
  servicioIds: string[];
}

const EMPTY: FormState = {
  etiqueta: "",
  tipo: "Texto",
  opciones: "",
  requerido: false,
  servicioIds: [],
};

export default function IntakePage() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<CampoIntake | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const { data: campos = [], isLoading } = useQuery({
    queryKey: ["intake-campos"],
    queryFn: () => intakeApi.getCampos(),
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios-intake"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const mutCrear = useMutation({
    mutationFn: (data: typeof form) =>
      intakeApi.crearCampo({
        etiqueta: data.etiqueta,
        tipo: data.tipo,
        opciones: data.tipo === "Seleccion" ? data.opciones || undefined : undefined,
        requerido: data.requerido,
        servicioIds: data.servicioIds.length > 0 ? data.servicioIds : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-campos"] });
      setShowForm(false);
      setForm(EMPTY);
      toast("Campo creado");
    },
    onError: () => toast("No se pudo crear el campo. Intenta de nuevo.", "error"),
  });

  const mutActualizar = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      intakeApi.actualizarCampo(id, {
        etiqueta: data.etiqueta,
        tipo: data.tipo,
        opciones: data.tipo === "Seleccion" ? data.opciones || undefined : undefined,
        requerido: data.requerido,
        servicioIds: data.servicioIds.length > 0 ? data.servicioIds : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-campos"] });
      setEditando(null);
      setShowForm(false);
      setForm(EMPTY);
      toast("Campo actualizado");
    },
    onError: () => toast("No se pudo actualizar el campo. Intenta de nuevo.", "error"),
  });

  const mutEliminar = useMutation({
    mutationFn: (id: string) => intakeApi.eliminarCampo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-campos"] });
      toast("Campo eliminado");
    },
    onError: () => toast("No se pudo eliminar el campo. Intenta de nuevo.", "error"),
  });

  function abrirCrear() {
    setEditando(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function abrirEditar(campo: CampoIntake) {
    setEditando(campo);
    setForm({
      etiqueta: campo.etiqueta,
      tipo: campo.tipo,
      opciones: campo.opciones ?? "",
      requerido: campo.requerido,
      servicioIds: campo.servicioIds ?? [],
    });
    setShowForm(true);
  }

  function guardar() {
    if (!form.etiqueta.trim()) return;
    if (form.tipo === "Seleccion" && !form.opciones.trim()) {
      toast("Debes agregar al menos una opción para el campo de selección", "error");
      return;
    }
    if (editando) {
      mutActualizar.mutate({ id: editando.id, data: form });
    } else {
      mutCrear.mutate(form);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cuestionario</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Preguntas adicionales que verá el cliente al reservar
          </p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus size={16} /> Nueva pregunta
        </button>
      </div>

      {/* Form modal */}
      <Modal
        abierto={showForm}
        onCerrar={() => { setShowForm(false); setEditando(null); }}
        titulo={editando ? "Editar pregunta" : "Nueva pregunta"}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pregunta / etiqueta</label>
              <input
                value={form.etiqueta}
                onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                placeholder="Ej: ¿Tienes alguna alergia?"
                className="mt-1 w-full border border-gray-200 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30 dark:focus:ring-slate-500/30"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de respuesta</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="mt-1 w-full border border-gray-200 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30 dark:focus:ring-slate-500/30"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {form.tipo === "Seleccion" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Opciones (separadas por coma)
                </label>
                <input
                  value={form.opciones}
                  onChange={(e) => setForm({ ...form, opciones: e.target.value })}
                  placeholder="Sí, No, Tal vez"
                  className="mt-1 w-full border border-gray-200 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30 dark:focus:ring-slate-500/30"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Escribe las opciones separadas por coma
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Servicios (opcional — deja vacío para todos)
              </label>
              {servicios.length === 0 ? (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">No hay servicios configurados</p>
              ) : (
                <div className="mt-1 space-y-1 max-h-36 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg p-2">
                  {servicios.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-slate-700/40">
                      <input
                        type="checkbox"
                        className="accent-slate-700 w-4 h-4"
                        checked={form.servicioIds.includes(s.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.servicioIds, s.id]
                            : form.servicioIds.filter((id) => id !== s.id);
                          setForm({ ...form, servicioIds: next });
                        }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{s.nombre}</span>
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
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Respuesta requerida</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setEditando(null); }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={!form.etiqueta.trim() || mutCrear.isPending || mutActualizar.isPending}
              className="flex items-center gap-1 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition"
            >
              <Check size={15} />
              {editando ? "Guardar cambios" : "Crear pregunta"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Lista de campos */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">Cargando...</div>
      ) : campos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay preguntas configuradas</p>
          <p className="text-sm mt-1">
            Agrega preguntas que se mostrarán al cliente antes de confirmar su reserva
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {campos.map((campo, idx) => (
            <CampoRow
              key={campo.id}
              campo={campo}
              orden={idx + 1}
              onEditar={() => abrirEditar(campo)}
              onEliminar={() => {
                if (confirm("¿Eliminar esta pregunta?"))
                  mutEliminar.mutate(campo.id);
              }}
            />
          ))}
        </div>
      )}

      {campos.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {campos.length} pregunta{campos.length !== 1 ? "s" : ""} — aparecen en el formulario de reserva en orden mostrado
        </p>
      )}
    </div>
  );
}

function CampoRow({
  campo,
  orden,
  onEditar,
  onEliminar,
}: {
  campo: CampoIntake;
  orden: number;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const tipoLabel = TIPOS.find((t) => t.value === campo.tipo)?.label ?? campo.tipo;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="text-xs text-gray-400 dark:text-gray-500 w-5 shrink-0">{orden}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">{campo.etiqueta}</p>
          {campo.requerido && (
            <span className="text-xs bg-red-50 dark:bg-red-900/40 text-red-500 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">
              Requerido
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
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
          onClick={onEditar}
          className="p-1.5 text-gray-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-700/10 dark:hover:bg-slate-600/30 rounded-lg transition"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onEliminar}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
