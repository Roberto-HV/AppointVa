import { useMemo, useRef, useState } from "react";
import { Camera, Pencil, Star, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import Tabs from "../../components/ui/Tabs";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { serviciosApi, categoriasApi } from "../../api/servicios";
import Modal from "../../components/ui/Modal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import Pagination from "../../components/ui/Pagination";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { useToastStore } from "../../store/toastStore";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import { useConfirmarDescarte } from "../../hooks/useCambiosSinGuardar";
import type { CategoriaDto, ServicioDto } from "../../types";
import { formatPrecio } from "../../utils/formatters";
import { claseCampo, CLASE_ERROR_CAMPO } from "../../lib/clasesCampo";
import { ACCEPT_IMAGEN } from "../../lib/imagenes";
import { useSubirImagen } from "../../hooks/useSubirImagen";
import ProgresoSubida from "../../components/ui/ProgresoSubida";
import Switch from "../../components/ui/Switch";
import ErrorCarga from "../../components/ui/ErrorCarga";

// ── Schemas ───────────────────────────────────────────────────────────────────
// `noValidate` en el formulario: estos mensajes son los únicos que ve el dueño.
// Antes el `step="0.5"` del navegador rechazaba $149.90 con un globo en inglés.
const numero = (mensaje: string) => z.coerce.number({ error: mensaje });

const schemaServicio = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  categoriaId: z.string().optional(),
  descripcion: z.string().max(300, "Máximo 300 caracteres").optional(),
  duracionMinutos: numero("Escribe la duración en minutos")
    .pipe(z.number().int("Usa minutos enteros").min(5, "Mínimo 5 minutos").max(480, "Máximo 480 minutos (8 horas)")),
  bufferMinutos: numero("Escribe los minutos de descanso")
    .pipe(z.number().int("Usa minutos enteros").min(0, "No puede ser negativo").max(120, "Máximo 120 minutos")),
  precio: numero("Escribe el precio")
    .pipe(z.number().min(0, "El precio no puede ser negativo")
      .max(9999999, "El precio es demasiado alto")
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Usa como máximo dos decimales (centavos)")),
  orden: numero("Escribe un número de orden")
    .pipe(z.number().int("Usa un número entero").min(1, "El orden empieza en 1")),
});
type ServicioForm = z.infer<typeof schemaServicio>;

const schemaCategoria = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  orden: z.coerce.number().min(1),
});
type CategoriaForm = z.infer<typeof schemaCategoria>;

function agruparPorCategoria(items: ServicioDto[]) {
  return items.reduce<Record<string, ServicioDto[]>>((acc, s) => {
    const cat = s.categoriaNombre ?? "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});
}

export default function ServiciosPage() {
  const terms = useSectorTerms();
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
  const {
    data: servicios = [], isLoading, isError: errorServicios, refetch: reintentarServicios, isFetching: actualizandoServicios,
  } = useQuery({
    queryKey: ["servicios"],
    queryFn: () => serviciosApi.obtenerTodos(true),
  });

  const {
    data: categorias = [], isLoading: cargandoCategorias, isError: errorCategorias,
    refetch: reintentarCategorias, isFetching: actualizandoCategorias,
  } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => categoriasApi.obtenerTodas(),
  });

  // ── Forms servicios ───────────────────────────────────────────────────────
  const descarte = useConfirmarDescarte();
  // Ocultar un servicio lo quita de la página de reservas: se confirma antes.
  const [servicioOcultar, setServicioOcultar] = useState<ServicioDto | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<ServicioForm>({
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
        // `destacado` no está en el formulario: se reenvía para que editar no lo borre.
        ? serviciosApi.actualizar(servicioEdit.id, { ...data, categoriaId: data.categoriaId || undefined, destacado: servicioEdit.destacado })
        : serviciosApi.crear({ ...data, categoriaId: data.categoriaId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicios"] });
      setModal(false);
      toast(`${terms.servicio} guardado`);
    },
    onError: () => toast(`No se pudo guardar el ${terms.servicio.toLowerCase()}. Intenta de nuevo.`, "error"),
  });

  const { mutate: eliminarServicio, isPending: eliminandoServicio } = useMutation({
    mutationFn: (id: string) => serviciosApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servicios"] });
      setServicioEliminar(null);
      toast(`${terms.servicio} eliminado`);
    },
    onError: () => toast(`No se pudo eliminar el ${terms.servicio.toLowerCase()}. Intenta de nuevo.`, "error"),
  });

  // El estado pendiente es por fila: antes una petición en curso desactivaba los
  // interruptores de todos los servicios.
  const toggleActivo = useMutation({
    mutationFn: (s: ServicioDto) => serviciosApi.toggleActivo(s),
    onSuccess: (_, s) => {
      qc.invalidateQueries({ queryKey: ["servicios"] });
      setServicioOcultar(null);
      toast(s.activo ? `${terms.servicio} oculto de la página de reservas` : `${terms.servicio} visible en la página de reservas`);
    },
    onError: () => toast("No se pudo cambiar el estado del servicio. Intenta de nuevo.", "error"),
  });
  const mutToggleActivo = toggleActivo.mutate;
  const activoPendiente = toggleActivo.isPending ? toggleActivo.variables?.id : undefined;

  const toggleDestacado = useMutation({
    mutationFn: (s: ServicioDto) => serviciosApi.toggleDestacado(s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["servicios"] }); },
    onError: () => toast("No se pudo cambiar el destacado. Intenta de nuevo.", "error"),
  });
  const destacadoPendiente = toggleDestacado.isPending ? toggleDestacado.variables?.id : undefined;

  const imagenServicio = useSubirImagen({
    subir: (archivo, id, onProgreso) => serviciosApi.subirImagen(id!, archivo, onProgreso),
    onExito: () => { qc.invalidateQueries({ queryKey: ["servicios"] }); toast("Imagen actualizada"); },
    mensajeFallo: "No se pudo subir la imagen. Intenta de nuevo.",
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
    onError: () => toast("No se pudo guardar la categoría. Intenta de nuevo.", "error"),
  });

  const { mutate: eliminarCategoria, isPending: eliminandoCategoria } = useMutation({
    mutationFn: (id: string) => categoriasApi.eliminar(id),
    onSuccess: () => {
      setCategoriaEliminar(null);
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["servicios"] });
      toast("Categoría eliminada");
    },
    onError: () => toast("No se pudo eliminar la categoría. Intenta de nuevo.", "error"),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  /**
   * La lista se pagina aplanada en el orden en que ya se dibujaba —categoría por
   * categoría— y la página se vuelve a agrupar para conservar los encabezados.
   * Paginar cada grupo por separado habría puesto un paginador por categoría.
   *
   * En el cliente y no en el servidor: el catálogo de un negocio está acotado y
   * esta misma query alimenta los selectores de Empleados y de Citas, así que ya
   * se trae completa.
   */
  const serviciosOrdenados = useMemo(
    () => Object.values(agruparPorCategoria(servicios)).flat(),
    [servicios]
  );
  const paginaServicios = usePaginacionLocal(serviciosOrdenados);
  const gruposVisibles = useMemo(
    () => agruparPorCategoria(paginaServicios.visibles),
    [paginaServicios.visibles]
  );

  const paginaCategorias = usePaginacionLocal(categorias);

  const serviciosPorCategoria = (catId: string) =>
    servicios.filter((s) => s.categoriaId === catId).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-1"
        titulo={terms.servicios}
        subtitulo={`Gestión de ${terms.servicios.toLowerCase()} y categorías`}
        acciones={
          tab === "servicios" ? (
            <BotonAccion onClick={abrirCrearServicio}>
              + Nuevo {terms.servicio.toLowerCase()}
            </BotonAccion>
          ) : (
            <BotonAccion onClick={abrirCrearCategoria}>
              + Nueva categoría
            </BotonAccion>
          )
        }
      />

      {/* Tabs */}
      <Tabs
        etiqueta={`Secciones de ${terms.servicios.toLowerCase()}`}
        valor={tab}
        onChange={setTab}
        className="mb-6"
        opciones={[
          { id: "servicios", label: terms.servicios },
          {
            id: "categorias",
            label: categorias.length > 0 ? `Categorías (${categorias.length})` : "Categorías",
          },
        ]}
      />

      {/* ── Tab Servicios ──────────────────────────────────────────────────── */}
      {tab === "servicios" && (
        isLoading ? (
          <p className="text-gray-400 dark:text-gray-500">Cargando {terms.servicios.toLowerCase()}...</p>
        ) : errorServicios ? (
          <ErrorCarga
            mensaje={`No se pudieron cargar los ${terms.servicios.toLowerCase()}.`}
            onReintentar={() => reintentarServicios()}
            reintentando={actualizandoServicios}
          />
        ) : servicios.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center dark:bg-slate-800 dark:border-slate-700">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-700">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-medium text-gray-700 mb-1 dark:text-gray-300">Aún no tienes {terms.servicios.toLowerCase()}</p>
            <p className="text-sm text-gray-400 mb-5 dark:text-gray-500">Crea tus {terms.servicios.toLowerCase()} para que los clientes puedan reservar</p>
            <button
              onClick={abrirCrearServicio}
              className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Crear primer {terms.servicio.toLowerCase()}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(gruposVisibles).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 dark:text-gray-500">{cat}</p>
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                  className="bg-white rounded-xl border border-gray-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  {items.map((s, i) => (
                    <motion.div
                      key={s.id}
                      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.25 } } }}
                      className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-gray-50 dark:border-slate-700" : ""}`}
                    >
                      {/* Botón con nombre y la cámara siempre visible: sin hover (táctil)
                          y con teclado también se descubre que aquí se cambia la imagen. */}
                      <button
                        type="button"
                        className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 relative group dark:bg-slate-700
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() => { servicioImagenIdRef.current = s.id; imagenInputRef.current?.click(); }}
                        disabled={imagenServicio.subiendoEn(s.id)}
                        aria-label={`Cambiar imagen de ${s.nombre}`}
                        title="Cambiar imagen"
                      >
                        <span className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center">
                          {s.imagenUrl
                            ? <img src={s.imagenUrl} alt="" className="w-full h-full object-cover" />
                            : <svg aria-hidden="true" className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                          }
                        </span>
                        <span aria-hidden="true" className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border text-muted-foreground flex items-center justify-center shadow-sm group-hover:text-foreground transition">
                          <Camera size={11} />
                        </span>
                      </button>
                      {imagenServicio.subiendoEn(s.id) && (
                        <ProgresoSubida className="w-16 shrink-0" porcentaje={imagenServicio.progresoDe(s.id) ?? null} etiqueta={`Subiendo imagen de ${s.nombre}`} />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{s.nombre}</p>
                        {s.descripcion && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 dark:text-gray-500">{s.descripcion}</p>}
                        <p className="text-xs text-gray-400 mt-0.5 dark:text-gray-500">{s.duracionMinutos} min</p>
                        <p className="sm:hidden font-semibold text-gray-800 text-sm mt-1 dark:text-gray-200">{formatPrecio(s.precio)}</p>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                        <span className="hidden sm:inline font-semibold text-gray-800 text-sm dark:text-gray-200">{formatPrecio(s.precio)}</span>
                        <div className="flex items-center gap-2">
                          {/* Interruptor con nombre de acción: "Activo" parecía una
                              insignia y al pulsarlo sacaba el servicio de reservas. */}
                          <div className="flex items-center">
                            <Switch
                              activo={s.activo}
                              onCambiar={() => (s.activo ? setServicioOcultar(s) : mutToggleActivo(s))}
                              disabled={activoPendiente === s.id}
                              etiqueta={`Visible en reservas: ${s.nombre}`}
                            />
                            <span aria-hidden="true" className="hidden md:inline text-xs text-muted-foreground -ml-1">Visible en reservas</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleDestacado.mutate(s)}
                            disabled={destacadoPendiente === s.id}
                            aria-pressed={s.destacado}
                            aria-label={`Destacado: ${s.nombre}`}
                            title={s.destacado ? "Quitar de destacados" : "Mostrar en Destacados de la página pública"}
                            className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-xs font-medium px-2.5 rounded-lg transition disabled:opacity-50
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              s.destacado
                                ? "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Star size={12} fill={s.destacado ? "currentColor" : "none"} aria-hidden="true" />
                            <span className="hidden sm:inline" aria-hidden="true">Destacado</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEditarServicio(s)}
                            aria-label={`Editar ${s.nombre}`}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-xs font-medium px-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil size={12} aria-hidden="true" />
                            <span className="hidden sm:inline" aria-hidden="true">Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setServicioEliminar(s)}
                            aria-label={`Eliminar ${s.nombre}`}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-xs font-medium px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 transition
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Trash2 size={12} aria-hidden="true" />
                            <span className="hidden sm:inline" aria-hidden="true">Eliminar</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            ))}
            {paginaServicios.totalPaginas > 1 && (
              <div className="bg-white rounded-xl border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                <Pagination
                  pagina={paginaServicios.pagina}
                  totalPaginas={paginaServicios.totalPaginas}
                  total={paginaServicios.total}
                  labelTotal={terms.servicios.toLowerCase()}
                  onCambiar={paginaServicios.setPagina}
                  cargando={isLoading}
                />
              </div>
            )}
          </div>
        )
      )}

      {/* ── Tab Categorías ─────────────────────────────────────────────────── */}
      {tab === "categorias" && (
        cargandoCategorias ? (
          <p className="text-gray-400 dark:text-gray-500">Cargando categorías...</p>
        ) : errorCategorias ? (
          <ErrorCarga
            mensaje="No se pudieron cargar las categorías."
            onReintentar={() => reintentarCategorias()}
            reintentando={actualizandoCategorias}
          />
        ) : categorias.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center dark:bg-slate-800 dark:border-slate-700">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-700">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-700 mb-1 dark:text-gray-300">Aún no tienes categorías</p>
            <p className="text-sm text-gray-400 mb-5 dark:text-gray-500">Las categorías agrupan tus servicios en el catálogo público</p>
            <button
              onClick={abrirCrearCategoria}
              className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Crear primera categoría
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {paginaCategorias.visibles.map((c) => {
              const count = serviciosPorCategoria(c.id);
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-slate-700/40 shrink-0" />
                    <span className="font-medium text-gray-800 dark:text-gray-200 flex-1 min-w-0">{c.nombre}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      count > 0 ? "bg-status-confirmed-bg text-status-confirmed-fg" : "bg-status-absent-bg text-status-absent-fg"
                    }`}>
                      {count} {count === 1 ? terms.servicio : terms.servicios}
                    </span>
                  </div>
                  <div className="flex gap-2 pl-4">
                    <button
                      type="button"
                      onClick={() => abrirEditarCategoria(c)}
                      aria-label={`Editar categoría ${c.nombre}`}
                      className="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] text-xs font-medium px-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Pencil size={12} aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoriaEliminar(c)}
                      aria-label={`Eliminar categoría ${c.nombre}`}
                      className="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] text-xs font-medium px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
            {paginaCategorias.totalPaginas > 1 && (
              <div className="bg-white rounded-xl border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                <Pagination
                  pagina={paginaCategorias.pagina}
                  totalPaginas={paginaCategorias.totalPaginas}
                  total={paginaCategorias.total}
                  labelTotal="categorías"
                  onCambiar={paginaCategorias.setPagina}
                  cargando={cargandoCategorias}
                />
              </div>
            )}
          </div>
        )
      )}

      {/* Input oculto para imagen de servicio */}
      <input
        ref={imagenInputRef}
        type="file"
        accept={ACCEPT_IMAGEN}
        className="hidden"
        onChange={(e) => {
          if (servicioImagenIdRef.current) imagenServicio.alElegir(e, servicioImagenIdRef.current);
          else e.target.value = "";
        }}
      />

      {/* Modal servicio */}
      <Modal
        abierto={modal}
        onCerrar={() => descarte.pedirCierre(isDirty, () => setModal(false))}
        titulo={servicioEdit ? `Editar ${terms.servicio.toLowerCase()}` : `Nuevo ${terms.servicio.toLowerCase()}`}
      >
        <form noValidate onSubmit={handleSubmit((d) => guardarServicio(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Nombre *</label>
            <input
              {...register("nombre")}
              aria-invalid={!!errors.nombre}
              className={claseCampo(!!errors.nombre)}
            />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Categoría</label>
            <Select {...register("categoriaId")} value={watch("categoriaId") ?? ""} className="w-full">
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Descripción</label>
            <textarea
              rows={2}
              {...register("descripcion")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="servicio-duracion" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Duración (min) *</label>
              <input
                id="servicio-duracion"
                type="number" min="5" step="5" inputMode="numeric"
                {...register("duracionMinutos")}
                aria-invalid={!!errors.duracionMinutos}
                aria-describedby={errors.duracionMinutos ? "servicio-duracion-error" : undefined}
                className={claseCampo(!!errors.duracionMinutos)}
              />
              {errors.duracionMinutos && <p id="servicio-duracion-error" className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.duracionMinutos.message}</p>}
            </div>
            <div>
              <label htmlFor="servicio-buffer" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Buffer (min)
                <span className="ml-1 text-xs text-gray-500 font-normal dark:text-gray-400">tiempo extra tras la cita</span>
              </label>
              <input
                id="servicio-buffer"
                type="number" min="0" max="120" step="5" inputMode="numeric"
                {...register("bufferMinutos")}
                aria-invalid={!!errors.bufferMinutos}
                aria-describedby={errors.bufferMinutos ? "servicio-buffer-error" : undefined}
                className={claseCampo(!!errors.bufferMinutos)}
              />
              {errors.bufferMinutos && <p id="servicio-buffer-error" className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.bufferMinutos.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="servicio-precio" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Precio (MXN) *</label>
              {/* `step="0.01"`: acepta centavos ($149.90, $99.99). */}
              <input
                id="servicio-precio"
                type="number" min="0" step="0.01" inputMode="decimal"
                {...register("precio")}
                aria-invalid={!!errors.precio}
                aria-describedby={errors.precio ? "servicio-precio-error" : undefined}
                className={claseCampo(!!errors.precio)}
              />
              {errors.precio && <p id="servicio-precio-error" className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.precio.message}</p>}
            </div>
            <div>
              <label htmlFor="servicio-orden" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Orden</label>
              <input
                id="servicio-orden"
                type="number" min="1" inputMode="numeric"
                {...register("orden")}
                aria-invalid={!!errors.orden}
                aria-describedby={errors.orden ? "servicio-orden-error" : undefined}
                className={claseCampo(!!errors.orden)}
              />
              {errors.orden && <p id="servicio-orden-error" className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.orden.message}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={guardandoServicio}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {guardandoServicio ? "Guardando..." : servicioEdit ? "Guardar cambios" : "Crear servicio"}
          </button>
        </form>
      </Modal>

      {/* Confirmar eliminar servicio. Ocultarlo es la alternativa reversible. */}
      <ConfirmarAccion
        abierto={!!servicioEliminar}
        titulo={`Eliminar ${terms.servicio.toLowerCase()}`}
        mensaje={servicioEliminar && (
          <>
            <p className="mb-2">{`¿Seguro que deseas eliminar "${servicioEliminar.nombre}"? Esta acción no se puede deshacer.`}</p>
            {servicioEliminar.activo && (
              <p>{`Si solo quieres dejar de ofrecerlo, apaga "Visible en reservas": se puede volver a activar cuando quieras.`}</p>
            )}
          </>
        )}
        etiquetaConfirmar={`Eliminar ${terms.servicio.toLowerCase()}`}
        destructiva
        pendiente={eliminandoServicio}
        onConfirmar={() => servicioEliminar && eliminarServicio(servicioEliminar.id)}
        onCerrar={() => setServicioEliminar(null)}
      />

      {/* Confirmar eliminar categoría */}
      <ConfirmarAccion
        abierto={!!categoriaEliminar}
        titulo="Eliminar categoría"
        mensaje={categoriaEliminar && (
          <>
            <p className="mb-2">{`¿Seguro que deseas eliminar "${categoriaEliminar.nombre}"? Esta acción no se puede deshacer.`}</p>
            {serviciosPorCategoria(categoriaEliminar.id) > 0 && (
              <p className="text-status-pending-fg bg-status-pending-bg border border-status-pending-dot rounded-lg px-3 py-2">
                {`Esta categoría tiene ${serviciosPorCategoria(categoriaEliminar.id)} ${serviciosPorCategoria(categoriaEliminar.id) === 1 ? terms.servicio.toLowerCase() : terms.servicios.toLowerCase()}. Quedarán sin categoría.`}
              </p>
            )}
          </>
        )}
        etiquetaConfirmar="Eliminar categoría"
        destructiva
        pendiente={eliminandoCategoria}
        onConfirmar={() => categoriaEliminar && eliminarCategoria(categoriaEliminar.id)}
        onCerrar={() => setCategoriaEliminar(null)}
      />

      {/* Modal categoría */}
      <Modal
        abierto={modalCategoria}
        onCerrar={() => descarte.pedirCierre(formCat.formState.isDirty, () => setModalCategoria(false))}
        titulo={categoriaEdit ? "Editar categoría" : "Nueva categoría"}
        ancho="sm"
      >
        <form onSubmit={formCat.handleSubmit((d) => guardarCategoria(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Nombre *</label>
            <input
              {...formCat.register("nombre")}
              placeholder="Ej. Cabello, Uñas, Tratamientos..."
              className={claseCampo(!!formCat.formState.errors.nombre)}
            />
            {formCat.formState.errors.nombre && (
              <p className={CLASE_ERROR_CAMPO}>{formCat.formState.errors.nombre.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Orden</label>
            <input
              type="number" min="1"
              {...formCat.register("orden")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:border-slate-600"
            />
            <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">Número que define el orden en el catálogo público.</p>
          </div>
          <button
            type="submit"
            disabled={guardandoCategoria}
            className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {guardandoCategoria ? "Guardando..." : categoriaEdit ? "Guardar cambios" : "Crear categoría"}
          </button>
        </form>
      </Modal>

      <ConfirmarAccion
        abierto={!!servicioOcultar}
        titulo={`Ocultar ${terms.servicio.toLowerCase()}`}
        mensaje={servicioOcultar && (
          <p>
            {`"${servicioOcultar.nombre}" dejará de aparecer en tu página de reservas y nadie podrá reservarlo hasta que lo vuelvas a activar. Las ${terms.citas.toLowerCase()} ya agendadas no cambian.`}
          </p>
        )}
        etiquetaConfirmar="Ocultar de reservas"
        pendiente={!!servicioOcultar && activoPendiente === servicioOcultar.id}
        onConfirmar={() => servicioOcultar && mutToggleActivo(servicioOcultar)}
        onCerrar={() => setServicioOcultar(null)}
      />

      {descarte.dialogo}
    </div>
  );
}
