import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { adminApi, type NegocioMetricasDto, type PlanDto } from "../../api/admin";
import Modal from "../../components/ui/Modal";
import { useToastStore } from "../../store/toastStore";
import { formatPrecio } from "../../utils/formatters";

const schemaNegocio = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  slug: z
    .string()
    .min(2, "Slug requerido")
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  descripcion: z.string().optional(),
  planId: z.string().optional(),
});
type NegocioForm = z.infer<typeof schemaNegocio>;

const schemaPropietario = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  apellido: z.string().default(""),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type PropietarioForm = z.infer<typeof schemaPropietario>;

function BarraProgreso({ valor, maximo, label }: { valor: number; maximo: number; label: string }) {
  const pct = maximo > 0 ? Math.min(Math.round((valor / maximo) * 100), 100) : 0;
  const colorBarra = pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";
  const colorTexto = pct >= 85 ? "text-red-600 font-semibold" : pct >= 60 ? "text-amber-600 font-semibold" : "text-gray-500";
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={colorTexto}>{valor} / {maximo} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorBarra}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TarjetaNegocio({
  negocio,
  onActivar,
  onDesactivar,
  onEliminar,
  onCrearPropietario,
  onColores,
}: {
  negocio: NegocioMetricasDto;
  onActivar: () => void;
  onDesactivar: () => void;
  onEliminar: () => void;
  onCrearPropietario: () => void;
  onColores: () => void;
}) {
  const esActivo = negocio.activo === 1;
  const iniciales = negocio.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
          {negocio.logoUrl ? (
            <img src={negocio.logoUrl} alt={negocio.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-slate-600">{iniciales}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{negocio.nombre}</p>
          <p className="text-xs text-gray-400 truncate">{negocio.slug}</p>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            esActivo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {esActivo ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Plan */}
      <div className="px-4 pb-3">
        <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
          {negocio.planNombre ?? "Sin plan"}
        </span>
      </div>

      {/* Métricas */}
      <div className="px-4 pb-4 flex-1">
        {negocio.maxCitasMes > 0 && (
          <BarraProgreso valor={negocio.citasMes} maximo={negocio.maxCitasMes} label="Citas este mes" />
        )}
        {negocio.maxEmpleados > 0 && (
          <BarraProgreso valor={negocio.empleadosActivos} maximo={negocio.maxEmpleados} label="Empleados" />
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-gray-400">Emails este mes:</span>
          <span
            className={`text-xs font-semibold ${
              negocio.emailsMes > 200 ? "text-red-600" : negocio.emailsMes > 100 ? "text-amber-600" : "text-gray-600"
            }`}
          >
            {negocio.emailsMes}
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap gap-2">
        <button
          onClick={esActivo ? onDesactivar : onActivar}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
            esActivo
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {esActivo ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={onColores}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
        >
          Colores
        </button>
        <button
          onClick={onCrearPropietario}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
        >
          + Propietario
        </button>
        <a
          href={`/b/${negocio.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
        >
          Ver booking
        </a>
        <button
          onClick={onEliminar}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition ml-auto"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

export default function NegociosAdminPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [modalNegocio, setModalNegocio] = useState(false);
  const [modalPropietario, setModalPropietario] = useState(false);
  const [modalColores, setModalColores] = useState(false);
  const [negocioSel, setNegocioSel] = useState<NegocioMetricasDto | null>(null);
  const [negocioEliminar, setNegocioEliminar] = useState<NegocioMetricasDto | null>(null);
  const [errorPropietario, setErrorPropietario] = useState("");
  const [mostrarPasswordProp, setMostrarPasswordProp] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#C8A961");
  const [colorSecundario, setColorSecundario] = useState("#a07830");

  const { data: metricas = [], isLoading } = useQuery({
    queryKey: ["admin-negocios-metricas"],
    queryFn: adminApi.obtenerMetricas,
    staleTime: 1000 * 60 * 2,
  });

  const { data: planes = [] } = useQuery({
    queryKey: ["planes"],
    queryFn: adminApi.obtenerPlanes,
  });

  const formNegocio = useForm<NegocioForm>({ resolver: zodResolver(schemaNegocio) });
  const formPropietario = useForm<PropietarioForm>({ resolver: zodResolver(schemaPropietario) as Resolver<PropietarioForm> });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
    qc.invalidateQueries({ queryKey: ["admin-negocios"] });
  };

  const { mutate: crearNegocio, isPending: creandoNegocio } = useMutation({
    mutationFn: (d: NegocioForm) =>
      adminApi.crearNegocio({
        ...d,
        email: d.email || undefined,
        planId: d.planId || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setModalNegocio(false);
      formNegocio.reset();
      toast("Negocio creado correctamente");
    },
  });

  const { mutate: activar } = useMutation({
    mutationFn: (id: string) => adminApi.activar(id),
    onSuccess: invalidar,
  });

  const { mutate: desactivar } = useMutation({
    mutationFn: (id: string) => adminApi.desactivar(id),
    onSuccess: invalidar,
  });

  const { mutate: eliminar, isPending: eliminando } = useMutation({
    mutationFn: (id: string) => adminApi.eliminar(id),
    onSuccess: () => {
      invalidar();
      setNegocioEliminar(null);
      toast("Negocio eliminado");
    },
  });

  const { mutate: actualizarColores, isPending: guardandoColores } = useMutation({
    mutationFn: () =>
      adminApi.actualizarColores(negocioSel!.id, {
        colorPrimario: colorPrimario || undefined,
        colorSecundario: colorSecundario || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setModalColores(false);
      toast("Colores actualizados");
    },
  });

  const abrirColores = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setColorPrimario(neg.colorPrimario ?? "#C8A961");
    setColorSecundario(neg.colorSecundario ?? "#a07830");
    setModalColores(true);
  };

  const { mutate: crearPropietario, isPending: creandoPropietario } = useMutation({
    mutationFn: (d: PropietarioForm) =>
      adminApi.crearPropietario(negocioSel!.id, {
        email: d.email,
        password: d.password,
        nombre: d.nombre,
        apellido: d.apellido ?? "",
      }),
    onSuccess: () => {
      setModalPropietario(false);
      formPropietario.reset();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      setErrorPropietario(msg ?? "No se pudo crear el propietario.");
    },
  });

  const abrirPropietario = (neg: NegocioMetricasDto) => {
    setNegocioSel(neg);
    setErrorPropietario("");
    formPropietario.reset({ nombre: "", apellido: "", email: "", password: "" });
    setModalPropietario(true);
  };

  const metricasFiltradas = metricas.filter(
    (n) =>
      n.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.slug.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Negocios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{metricas.length} registrados en total</p>
        </div>
        <button
          onClick={() => { formNegocio.reset(); setModalNegocio(true); }}
          className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          + Nuevo negocio
        </button>
      </div>

      {/* Buscador */}
      <input
        type="text"
        placeholder="Buscar por nombre o slug..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full max-w-sm px-4 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 mb-6"
      />

      {/* Grid de tarjetas */}
      {isLoading ? (
        <p className="text-gray-400">Cargando negocios...</p>
      ) : metricasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400">
            {busqueda ? "Sin resultados para esa búsqueda" : "No hay negocios registrados"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {metricasFiltradas.map((neg) => (
            <TarjetaNegocio
              key={neg.id}
              negocio={neg}
              onActivar={() => activar(neg.id)}
              onDesactivar={() => desactivar(neg.id)}
              onEliminar={() => setNegocioEliminar(neg)}
              onCrearPropietario={() => abrirPropietario(neg)}
              onColores={() => abrirColores(neg)}
            />
          ))}
        </div>
      )}

      {/* Modal: nuevo negocio */}
      <Modal
        abierto={modalNegocio}
        onCerrar={() => setModalNegocio(false)}
        titulo="Nuevo negocio"
      >
        <form onSubmit={formNegocio.handleSubmit((d) => crearNegocio(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              {...formNegocio.register("nombre")}
              placeholder="Barbería Luis"
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${formNegocio.formState.errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formNegocio.formState.errors.nombre && (
              <p className="text-red-500 text-xs mt-1">{formNegocio.formState.errors.nombre.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *{" "}
              <span className="font-normal text-gray-400">
                (aparece en la URL: /b/<strong>slug</strong>)
              </span>
            </label>
            <input
              {...formNegocio.register("slug")}
              placeholder="barberia-luis"
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary font-mono
                ${formNegocio.formState.errors.slug ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formNegocio.formState.errors.slug && (
              <p className="text-red-500 text-xs mt-1">{formNegocio.formState.errors.slug.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                {...formNegocio.register("telefono")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                {...formNegocio.register("email")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <Select {...formNegocio.register("planId")} className="w-full">
              <option value="">Sin plan asignado</option>
              {planes.map((p: PlanDto) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatPrecio(p.precioMensual)}/mes · {p.maxEmpleados} empleados
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={2}
              {...formNegocio.register("descripcion")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={creandoNegocio}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {creandoNegocio ? "Creando..." : "Crear negocio"}
          </button>
        </form>
      </Modal>

      {/* Modal: crear propietario */}
      <Modal
        abierto={modalPropietario}
        onCerrar={() => setModalPropietario(false)}
        titulo="Crear propietario"
        ancho="sm"
      >
        <p className="text-sm text-gray-500 mb-4">
          Crea la cuenta de acceso para el propietario de{" "}
          <strong>{negocioSel?.nombre}</strong>.
        </p>

        <form
          onSubmit={formPropietario.handleSubmit((d) => crearPropietario(d))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...formPropietario.register("nombre")}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                  ${formPropietario.formState.errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              />
              {formPropietario.formState.errors.nombre && (
                <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.nombre.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                {...formPropietario.register("apellido")}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo de acceso *</label>
            <input
              type="email"
              {...formPropietario.register("email")}
              className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
                ${formPropietario.formState.errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {formPropietario.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña inicial *</label>
            <div className="relative">
              <input
                type={mostrarPasswordProp ? "text" : "password"}
                {...formPropietario.register("password")}
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-primary
                  ${formPropietario.formState.errors.password ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMostrarPasswordProp((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {mostrarPasswordProp ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {formPropietario.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{formPropietario.formState.errors.password.message}</p>
            )}
          </div>

          {errorPropietario && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              {errorPropietario}
            </div>
          )}

          <button
            type="submit"
            disabled={creandoPropietario}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
          >
            {creandoPropietario ? "Creando cuenta..." : "Crear propietario"}
          </button>
        </form>
      </Modal>

      {/* Modal: colores del negocio */}
      <Modal
        abierto={modalColores}
        onCerrar={() => setModalColores(false)}
        titulo="Colores del negocio"
        ancho="sm"
      >
        {negocioSel && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Personaliza los colores del panel de{" "}
              <span className="font-semibold text-gray-800">{negocioSel.nombre}</span>.
              Estos colores se aplican en el sidebar del dueño y empleados.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color primario</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={colorPrimario}
                    onChange={(e) => setColorPrimario(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={colorPrimario}
                    onChange={(e) => setColorPrimario(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 font-mono uppercase"
                    maxLength={7}
                    placeholder="#C8A961"
                  />
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
                    style={{ backgroundColor: colorPrimario }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color secundario</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={colorSecundario}
                    onChange={(e) => setColorSecundario(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={colorSecundario}
                    onChange={(e) => setColorSecundario(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 font-mono uppercase"
                    maxLength={7}
                    placeholder="#a07830"
                  />
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
                    style={{ backgroundColor: colorSecundario }}
                  />
                </div>
              </div>
            </div>

            {/* Vista previa del sidebar */}
            <div className="rounded-xl border border-gray-100 p-3 bg-gray-50">
              <p className="text-xs text-gray-400 mb-2">Vista previa</p>
              <div className="flex flex-col gap-1">
                {["Inicio", "Citas", "Empleados", "Servicios"].map((item, i) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                    style={i === 0 ? { backgroundColor: colorPrimario, color: "#fff" } : { color: "#6b7280" }}
                  >
                    <div className="w-4 h-4 rounded bg-current opacity-30" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalColores(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => actualizarColores()}
                disabled={guardandoColores}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-semibold transition"
              >
                {guardandoColores ? "Guardando..." : "Guardar colores"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: confirmar eliminación */}
      <Modal abierto={!!negocioEliminar} onCerrar={() => setNegocioEliminar(null)} titulo="Eliminar negocio" ancho="sm">
        {negocioEliminar && (
          <div>
            <p className="text-sm text-gray-600 mb-1">
              ¿Seguro que deseas eliminar <span className="font-semibold text-gray-900">{negocioEliminar.nombre}</span>?
            </p>
            <p className="text-xs text-gray-400 mb-6">
              El negocio quedará marcado como eliminado y dejará de aparecer en el sistema. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setNegocioEliminar(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminar(negocioEliminar.id)}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold transition"
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
