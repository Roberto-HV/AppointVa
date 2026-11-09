import { construirDistSiCambio } from "./construirDist";

/**
 * Vitest ejecuta el globalSetup una sola vez por corrida y antes de levantar
 * los workers, que es exactamente lo que hace falta aquí: serviceWorkerBuild y
 * cspHashScriptTema leen el mismo `dist/`, así que el build tiene que estar
 * terminado antes de que cualquier worker empiece a leerlo. Si las entradas no
 * cambiaron, esto no hace nada y la suite arranca igual de rápido.
 */
export default function setup(): void {
  construirDistSiCambio();
}
