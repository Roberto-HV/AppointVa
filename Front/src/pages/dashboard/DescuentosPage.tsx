import { useId, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Tag, Check, Copy } from "lucide-react";
import { descuentosApi, type Descuento } from "../../api/descuentos";
import { negociosApi } from "../../api/negocios";
import { useToastStore } from "../../store/toastStore";
import Pagination from "../../components/ui/Pagination";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import ErrorCarga from "../../components/ui/ErrorCarga";
import { DatePicker } from "../../components/ui/DateTimePicker";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import { useConfirmarDescarte } from "../../hooks/useCambiosSinGuardar";
import { mensajeError } from "../../utils/errores";
import { formatFecha, formatPrecio } from "../../utils/formatters";
import { comoUtc, finDelDiaEnZona, hoy } from "../../utils/fechas";
import { claseCampo, CLASE_ERROR_CAMPO } from "../../lib/clasesCampo";

const TIPOS = [
  { value: "Porcentaje", label: "Porcentaje (%)" },
  { value: "MontoFijo", label: "Monto fijo ($)" },
] as const;

const vacioAIndefinido = (v: unknown) => (v === "" || v === null ? undefined : v);

// Las mismas reglas que ya intentaban los atributos `min`/`max`, que nunca se
// aplicaban porque el panel no era un <form>: un 150% llegaba al servidor.
const schemaCupon = z.object({
  codigo: z.string().trim().min(1, "Escribe un código").max(50, "Máximo 50 caracteres")
    .regex(/^\S+$/, "El código no puede llevar espacios"),
  descripcion: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
  tipo: z.enum(["Porcentaje", "MontoFijo"]),
  valor: z.coerce.number({ error: "Escribe un valor" })
    .positive("El valor debe ser mayor a 0")
    .refine((n) => Math.round(n * 100) === n * 100, "Usa como máximo dos decimales"),
  usoMaximo: z.preprocess(vacioAIndefinido, z.coerce.number().int("Debe ser un número entero").min(1, "Mínimo 1 uso").optional()),
  fechaExpiracion: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.tipo === "Porcentaje" && d.valor > 100) {
    ctx.addIssue({ code: "custom", path: ["valor"], message: "Un porcentaje no puede pasar de 100%" });
  }
  if (d.fechaExpiracion && d.fechaExpiracion < hoy()) {
    ctx.addIssue({ code: "custom", path: ["fechaExpiracion"], message: "La fecha ya pasó" });
  }
});
type CuponForm = z.infer<typeof schemaCupon>;

const VALORES_INICIALES: CuponForm = {
  codigo: "", descripcion: "", tipo: "Porcentaje", valor: "" as unknown as number, usoMaximo: undefined, fechaExpiracion: "",
};

function formatDescuento(desc: Descuento) {
  if (desc.tipo === "Porcentaje") return `${desc.valor}% de descuento`;
  return `${formatPrecio(desc.valor)} de descuento`;
}

export default function DescuentosPage() {
  const idForm = useId();
  const [showForm, setShowForm] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [cuponEliminar, setCuponEliminar] = useState<Descuento | null>(null);
  const descarte = useConfirmarDescarte();
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<CuponForm>({
    resolver: zodResolver(schemaCupon) as Resolver<CuponForm>,
    defaultValues: VALORES_INICIALES,
  });

  const cerrarFormulario = () => descarte.pedirCierre(isDirty, () => { setShowForm(false); reset(VALORES_INICIALES); });

  const { data: descuentos = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["descuentos"],
    queryFn: descuentosApi.getDescuentos,
  });

  // La zona del negocio decide cuándo termina "el día" de la expiración.
  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil-layout"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 5,
  });

  const mutCrear = useMutation({
    mutationFn: (d: CuponForm) =>
      descuentosApi.crear({
        codigo: d.codigo,
        descripcion: d.descripcion || undefined,
        tipo: d.tipo,
        valor: d.valor,
        usoMaximo: d.usoMaximo,
        fechaExpiracion: d.fechaExpiracion ? finDelDiaEnZona(d.fechaExpiracion, perfil?.zonaHoraria) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["descuentos"] });
      setShowForm(false);
      reset(VALORES_INICIALES);
      toast("Cupón creado");
    },
    onError: (err: unknown) => toast(mensajeError(err, "No se pudo crear el cupón"), "error"),
  });

  // El backend lo da de baja y deja de listarlo: no hay forma de reactivarlo,
  // así que se llama "eliminar" en todos lados (antes el diálogo decía
  // "desactivar" y el aviso "eliminado").
  const mutEliminar = useMutation({
    mutationFn: (id: string) => descuentosApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["descuentos"] });
      setCuponEliminar(null);
      toast("Cupón eliminado");
    },
    onError: () => toast("No se pudo eliminar el cupón. Intenta de nuevo.", "error"),
  });

  const copiarCodigo = (codigo: string) => {
    void navigator.clipboard?.writeText(codigo);
    setCopiado(codigo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const vigente = (d: Descuento) => !d.agotado && !d.expirado;

  // Se pagina la lista aplanada —activos y después inactivos, el mismo orden que
  // ya tenía— con un solo paginador, para que una página sean 15 cupones y no 15
  // por sección. Los encabezados siguen contando el grupo completo, por eso
  // dicen "en total": partida en páginas, "Activos (12)" se leería como "los que
  // hay aquí abajo".
  const { activos, inactivos, ordenados } = useMemo(() => {
    const activos = descuentos.filter(vigente);
    const inactivos = descuentos.filter((d) => !vigente(d));
    return { activos, inactivos, ordenados: [...activos, ...inactivos] };
  }, [descuentos]);

  const paginados = usePaginacionLocal(ordenados);
  const activosVisibles = paginados.visibles.filter(vigente);
  const inactivosVisibles = paginados.visibles.filter((d) => !vigente(d));

  const tipo = watch("tipo");
  const codigo = watch("codigo");
  const valor = watch("valor");
  const fechaExpiracion = watch("fechaExpiracion") ?? "";
  const id = (campo: string) => `${idForm}-${campo}`;
  const describir = (campo: keyof CuponForm) => (errors[campo] ? `${id(campo)}-error` : undefined);
  const errorDe = (campo: keyof CuponForm) =>
    errors[campo] ? <p id={`${id(campo)}-error`} className={CLASE_ERROR_CAMPO}>{errors[campo]?.message}</p> : null;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <EncabezadoPagina
        titulo="Cupones de descuento"
        subtitulo="Los clientes ingresan el código al reservar para obtener un descuento"
        acciones={
          <BotonAccion onClick={() => setShowForm(true)}>
            <Plus size={16} /> Nuevo cupón
          </BotonAccion>
        }
      />

      {/* El mismo modal + react-hook-form/zod que el resto del panel. */}
      <Modal abierto={showForm} onCerrar={cerrarFormulario} titulo="Nuevo cupón" ancho="lg">
        <form noValidate onSubmit={handleSubmit((d) => mutCrear.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={id("codigo")} className="text-sm font-medium text-slate-700 dark:text-slate-300">Código</label>
              <input
                id={id("codigo")}
                value={codigo}
                onChange={(e) => setValue("codigo", e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: isSubmitted })}
                placeholder="PROMO20"
                maxLength={50}
                aria-invalid={!!errors.codigo || undefined}
                aria-describedby={describir("codigo")}
                className={claseCampo(!!errors.codigo, "mt-1 font-mono uppercase")}
              />
              {errorDe("codigo")}
            </div>
            <div>
              <label htmlFor={id("descripcion")} className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
              <input
                id={id("descripcion")}
                {...register("descripcion")}
                placeholder="Descuento de bienvenida"
                aria-invalid={!!errors.descripcion || undefined}
                aria-describedby={describir("descripcion")}
                className={claseCampo(!!errors.descripcion, "mt-1")}
              />
              {errorDe("descripcion")}
            </div>
            <div>
              <label htmlFor={id("tipo")} className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
              <Select id={id("tipo")} {...register("tipo")} value={tipo} className="mt-1 w-full">
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor={id("valor")} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Valor {tipo === "Porcentaje" ? "(%)" : "($)"}
              </label>
              <input
                id={id("valor")}
                type="number"
                inputMode="decimal"
                step="0.01"
                {...register("valor")}
                placeholder={tipo === "Porcentaje" ? "20" : "50"}
                aria-invalid={!!errors.valor || undefined}
                aria-describedby={describir("valor")}
                className={claseCampo(!!errors.valor, "mt-1")}
              />
              {errorDe("valor")}
            </div>
            <div>
              <label htmlFor={id("usoMaximo")} className="text-sm font-medium text-slate-700 dark:text-slate-300">Límite de usos (opcional)</label>
              <input
                id={id("usoMaximo")}
                type="number"
                inputMode="numeric"
                {...register("usoMaximo")}
                placeholder="Sin límite"
                aria-invalid={!!errors.usoMaximo || undefined}
                aria-describedby={describir("usoMaximo")}
                className={claseCampo(!!errors.usoMaximo, "mt-1")}
              />
              {errorDe("usoMaximo")}
            </div>
            <div>
              <span id={id("fecha-etiqueta")} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Válido hasta (incluido, opcional)
              </span>
              <DatePicker
                value={fechaExpiracion}
                onChange={(v) => setValue("fechaExpiracion", v, { shouldDirty: true, shouldValidate: isSubmitted })}
                minDate={hoy()}
                ariaLabel="Válido hasta (incluido)"
                error={errors.fechaExpiracion?.message}
              />
              <p className="text-xs text-muted-foreground mt-1">Se acepta hasta las 23:59 de ese día, hora del negocio.</p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={cerrarFormulario}
              className="min-h-[44px] lg:min-h-[36px] px-4 text-sm text-foreground border border-border hover:bg-muted rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!codigo.trim() || valor === undefined || String(valor) === "" || mutCrear.isPending}
              className="min-h-[44px] lg:min-h-[36px] inline-flex items-center justify-center gap-1 px-4 bg-slate-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check size={15} aria-hidden="true" /> {mutCrear.isPending ? "Creando…" : "Crear cupón"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Lista activos */}
      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando cupones">
          {[0, 1, 2].map((i) => <div key={i} className="h-[76px] rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : isError ? (
        <ErrorCarga mensaje="No se pudieron cargar los cupones." onReintentar={() => refetch()} reintentando={isFetching} />
      ) : descuentos.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p className="font-medium">No hay cupones configurados</p>
          <p className="text-sm mt-1">Crea cupones para ofrecer descuentos a tus clientes</p>
        </div>
      ) : (
        <>
          {activosVisibles.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Activos · {activos.length} en total</h2>
              {activosVisibles.map((d) => (
                <DescuentoRow
                  key={d.id}
                  descuento={d}
                  copiado={copiado === d.codigo}
                  onCopiar={() => copiarCodigo(d.codigo)}
                  onEliminar={() => setCuponEliminar(d)}
                />
              ))}
            </div>
          )}
          {inactivosVisibles.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Inactivos / expirados · {inactivos.length} en total</h2>
              {inactivosVisibles.map((d) => (
                <DescuentoRow
                  key={d.id}
                  descuento={d}
                  copiado={copiado === d.codigo}
                  onCopiar={() => copiarCodigo(d.codigo)}
                  onEliminar={() => setCuponEliminar(d)}
                />
              ))}
            </div>
          )}
          {paginados.totalPaginas > 1 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl">
              <Pagination
                pagina={paginados.pagina}
                totalPaginas={paginados.totalPaginas}
                total={paginados.total}
                labelTotal="cupones"
                onCambiar={paginados.setPagina}
                cargando={isLoading}
              />
            </div>
          )}
        </>
      )}

      {/* OM-17 (DECISION NEEDED): si los cupones deben poder reactivarse. Hoy no se puede. */}
      <ConfirmarAccion
        abierto={!!cuponEliminar}
        titulo="Eliminar cupón"
        mensaje={cuponEliminar && (
          <p>{`El cupón ${cuponEliminar.codigo} dejará de aceptarse al reservar y desaparecerá de esta lista. No se puede reactivar: para volver a ofrecerlo tendrás que crearlo de nuevo.`}</p>
        )}
        etiquetaConfirmar="Eliminar cupón"
        destructiva
        pendiente={mutEliminar.isPending}
        onConfirmar={() => cuponEliminar && mutEliminar.mutate(cuponEliminar.id)}
        onCerrar={() => setCuponEliminar(null)}
      />
      {descarte.dialogo}
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
    <div className={`bg-white dark:bg-slate-800 border rounded-xl p-4 flex items-center gap-4 ${inactivo ? "border-slate-100 dark:border-slate-700 opacity-60" : "border-slate-200 dark:border-slate-600"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">{d.codigo}</span>
          <span className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full font-medium">
            {formatDescuento(d)}
          </span>
          {d.agotado && <span className="text-xs bg-status-cancelled-bg text-status-cancelled-fg px-2 py-0.5 rounded-full">Agotado</span>}
          {d.expirado && <span className="text-xs bg-status-absent-bg text-status-absent-fg px-2 py-0.5 rounded-full">Expirado</span>}
        </div>
        {d.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{d.descripcion}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>Usos: {d.usoActual}{d.usoMaximo ? ` / ${d.usoMaximo}` : ""}</span>
          {d.fechaExpiracion && (
            // El backend guarda la expiración en UTC sin "Z".
            <span>Válido hasta: {formatFecha(comoUtc(d.fechaExpiracion))}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onCopiar}
          aria-label={copiado ? `Código ${d.codigo} copiado` : `Copiar código ${d.codigo}`}
          title="Copiar código"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-slate-500 dark:text-slate-400 hover:text-foreground hover:bg-muted rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copiado ? <Check size={15} className="text-green-600 dark:text-green-400" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onEliminar}
          aria-label={`Eliminar cupón ${d.codigo}`}
          title="Eliminar"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
