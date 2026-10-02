import { useEffect, useMemo, useState } from "react";

/** Filas por página en todo el dashboard, lo paginen el servidor o el cliente. */
export const TAMANO_PAGINA = 15;

/**
 * Paginación sobre un arreglo ya cargado.
 *
 * Para las listas acotadas por naturaleza —empleados, servicios, cupones, la
 * lista de espera— mover la paginación al servidor no compra nada: el total no
 * crece sin límite y la página calcula KPIs y totales sobre el conjunto
 * completo, así que lo necesita entero de todas formas. Aquí solo se recorta lo
 * que se dibuja; los conteos siguen leyendo el arreglo completo.
 */
export function usePaginacionLocal<T>(items: T[], tamano: number = TAMANO_PAGINA) {
  const [pagina, setPagina] = useState(1);

  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  // Al encogerse la lista —un filtro nuevo, un borrado— la página actual puede
  // quedar fuera de rango. Se acota al vuelo para no dibujar una página vacía
  // mientras el efecto corrige el estado.
  const paginaSegura = Math.min(pagina, totalPaginas);

  useEffect(() => {
    if (pagina !== paginaSegura) setPagina(paginaSegura);
  }, [pagina, paginaSegura]);

  const visibles = useMemo(
    () => items.slice((paginaSegura - 1) * tamano, paginaSegura * tamano),
    [items, paginaSegura, tamano]
  );

  return { pagina: paginaSegura, setPagina, totalPaginas, total, visibles };
}
