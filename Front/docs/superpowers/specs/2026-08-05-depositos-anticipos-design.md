# Depósitos / Anticipos + Reestructuración de Mi Negocio — Design Spec

**Date:** 2026-08-05  
**Status:** Approved — ready for implementation planning

---

## Overview

Two scoped deliverables:

1. **Depósitos/Anticipos** — Allow business owners to require an upfront deposit when clients book. The deposit is received manually (cash/transfer) and confirmed by whoever takes it. At checkout the confirmed deposit auto-credits against the total, and a banner notifies the cashier.

2. **Mi Negocio tab restructuring** — The current 3-tab layout (Perfil / Configuracion / Horarios) has grown disorganized. Reorganize into 5 semantically clear tabs.

---

## Section 1 — Architecture (Anticipos)

Three moments in the lifecycle:

| Moment | Actor | Where |
|---|---|---|
| Configuration | Propietario | Mi Negocio → tab Anticipos (new) |
| Receipt registration | Propietario or Empleado | CitasPage — "Registrar anticipo" button on each pending cita |
| Checkout auto-credit | Propietario or Empleado | PagosPage — banner + pre-fill when anticipo confirmed |

**Cancellation advisory:** informational only. The system displays the cancellation/refund policy to the client at booking time (already handled via `InstruccionesAnticipo`). No automated refund logic — the owner handles that manually. The system never blocks or triggers automatic monetary actions.

---

## Section 2 — Data Model

### Negocio — new fields

| Field | Type | Constraints | Default |
|---|---|---|---|
| `PorcentajeAnticipo` | `int` | 0–80, replaces current fixed `MontoAnticipo` | `0` |
| `HorasCancelacionConReembolso` | `int` | ≥ 0 | `24` |
| `PoliticaCancelacionAnticipo` | `string` | `MaxLength(500)` | `""` |

> **Note:** `RequiereAnticipo (bool)` and `InstruccionesAnticipo (string?)` already exist on `Negocio`. `MontoAnticipo (decimal)` is already present but will be deprecated in favor of `PorcentajeAnticipo`; keep it in DB for backwards compat but stop writing to it from the new flow.

### Cita — 5 new fields

| Field | Type | Constraints |
|---|---|---|
| `AnticipoRequerido` | `bool` | Set at booking time from `Negocio.RequiereAnticipo` — snapshot |
| `MontoAnticipo` | `decimal?` | Computed at booking: `round(Precio * PorcentajeAnticipo / 100, 2)` |
| `AnticipoRecibido` | `bool` | Default `false` |
| `AnticipoRecibidoPorId` | `Guid?` | FK → `ApplicationUser` (who confirmed receipt) |
| `AnticipoRecibidoEn` | `DateTime?` | UTC timestamp of confirmation |

> **Why snapshot:** The deposit amount must reflect the price at booking time, not a later config change.
>
> **Where computed:** `PublicoController → POST /publico/citas` sets `AnticipoRequerido = negocio.RequiereAnticipo` and `MontoAnticipo = Math.Round(servicio.Precio * negocio.PorcentajeAnticipo / 100m, 2)` when creating the cita. The `CitasController` (owner-created appointments) also sets these fields.

### New endpoint

```
PATCH api/citas/{id}/anticipo
Body: { "recibido": bool }
Roles: Propietario, Empleado
```

- Sets `AnticipoRecibido = dto.Recibido`, `AnticipoRecibidoPorId = contexto.UsuarioId`, `AnticipoRecibidoEn = DateTime.UtcNow`
- Returns updated `CitaDto`

### CitaDto — extended fields

```csharp
public bool AnticipoRequerido { get; set; }
public decimal? MontoAnticipo { get; set; }
public bool AnticipoRecibido { get; set; }
public string? AnticipoRecibidoPorNombre { get; set; }  // denormalized from ApplicationUser
public DateTime? AnticipoRecibidoEn { get; set; }
```

---

## Section 3 — Frontend

### 3a. CitasPage — Anticipo button

On each pending cita that has `anticipoRequerido = true`:

- Show a pill/badge: if `anticipoRecibido = false` → amber "Anticipo pendiente"; if `true` → green "Anticipo recibido"
- Button: "Registrar anticipo" (amber, visible when `!anticipoRecibido`) or "Anular anticipo" (ghost, visible when `anticipoRecibido`)
- Calls `PATCH api/citas/{id}/anticipo` then invalidates `['citas']` query
- Toast notification on success: "Anticipo registrado — $X confirmado" / "Anticipo anulado"

### 3b. PagosPage — Checkout banner + pre-fill

When the cita being charged has `anticipoRecibido = true`:

- Show a green banner above the payment form: "Este cliente dejó un anticipo de $X. Se descuenta automáticamente del total."
- Pre-populate `MontoCobrado` with `cita.precio - cita.montoAnticipo` (owner can still override)
- The anticipo does NOT become a payment method — it just reduces what's owed. `MontoCobrado` always reflects the remaining balance the owner is actually collecting now.

### 3c. Mi Negocio — tab Anticipos (new)

New tab in the restructured layout. Contains:

- Toggle: **Requerir anticipo al reservar** (maps to `RequiereAnticipo`)
- When enabled, reveals:
  - **Porcentaje del anticipo**: slider or number input, 10–80, step 5 (maps to `PorcentajeAnticipo`)
  - **Horas mínimas para reembolso**: number input ≥ 0 (maps to `HorasCancelacionConReembolso`)
  - **Política de cancelación**: textarea `MaxLength(500)` — shown to client at booking (maps to `PoliticaCancelacionAnticipo`)
  - **Instrucciones de pago**: textarea `MaxLength(500)` — how to send the deposit (maps to `InstruccionesAnticipo`, already exists)
- Save button calls existing `PUT api/negocios` (add new fields to both `NegocioDto` for reads and `ActualizarNegocioDto` for writes: `PorcentajeAnticipo`, `HorasCancelacionConReembolso`, `PoliticaCancelacionAnticipo`; `InstruccionesAnticipo` already exists in both)

### 3d. Cancellation advisory

No UI changes needed for cancellation. The `PoliticaCancelacionAnticipo` text is already surfaced to clients via `PublicoController → ConfirmacionCitaDto`. No automated blocking or refund logic.

---

## Section 4 — Mi Negocio Tab Restructuring

### Current layout (3 tabs — disorganized)

| Tab | Contents |
|---|---|
| Perfil | QR, logo/portada, color, redes sociales, info básica |
| Configuracion | Suscripción, ajustes de citas, anticipo toggle, zona de peligro |
| Horarios | Horarios de atención, días bloqueados |

### Proposed layout (5 tabs — semantic)

| Tab | Contents |
|---|---|
| **Perfil** | Info básica (nombre, teléfono, email, dirección, descripción) · Logo · Portada · Redes sociales · Color de página · QR de reservas |
| **Citas** | Zona horaria · Recordatorio al cliente · Política de cancelación · Confirmación automática · Lista de espera · Canal de notificaciones |
| **Anticipos** | RequiereAnticipo toggle + all anticipo config fields (new, from Section 3c) |
| **Horarios** | Horarios de atención · Días sin atención |
| **Cuenta** | Tu suscripción · Zona de peligro |

### Rationale

- **Perfil** groups everything a client sees about the business (info pública + identidad visual).
- **Citas** groups all appointment behavior settings — these are operational, not identity.
- **Anticipos** gets its own tab because: (a) it's substantial (4 fields + policy text), (b) owners will return to it specifically.
- **Horarios** stays isolated — owners edit hours frequently and need fast access.
- **Cuenta** isolates destructive/admin actions from daily-use tabs.

### Migration notes

- The form submit handler needs to be split: currently Perfil + Configuracion share one `<form>`. After restructuring, each tab owns its own save action.
- Existing save mutations (`guardarPerfil`, `actualizarColores`, `guardarHorarios`) are already separate — only the form wiring changes.
- The "Canal de notificaciones" placeholder (hardcoded "Correo" button) moves to the Citas tab as-is.

---

## Out of Scope

- Paquetes / Membresías — future feature, separate spec
- WhatsApp Business API — deferred until dedicated phone number is available
- Automated refunds — owner handles manually; system is advisory only
- Stripe or payment processor integration for collecting deposits online — owner collects deposits out-of-band

---

## EF Core Migration Strategy

Two migrations needed:

1. `AddAnticipoFieldsToNegocio` — adds `PorcentajeAnticipo`, `HorasCancelacionConReembolso`, `PoliticaCancelacionAnticipo`
2. `AddAnticipoFieldsToCita` — adds `AnticipoRequerido`, `MontoAnticipo` (on Cita), `AnticipoRecibido`, `AnticipoRecibidoPorId`, `AnticipoRecibidoEn`

Run from `AppointVaAPI/` with `dotnet ef migrations add <Name>` then `dotnet ef database update`.

---

## Testing Strategy

**Backend integration tests:**
- `PATCH api/citas/{id}/anticipo` — sets fields, returns correct DTO
- `PATCH api/citas/{id}/anticipo` as Empleado — allowed (200)
- Checkout with anticipo confirmed — `MontoCobrado` unaffected by anticipo (backend doesn't auto-reduce; frontend pre-fills)
- `GET /publico/negocio/{slug}` — exposes `PorcentajeAnticipo` and `PoliticaCancelacionAnticipo`

**Frontend:**
- Visual verification of the anticipo badge states on CitasPage
- Checkout banner appears when `anticipoRecibido = true`
- Tab restructuring: each tab renders, save actions work independently
