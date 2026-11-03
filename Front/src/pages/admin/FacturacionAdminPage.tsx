import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SuscripcionResumenDto } from "../../api/admin";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { SkeletonLista } from "../../components/ui/Skeleton";
import { FiltroBarra } from "../../components/ui/filtros";
import { usePaginacionLocal } from "../../hooks/usePaginacionLocal";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import { useToastStore } from "../../store/toastStore";
import { formatPrecio } from "../../utils/formatters";
import { mensajeError } from "../../utils/errores";
import { adminApi } from "../../api/admin";
import { useDatosNegocios } from "./negocios/useDatosNegocios";
import { useAccionesNegocio } from "./negocios/useAccionesNegocio";
import KpisNegocios from "./negocios/KpisNegocios";
import { TablaFacturacion, TarjetasFacturacion } from "./negocios/Facturacion";
import { ESTADO_ORDER } from "./negocios/formatoSuscripcion";

/**
 * Facturación del SuperAdmin. Era la segunda pestaña de Negocios; con la lista
 * convertida en tabla y cada negocio con su ficha (lote 4), pasa a su propia
 * entrada del menú, como proponía M2. El contenido no cambia: misma tabla,
 * mismas tarjetas en el teléfono, mismo pie que suma lo que suman los KPIs.
 */
export default function FacturacionAdminPage() {
  useTituloPagina("Facturación · Admin");
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const datos = useDatosNegocios();
  const { metricas, suscripciones, cargandoSuscripciones, errorSuscripciones, resumen } = datos;
  const acciones = useAccionesNegocio();
  const [busqueda, setBusqueda] = useState("");

  // Debajo de `sm` Facturación es una lista de tarjetas (I6): en la tabla, a
  // 390px quedaban fuera justo el ingreso, el vencimiento y el estado.
  const esMovil = useMediaQuery(CONSULTA_MOVIL);

  // Los negocios de prueba no son clientes: fuera de la tabla y de las cifras.
  const ordenadas = useMemo(
    () => [...suscripciones]
      .filter(s => !s.esTester)
      .sort((a, b) => (ESTADO_ORDER[a.estado] ?? 4) - (ESTADO_ORDER[b.estado] ?? 4)),
    [suscripciones]
  );

  const termino = busqueda.trim().toLowerCase();
  const filtradas = useMemo(
    () => ordenadas.filter(
      (s) =>
        !termino ||
        s.negocioNombre.toLowerCase().includes(termino) ||
        s.negocioSlug.toLowerCase().includes(termino)
    ),
    [ordenadas, termino]
  );
  const pagina = usePaginacionLocal(filtradas);

  // Empleados extra desde la tabla: mismo guardado explícito que en el modal.
  const { mutate: guardarExtraFila, isPending: guardandoExtraFila, variables: extraFilaEnCurso } = useMutation({
    mutationFn: ({ s, valor }: { s: SuscripcionResumenDto; valor: number }) =>
      adminApi.setEmpleadosExtra(s.negocioId, valor),
    onSuccess: (_, { s, valor }) => {
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      toast(`Empleados extra de ${s.negocioNombre}: ${valor} · total ${formatPrecio(s.precioBase + valor * s.precioEmpleadoExtra)}/mes`);
    },
    onError: (err: unknown) => toast(mensajeError(err, "No se pudieron actualizar los empleados extra."), "error"),
  });

  const verSuscripcion = (s: SuscripcionResumenDto) => {
    const neg = metricas.find(m => m.id === s.negocioId);
    if (neg) acciones.abrirSuscripcion(neg);
  };

  const paginacion = pagina.totalPaginas > 1 && (
    <Pagination
      pagina={pagina.pagina}
      totalPaginas={pagina.totalPaginas}
      total={pagina.total}
      labelTotal="suscripciones"
      onCambiar={pagina.setPagina}
    />
  );

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-5"
        titulo="Facturación"
        subtitulo="Lo que paga cada negocio y lo que entra cada mes"
      />

      <KpisNegocios
        metricas={metricas}
        resumen={resumen}
        error={datos.errorPanel}
        cargando={datos.cargandoPanel}
        reintentando={datos.reintentandoPanel}
        onReintentar={datos.reintentarPanel}
      />

      <FiltroBarra
        etiqueta="Filtros de facturación"
        busqueda={{
          valor: busqueda,
          onChange: setBusqueda,
          etiqueta: "Buscar negocio",
          placeholder: "Buscar por nombre o slug...",
        }}
        campos={[]}
        onLimpiar={() => setBusqueda("")}
      />

      {!errorSuscripciones && (
        cargandoSuscripciones ? (
          // Antes, mientras cargaba, se leía "Sin facturación todavía".
          <SkeletonLista filas={6} columnas={8} etiqueta="Cargando facturación" />
        ) : filtradas.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            {termino ? (
              <EmptyState
                variante="sinResultados"
                title="Sin resultados"
                description="Ningún negocio coincide con los filtros actuales."
                onLimpiarFiltros={() => setBusqueda("")}
                labelLimpiarFiltros="Ver todas las suscripciones"
              />
            ) : (
              <EmptyState
                title="Sin facturación todavía"
                description="No hay negocios activos que facturar."
              />
            )}
          </div>
        ) : esMovil ? (
          <TarjetasFacturacion
            filas={pagina.visibles}
            resumen={resumen}
            onVerSuscripcion={verSuscripcion}
            paginacion={paginacion}
          />
        ) : (
          <TablaFacturacion
            filas={pagina.visibles}
            resumen={resumen}
            onVerSuscripcion={verSuscripcion}
            guardandoExtraDe={guardandoExtraFila ? extraFilaEnCurso?.s.negocioId ?? null : null}
            onGuardarExtra={(s, valor) => guardarExtraFila({ s, valor })}
            paginacion={paginacion}
          />
        )
      )}

      {acciones.modales}
    </div>
  );
}
