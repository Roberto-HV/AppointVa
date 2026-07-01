# Diseño: Monitoreo de negocios y suscripciones

**Fecha:** 2026-07-01  
**Estado:** Aprobado por usuario

---

## Contexto

AppointVa tiene un modelo de negocio donde el propietario (Roberto) cobra suscripciones manualmente y las asigna desde el SuperAdmin. Con hasta 5 clientes iniciales, el objetivo principal es:

- Detectar cuándo un negocio está saturando Resend (emails)
- Ver de un vistazo quién está cerca de los límites de su plan
- Activar/desactivar negocios que no paguen
- Mostrar al dueño del negocio en qué plan está

---

## Alcance

### Para el dueño del negocio — PerfilPage (tab Configuración)
Tarjeta de solo lectura que muestra únicamente el nombre del plan actual y un texto de contacto para cambiar de plan. Sin métricas de uso.

### Para el SuperAdmin — NegociosAdminPage
Reemplazar la tabla actual por un grid de tarjetas. Cada tarjeta muestra:
- Nombre del negocio, slug, estado (Activo/Inactivo)
- Nombre del plan asignado
- Barra de progreso: **Citas este mes** vs `MaxCitasMes` del plan
- Barra de progreso: **Empleados activos** vs `MaxEmpleados` del plan
- Contador simple: **Emails enviados este mes** (sin límite, solo volumen)
- Botones de acción: Desactivar/Activar, Ver booking

**Colores de barras de progreso:**
- 🟢 Verde: 0–60%
- 🟡 Amarillo: 60–85%
- 🔴 Rojo: 85%+

---

## Arquitectura

### Backend

#### 1. Modelo `EmailLog` (tabla nueva)
```csharp
public class EmailLog
{
    public Guid Id { get; set; }
    public Guid NegocioId { get; set; }
    public string Tipo { get; set; }       // "Confirmacion", "Recordatorio", "Cancelacion", etc.
    public DateTime EnviadoEn { get; set; }
    public Negocio Negocio { get; set; }
}
```

#### 2. Registro en EmailService
Después de cada envío exitoso, insertar una fila en `EmailLog` con fire-and-forget (wrapped en try/catch para que un fallo de log nunca interrumpa el envío del email).

#### 3. Endpoint de métricas — `GET /api/admin/negocios/metricas`
- **Rol:** Solo SuperAdmin
- **Respuesta:** Lista de todos los negocios con:
  - Datos del negocio (id, nombre, slug, activo, planNombre)
  - `citasMes`: COUNT de Citas donde InicioEn está en el mes actual
  - `maxCitasMes`: del Plan asignado
  - `empleadosActivos`: COUNT de Empleados con FechaEliminacion == null y Activo == 1
  - `maxEmpleados`: del Plan asignado
  - `emailsMes`: COUNT de EmailLog donde EnviadoEn está en el mes actual

#### 4. Migración EF Core
Nueva migración `AddEmailLog` para crear la tabla.

### Frontend

#### 1. PerfilPage — tab Configuración
Agregar tarjeta de solo lectura al inicio del tab:
```
┌────────────────────────┐
│ Tu suscripción         │
│                        │
│  Plan Pro              │
│                        │
│  ¿Quieres cambiar?     │
│  Contáctanos →         │
└────────────────────────┘
```
El plan llega del endpoint existente `GET /api/negocios/perfil` que ya incluye `planNombre`.

#### 2. NegociosAdminPage — grid de tarjetas
- Reemplazar la tabla `<table>` por un grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- Nuevo componente `BarraProgreso` (local en la página): recibe `valor`, `maximo`, calcula porcentaje y aplica color
- Mantener todas las acciones existentes (colores, propietario, activar/desactivar, booking, eliminar)
- Nuevo tipo TypeScript `NegocioMetricas` para el endpoint nuevo

---

## Flujo de datos

```
EmailService.EnviarXxx()
  └─> envía email via Resend
  └─> (try/catch) inserta fila en EmailLog

GET /api/admin/negocios/metricas
  └─> query Negocios JOIN Planes
  └─> subquery COUNT Citas del mes
  └─> subquery COUNT Empleados activos
  └─> subquery COUNT EmailLog del mes
  └─> devuelve lista con métricas

NegociosAdminPage
  └─> useQuery → /api/admin/negocios/metricas
  └─> grid de tarjetas con BarraProgreso
```

---

## Decisiones de diseño

- **EmailLog mínimo**: Solo 3 campos útiles (NegocioId, Tipo, EnviadoEn). Sin destinatario ni body para mantenerlo liviano.
- **Sin límite de emails por plan**: Los emails no tienen barra de progreso porque el límite es de Resend a nivel de cuenta, no por negocio. Solo se muestra el conteo como indicador de volumen.
- **Fire-and-forget para log**: El registro de emails no debe afectar el flujo de envío. Si la DB falla, el email igual se envía.
- **Grid de tarjetas en SuperAdmin**: Con ≤10 negocios esperados, las tarjetas permiten ver el estado de todos sin necesidad de expandir filas.
- **Plan en dueño = solo nombre**: Sin métricas de uso para el dueño por ahora. Suficiente para que sepa en qué plan está.

---

## Archivos a modificar / crear

### Backend
- `Models/EmailLog.cs` — nuevo
- `Data/ApplicationDbContext.cs` — agregar DbSet<EmailLog>
- `Services/EmailService.cs` — agregar logging en cada método de envío
- `Controllers/V1/AdminController.cs` (o nuevo `MetricasAdminController.cs`) — endpoint GET métricas
- `Migrations/` — nueva migración AddEmailLog

### Frontend
- `Front/src/pages/dashboard/PerfilPage.tsx` — tarjeta de plan en tab Configuración
- `Front/src/pages/admin/NegociosAdminPage.tsx` — grid de tarjetas con métricas
- `Front/src/api/admin.ts` — agregar función para el endpoint de métricas

---

## Fuera de alcance

- Emails de alerta automáticos cuando un negocio se acerca al límite
- Vista de histórico de emails por negocio
- Métricas de uso para el dueño (citas usadas, empleados)
- Integración con Resend API para obtener cuotas reales
