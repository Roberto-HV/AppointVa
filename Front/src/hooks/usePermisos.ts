import { useAuthStore } from "../store/authStore";

// ── Permisos por rol en la interfaz (decisión 2, DC-14) ───────────────────────
//
// El Empleado es un rol restringido: puede cobrar y registrar anticipos de SUS
// citas, pero no exporta a Excel, no revierte pagos, no anula anticipos, no hace
// el corte de caja ni edita los datos de un cliente.
//
// Ocultar controles NO es seguridad: el backend debe aplicar la misma matriz
// (B10). Hoy el backend ya limita estado, pago, anticipo y notas a las citas
// propias del empleado, pero NO bloquea al Empleado en:
//   - exportar a Excel (Citas, Pagos, Clientes),
//   - el corte de caja,
//   - la reversión de un pago,
//   - la anulación de un anticipo.

export interface Permisos {
  esEmpleado: boolean;
  /** Dueño de la cuenta del negocio (p. ej. 2FA de la cuenta). */
  esPropietario: boolean;
  /** Exportar a Excel (Citas, Pagos, Clientes). */
  exportar: boolean;
  /** Revertir un pago ya registrado. */
  revertirPago: boolean;
  /** Anular un anticipo ya registrado. */
  anularAnticipo: boolean;
  /** Pestaña "Corte del día" y cierre de caja. */
  corteCaja: boolean;
  /** Editar nombre, teléfono o correo del cliente. */
  editarCliente: boolean;
}

export function permisosPorRol(rol: string | null | undefined): Permisos {
  const esEmpleado = rol === "Empleado";
  const completo = !esEmpleado;
  return {
    esEmpleado,
    esPropietario: rol === "Propietario",
    exportar: completo,
    revertirPago: completo,
    anularAnticipo: completo,
    corteCaja: completo,
    editarCliente: completo,
  };
}

export function usePermisos(): Permisos {
  const rol = useAuthStore((s) => s.usuario?.rol);
  return permisosPorRol(rol);
}
