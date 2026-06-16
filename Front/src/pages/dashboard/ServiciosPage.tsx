import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { serviciosApi, categoriasApi } from "../../api/servicios";
import Modal from "../../components/ui/Modal";
import { useToastStore } from "../../store/toastStore";
import type { CategoriaDto, ServicioDto } from "../../types";

// ── Schemas ───────────────────────────────────────────────────────────────────
const schemaServicio = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  categoriaId: z.string().optional(),
  descripcion: z.string().max(300).optional(),
  duracionMinutos: z.coerce.number().min(5, "Mínimo 5 minutos"),
  bufferMinutos: z.coerce.number().min(0).max(120),
  precio: z.coerce.number().min(0, "Precio inválido"),
  orden: z.coerce.number().min(1),
});
type ServicioForm = z.infer<typeof schemaServicio>;

const schemaCategoria = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  orden: z.coerce.number().min(1),
});
type CategoriaForm = z.infer<typeof schemaCategoria>;

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default function ServiciosPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [tab, setTab] = useState<"servicios" | "categorias">("servicios");

  // ── Estado servicios ──────────────────────────────────────────────────────
  const [modal, setModal] = useState(false);
  const [servicioEdit, setServicioEdit] = useState<ServicioDto | null>(null);
  const imagenInputRef = useRef<HTMLInputElement>(null);
  const servicioImagenIdRef = useRef<string | null>(null);

  // ── Estado categorías ─────────────────────────────────────────────────────
  const [categoriaEdit, setCategoriaEdit] = useState<CategoriaDto | null>(null);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [categoriaEliminar, setCategoriaEliminar] = useState<CategoriaDto | null>(null);
  const [servicioEliminar, setServicioEliminar] = useState<ServicioDto | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: servicios = [], isLoading } = useQuery({
    queryKey: ["servicios"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const { data: categorias = [], isLoading: cargandoCategorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => categoriasApi.obtenerTodas(),
  });

  // ── Forms servicios ───────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ServicioForm>({
    resolver: zodResolver(schemaServicio) as Resolver<ServicioForm>,
    defaultValues: { orden: 1, duracionMinutos: 30, bufferMinutos: 0, precio: 0 },
  });

  const abrirCrearServicio = () => {
    setServicioEdit(null);
    reset({ nombre: "", categoriaId: "", descripcion: "", duracionMinutos: 30, bufferMinutos: 0, precio: 0, orden: servicios.length + 1 });
    setModal(true);
  };

  const abrirEditarServicio = (s: ServicioDto) => {
    setServicioEdit(s);
    reset({
      nombre: s.nombre, categoriaId: s.categoriaId ?? "",
      descripcion: s.descripcion ?? "", duracionMinutos: s.duracionMinutos,
      bufferMinutos: s.bufferMinutos, precio: s.precio, orden: s.orden,
    });
    setModal(true);
  };

  // ── Forms categorías ──────────────────────────────────────────────────────
  const formCat = useForm<CategoriaForm>({
    resolver: zodResolver(schemaCategoria) as Resolver<CategoriaForm>,
    defaultValues: { nombre: "", orden: 1 },
  });

  const abrirCrearCategoria = () => {
    setCategoriaEdit(null);
    formCat.reset({ nombre: "", orden: categorias.length + 1 });
    setModalCategoria(true);
  };

  const abrirEditarCategoria = (c: CategoriaDto) => {
    setCategoriaEdit(c);
    formCat.reset({ nombre: c.nombre, orden: c.orden });
    setModalCategoria(true);
  };

  // ── Mutations servicios ───────────────────────────────────────────────────
  const { mutate: guardarServicio, isPending: guardandoServicio } = useMutation({
    mutationFn: (data: ServicioForm) =>
      servicioEdit
        ? serviciosApi.actualizar(servicioEdit.id, { ...data, categoriaId: data.categoriaId || undefined })
        : serviciosApi.crear({ ...data, categoriaId: data.categoriaId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicios"] });
      setModal(false);
      toast(servicioEdit ? "Servicio actualizado" : "Servicio creado");
    },
  });

  const { mutate: eliminarServicio } = useMutation({
    mutationFn: (id: string) => serviciosApi.eliminar(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["servicios"] }); toast("Servicio eliminado"); },
  });

  const { mutate: subirImagen } = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => serviciosApi.subirImagen(id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["servicios"] }); toast("Imagen actualizada"); },
  });

  // ── Mutations categorías ──────────────────────────────────────────────────
  const { mutate: guardarCategoria, isPending: guardandoCategoria } = useMutation({
    mutationFn: (data: CategoriaForm) =>
      categoriaEdit
        ? categoriasApi.actualizar(categoriaEdit.id, data.nombre, data.orden)
        : categoriasApi.crear(data.nombre, data.orden),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["servicios"] });
      setModalCategoria(false);
      toast(categoriaEdit ? "Categoría actualizada" : "Categoría creada");
    },
  });

  const { mutate: eliminarCategoria } = useMutation({
    mutationFn: (id: string) => categoriasApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["servicios"] });
      toast("Categoría eliminada");
    },
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const grupos = servicios.reduce<Record<string, ServicioDto[]>>((acc, s) => {
    const cat = s.categoriaNombre ?? "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const serviciosPorCategoria = (catId: string) =>
    servicios.filter((s) => s.categoriaId === catId).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8">
      {/* Header con tabs */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setTab("servicios")}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                tab === "servicios" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Servicios
            </button>
            <button
              onClick={() => setTab("categorias")}
              className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                tab === "categorias" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Categorías
              {categorias.length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">
                  {categorias.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {tab === "servicios" ? (
          <button
            onClick={abrirCrearServicio}
            className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Nuevo servicio
          </button>
        ) : (
          <button
            onClick={abrirCrearCategoria}
            className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            + Nueva categoría
          </button>
        )}
      </div>

      {/* ── Tab Servicios ──────────────────────────────────────────────────── */}
      {tab === "servicios" && (
        isLoading ? (
          <p className="text-gray-400">Cargando servicios...</p>
        ) : servicios.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-medium text-gray-700 mb-1">Aún no tienes servicios</p>
            <p className="text-sm text-gray-400 mb-5">Crea tus servicios para que los clientes puedan reservar</p>
            <button
              onClick={abrirCrearServicio}
              className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Crear primer servicio
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grupos).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
                <div className="bg-white rounded-xl border border-gray-100">
                  {items.map((s, i) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      {/* Thumbnail imagen */}
                      <div
                        className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden relative group cursor-pointer"
                        onClick={() => { servicioImagenIdRef.current = s.id; imagenInputRef.current?.click(); }}
                        title="Haz clic para cambiar la imagen del servicio"
                      >
                        {s.imagenUrl
                          ? <img src={s.imagenUrl} alt={s.nombre} className="w-full h-full object-cover" />
                          : <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        }
                        <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">{s.nombre}</p>
                        {s.descripcion && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{s.descripcion}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{s.duracionMinutos} min</p>
                        <p className="sm:hidden font-semibold text-gray-800 text-sm mt-1">{formatPrecio(s.precio)}</p>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                        <span className="hidden sm:inline font-semibold text-gray-800 text-sm">{formatPrecio(s.precio)}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => abrirEditarServicio(s)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setServicioEliminar(s)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Tab Categorías ─────────────────────────────────────────────────── */}
      {tab === "categorias" && (
        cargandoCategorias ? (
          <p className="text-gray-400">Cargando categorías...</p>
        ) : categorias.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-700 mb-1">Aún no tienes categorías</p>
            <p className="text-sm text-gray-400 mb-5">Las categorías agrupan tus servicios en el catálogo público</p>
            <button
              onClick={abrirCrearCategoria}
              className="bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Crear primera categoría
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {categorias.map((c) => {
              const count = serviciosPorCategoria(c.id);
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                  <span className="font-medium text-gray-800 flex-1 min-w-0 truncate">{c.nombre}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    count > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                  }`}>
                    {count} {count === 1 ? "servicio" : "servicios"}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => abrirEditarCategoria(c)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setCategoriaEliminar(c)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Input oculto para imagen de servicio */}
      <input
        ref={imagenInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && servicioImagenIdRef.current) subirImagen({ id: servicioImagenIdRef.current, file: f });
          e.target.value = "";
        }}
      />

      {/* Modal servicio */}
      <Modal
        abierto={modal}
        onCerrar={() => setModal(false)}
        titulo={servicioEdit ? "Editar servicio" : "Nuevo servicio"}
      >
        <form onSubmit={handleSubmit((d) => guardarServicio(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              {...register("nombre")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <Select {...register("categoriaId")} value={watch("categoriaId") ?? ""} className="w-full">
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={2}
              {...register("descripcion")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min) *</label>
              <input
                type="number" min="5" step="5"
                {...register("duracionMinutos")}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                  ${errors.duracionMinutos ? "border-red-400" : "border-gray-200"}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buffer (min)
                <span className="ml-1 text-xs text-gray-400 font-normal">tiempo extra tras la cita</span>
              </label>
              <input
                type="number" min="0" max="120" step="5"
                {...register("bufferMinutos")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio (MXN) *</label>
              <input
                type="number" min="0" step="0.5"
                {...register("precio")}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                  ${errors.precio ? "border-red-400" : "border-gray-200"}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
              <input
                type="number" min="1"
                {...register("orden")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={guardandoServicio}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {guardandoServicio ? "Guardando..." : servicioEdit ? "Guardar cambios" : "Crear servicio"}
          </button>
        </form>
      </Modal>

      {/* Modal confirmar eliminar servicio */}
      <Modal abierto={!!servicioEliminar} onCerrar={() => setServicioEliminar(null)} titulo="Eliminar servicio" ancho="sm">
        {servicioEliminar && (
          <div>
            <p className="text-sm text-gray-600 mb-1">
              ¿Seguro que deseas eliminar <span className="font-semibold text-gray-900">"{servicioEliminar.nombre}"</span>?
            </p>
            <p className="text-xs text-gray-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setServicioEliminar(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { eliminarServicio(servicioEliminar.id); setServicioEliminar(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmar eliminar categoría */}
      <Modal abierto={!!categoriaEliminar} onCerrar={() => setCategoriaEliminar(null)} titulo="Eliminar categoría" ancho="sm">
        {categoriaEliminar && (
          <div>
            <p className="text-sm text-gray-600 mb-1">
              ¿Seguro que deseas eliminar <span className="font-semibold text-gray-900">"{categoriaEliminar.nombre}"</span>?
            </p>
            {serviciosPorCategoria(categoriaEliminar.id) > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Esta categoría tiene {serviciosPorCategoria(categoriaEliminar.id)} servicio(s). Los servicios quedarán sin categoría.
              </p>
            )}
            <p className="text-xs text-gray-400 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setCategoriaEliminar(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { eliminarCategoria(categoriaEliminar.id); setCategoriaEliminar(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal categoría */}
      <Modal
        abierto={modalCategoria}
        onCerrar={() => setModalCategoria(false)}
        titulo={categoriaEdit ? "Editar categoría" : "Nueva categoría"}
        ancho="sm"
      >
        <form onSubmit={formCat.handleSubmit((d) => guardarCategoria(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              {...formCat.register("nombre")}
              placeholder="Ej. Cabello, Uñas, Tratamientos..."
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${formCat.formState.errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formCat.formState.errors.nombre && (
              <p className="text-red-500 text-xs mt-1">{formCat.formState.errors.nombre.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
            <input
              type="number" min="1"
              {...formCat.register("orden")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-gray-400 mt-1">Número que define el orden en el catálogo público.</p>
          </div>
          <button
            type="submit"
            disabled={guardandoCategoria}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {guardandoCategoria ? "Guardando..." : categoriaEdit ? "Guardar cambios" : "Crear categoría"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
