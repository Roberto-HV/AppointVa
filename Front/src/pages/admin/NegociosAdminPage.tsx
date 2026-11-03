import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, Rows3 } from "lucide-react";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import BotonAccion from "../../components/ui/BotonAccion";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { SkeletonLista, SkeletonTarjetasNegocio } from "../../components/ui/Skeleton";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import {
  esPendienteActivacion, ordenarNegociosAdmin, coincideBusquedaNegocio, conteosAtencion,
  requiereAtencion, esMotivoAtencion, ordenarPorColumna, DIRECCION_INICIAL, MOTIVOS_ATENCION,
  type MotivoAtencion, type ColumnaNegocios, type DireccionOrden,
} from "../../utils/negociosAdmin";
import { useDatosNegocios } from "./negocios/useDatosNegocios";
import { useAccionesNegocio } from "./negocios/useAccionesNegocio";
import KpisNegocios from "./negocios/KpisNegocios";
import FranjaAtencion from "./negocios/FranjaAtencion";
import TablaNegocios from "./negocios/TablaNegocios";
import { TarjetaNegocio } from "./negocios/TarjetaNegocio";
import ModalNuevoNegocio from "./negocios/ModalNuevoNegocio";

// Lote 4: la página tenía ~2,500 líneas con tarjeta, modales, Facturación y
// todas las mutaciones. Ahora es solo la lista; las piezas viven en
// `./negocios/` y las comparten Facturación y la ficha del negocio.

type Vista = "tabla" | "tarjetas";

/** La vista elegida en escritorio se recuerda en este navegador. */
const CLAVE_VISTA = "admin-negocios-vista";

function leerVista(): Vista {
  try {
    return localStorage.getItem(CLAVE_VISTA) === "tarjetas" ? "tarjetas" : "tabla";
  } catch {
    return "tabla";
  }
}

function guardarVista(vista: Vista) {
  try { localStorage.setItem(CLAVE_VISTA, vista); } catch { /* almacenamiento no disponible */ }
}

const BOTON_VISTA =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] lg:min-h-[36px] px-3 rounded-md text-xs font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40";

export default function NegociosAdminPage() {
  useTituloPagina("Negocios · Admin");
  const datos = useDatosNegocios();
  const { metricas, cargandoMetricas, errorMetricas, suscripcionMap, resumen, cargandoPanel, errorPanel } = datos;
  const acciones = useAccionesNegocio();

  const [modalNegocio, setModalNegocio] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("");
  const [filtroSuscripcion, setFiltroSuscripcion] = useState("");

  // El filtro de "Requiere atención" va en la URL (`?atencion=pendientes`): el
  // contador del menú enlaza directo a la cola, y la vista se puede compartir.
  const [params, setParams] = useSearchParams();
  const crudoAtencion = params.get("atencion");
  const atencion: MotivoAtencion | "" = esMotivoAtencion(crudoAtencion) ? crudoAtencion : "";
  const cambiarAtencion = (motivo: MotivoAtencion | "") => {
    setParams((p) => {
      const siguiente = new URLSearchParams(p);
      if (motivo) siguiente.set("atencion", motivo);
      else siguiente.delete("atencion");
      return siguiente;
    }, { replace: true });
  };

  // En el teléfono siempre tarjetas; en escritorio la tabla, salvo que se elija otra cosa.
  const esMovil = useMediaQuery(CONSULTA_MOVIL);
  const [vistaElegida, setVistaElegida] = useState<Vista>(leerVista);
  const vista: Vista = esMovil ? "tarjetas" : vistaElegida;
  const cambiarVista = (v: Vista) => { setVistaElegida(v); guardarVista(v); };

  // Sin columna elegida, el orden de siempre: pendientes primero (AP-07).
  const [orden, setOrden] = useState<{ columna: ColumnaNegocios | null; direccion: DireccionOrden }>({
    columna: null, direccion: "asc",
  });
  const ordenarPor = (columna: ColumnaNegocios) =>
    setOrden((o) => o.columna === columna
      ? { columna, direccion: o.direccion === "asc" ? "desc" : "asc" }
      : { columna, direccion: DIRECCION_INICIAL[columna] });

  const suscripcionDe = (id: string) => suscripcionMap[id];

  const conteos = useMemo(
    () => conteosAtencion(metricas, (id) => suscripcionMap[id]),
    [metricas, suscripcionMap]
  );

  const metricasFiltradas = useMemo(() => {
    const filtradas = metricas.filter((n) => {
      if (!coincideBusquedaNegocio(n, busqueda)) return false;
      if (filtroActivo === "activos" && n.activo !== 1) return false;
      if (filtroActivo === "inactivos" && n.activo === 1) return false;
      if (filtroActivo === "pendientes" && !esPendienteActivacion(n)) return false;
      if (filtroSuscripcion) {
        const estado = suscripcionMap[n.id]?.estado ?? "SinSuscripcion";
        if (estado !== filtroSuscripcion) return false;
      }
      if (atencion && !requiereAtencion(n, suscripcionMap[n.id], atencion)) return false;
      return true;
    });
    return orden.columna
      ? ordenarPorColumna(filtradas, (id) => suscripcionMap[id], orden.columna, orden.direccion)
      : filtradas.sort(ordenarNegociosAdmin);
  }, [metricas, busqueda, filtroActivo, filtroSuscripcion, atencion, suscripcionMap, orden]);

  const paginaNegocios = usePaginacionLocal(metricasFiltradas);

  // Otra búsqueda, filtro u orden es otra lista: se vuelve a la página 1 en vez
  // de quedarse en la 3 de algo distinto. Se compara contra la clave anterior
  // durante el render (no en un efecto) para no dibujar un cuadro con la página
  // vieja; cubre también `?atencion=` cuando cambia desde un enlace del menú.
  const claveLista = JSON.stringify([busqueda, filtroActivo, filtroSuscripcion, atencion, orden.columna, orden.direccion]);
  const [claveListaAnterior, setClaveListaAnterior] = useState(claveLista);
  if (claveListaAnterior !== claveLista) {
    setClaveListaAnterior(claveLista);
    paginaNegocios.setPagina(1);
  }

  const hayFiltros = Boolean(busqueda.trim() || filtroActivo || filtroSuscripcion || atencion);
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroActivo("");
    setFiltroSuscripcion("");
    cambiarAtencion("");
  };

  const abrirNuevoNegocio = () => setModalNegocio(true);

  const paginacion = paginaNegocios.totalPaginas > 1 && (
    <Pagination
      pagina={paginaNegocios.pagina}
      totalPaginas={paginaNegocios.totalPaginas}
      total={paginaNegocios.total}
      labelTotal="negocios"
      onCambiar={paginaNegocios.setPagina}
      cargando={cargandoMetricas}
    />
  );

  return (
    <div className="p-4 sm:p-8">
      {/* "Negocios", como en el menú (M2). */}
      <EncabezadoPagina
        className="mb-5"
        titulo="Negocios"
        subtitulo={
          errorMetricas ? undefined
            : cargandoMetricas ? <span aria-hidden="true" className="inline-block align-middle h-3.5 w-36 rounded-md bg-muted animate-pulse" />
            : `${metricas.length} ${metricas.length === 1 ? "registrado" : "registrados"} en total`
        }
        acciones={
          <BotonAccion onClick={abrirNuevoNegocio}>
            + Nuevo negocio
          </BotonAccion>
        }
      />

      <KpisNegocios
        metricas={metricas}
        resumen={resumen}
        error={errorPanel}
        cargando={cargandoPanel}
        reintentando={datos.reintentandoPanel}
        onReintentar={datos.reintentarPanel}
      />

      {!cargandoPanel && !errorPanel && (
        <FranjaAtencion conteos={conteos} activo={atencion} onCambiar={cambiarAtencion} />
      )}

      <FiltroBarra
        etiqueta="Filtros de negocios"
        busqueda={{
          valor: busqueda,
          onChange: setBusqueda,
          etiqueta: "Buscar negocio",
          // Corto para que quepa en el campo; el correo del propietario es lo nuevo.
          placeholder: "Nombre, slug o correo...",
        }}
        accion={!esMovil && (
          <div role="group" aria-label="Vista de la lista" className="inline-flex shrink-0 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-700">
            {([
              { id: "tabla", etiqueta: "Tabla", Icono: Rows3 },
              { id: "tarjetas", etiqueta: "Tarjetas", Icono: LayoutGrid },
            ] as const).map(({ id, etiqueta, Icono }) => (
              <button
                key={id}
                type="button"
                aria-pressed={vista === id}
                onClick={() => cambiarVista(id)}
                className={`${BOTON_VISTA} ${
                  vista === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icono size={14} aria-hidden="true" /> {etiqueta}
              </button>
            ))}
          </div>
        )}
        campos={[
          {
            id: "activo",
            tipo: "select",
            etiqueta: "Estado",
            valor: filtroActivo,
            onChange: setFiltroActivo,
            etiquetaNeutra: "Todos",
            opciones: [
              { valor: "pendientes", etiqueta: "Pendientes de activación" },
              { valor: "activos", etiqueta: "Activos" },
              { valor: "inactivos", etiqueta: "Inactivos" },
            ],
          },
          {
            id: "suscripcion",
            tipo: "select",
            etiqueta: "Suscripción",
            valor: filtroSuscripcion,
            onChange: setFiltroSuscripcion,
            etiquetaNeutra: "Todas",
            opciones: [
              { valor: "Activa", etiqueta: "Activa" },
              { valor: "PorVencer", etiqueta: "Por vencer" },
              { valor: "Vencida", etiqueta: "Vencida" },
              { valor: "SinSuscripcion", etiqueta: "Sin suscripción" },
            ],
          },
          // El mismo filtro que la franja "Requiere atención": así cuenta en el
          // badge de "Filtros" del teléfono y "Limpiar filtros" también lo quita.
          {
            id: "atencion",
            tipo: "select",
            etiqueta: "Requiere atención",
            valor: atencion,
            onChange: (v) => cambiarAtencion(esMotivoAtencion(v) ? v : ""),
            etiquetaNeutra: "Todos",
            opciones: MOTIVOS_ATENCION.map((m) => ({ valor: m.id, etiqueta: m.etiqueta })),
          },
        ]}
        onLimpiar={limpiarFiltros}
      />

      {cargandoPanel && !errorPanel ? (
        vista === "tabla"
          ? <SkeletonLista filas={8} columnas={9} etiqueta="Cargando negocios" />
          : <SkeletonTarjetasNegocio />
      ) : errorMetricas ? null : metricasFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          {hayFiltros ? (
            <EmptyState
              variante="sinResultados"
              title="Sin resultados"
              description="Ningún negocio coincide con los filtros actuales."
              onLimpiarFiltros={limpiarFiltros}
              // Distinto del "Limpiar filtros" de la barra: dos botones con
              // el mismo nombre accesible en la misma pantalla no se
              // distinguen al navegar por lista.
              labelLimpiarFiltros="Ver todos los negocios"
            />
          ) : (
            // La acción va en el propio vacío (M10), no nombrada en el texto.
            // Otro nombre que el del encabezado: dos botones iguales no se
            // distinguen al recorrer la página con un lector.
            <EmptyState
              title="No hay negocios registrados"
              description="Cuando des de alta el primero, aquí verás su estado, su plan y su uso."
              action={<BotonAccion onClick={abrirNuevoNegocio}>Crear el primer negocio</BotonAccion>}
            />
          )}
        </div>
      ) : vista === "tabla" ? (
        <TablaNegocios
          negocios={paginaNegocios.visibles}
          suscripcionDe={suscripcionDe}
          columna={orden.columna}
          direccion={orden.direccion}
          onOrdenar={ordenarPor}
          acciones={acciones}
          pie={paginacion && <div className="border-t border-slate-100 dark:border-slate-700">{paginacion}</div>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginaNegocios.visibles.map((neg) => (
              <TarjetaNegocio
                key={neg.id}
                negocio={neg}
                suscripcion={suscripcionMap[neg.id]}
                onActivar={() => acciones.activar(neg)}
                onDesactivar={() => acciones.pedirDesactivar(neg)}
                onConfirmarEmail={() => acciones.pedirConfirmarCorreo(neg)}
                onCrearPropietario={() => acciones.abrirPropietario(neg)}
                onColores={() => acciones.abrirColores(neg)}
                onSuscripcion={() => acciones.abrirSuscripcion(neg)}
                onTogglePagos={(habilitado) => acciones.togglePagos(neg, habilitado)}
                onToggleTester={() => acciones.toggleTester(neg)}
                onEliminar={() => acciones.abrirEliminar(neg)}
                // Solo la tarjeta cuyo estado está cambiando queda en espera (AP-06).
                isToggling={acciones.cambiandoEstado(neg.id)}
              />
            ))}
          </div>
          {paginacion && (
            <div className="mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {paginacion}
            </div>
          )}
        </>
      )}

      <ModalNuevoNegocio abierto={modalNegocio} onCerrar={() => setModalNegocio(false)} planes={datos.planes} />
      {acciones.modales}
    </div>
  );
}
