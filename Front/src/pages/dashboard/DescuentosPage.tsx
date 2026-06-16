import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag, X, Check, Copy } from "lucide-react";
import { descuentosApi, type Descuento } from "../../api/descuentos";
import { useToastStore } from "../../store/toastStore";

const TIPOS = [
  { value: "Porcentaje", label: "Porcentaje (%)" },
  { value: "MontoFijo", label: "Monto fijo ($)" },
];

interface FormState {
  codigo: string;
  descripcion: string;
  tipo: string;
  valor: string;
  usoMaximo: string;
  fechaExpiracion: string;
}

const EMPTY: FormState = {
  codigo: "",
  descripcion: "",
  tipo: "Porcentaje",
  valor: "",
  usoMaximo: "",
  fechaExpiracion: "",
};

function formatDescuento(desc: Descuento) {
  if (desc.tipo === "Porcentaje") return `${desc.valor}% de descuento`;
  return `$${desc.valor} de descuento`;
}

export default function DescuentosPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [copiado, setCopiado] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const { data: descuentos = [], isLoading } = useQuery({
    queryKey: ["descuentos"],
    queryFn: descuentosApi.getDescuentos,
  });

  const mutCrear = useMutation({
    mutationFn: () =>
      descuentosApi.crear({
        codigo: form.codigo,
        descripcion: form.descripcion || undefined,
        tipo: form.tipo,
        valor: Number(form.valor),
        usoMaximo: form.usoMaximo ? Number(form.usoMaximo) : undefined,
        fechaExpiracion: form.fechaExpiracion || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["descuentos"] });
      setShowForm(false);
      setForm(EMPTY);
      toast("Cupón creado");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })
        ?.response?.data?.mensaje ?? "Error al crear el cupón";
      toast(msg);
    },
  });

  const mutEliminar = useMutation({
    mutationFn: (id: string) => descuentosApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["descuentos"] });
      toast("Cupón eliminado");
    },
  });

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const activos = descuentos.filter((d) => !d.agotado && !d.expirado);
  const inactivos = descuentos.filter((d) => d.agotado || d.expirado);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupones de descuento</h1>
          <p className="text-gray-500 text-sm mt-1">
            Los clientes ingresan el código al reservar para obtener un descuento
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus size={16} /> Nuevo cupón
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Nuevo cupón</h2>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Código</label>
              <input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="PROMO20"
                maxLength={50}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Descripción (opcional)</label>
              <input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descuento de bienvenida"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Valor {form.tipo === "Porcentaje" ? "(%)" : "($)"}
              </label>
              <input
                type="number"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder={form.tipo === "Porcentaje" ? "20" : "50"}
                min="0.01"
                max={form.tipo === "Porcentaje" ? "100" : undefined}
                step="0.01"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Límite de usos (opcional)</label>
              <input
                type="number"
                value={form.usoMaximo}
                onChange={(e) => setForm({ ...form, usoMaximo: e.target.value })}
                placeholder="Sin límite"
                min="1"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Fecha expiración (opcional)</label>
              <input
                type="date"
                value={form.fechaExpiracion}
                onChange={(e) => setForm({ ...form, fechaExpiracion: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setForm(EMPTY); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={() => mutCrear.mutate()}
              disabled={!form.codigo.trim() || !form.valor || mutCrear.isPending}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition"
            >
              <Check size={15} /> Crear cupón
            </button>
          </div>
        </div>
      )}

      {/* Lista activos */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : descuentos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay cupones configurados</p>
          <p className="text-sm mt-1">Crea cupones para ofrecer descuentos a tus clientes</p>
        </div>
      ) : (
        <>
          {activos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Activos ({activos.length})</h2>
              {activos.map((d) => (
                <DescuentoRow
                  key={d.id}
                  descuento={d}
                  copiado={copiado === d.codigo}
                  onCopiar={() => copiarCodigo(d.codigo)}
                  onEliminar={() => {
                    if (confirm(`¿Desactivar el cupón ${d.codigo}?`))
                      mutEliminar.mutate(d.id);
                  }}
                />
              ))}
            </div>
          )}
          {inactivos.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Inactivos / expirados ({inactivos.length})</h2>
              {inactivos.map((d) => (
                <DescuentoRow
                  key={d.id}
                  descuento={d}
                  copiado={false}
                  onCopiar={() => copiarCodigo(d.codigo)}
                  onEliminar={() => mutEliminar.mutate(d.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DescuentoRow({
  descuento: d,
  copiado,
  onCopiar,
  onEliminar,
}: {
  descuento: Descuento;
  copiado: boolean;
  onCopiar: () => void;
  onEliminar: () => void;
}) {
  const inactivo = d.agotado || d.expirado;
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${inactivo ? "border-gray-100 opacity-60" : "border-gray-200"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-gray-900 text-sm">{d.codigo}</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {formatDescuento(d)}
          </span>
          {d.agotado && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Agotado</span>}
          {d.expirado && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Expirado</span>}
        </div>
        {d.descripcion && <p className="text-xs text-gray-500 mt-0.5">{d.descripcion}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
          <span>Usos: {d.usoActual}{d.usoMaximo ? ` / ${d.usoMaximo}` : ""}</span>
          {d.fechaExpiracion && (
            <span>Expira: {new Date(d.fechaExpiracion).toLocaleDateString("es-MX")}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onCopiar}
          title="Copiar código"
          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition"
        >
          {copiado ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
        </button>
        <button
          onClick={onEliminar}
          title="Desactivar"
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
