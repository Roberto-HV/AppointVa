# Módulo de Pagos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Pagos page where owners and employees register appointment payments (method + amounts + change), generate printable 80mm thermal receipts via `window.print()`, optionally email receipts to clients via Brevo, gate the feature with a per-business flag toggled from SuperAdmin, and hide the legacy payment flow in CitasPage when the module is active.

**Architecture:** Backend extends the existing `Cita` entity with five new payment fields and enhances `PATCH /citas/{id}/pago`; a `ModuloPagosHabilitado` boolean on `Negocio` is toggled by SuperAdmin; a new `POST /citas/{id}/ticket-email` endpoint dispatches a Hangfire job for the receipt email. Frontend adds `PagosPage` (cards + payment drawer), a `TicketRecibo` print component, a `useModuloPagos` hook, and conditional CitasPage UI gating.

**Tech Stack:** ASP.NET Core 8 · EF Core · PostgreSQL · Brevo REST API · Hangfire (backend); React 18 · TypeScript · Vite · TanStack Query v5 · Zustand · Tailwind CSS · shadcn/ui · Vitest + RTL (frontend)

## Global Constraints

- Backend migrations: inline SQL in `Program.cs` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (pattern followed since `AddListaEsperaActiva`)
- Backend email: always enqueue Hangfire job — never call `IEmailService` directly from controller
- Backend employee guard: employees may only pay their own assigned citas — enforce in controller
- Frontend API calls: all through `api` axios instance in `src/api/axios.ts`
- Frontend tests: Vitest + RTL + `MemoryRouter` + `QueryClient({ retry: false })` (see `CitasPage.test.tsx`)
- `METODOS_PAGO = ["Efectivo", "Tarjeta", "Transferencia"]` — do not add new values
- No new npm packages — use existing dependencies (ExcelJS, Radix UI, lucide-react, etc.)
- Feature flag default: `false` on `Negocio`; SuperAdmin enables it per business for testing
- Printing: browser `window.print()` with `@media print` CSS — no PDF library

---

## File Structure

```
BACKEND (AppointVaAPI/)
  Models/
    Cita.cs                                   ← +5 payment fields
    Negocio.cs                                ← +ModuloPagosHabilitado
    Dtos/Citas/
      MarcarPagoDto.cs                        ← +MontoRecibido, MontoCobrado, Cambio
      CitaDto.cs                              ← +montoCobrado, montoRecibido, cambio, fechaPago
  Controllers/V1/
    CitasController.cs                        ← update MarcarPago + add POST ticket-email
    SuscripcionAdminController.cs             ← add PATCH /admin/negocios/{id}/modulo-pagos
  Services/
    IEmailService.cs                          ← +EnviarTicketCitaAsync
    EmailService.cs                           ← +EnviarTicketCitaAsync + PlantillaTicket
  Jobs/NotificacionJob.cs                     ← +EnviarTicketAsync
  Program.cs                                  ← +2 inline SQL columns

FRONTEND (Front/src/)
  types/index.ts                              ← +5 fields on CitaDto, +moduloPagosHabilitado on NegocioPerfilDto
  api/pagos.ts                                ← new file: registrar + enviarTicketEmail
  hooks/useModuloPagos.ts                     ← new file: reads negocio profile flag
  components/dashboard/TicketRecibo.tsx       ← new file: printable receipt
  pages/dashboard/PagosPage.tsx               ← new file: cards + drawer + payment flow
  pages/dashboard/PagosPage.test.tsx          ← new file
  components/dashboard/TicketRecibo.test.tsx  ← new file
  layouts/DashboardLayout.tsx                 ← +Pagos nav item in both arrays
  App.tsx                                     ← +route /dashboard/pagos
  pages/dashboard/CitasPage.tsx               ← conditional hide of payment column + modal
  pages/dashboard/CitasPage.test.tsx          ← +test for hidden payment UI
  pages/admin/NegociosAdminPage.tsx           ← +toggle ModuloPagosHabilitado
  api/admin.ts                                ← +toggleModuloPagos
```

---

### Task 1: Backend — Extend Cita with payment amount fields

**Files:**
- Modify: `AppointVaAPI/Models/Cita.cs`
- Modify: `AppointVaAPI/Models/Dtos/Citas/MarcarPagoDto.cs`
- Modify: `AppointVaAPI/Models/Dtos/Citas/CitaDto.cs`
- Modify: `AppointVaAPI/Controllers/V1/CitasController.cs`
- Modify: `AppointVaAPI/Program.cs`

**Interfaces:**
- Produces: `PATCH /citas/{id}/pago` accepts `{ pagada, metodoPago, montoCobrado, montoRecibido, cambio }`; responds with updated `CitaDto` including new payment fields
- Employees are forbidden from paying citas not assigned to them (403)

- [ ] **Step 1: Add fields to `Cita.cs`**

Open `AppointVaAPI/Models/Cita.cs`. After the existing `public string? MetodoPago { get; set; }` line, add:

```csharp
public decimal? MontoCobrado  { get; set; }   // precio final cobrado
public decimal? MontoRecibido { get; set; }   // dinero entregado por el cliente
public decimal? Cambio        { get; set; }   // vuelto entregado
public DateTime? FechaPago    { get; set; }   // cuándo se registró el pago
public Guid?     RegistradoPorId { get; set; } // FK a ApplicationUser
```

- [ ] **Step 2: Add inline SQL migration to `Program.cs`**

Find the block where `ListaEsperaActiva` is applied (around line 264). Add immediately after it:

```csharp
await db.Database.ExecuteSqlRawAsync("""
    ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "MontoCobrado"   numeric(10,2) NULL;
    ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "MontoRecibido"  numeric(10,2) NULL;
    ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "Cambio"         numeric(10,2) NULL;
    ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "FechaPago"      timestamptz   NULL;
    ALTER TABLE "Citas" ADD COLUMN IF NOT EXISTS "RegistradoPorId" uuid         NULL;
""");
```

- [ ] **Step 3: Update `MarcarPagoDto.cs`**

Replace the file content with:

```csharp
using System.ComponentModel.DataAnnotations;

namespace AppointVaAPI.Models.Dtos.Citas;

public class MarcarPagoDto
{
    public bool Pagada { get; set; }

    [MaxLength(30)]
    public string? MetodoPago { get; set; }

    public decimal? MontoCobrado  { get; set; }
    public decimal? MontoRecibido { get; set; }
    public decimal? Cambio        { get; set; }
}
```

- [ ] **Step 4: Add new fields to `CitaDto.cs`**

Open `AppointVaAPI/Models/Dtos/Citas/CitaDto.cs`. After the existing `MetodoPago` property, add:

```csharp
public decimal?  MontoCobrado  { get; set; }
public decimal?  MontoRecibido { get; set; }
public decimal?  Cambio        { get; set; }
public DateTime? FechaPago     { get; set; }
```

- [ ] **Step 5: Update `MarcarPago` in `CitasController.cs`**

Replace the current `MarcarPago` method (lines 319–333) with:

```csharp
[HttpPatch("{id:guid}/pago")]
public async Task<IActionResult> MarcarPago(Guid id, [FromBody] MarcarPagoDto dto)
{
    if (_contexto.NegocioId is null) return Unauthorized();

    var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
    if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });

    // Empleados solo pueden cobrar sus propias citas
    if (_contexto.Rol == Roles.Empleado)
    {
        var empleado = await _db.Empleados
            .FirstOrDefaultAsync(e => e.UsuarioId == _contexto.UsuarioId
                                   && e.NegocioId == _contexto.NegocioId);
        if (empleado is null || cita.EmpleadoId != empleado.Id)
            return StatusCode(403, new { mensaje = "Solo puedes registrar pagos de tus propias citas" });
    }

    cita.Pagada        = dto.Pagada;
    cita.MetodoPago    = dto.Pagada ? dto.MetodoPago    : null;
    cita.MontoCobrado  = dto.Pagada ? dto.MontoCobrado  : null;
    cita.MontoRecibido = dto.Pagada ? dto.MontoRecibido : null;
    cita.Cambio        = dto.Pagada ? dto.Cambio        : null;
    cita.FechaPago     = dto.Pagada ? DateTime.UtcNow   : null;
    cita.RegistradoPorId = dto.Pagada ? _contexto.UsuarioId : null;
    cita.FechaActualizacion = DateTime.UtcNow;

    await _citaRepo.ActualizarAsync(cita);
    return Ok(MapearDto(cita));
}
```

- [ ] **Step 6: Update `MapearDto` in `CitasController.cs`**

Find the private `MapearDto` method. Add the new fields to the object initializer:

```csharp
MontoCobrado  = cita.MontoCobrado,
MontoRecibido = cita.MontoRecibido,
Cambio        = cita.Cambio,
FechaPago     = cita.FechaPago,
```

- [ ] **Step 7: Build and verify**

```bash
cd AppointVaAPI
dotnet build
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 8: Run the app and test the endpoint manually**

```bash
dotnet run
```

Using an HTTP client (REST Client / Postman), send:
```
PATCH /api/citas/{valid-cita-id}/pago
Authorization: Bearer {token-propietario}
Content-Type: application/json

{
  "pagada": true,
  "metodoPago": "Efectivo",
  "montoCobrado": 280.00,
  "montoRecibido": 300.00,
  "cambio": 20.00
}
```

Expected response: 200 with `cita.pagada = true`, `cita.montoCobrado = 280.00`, `cita.cambio = 20.00`.

- [ ] **Step 9: Commit**

```bash
git add AppointVaAPI/Models/Cita.cs \
        AppointVaAPI/Models/Dtos/Citas/MarcarPagoDto.cs \
        AppointVaAPI/Models/Dtos/Citas/CitaDto.cs \
        AppointVaAPI/Controllers/V1/CitasController.cs \
        AppointVaAPI/Program.cs
git commit -m "feat(pagos): extend Cita payment fields and enforce employee guard"
```

---

### Task 2: Backend — Feature flag ModuloPagosHabilitado

**Files:**
- Modify: `AppointVaAPI/Models/Negocio.cs`
- Modify: `AppointVaAPI/Program.cs`
- Modify: `AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs`
- Modify: relevant NegocioDto or PerfilNegocioDto that `GET /api/negocios/perfil` returns

**Interfaces:**
- Produces: `GET /api/negocios/perfil` includes `moduloPagosHabilitado: bool`; `PATCH /api/admin/negocios/{id}/modulo-pagos` toggles the flag

- [ ] **Step 1: Add field to `Negocio.cs`**

After `public bool ListaEsperaActiva { get; set; } = false;`, add:

```csharp
public bool ModuloPagosHabilitado { get; set; } = false;
```

- [ ] **Step 2: Add inline SQL migration to `Program.cs`**

In the same migration block from Task 1, add:

```csharp
await db.Database.ExecuteSqlRawAsync("""
    ALTER TABLE "Negocios" ADD COLUMN IF NOT EXISTS "ModuloPagosHabilitado" boolean NOT NULL DEFAULT false;
""");
```

- [ ] **Step 3: Add field to the NegocioDto that `GET /api/negocios/perfil` returns**

Find the DTO class returned by the profile endpoint (search for `PerfilNegocioDto` or `NegocioDto` in `Models/Dtos/`). Add:

```csharp
public bool ModuloPagosHabilitado { get; set; }
```

Also add its mapping (wherever `MapearPerfil` or the profile mapper is):

```csharp
ModuloPagosHabilitado = negocio.ModuloPagosHabilitado,
```

- [ ] **Step 4: Add SuperAdmin toggle endpoint to `SuscripcionAdminController.cs`**

Add after the existing endpoints:

```csharp
[HttpPatch("negocios/{id:guid}/modulo-pagos")]
public async Task<IActionResult> ToggleModuloPagos(Guid id, [FromBody] ToggleModuloPagosDto dto)
{
    var negocio = await _db.Negocios.FindAsync(id);
    if (negocio is null) return NotFound(new { mensaje = "Negocio no encontrado" });

    negocio.ModuloPagosHabilitado = dto.Habilitado;
    negocio.FechaActualizacion = DateTime.UtcNow;
    await _db.SaveChangesAsync();

    return Ok(new { negocioId = id, moduloPagosHabilitado = negocio.ModuloPagosHabilitado });
}
```

- [ ] **Step 5: Create `ToggleModuloPagosDto.cs`**

Create `AppointVaAPI/Models/Dtos/Admin/ToggleModuloPagosDto.cs`:

```csharp
namespace AppointVaAPI.Models.Dtos.Admin;

public class ToggleModuloPagosDto
{
    public bool Habilitado { get; set; }
}
```

- [ ] **Step 6: Build and test**

```bash
dotnet build
```

Test with:
```
PATCH /api/admin/negocios/{negocio-id}/modulo-pagos
Authorization: Bearer {superadmin-token}
Content-Type: application/json

{ "habilitado": true }
```

Expected: 200 `{ "negocioId": "...", "moduloPagosHabilitado": true }`.

Then `GET /api/negocios/perfil` with a token from that negocio should include `"moduloPagosHabilitado": true`.

- [ ] **Step 7: Commit**

```bash
git add AppointVaAPI/Models/Negocio.cs \
        AppointVaAPI/Models/Dtos/Admin/ToggleModuloPagosDto.cs \
        AppointVaAPI/Controllers/V1/SuscripcionAdminController.cs \
        AppointVaAPI/Program.cs
git commit -m "feat(pagos): add ModuloPagosHabilitado flag on Negocio with SuperAdmin toggle"
```

---

### Task 3: Backend — Receipt email endpoint

**Files:**
- Modify: `AppointVaAPI/Services/IEmailService.cs`
- Modify: `AppointVaAPI/Services/EmailService.cs`
- Modify: `AppointVaAPI/Jobs/NotificacionJob.cs`
- Modify: `AppointVaAPI/Controllers/V1/CitasController.cs`

**Interfaces:**
- Produces: `POST /api/citas/{id}/ticket-email` — 200 if enqueued, 400 if not paid or no client email, 404 if not found

- [ ] **Step 1: Add method to `IEmailService.cs`**

```csharp
Task EnviarTicketCitaAsync(
    string destinoEmail,
    string clienteNombre,
    string negocioNombre,
    string servicio,
    DateTime fechaCita,
    decimal montoCobrado,
    string metodoPago,
    decimal? cambio);
```

- [ ] **Step 2: Implement `EnviarTicketCitaAsync` in `EmailService.cs`**

Add the method and a private `PlantillaTicket()` helper:

```csharp
public async Task EnviarTicketCitaAsync(
    string destinoEmail, string clienteNombre, string negocioNombre,
    string servicio, DateTime fechaCita, decimal montoCobrado,
    string metodoPago, decimal? cambio)
{
    if (!_habilitado) return;
    var html = PlantillaTicket(clienteNombre, negocioNombre, servicio,
                               fechaCita, montoCobrado, metodoPago, cambio);
    await EnviarAsync(destinoEmail, $"Recibo de pago — {negocioNombre}", html);
}

private static string PlantillaTicket(
    string clienteNombre, string negocioNombre, string servicio,
    DateTime fechaCita, decimal montoCobrado, string metodoPago, decimal? cambio)
{
    var fecha = fechaCita.ToString("dd 'de' MMMM yyyy, HH:mm", new System.Globalization.CultureInfo("es-MX"));
    var cambioHtml = cambio.HasValue && cambio > 0
        ? $"<tr><td>Cambio</td><td><strong>${cambio:F2}</strong></td></tr>"
        : "";
    return $"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#334155;margin-bottom:4px;">{negocioNombre}</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">Recibo de pago</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="background:#f8fafc;"><td style="padding:8px 12px;">Cliente</td><td style="padding:8px 12px;"><strong>{clienteNombre}</strong></td></tr>
        <tr><td style="padding:8px 12px;">Servicio</td><td style="padding:8px 12px;">{servicio}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:8px 12px;">Fecha</td><td style="padding:8px 12px;">{fecha}</td></tr>
        <tr><td style="padding:8px 12px;">Método</td><td style="padding:8px 12px;">{metodoPago}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:8px 12px;">Total</td><td style="padding:8px 12px;"><strong style="color:#c8a961;">${montoCobrado:F2}</strong></td></tr>
        {cambioHtml}
      </table>
      <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;">Gracias por su visita · AppointVa</p>
    </div>
    """;
}
```

- [ ] **Step 3: Add `EnviarTicketAsync` to `NotificacionJob.cs`**

Add to the existing `NotificacionJob` class:

```csharp
public async Task EnviarTicketAsync(Guid citaId)
{
    var cita = await _db.Citas
        .Include(c => c.Cliente)
        .Include(c => c.Servicio)
        .Include(c => c.Negocio)
        .FirstOrDefaultAsync(c => c.Id == citaId);

    if (cita is null || string.IsNullOrEmpty(cita.Cliente?.Email)) return;

    await _emailService.EnviarTicketCitaAsync(
        destinoEmail:   cita.Cliente.Email,
        clienteNombre:  cita.Cliente.Nombre,
        negocioNombre:  cita.Negocio.Nombre,
        servicio:       cita.Servicio.Nombre,
        fechaCita:      cita.InicioEn,
        montoCobrado:   cita.MontoCobrado ?? cita.Precio,
        metodoPago:     cita.MetodoPago ?? "No especificado",
        cambio:         cita.Cambio);
}
```

- [ ] **Step 4: Add `POST /citas/{id}/ticket-email` to `CitasController.cs`**

Add after `MarcarPago`:

```csharp
[HttpPost("{id:guid}/ticket-email")]
public async Task<IActionResult> EnviarTicketEmail(Guid id)
{
    if (_contexto.NegocioId is null) return Unauthorized();

    var cita = await _citaRepo.ObtenerPorIdAsync(id, _contexto.NegocioId.Value);
    if (cita is null) return NotFound(new { mensaje = "Cita no encontrada" });
    if (!cita.Pagada) return BadRequest(new { mensaje = "La cita no ha sido pagada aún" });

    var cliente = await _db.Clientes.FindAsync(cita.ClienteId);
    if (string.IsNullOrEmpty(cliente?.Email))
        return BadRequest(new { mensaje = "El cliente no tiene correo electrónico registrado" });

    _jobClient.Enqueue<NotificacionJob>(j => j.EnviarTicketAsync(id));
    return Ok(new { mensaje = "Ticket enviado al correo del cliente" });
}
```

- [ ] **Step 5: Build and test**

```bash
dotnet build
```

Test manually:
1. Mark a cita as paid via `PATCH /citas/{id}/pago`
2. `POST /api/citas/{id}/ticket-email` → expect 200 with `{ mensaje: "Ticket enviado..." }`
3. If client has no email → expect 400

- [ ] **Step 6: Commit**

```bash
git add AppointVaAPI/Services/IEmailService.cs \
        AppointVaAPI/Services/EmailService.cs \
        AppointVaAPI/Jobs/NotificacionJob.cs \
        AppointVaAPI/Controllers/V1/CitasController.cs
git commit -m "feat(pagos): add receipt email endpoint and Brevo template"
```

---

### Task 4: Frontend — Types + API layer + useModuloPagos hook

**Files:**
- Modify: `Front/src/types/index.ts`
- Create: `Front/src/api/pagos.ts`
- Create: `Front/src/hooks/useModuloPagos.ts`

**Interfaces:**
- Produces: `pagosApi.registrar(citaId, dto)` → `CitaDto`; `pagosApi.enviarTicketEmail(citaId)` → `void`; `useModuloPagos()` → `{ habilitado: boolean, isLoading: boolean }`

- [ ] **Step 1: Update `CitaDto` in `Front/src/types/index.ts`**

Find the `CitaDto` interface (line ~173). Add after `metodoPago`:

```typescript
montoCobrado?: number | null;
montoRecibido?: number | null;
cambio?: number | null;
fechaPago?: string | null;
```

Also find the negocio profile type (look for `NegocioPerfilDto` or similar interface). Add:

```typescript
moduloPagosHabilitado: boolean;
```

- [ ] **Step 2: Create `Front/src/api/pagos.ts`**

```typescript
import { api } from "./axios";
import type { CitaDto } from "../types";

export interface RegistrarPagoPayload {
  pagada: boolean;
  metodoPago?: string;
  montoCobrado?: number;
  montoRecibido?: number;
  cambio?: number;
}

export const pagosApi = {
  registrar: async (citaId: string, payload: RegistrarPagoPayload): Promise<CitaDto> => {
    const { data } = await api.patch(`/citas/${citaId}/pago`, payload);
    return data;
  },

  enviarTicketEmail: async (citaId: string): Promise<void> => {
    await api.post(`/citas/${citaId}/ticket-email`);
  },
};
```

- [ ] **Step 3: Create `Front/src/hooks/useModuloPagos.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

export function useModuloPagos() {
  const { data, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });
  return {
    habilitado: data?.moduloPagosHabilitado ?? false,
    isLoading,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd Front
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add Front/src/types/index.ts Front/src/api/pagos.ts Front/src/hooks/useModuloPagos.ts
git commit -m "feat(pagos): add payment types, pagosApi, and useModuloPagos hook"
```

---

### Task 5: Frontend — TicketRecibo component

**Files:**
- Create: `Front/src/components/dashboard/TicketRecibo.tsx`
- Create: `Front/src/components/dashboard/TicketRecibo.test.tsx`

**Interfaces:**
- Consumes: `CitaDto` (from Task 4), `negocioNombre: string`, `onClose: () => void`, `onEnviarEmail: () => void`, `enviandoEmail: boolean`
- Produces: a printable div with `id="ticket-recibo"` and a `<style>` block for `@media print`

- [ ] **Step 1: Write the failing test**

Create `Front/src/components/dashboard/TicketRecibo.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketRecibo from "./TicketRecibo";
import type { CitaDto } from "../../types";

const cita: CitaDto = {
  id: "cita-1",
  nombreCliente: "Ana García",
  servicio: "Corte de dama",
  nombreEmpleado: "Sofía Hernández",
  precio: 280,
  montoCobrado: 280,
  montoRecibido: 300,
  cambio: 20,
  metodoPago: "Efectivo",
  fechaPago: "2026-07-31T15:00:00Z",
  inicioEn: "2026-07-31T11:30:00Z",
  pagada: true,
  estado: 2,
  estadoTexto: "Confirmada",
};

describe("TicketRecibo", () => {
  it("muestra el nombre del cliente", () => {
    render(
      <TicketRecibo
        cita={cita}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={vi.fn()}
        enviandoEmail={false}
      />
    );
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("muestra el monto cobrado y el cambio", () => {
    render(
      <TicketRecibo
        cita={cita}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={vi.fn()}
        enviandoEmail={false}
      />
    );
    expect(screen.getByText(/\$280/)).toBeInTheDocument();
    expect(screen.getByText(/\$20/)).toBeInTheDocument();
  });

  it("llama onEnviarEmail al presionar el botón de email", async () => {
    const onEnviarEmail = vi.fn();
    render(
      <TicketRecibo
        cita={cita}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={onEnviarEmail}
        enviandoEmail={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /email/i }));
    expect(onEnviarEmail).toHaveBeenCalledOnce();
  });

  it("no muestra fila de cambio si metodoPago no es Efectivo", () => {
    render(
      <TicketRecibo
        cita={{ ...cita, metodoPago: "Tarjeta", cambio: null }}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={vi.fn()}
        enviandoEmail={false}
      />
    );
    expect(screen.queryByText(/cambio/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/dashboard/TicketRecibo.test.tsx
```

Expected: FAIL — `TicketRecibo` not found.

- [ ] **Step 3: Implement `TicketRecibo.tsx`**

```typescript
import { Printer, Mail } from "lucide-react";
import type { CitaDto } from "../../types";

interface Props {
  cita: CitaDto;
  negocioNombre: string;
  onClose: () => void;
  onEnviarEmail: () => void;
  enviandoEmail: boolean;
}

export default function TicketRecibo({ cita, negocioNombre, onClose, onEnviarEmail, enviandoEmail }: Props) {
  const fecha = cita.inicioEn
    ? new Date(cita.inicioEn).toLocaleDateString("es-MX", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const mostrarCambio = cita.metodoPago === "Efectivo" && cita.cambio != null && cita.cambio > 0;

  const handlePrint = () => window.print();

  return (
    <>
      {/* Estilos de impresión 80mm */}
      <style>{`
        @media print {
          body > *:not(#ticket-recibo-wrapper) { display: none !important; }
          #ticket-recibo-wrapper { display: block !important; }
          @page { size: 80mm auto; margin: 4mm; }
        }
      `}</style>

      <div id="ticket-recibo-wrapper">
        <div
          id="ticket-recibo"
          className="bg-white text-gray-900 font-mono text-xs leading-relaxed p-4"
          style={{ width: "100%", maxWidth: "302px", margin: "0 auto" }}
        >
          {/* Encabezado */}
          <div className="text-center mb-3 border-b border-dashed border-gray-300 pb-3">
            <p className="font-bold text-sm">{negocioNombre}</p>
            <p className="text-gray-500 text-[10px]">Comprobante de pago</p>
          </div>

          {/* Datos de la cita */}
          <table className="w-full mb-3">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-2">Cliente</td>
                <td className="text-right font-medium">{cita.nombreCliente}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-2">Servicio</td>
                <td className="text-right">{cita.servicio}</td>
              </tr>
              {cita.nombreEmpleado && (
                <tr>
                  <td className="text-gray-500 pr-2">Atendió</td>
                  <td className="text-right">{cita.nombreEmpleado}</td>
                </tr>
              )}
              <tr>
                <td className="text-gray-500 pr-2">Fecha</td>
                <td className="text-right">{fecha}</td>
              </tr>
            </tbody>
          </table>

          {/* Montos */}
          <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="text-gray-500 pr-2">Método</td>
                  <td className="text-right">{cita.metodoPago}</td>
                </tr>
                <tr>
                  <td className="text-gray-500 pr-2">Total</td>
                  <td className="text-right font-bold">
                    ${(cita.montoCobrado ?? cita.precio).toFixed(2)}
                  </td>
                </tr>
                {cita.montoRecibido != null && (
                  <tr>
                    <td className="text-gray-500 pr-2">Recibido</td>
                    <td className="text-right">${cita.montoRecibido.toFixed(2)}</td>
                  </tr>
                )}
                {mostrarCambio && (
                  <tr>
                    <td className="text-gray-500 pr-2">Cambio</td>
                    <td className="text-right font-bold">${cita.cambio!.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pie */}
          <div className="text-center text-[10px] text-gray-400 border-t border-dashed border-gray-300 pt-3">
            <p>Gracias por su visita</p>
            <p>AppointVa</p>
          </div>
        </div>
      </div>

      {/* Botones de acción (se ocultan al imprimir) */}
      <div className="print:hidden flex gap-2 mt-4 justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <Printer size={15} /> Imprimir ticket
        </button>
        <button
          onClick={onEnviarEmail}
          disabled={enviandoEmail}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition"
        >
          <Mail size={15} /> {enviandoEmail ? "Enviando…" : "Enviar por email"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Cerrar
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/dashboard/TicketRecibo.test.tsx
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add Front/src/components/dashboard/TicketRecibo.tsx \
        Front/src/components/dashboard/TicketRecibo.test.tsx
git commit -m "feat(pagos): add TicketRecibo printable component with 80mm CSS"
```

---

### Task 6: Frontend — PagosPage

**Files:**
- Create: `Front/src/pages/dashboard/PagosPage.tsx`
- Create: `Front/src/pages/dashboard/PagosPage.test.tsx`

**Interfaces:**
- Consumes: `citasApi.obtenerTodas(filtros)`, `pagosApi.registrar()`, `pagosApi.enviarTicketEmail()`, `TicketRecibo`, `useAuthStore`, `negociosApi.obtenerPerfil`
- Produces: route `/dashboard/pagos` renders a card grid with payment flow

- [ ] **Step 1: Write the failing tests**

Create `Front/src/pages/dashboard/PagosPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PagosPage from "./PagosPage";

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn().mockResolvedValue({
      datos: [
        {
          id: "cita-1",
          nombreCliente: "Ana García",
          servicio: "Corte de dama",
          nombreEmpleado: "Sofía Hernández",
          precio: 280,
          pagada: false,
          estado: 2,
          estadoTexto: "Confirmada",
          inicioEn: "2026-07-31T11:30:00Z",
          finEn: "2026-07-31T12:00:00Z",
        },
      ],
      total: 1,
    }),
  },
  METODOS_PAGO: ["Efectivo", "Tarjeta", "Transferencia"],
  ESTADOS: [],
}));

vi.mock("../../api/pagos", () => ({
  pagosApi: {
    registrar: vi.fn().mockResolvedValue({
      id: "cita-1",
      pagada: true,
      metodoPago: "Efectivo",
      montoCobrado: 280,
      montoRecibido: 300,
      cambio: 20,
    }),
    enviarTicketEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn().mockResolvedValue({
      nombre: "Salón Test",
      moduloPagosHabilitado: true,
    }),
  },
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    usuario: { rol: "Propietario", nombreCompleto: "Roberto Hilario" },
  })),
}));

vi.mock("../../components/dashboard/TicketRecibo", () => ({
  default: ({ cita }: { cita: { nombreCliente: string } }) => (
    <div data-testid="ticket-recibo">{cita.nombreCliente}</div>
  ),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PagosPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PagosPage", () => {
  it("muestra las citas como cards", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Ana García")).toBeInTheDocument();
    });
  });

  it("botón Cobrar abre el modal de pago", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    expect(screen.getByText(/registrar pago/i)).toBeInTheDocument();
  });

  it("muestra el cálculo del cambio al ingresar monto en efectivo", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /efectivo/i }));
    const input = screen.getByPlaceholderText(/monto recibido/i);
    await userEvent.clear(input);
    await userEvent.type(input, "300");
    expect(screen.getByText(/cambio/i)).toBeInTheDocument();
    expect(screen.getByText(/\$20/)).toBeInTheDocument();
  });

  it("muestra el ticket tras confirmar el pago", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /tarjeta/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar pago/i }));
    await waitFor(() => {
      expect(screen.getByTestId("ticket-recibo")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/pages/dashboard/PagosPage.test.tsx
```

Expected: FAIL — `PagosPage` not found.

- [ ] **Step 3: Implement `PagosPage.tsx`**

```typescript
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Clock, CheckCircle2, Circle } from "lucide-react";
import { citasApi, METODOS_PAGO } from "../../api/citas";
import { pagosApi } from "../../api/pagos";
import { negociosApi } from "../../api/negocios";
import { useAuthStore } from "../../store/authStore";
import Modal from "../../components/ui/Modal";
import TicketRecibo from "../../components/dashboard/TicketRecibo";
import type { CitaDto } from "../../types";

type FiltroEstadoPago = "todas" | "pendientes" | "pagadas";
type FiltroPeriodo = "hoy" | "semana" | "mes";

const hoy = () => new Date().toISOString().slice(0, 10);
const inicioSemana = () => {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0, 10);
};
const finSemana = () => {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + 7); return d.toISOString().slice(0, 10);
};
const inicioMes = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const finMes = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

const PERIODOS: { key: FiltroPeriodo; label: string; desde: () => string; hasta: () => string }[] = [
  { key: "hoy",    label: "Hoy",   desde: hoy,        hasta: hoy },
  { key: "semana", label: "Semana", desde: inicioSemana, hasta: finSemana },
  { key: "mes",    label: "Mes",   desde: inicioMes,   hasta: finMes },
];

const METODO_ICONO: Record<string, string> = {
  Efectivo: "💵", Tarjeta: "💳", Transferencia: "🏦",
};

export default function PagosPage() {
  const qc = useQueryClient();
  const { usuario } = useAuthStore();
  const esEmpleado = usuario?.rol === "Empleado";

  const [periodo, setPeriodo] = useState<FiltroPeriodo>("hoy");
  const [filtroPago, setFiltroPago] = useState<FiltroEstadoPago>("pendientes");
  const [citaSel, setCitaSel] = useState<CitaDto | null>(null);
  const [metodoPago, setMetodoPago] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [citaPagada, setCitaPagada] = useState<CitaDto | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const periodoActivo = PERIODOS.find((p) => p.key === periodo)!;

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pagina, isLoading } = useQuery({
    queryKey: ["citas-pagos", periodo],
    queryFn: () =>
      citasApi.obtenerTodas({
        desde: periodoActivo.desde(),
        hasta: periodoActivo.hasta(),
        pagina: 1,
        porPagina: 200,
      }),
  });

  const citas = useMemo(() => {
    const todas = pagina?.datos ?? [];
    if (filtroPago === "pendientes") return todas.filter((c) => !c.pagada);
    if (filtroPago === "pagadas") return todas.filter((c) => c.pagada);
    return todas;
  }, [pagina, filtroPago]);

  const mutPagar = useMutation({
    mutationFn: (payload: { id: string; montoRec: number }) =>
      pagosApi.registrar(payload.id, {
        pagada: true,
        metodoPago,
        montoCobrado: citaSel?.precio,
        montoRecibido: metodoPago === "Efectivo" ? payload.montoRec : undefined,
        cambio:
          metodoPago === "Efectivo" && payload.montoRec > (citaSel?.precio ?? 0)
            ? payload.montoRec - (citaSel?.precio ?? 0)
            : undefined,
      }),
    onSuccess: (citaActualizada) => {
      qc.invalidateQueries({ queryKey: ["citas-pagos"] });
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaSel(null);
      setMetodoPago("");
      setMontoRecibido("");
      setCitaPagada(citaActualizada);
    },
  });

  const cambio =
    metodoPago === "Efectivo" && montoRecibido && citaSel
      ? parseFloat(montoRecibido) - citaSel.precio
      : null;

  const puedeConfirmar =
    metodoPago !== "" &&
    (metodoPago !== "Efectivo" || (parseFloat(montoRecibido || "0") >= (citaSel?.precio ?? 0)));

  const handleConfirmar = () => {
    if (!citaSel) return;
    mutPagar.mutate({ id: citaSel.id, montoRec: parseFloat(montoRecibido || "0") });
  };

  const handleEnviarEmail = async () => {
    if (!citaPagada) return;
    setEnviandoEmail(true);
    try {
      await pagosApi.enviarTicketEmail(citaPagada.id);
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Registro de pagos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {esEmpleado ? "Tus citas del período seleccionado" : "Citas del período seleccionado"}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Período */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Período</p>
          <div className="flex gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                  periodo === p.key
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Estado de pago */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Estado</p>
          <div className="flex gap-1">
            {(["pendientes", "todas", "pagadas"] as FiltroEstadoPago[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroPago(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition capitalize ${
                  filtroPago === f
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                }`}
              >
                {f === "pendientes" ? "Pendientes" : f === "pagadas" ? "Pagadas" : "Todas"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : citas.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {filtroPago === "pendientes"
              ? "No hay citas pendientes de pago en este período"
              : "No hay citas en este período"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {citas.map((cita) => (
            <CitaCard key={cita.id} cita={cita} onCobrar={() => { setCitaSel(cita); setMetodoPago(""); setMontoRecibido(""); }} />
          ))}
        </div>
      )}

      {/* Modal: registrar pago */}
      <Modal
        abierto={!!citaSel}
        onCerrar={() => { setCitaSel(null); setMetodoPago(""); setMontoRecibido(""); }}
        titulo="Registrar pago"
        ancho="sm"
      >
        {citaSel && (
          <div className="space-y-4">
            {/* Resumen cita */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{citaSel.nombreCliente}</p>
              <p className="text-gray-500 dark:text-gray-400">{citaSel.servicio}</p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-2">
                ${citaSel.precio.toFixed(2)}
              </p>
            </div>

            {/* Método de pago */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {METODOS_PAGO.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMetodoPago(m); setMontoRecibido(""); }}
                    className={`py-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-1 transition ${
                      metodoPago === m
                        ? "bg-slate-700 text-white border-slate-700"
                        : "border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <span className="text-xl">{METODO_ICONO[m]}</span>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Monto recibido (solo efectivo) */}
            {metodoPago === "Efectivo" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Monto recibido
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={citaSel.precio}
                  placeholder="Monto recibido"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  className="mt-1 w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
                {cambio !== null && cambio >= 0 && (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    Cambio: <span className="font-bold">${cambio.toFixed(2)}</span>
                  </p>
                )}
                {cambio !== null && cambio < 0 && (
                  <p className="mt-2 text-sm text-red-500">
                    El monto recibido es menor al total
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleConfirmar}
              disabled={!puedeConfirmar || mutPagar.isPending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
            >
              {mutPagar.isPending ? "Procesando…" : "Confirmar pago"}
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: ticket de recibo */}
      <Modal
        abierto={!!citaPagada}
        onCerrar={() => setCitaPagada(null)}
        titulo="Pago registrado"
        ancho="sm"
      >
        {citaPagada && (
          <TicketRecibo
            cita={citaPagada}
            negocioNombre={negocio?.nombre ?? ""}
            onClose={() => setCitaPagada(null)}
            onEnviarEmail={handleEnviarEmail}
            enviandoEmail={enviandoEmail}
          />
        )}
      </Modal>
    </div>
  );
}

/* ── CitaCard ─────────────────────────────────────────────── */
function CitaCard({ cita, onCobrar }: { cita: CitaDto; onCobrar: () => void }) {
  const hora = cita.inicioEn
    ? new Date(cita.inicioEn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className={`bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3 shadow-sm ${
      cita.pagada ? "border-emerald-100 dark:border-emerald-900/40" : "border-gray-200 dark:border-slate-600"
    }`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{cita.nombreCliente}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{cita.servicio}</p>
        </div>
        {cita.pagada ? (
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <Circle size={18} className="text-gray-300 dark:text-slate-600 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Info */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Clock size={12} /> {hora}
        </span>
        {cita.nombreEmpleado && <span className="truncate">{cita.nombreEmpleado}</span>}
      </div>

      {/* Pie */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
          ${cita.precio.toFixed(2)}
        </span>
        {cita.pagada ? (
          <span className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
            {cita.metodoPago ?? "Pagada"}
          </span>
        ) : (
          <button
            onClick={onCobrar}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition"
          >
            Cobrar
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/pages/dashboard/PagosPage.test.tsx
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add Front/src/pages/dashboard/PagosPage.tsx \
        Front/src/pages/dashboard/PagosPage.test.tsx
git commit -m "feat(pagos): add PagosPage with card grid, payment drawer, and change calculation"
```

---

### Task 7: Frontend — Route + Menu integration

**Files:**
- Modify: `Front/src/App.tsx`
- Modify: `Front/src/layouts/DashboardLayout.tsx`

**Interfaces:**
- Produces: `/dashboard/pagos` renders `PagosPage`; both `NAV_PROPIETARIO` and `NAV_EMPLEADO` include the Pagos entry

- [ ] **Step 1: Add route to `App.tsx`**

Find where the other dashboard routes are defined (e.g., near `CitasPage`). Add:

```typescript
const PagosPage = lazy(() => import("./pages/dashboard/PagosPage"));
```

And in the route tree, inside `<RutaProtegida roles={["Propietario", "Empleado"]}>`:

```tsx
<Route path="pagos" element={<PagosPage />} />
```

- [ ] **Step 2: Add nav item to `DashboardLayout.tsx`**

Import the icon at the top of the file (with the other lucide imports):

```typescript
import { ..., CreditCard } from "lucide-react";
```

In `NAV_PROPIETARIO`, add before `seguridad`:

```typescript
{ to: "/dashboard/pagos", label: "Pagos", icon: CreditCard },
```

In `NAV_EMPLEADO`, add after `citas`:

```typescript
{ to: "/dashboard/pagos", label: "Pagos", icon: CreditCard },
```

- [ ] **Step 3: Verify in browser**

With the dev server running (`npm run dev`), log in as Propietario and as Empleado. Both should see "Pagos" in the sidebar. Navigating to `/dashboard/pagos` should render the page.

- [ ] **Step 4: Commit**

```bash
git add Front/src/App.tsx Front/src/layouts/DashboardLayout.tsx
git commit -m "feat(pagos): add /dashboard/pagos route and sidebar nav item"
```

---

### Task 8: Frontend — CitasPage conditional payment UI

**Files:**
- Modify: `Front/src/pages/dashboard/CitasPage.tsx`
- Modify: `Front/src/pages/dashboard/CitasPage.test.tsx`

**Interfaces:**
- Consumes: `useModuloPagos()` from Task 4
- Produces: when `habilitado === true`, the "Pago" column header, "Cobrar"/"Pagado" badge cells, and the `Modal` de pago are not rendered

- [ ] **Step 1: Write the failing test**

In `CitasPage.test.tsx`, add a new `describe` block:

```typescript
describe("integración módulo de pagos", () => {
  it("oculta la columna Pago y el botón Cobrar cuando el módulo está activo", async () => {
    // Override negocio profile to return module enabled
    vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({
      nombre: "Salón Test",
      moduloPagosHabilitado: true,
    });

    renderConQuery();
    await waitFor(() => screen.getByText("Juan Pérez")); // cita loaded

    expect(screen.queryByText("Pago")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cobrar/i })).not.toBeInTheDocument();
  });
});
```

Note: you'll also need to add `negociosApi` to the existing mocks at the top of `CitasPage.test.tsx`:

```typescript
vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerPerfil: vi.fn().mockResolvedValue({ nombre: "Salón Test", moduloPagosHabilitado: false }) },
}));
```

And add `negociosApi` to the import from `"../../api/negocios"` in the test.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/pages/dashboard/CitasPage.test.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: the new test fails (column and button still visible).

- [ ] **Step 3: Update `CitasPage.tsx`**

Add the hook import and call at the top of the component:

```typescript
import { useModuloPagos } from "../../hooks/useModuloPagos";
// inside PagosPage component:
const { habilitado: moduloPagosActivo } = useModuloPagos();
```

Wrap the "Pago" `<th>` header with a conditional:

```tsx
{!moduloPagosActivo && (
  <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Pago</th>
)}
```

Wrap the "Pago" `<td>` cell in each row with the same conditional:

```tsx
{!moduloPagosActivo && (
  <td className="hidden sm:table-cell text-center px-4 py-3">
    {/* existing cobrar/pagado button */}
  </td>
)}
```

Wrap the payment `<Modal>` (the `citaPago` modal) with the conditional:

```tsx
{!moduloPagosActivo && (
  <Modal abierto={!!citaPago} ... >
    {/* existing modal content */}
  </Modal>
)}
```

- [ ] **Step 4: Run all CitasPage tests**

```bash
npx vitest run src/pages/dashboard/CitasPage.test.tsx
```

Expected: all tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add Front/src/pages/dashboard/CitasPage.tsx \
        Front/src/pages/dashboard/CitasPage.test.tsx
git commit -m "feat(pagos): hide CitasPage payment UI when módulo pagos is active"
```

---

### Task 9: Frontend — SuperAdmin toggle UI

**Files:**
- Modify: `Front/src/api/admin.ts`
- Modify: `Front/src/pages/admin/NegociosAdminPage.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/negocios/{id}/modulo-pagos` from Task 2
- Produces: SuperAdmin sees a toggle "Módulo de pagos" per business in the admin panel

- [ ] **Step 1: Add API call to `admin.ts`**

Open `Front/src/api/admin.ts`. Add:

```typescript
toggleModuloPagos: async (negocioId: string, habilitado: boolean): Promise<void> => {
  await api.patch(`/admin/negocios/${negocioId}/modulo-pagos`, { habilitado });
},
```

- [ ] **Step 2: Add toggle to `NegociosAdminPage.tsx`**

Find where the negocio list/cards are rendered. Each negocio card should show a toggle for `ModuloPagosHabilitado`. Add a `useMutation` for the toggle:

```typescript
const mutTogglePagos = useMutation({
  mutationFn: ({ id, habilitado }: { id: string; habilitado: boolean }) =>
    adminApi.toggleModuloPagos(id, habilitado),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["admin-negocios"] });
    toast("Módulo de pagos actualizado");
  },
});
```

In the negocio card/row, add the toggle button:

```tsx
<div className="flex items-center gap-2">
  <span className="text-xs text-gray-500">Módulo pagos</span>
  <button
    onClick={() =>
      mutTogglePagos.mutate({ id: negocio.id, habilitado: !negocio.moduloPagosHabilitado })
    }
    disabled={mutTogglePagos.isPending}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
      negocio.moduloPagosHabilitado ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-600"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
        negocio.moduloPagosHabilitado ? "translate-x-4" : "translate-x-1"
      }`}
    />
  </button>
</div>
```

- [ ] **Step 3: Verify in browser**

Log in as SuperAdmin. Open the admin panel. Each negocio card should show the "Módulo pagos" toggle. Toggle it and verify the change persists (refresh page).

- [ ] **Step 4: Commit**

```bash
git add Front/src/api/admin.ts Front/src/pages/admin/NegociosAdminPage.tsx
git commit -m "feat(pagos): add SuperAdmin toggle for ModuloPagosHabilitado per business"
```

---

### Task 10: Full test run + smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
cd Front
npx vitest run
```

Expected: all 205+ tests pass (0 failures).

- [ ] **Step 2: Start dev servers and test the golden path manually**

```bash
# Terminal 1
cd Back/AppointVaAPI && dotnet run

# Terminal 2
cd Front && npm run dev
```

Golden path:
1. Log in as Propietario → sidebar shows "Pagos"
2. Navigate to Pagos → cards appear for today's appointments
3. Click "Cobrar" on a pending cita → modal opens
4. Select "Efectivo", enter monto recibido > total → cambio appears
5. Click "Confirmar pago" → ticket modal opens with correct amounts
6. Click "Imprimir ticket" → browser print dialog opens showing 80mm receipt
7. Click "Enviar por email" → toast confirms (if client has email)
8. Navigate to Citas → payment column is hidden
9. Log in as Empleado → sidebar shows "Pagos"; only their own citas appear

SuperAdmin path:
1. Log in as SuperAdmin → admin panel
2. Find a negocio → toggle "Módulo pagos" off → verify Pagos disappears from that negocio's sidebar (requires re-login or profile refresh)

- [ ] **Step 3: Final commit if any last-minute fixes were made**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(pagos): address smoke test findings"
```

---

## Self-Review

### 1. Spec coverage

| Requirement | Task |
|---|---|
| Nueva página Pagos con cards + filtros período | Task 6 |
| Filtro Todas/Pendientes/Pagadas | Task 6 |
| Empleado ve solo sus citas (backend guard) | Task 1 |
| Drawer de pago con método + monto + cambio | Task 6 |
| Ticket imprimible 80mm | Task 5 |
| Email al cliente opcional | Task 3 + 6 |
| Feature flag `ModuloPagosHabilitado` | Task 2 |
| SuperAdmin toggle | Task 2 + 9 |
| CitasPage oculta UI de pago cuando módulo activo | Task 8 |
| Tests unitarios con cobertura | Tasks 1, 5, 6, 8 |
| Empleados en menú lateral | Task 7 |
| Nuevos campos en BD (monto, cambio, fechaPago) | Task 1 |

### 2. Type consistency

- `RegistrarPagoPayload` (api/pagos.ts) matches `MarcarPagoDto` (backend)
- `CitaDto.montoCobrado` added in Task 4 types, consumed in Tasks 5 and 6
- `useModuloPagos()` returns `{ habilitado, isLoading }` — used the same shape in Tasks 6 and 8
- `pagosApi.registrar` signature matches in `PagosPage.tsx` usage ✓
