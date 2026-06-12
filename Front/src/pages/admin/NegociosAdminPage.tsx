import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { adminApi } from "../../api/admin";
import Modal from "../../components/ui/Modal";
import { useToastStore } from "../../store/toastStore";
import type { NegocioDto } from "../../types";

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
  apellido: z.string().optional().default(""),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type PropietarioForm = z.infer<typeof schemaPropietario>;

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default function NegociosAdminPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [modalNegocio, setModalNegocio] = useState(false);
  const [modalPropietario, setModalPropietario] = useState(false);
  const [modalColores, setModalColores] = useState(false);
  const [negocioSel, setNegocioSel] = useState<NegocioDto | null>(null);
  const [negocioEliminar, setNegocioEliminar] = useState<NegocioDto | null>(null);
  const [errorPropietario, setErrorPropietario] = useState("");
  const [mostrarPasswordProp, setMostrarPasswordProp] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#C8A961");
  const [colorSecundario, setColorSecundario] = useState("#a07830");

  const { data: negocios = [], isLoading } = useQuery({
    queryKey: ["admin-negocios"],
    queryFn: adminApi.obtenerNegocios,
  });

  const { data: planes = [] } = useQuery({
    queryKey: ["planes"],
    queryFn: adminApi.obtenerPlanes,
  });

  const formNegocio = useForm<NegocioForm>({ resolver: zodResolver(schemaNegocio) });
  const formPropietario = useForm<PropietarioForm>({ resolver: zodResolver(schemaPropietario) });

  const { mutate: crearNegocio, isPending: creandoNegocio } = useMutation({
    mutationFn: (d: NegocioForm) =>
      adminApi.crearNegocio({
        ...d,
        email: d.email || undefined,
        planId: d.planId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
      setModalNegocio(false);
      formNegocio.reset();
      toast("Negocio creado correctamente");
    },
  });

  const { mutate: toggleEstado } = useMutation({
    mutationFn: (neg: NegocioDto) =>
      neg.activo ? adminApi.desactivar(neg.id) : adminApi.activar(neg.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-negocios"] }),
  });

  const { mutate: eliminar, isPending: eliminando } = useMutation({
    mutationFn: (id: string) => adminApi.eliminar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
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
    onSuccess: (negocioActualizado) => {
      qc.setQueryData<NegocioDto[]>(["admin-negocios"], (prev) =>
        prev?.map((n) => (n.id === negocioActualizado.id ? negocioActualizado : n)) ?? prev
      );
      setModalColores(false);
      toast("Colores actualizados");
    },
  });

  const abrirColores = (neg: NegocioDto) => {
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

  const abrirPropietario = (neg: NegocioDto) => {
    setNegocioSel(neg);
    setErrorPropietario("");
    formPropietario.reset({ nombre: "", apellido: "", email: "", password: "" });
    setModalPropietario(true);
  };

  const negociosFiltrados = negocios.filter(
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
          <p className="text-sm text-gray-400 mt-0.5">{negocios.length} registrados en total</p>
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

      {/* Tabla */}
      {isLoading ? (
        <p className="text-gray-400">Cargando negocios...</p>
      ) : negociosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400">
            {busqueda ? "Sin resultados para esa búsqueda" : "No hay negocios registrados"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Negocio</th>
                <th className="text-left px-5 py-3 font-medium">Slug</th>
                <th className="text-left px-5 py-3 font-medium">Plan</th>
                <th className="text-center px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {negociosFiltrados.map((neg) => (
                <tr key={neg.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {neg.logoUrl ? (
                        <img src={neg.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-sm">
                          {neg.nombre.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800">{neg.nombre}</p>
                        {neg.email && <p className="text-xs text-gray-400">{neg.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                      {neg.slug}
                    </code>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {neg.planNombre ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${neg.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                    >
                      {neg.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => abrirColores(neg)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition"
                      >
                        Colores
                      </button>
                      <button
                        onClick={() => abrirPropietario(neg)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                      >
                        + Propietario
                      </button>
                      <button
                        onClick={() => toggleEstado(neg)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg transition ${neg.activo ? "bg-red-50 text-red-500 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                      >
                        {neg.activo ? "Desactivar" : "Activar"}
                      </button>
                      <a
                        href={`/b/${neg.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
                      >
                        Ver booking
                      </a>
                      <button
                        onClick={() => setNegocioEliminar(neg)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <select
              {...formNegocio.register("planId")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">Sin plan asignado</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatPrecio(p.precioMensual)}/mes · {p.maxEmpleados} empleados
                </option>
              ))}
            </select>
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
