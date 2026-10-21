import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Regla única de "Volver" (AP-15): con historial en esta pestaña se vuelve
 * atrás; sin él (pestaña nueva, enlace directo, notificación) se va al
 * `respaldo`. react-router marca la primera entrada de la pestaña con
 * `key === "default"`.
 */
export function useVolverAtras(respaldo = "/") {
  const navigate = useNavigate();
  const { key } = useLocation();
  const hayHistorial = key !== "default";
  const volver = useCallback(
    () => (hayHistorial ? navigate(-1) : navigate(respaldo)),
    [hayHistorial, navigate, respaldo],
  );
  return { volver, hayHistorial };
}

/**
 * La misma regla fuera del contexto del router (p. ej. `ErrorBoundary`).
 * `BrowserRouter` guarda en `history.state.idx` la posición de la entrada:
 * 0 es la primera de la pestaña, la misma que tiene `key === "default"`.
 */
export function hayHistorialEnPestana(estado: unknown = window.history.state): boolean {
  const idx = (estado as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}
