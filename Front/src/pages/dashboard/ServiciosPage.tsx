import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, ClipboardList, GripVertical, Pencil, Star, Tag, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEntradaAnimada } from "../../hooks/useEntradaAnimada";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import Tabs from "../../components/ui/Tabs";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { serviciosApi, categoriasApi } from "../../api/servicios";
import Modal from "../../components/ui/Modal";
import ModalAcciones from "../../components/ui/ModalAcciones";
import { BOTON_MODAL_PRIMARIO, BOTON_MODAL_SECUNDARIO } from "../../components/ui/botonesModal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import DialogoEliminarConCitas from "../../components/dashboard/DialogoEliminarConCitas";
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
import MenuAcciones from "../../components/ui/MenuAcciones";
import { SkeletonServicios } from "../../components/ui/Skeleton";
import { aplicarOrden, cambiosDeOrden, type CambioOrden } from "../../lib/ordenServicios";
import ErrorCarga from "../../components/ui/ErrorCarga";
import EmptyState from "../../components/ui/EmptyState";
import { mensajeError } from "../../utils/errores";

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
  const entrada = useEntradaAnimada();
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
    // Sin campo "Orden" en el formulario: el nuevo entra al final del catálogo.
    const ultimo = servicios.reduce((max, s) => Math.max(max, s.orden), 0);
    reset({ nombre: "", categoriaId: "", descripcion: "", duracionMinutos: 30, bufferMinutos: 0, precio: 0, orden: ultimo + 1 });
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
    // 409: el servidor también bloquea el borrado con citas futuras y explica por qué.
    onError: (err: unknown) => toast(mensajeError(err, `No se pudo eliminar el ${terms.servicio.toLowerCase()}. Intenta de nuevo.`), "error"),
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

  // ── Orden (M11) ───────────────────────────────────────────────────────────
  // El campo numérico "Orden" salió del formulario: se ordena moviendo filas
  // dentro de su categoría, arrastrando el asa o con "Mover arriba / abajo".
  const categoriasCompletas = useMemo(() => agruparPorCategoria(servicios), [servicios]);
  const hermanos = (s: ServicioDto) => categoriasCompletas[s.categoriaNombre ?? "Sin categoría"] ?? [];
  const posicion = (s: ServicioDto) => hermanos(s).findIndex((x) => x.id === s.id);
  const [arrastrado, setArrastrado] = useState<ServicioDto | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  // No hay endpoint de reorden en lote: es un PUT por servicio, en serie.
  // `enCurso` cierra el paso en el mismo tick del clic o del soltar, antes de
  // que `isPending` llegue al render: dos movimientos intercalados mezclarían
  // sus PUT y el orden final dependería de cuál responde al último.
  const enCurso = useRef(false);
  const reordenar = useMutation({
    mutationFn: async (cambios: CambioOrden[]) => {
      for (const c of cambios) {
        // El PUT reemplaza el servicio completo: se arma con la copia más reciente
        // de la caché, no con la que se capturó al arrastrar o abrir el menú, para
        // no pisar lo que otra edición haya guardado mientras tanto.
        const reciente = qc.getQueryData<ServicioDto[]>(["servicios"])?.find((x) => x.id === c.servicio.id);
        await serviciosApi.cambiarOrden(reciente ?? c.servicio, c.orden);
      }
    },
    // Se mueve al momento y se guarda detrás. Se cancela el refetch en vuelo para
    // que no pise el movimiento optimista con la lista vieja.
    onMutate: async (cambios) => {
      await qc.cancelQueries({ queryKey: ["servicios"] });
      const previos = qc.getQueryData<ServicioDto[]>(["servicios"]);
      qc.setQueryData<ServicioDto[]>(["servicios"], (prev) => (prev ? aplicarOrden(prev, cambios) : prev));
      return { previos };
    },
    // Si falla, la lista vuelve a como estaba y el refetch de onSettled trae lo
    // que el servidor sí alcanzó a guardar (los PUT anteriores al que falló).
    onError: (_e, _cambios, contexto) => {
      if (contexto?.previos) qc.setQueryData(["servicios"], contexto.previos);
      toast(`No se pudo cambiar el orden. Intenta de nuevo.`, "error");
    },
    onSettled: () => {
      enCurso.current = false;
      return qc.invalidateQueries({ queryKey: ["servicios"] });
    },
  });
  const moviendo = reordenar.isPending;
  const moverServicio = (s: ServicioDto, delta: number) => {
    if (enCurso.current || moviendo) return;
    const desde = posicion(s);
    const cambios = cambiosDeOrden(hermanos(s), desde, desde + delta);
    if (cambios.length === 0) return;
    enCurso.current = true;
    reordenar.mutate(cambios);
  };

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
          // Filas con imagen, precio y controles, como la lista real (I14).
          <SkeletonServicios />
        ) : errorServicios ? (
          <ErrorCarga
            mensaje={`No se pudieron cargar los ${terms.servicios.toLowerCase()}.`}
            onReintentar={() => reintentarServicios()}
            reintentando={actualizandoServicios}
          />
        ) : servicios.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
            <EmptyState
              icon={<ClipboardList size={40} strokeWidth={1.5} />}
              title={`Aún no tienes ${terms.servicios.toLowerCase()}`}
              description={`Crea tus ${terms.servicios.toLowerCase()} para que los clientes puedan reservar`}
              action={
                <BotonAccion variante="primaria" onClick={abrirCrearServicio}>
                  {`Crear primer ${terms.servicio.toLowerCase()}`}
                </BotonAccion>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(gruposVisibles).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 dark:text-slate-500">{cat}</p>
                <motion.div
                  {...entrada}
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                  className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  {items.map((s, i) => (
                    <motion.div
                      key={s.id}
                      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.25 } } }}
                      // Destino del arrastre: solo filas de la misma categoría.
                      onDragOver={(e) => {
                        if (!arrastrado || arrastrado.id === s.id || (arrastrado.categoriaNombre ?? null) !== (s.categoriaNombre ?? null)) return;
                        e.preventDefault();
                        if (sobre !== s.id) setSobre(s.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        // Con un reorden pendiente se ignora, igual que "Mover arriba / abajo".
                        if (arrastrado && arrastrado.id !== s.id && !moviendo) moverServicio(arrastrado, posicion(s) - posicion(arrastrado));
                        setArrastrado(null); setSobre(null);
                      }}
                      data-sobre={sobre === s.id || undefined}
                      // Móvil: imagen + nombre/descripción arriba y, en su propia línea,
                      // precio · duración y acciones. Desde sm todo va en una fila.
                      className={`flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-x-3 gap-y-2 px-4 sm:pl-1 py-3 transition-colors ${
                        i < items.length - 1 ? "border-b border-slate-50 dark:border-slate-700" : ""
                      } ${sobre === s.id ? "bg-muted ring-2 ring-inset ring-ring/40 rounded-lg" : ""} ${arrastrado?.id === s.id ? "opacity-50" : ""}`}
                    >
                      {/* Asa para ordenar arrastrando (M11), solo con puntero fino: el
                          arrastre nativo no existe en pantallas táctiles, ahí se mueve
                          con "Mover arriba / abajo" del menú "⋯". */}
                      <span
                        draggable={hermanos(s).length > 1}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", s.id);
                          setArrastrado(s);
                        }}
                        onDragEnd={() => { setArrastrado(null); setSobre(null); }}
                        title={hermanos(s).length > 1 ? "Arrastra para cambiar el orden" : undefined}
                        aria-hidden="true"
                        className={`hidden sm:flex items-center justify-center w-6 self-stretch shrink-0 rounded text-slate-300 dark:text-slate-600 ${
                          hermanos(s).length > 1 ? "cursor-grab active:cursor-grabbing hover:text-muted-foreground" : "invisible"
                        }`}
                      >
                        <GripVertical size={16} />
                      </span>
                      {/* Botón con nombre y la cámara siempre visible: sin hover (táctil)
                          y con teclado también se descubre que aquí se cambia la imagen. */}
                      <button
                        type="button"
                        className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 relative group dark:bg-slate-700
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        onClick={() => { servicioImagenIdRef.current = s.id; imagenInputRef.current?.click(); }}
                        disabled={imagenServicio.subiendoEn(s.id)}
                        aria-label={`Cambiar imagen de ${s.nombre}`}
                        title="Cambiar imagen"
                      >
                        <span className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center">
                          {s.imagenUrl
                            ? <img src={s.imagenUrl} alt="" className="w-full h-full object-cover" />
                            : <svg aria-hidden="true" className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                      <div className="flex-1 min-w-0 basis-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 break-words">
                          {s.nombre}
                          {/* Destacado ya no es un botón en la fila: queda como insignia. */}
                          {s.destacado && (
                            <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              <Star size={10} fill="currentColor" aria-hidden="true" /> Destacado
                            </span>
                          )}
                        </p>
                        {s.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-3 sm:line-clamp-2 break-words dark:text-slate-400">{s.descripcion}</p>}
                        <p className="hidden sm:block text-xs text-slate-500 mt-0.5 tabular-nums dark:text-slate-400">{s.duracionMinutos} min</p>
                      </div>
                      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 sm:gap-5 sm:shrink-0">
                        <p className="sm:hidden text-sm tabular-nums">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{formatPrecio(s.precio)}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400"> · {s.duracionMinutos} min</span>
                        </p>
                        <span className="hidden sm:inline font-semibold text-slate-800 text-sm tabular-nums dark:text-slate-200">{formatPrecio(s.precio)}</span>
                        <div className="flex items-center gap-2">
                          {/* Interruptor con nombre de acción: "Activo" parecía una
                              insignia y al pulsarlo sacaba el servicio de reservas. */}
                          {/* El riel del switch ocupa todo su botón de 44 px: el
                              texto va al lado con su propio hueco (`gap-2`). El
                              `-ml-1` de antes lo metía bajo el riel y se leía
                              "isible en reservas". */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              activo={s.activo}
                              onCambiar={() => (s.activo ? setServicioOcultar(s) : mutToggleActivo(s))}
                              disabled={activoPendiente === s.id}
                              etiqueta={`Visible en reservas: ${s.nombre}`}
                            />
                            <span aria-hidden="true" className="hidden md:inline text-xs text-muted-foreground whitespace-nowrap">Visible en reservas</span>
                          </div>
                          {/* Editar sigue a la vista; Destacado, mover y Eliminar van en
                              "⋯", como los tipos de evento de Calendly (I9). Eliminar
                              conserva su confirmación. */}
                          <button
                            type="button"
                            onClick={() => abrirEditarServicio(s)}
                            aria-label={`Editar ${s.nombre}`}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-xs font-medium px-2.5 rounded-xl border border-border dark:border-slate-600 text-foreground hover:bg-muted transition
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Pencil size={12} aria-hidden="true" />
                            <span className="hidden sm:inline" aria-hidden="true">Editar</span>
                          </button>
                          <MenuAcciones
                            etiqueta={`Más acciones de ${s.nombre}`}
                            acciones={[
                              {
                                id: "destacado",
                                etiqueta: s.destacado ? "Quitar de destacados" : "Marcar como destacado",
                                Icono: Star,
                                deshabilitada: destacadoPendiente === s.id,
                                onSelect: () => toggleDestacado.mutate(s),
                              },
                              ...(posicion(s) > 0 ? [{
                                id: "subir", etiqueta: "Mover arriba", Icono: ArrowUp,
                                deshabilitada: moviendo, onSelect: () => moverServicio(s, -1),
                              }] : []),
                              ...(posicion(s) < hermanos(s).length - 1 ? [{
                                id: "bajar", etiqueta: "Mover abajo", Icono: ArrowDown,
                                deshabilitada: moviendo, onSelect: () => moverServicio(s, 1),
                              }] : []),
                              {
                                id: "eliminar",
                                etiqueta: `Eliminar ${terms.servicio.toLowerCase()}`,
                                Icono: Trash2,
                                destructiva: true,
                                onSelect: () => setServicioEliminar(s),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            ))}
            {paginaServicios.totalPaginas > 1 && (
              <div className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
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
          <p className="text-slate-400 dark:text-slate-500">Cargando categorías...</p>
        ) : errorCategorias ? (
          <ErrorCarga
            mensaje="No se pudieron cargar las categorías."
            onReintentar={() => reintentarCategorias()}
            reintentando={actualizandoCategorias}
          />
        ) : categorias.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
            <EmptyState
              icon={<Tag size={40} strokeWidth={1.5} />}
              title="Aún no tienes categorías"
              description="Las categorías agrupan tus servicios en el catálogo público"
              action={
                <BotonAccion variante="primaria" onClick={abrirCrearCategoria}>
                  Crear primera categoría
                </BotonAccion>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {paginaCategorias.visibles.map((c) => {
              const count = serviciosPorCategoria(c.id);
              return (
                <div key={c.id} className="bg-white rounded-xl border border-slate-100 px-4 py-3 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-slate-700/40 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 flex-1 min-w-0">{c.nombre}</span>
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
              <div className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
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
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Nombre *</label>
            <input
              {...register("nombre")}
              aria-invalid={!!errors.nombre}
              className={claseCampo(!!errors.nombre)}
            />
            {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Categoría</label>
            <Select {...register("categoriaId")} value={watch("categoriaId") ?? ""} className="w-full">
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Descripción</label>
            <textarea
              rows={2}
              {...register("descripcion")}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-brand resize-none dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="servicio-duracion" className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Duración (min) *</label>
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
              {/* Etiqueta corta, de una línea como "Duración (min)": la larga se partía
                  en dos y bajaba el campo respecto al de al lado (M11). La
                  explicación va en la ayuda de abajo. */}
              <label htmlFor="servicio-buffer" className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
                Descanso (min)
              </label>
              <input
                id="servicio-buffer"
                type="number" min="0" max="120" step="5" inputMode="numeric"
                {...register("bufferMinutos")}
                aria-invalid={!!errors.bufferMinutos}
                aria-describedby={errors.bufferMinutos ? "servicio-buffer-error servicio-buffer-ayuda" : "servicio-buffer-ayuda"}
                className={claseCampo(!!errors.bufferMinutos)}
              />
              {errors.bufferMinutos && <p id="servicio-buffer-error" className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.bufferMinutos.message}</p>}
            </div>
            <p id="servicio-buffer-ayuda" className="col-span-2 -mt-1 text-xs text-muted-foreground">
              El descanso es tiempo libre que se aparta después de cada cita, para limpiar o preparar.
            </p>
          </div>
          {/* Sin campo "Orden": el lugar en el catálogo se cambia moviendo la fila en
              la lista (M11). Un servicio nuevo entra al final. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="servicio-precio" className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Precio (MXN) *</label>
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
          </div>

          <ModalAcciones>
            <button type="button" onClick={() => descarte.pedirCierre(isDirty, () => setModal(false))} className={BOTON_MODAL_SECUNDARIO}>
              Cancelar
            </button>
            <button type="submit" disabled={guardandoServicio} className={BOTON_MODAL_PRIMARIO}>
              {guardandoServicio ? "Guardando..." : servicioEdit ? "Guardar cambios" : "Crear servicio"}
            </button>
          </ModalAcciones>
        </form>
      </Modal>

      {/* Eliminar servicio (decisión 7, OM-17): se bloquea si tiene citas
          abiertas desde hoy, y ocultarlo (reversible) es la acción principal. */}
      <DialogoEliminarConCitas
        abierto={!!servicioEliminar}
        titulo={`Eliminar ${terms.servicio.toLowerCase()}`}
        filtro={servicioEliminar ? { servicioId: servicioEliminar.id } : null}
        terminoCitas={{ singular: terms.cita.toLowerCase(), plural: terms.citas.toLowerCase() }}
        mensaje={servicioEliminar && (
          <p>{`¿Seguro que deseas eliminar "${servicioEliminar.nombre}"? Esta acción no se puede deshacer.`}</p>
        )}
        alternativa={servicioEliminar?.activo ? {
          etiqueta: "Ocultar de reservas",
          descripcion: "Si solo quieres dejar de ofrecerlo, ocúltalo de tu página de reservas: se puede volver a activar cuando quieras.",
          pendiente: activoPendiente === servicioEliminar.id,
          onSelect: () => mutToggleActivo(servicioEliminar, { onSuccess: () => setServicioEliminar(null) }),
        } : undefined}
        etiquetaEliminar={`Eliminar ${terms.servicio.toLowerCase()}`}
        eliminando={eliminandoServicio}
        onEliminar={() => servicioEliminar && eliminarServicio(servicioEliminar.id)}
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
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Nombre *</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Orden</label>
            <input
              type="number" min="1"
              {...formCat.register("orden")}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-brand dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
            />
            <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">Número que define el orden en el catálogo público.</p>
          </div>
          <ModalAcciones>
            <button type="button" onClick={() => descarte.pedirCierre(formCat.formState.isDirty, () => setModalCategoria(false))} className={BOTON_MODAL_SECUNDARIO}>
              Cancelar
            </button>
            <button type="submit" disabled={guardandoCategoria} className={BOTON_MODAL_PRIMARIO}>
              {guardandoCategoria ? "Guardando..." : categoriaEdit ? "Guardar cambios" : "Crear categoría"}
            </button>
          </ModalAcciones>
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
