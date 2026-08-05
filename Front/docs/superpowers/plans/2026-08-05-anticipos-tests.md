# Anticipo Feature — Test Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cover all new anticipo code (backend + frontend) that currently has zero tests.

**Tech Stack:** ASP.NET Core 8 / xUnit / FluentAssertions (backend) · Vitest + Testing Library (frontend)

## Global Constraints

- Backend test project: `c:\Cursos\AppointVa\Back\AppointVaAPI\AppointVaAPI.Tests`
- Run backend tests from: `c:\Cursos\AppointVa\Back\AppointVaAPI`
- Frontend src: `c:\Cursos\AppointVa\Front\src`
- Run frontend tests from: `c:\Cursos\AppointVa\Front` with `npx vitest run`
- No new npm packages
- TypeScript strict — no `any`
- All tests must be green; no skipped tests

---

### Task 1: Backend — PublicoController anticipo snapshot tests

**Files:**
- Create: `AppointVaAPI.Tests/Controllers/Integration/PublicoAnticipoTests.cs`

**Interfaces:**
- Consumes: existing `BookingFlowIntegrationTests.SeedNegocioAsync` pattern + `IntegrationTestBase`
- Produces: verified public booking path sets `AnticipoRequerido`/`MontoAnticipo` correctly

- [ ] **Step 1: Read `BookingFlowIntegrationTests.cs` to understand the seeding helper**

  Note the `SeedNegocioAsync()` pattern: uses `Factory.Services.CreateAsyncScope()`, adds `Negocio` + `Servicio` + `Empleado` + `EmpleadoServicio` + full-week `HorariosEmpleados`. The test class extends `IntegrationTestBase` which has `Factory`, `Client`, `NewClient()`.

- [ ] **Step 2: Create `PublicoAnticipoTests.cs`**

```csharp
using System.Net.Http.Json;
using AppointVaAPI.Data;
using AppointVaAPI.Models;
using AppointVaAPI.Models.Dtos.Publico;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AppointVaAPI.Tests.Controllers.Integration;

public class PublicoAnticipoTests : IntegrationTestBase
{
    public PublicoAnticipoTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<(Guid negocioId, string slug, Guid servicioId, Guid empleadoId)> SeedNegocioConAnticipoAsync(
        bool requiereAnticipo, int porcentaje)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var negocioId  = Guid.NewGuid();
        var slug       = "anticipo-" + negocioId.ToString("N")[..8];
        var servicioId = Guid.NewGuid();
        var empleadoId = Guid.NewGuid();

        db.Negocios.Add(new Negocio
        {
            Id = negocioId, Slug = slug, Nombre = "Salon Anticipo Test",
            ZonaHoraria = "UTC", AutoConfirmar = true, HorasCancelacion = 0,
            Activo = 1,
            RequiereAnticipo = requiereAnticipo,
            PorcentajeAnticipo = porcentaje,
            PoliticaCancelacionAnticipo = "Sin reembolso.",
            FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Servicios.Add(new Servicio
        {
            Id = servicioId, NegocioId = negocioId, Nombre = "Corte",
            DuracionMinutos = 30, BufferMinutos = 0, Precio = 200m,
            Orden = 1, Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.Empleados.Add(new Empleado
        {
            Id = empleadoId, NegocioId = negocioId, Nombre = "Empleado",
            Activo = 1, FechaCreacion = DateTime.UtcNow, FechaActualizacion = DateTime.UtcNow,
        });
        db.EmpleadosServicios.Add(new EmpleadoServicio { EmpleadoId = empleadoId, ServicioId = servicioId });
        for (byte day = 0; day <= 6; day++)
            db.HorariosEmpleados.Add(new HorarioEmpleado
            {
                Id = Guid.NewGuid(), EmpleadoId = empleadoId, DiaSemana = day,
                HoraInicio = new TimeSpan(8, 0, 0), HoraFin = new TimeSpan(20, 0, 0), Activo = 1,
            });

        await db.SaveChangesAsync();
        return (negocioId, slug, servicioId, empleadoId);
    }

    [Fact]
    public async Task ObtenerNegocio_DevuelveAnticipoCampos()
    {
        // Arrange
        var (_, slug, _, _) = await SeedNegocioConAnticipoAsync(true, 25);
        ClearToken();

        // Act
        var response = await Client.GetAsync($"/api/publico/negocios/{slug}");

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
        var body = await response.Content.ReadFromJsonAsync<NegocioPublicoDto>();
        body.Should().NotBeNull();
        body!.PorcentajeAnticipo.Should().Be(25);
        body.PoliticaCancelacionAnticipo.Should().Be("Sin reembolso.");
    }

    [Fact]
    public async Task CrearCita_NegocioConAnticipo_SnapshotCorrecto()
    {
        // Arrange — negocio with 25% anticipo, servicio price 200 → expected MontoAnticipo = 50
        var (_, slug, servicioId, empleadoId) = await SeedNegocioConAnticipoAsync(true, 25);
        var client = NewClient();
        ClearToken();

        var inicio = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var payload = new
        {
            negocioSlug = slug,
            servicioId,
            empleadoId,
            inicioEn = inicio,
            nombreCliente = "Cliente Test",
            telefonoCliente = "5512345678",
            emailCliente = "test@test.com",
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/publico/citas", payload);

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
        var confirmacion = await response.Content.ReadFromJsonAsync<ConfirmacionCitaDto>();
        confirmacion.Should().NotBeNull();
        confirmacion!.AnticipoRequerido.Should().BeTrue();
        confirmacion.MontoAnticipo.Should().Be(50m); // Math.Round(200 * 25 / 100, 2)
    }

    [Fact]
    public async Task CrearCita_NegocioSinAnticipo_SnapshotFalse()
    {
        // Arrange
        var (_, slug, servicioId, empleadoId) = await SeedNegocioConAnticipoAsync(false, 0);
        var client = NewClient();
        ClearToken();

        var inicio = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var payload = new
        {
            negocioSlug = slug,
            servicioId,
            empleadoId,
            inicioEn = inicio,
            nombreCliente = "Cliente Test",
            telefonoCliente = "5512345678",
            emailCliente = "test2@test.com",
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/publico/citas", payload);

        // Assert
        response.IsSuccessStatusCode.Should().BeTrue();
        var confirmacion = await response.Content.ReadFromJsonAsync<ConfirmacionCitaDto>();
        confirmacion.Should().NotBeNull();
        confirmacion!.AnticipoRequerido.Should().BeFalse();
        confirmacion.MontoAnticipo.Should().BeNull();
    }
}
```

> **Note:** `ConfirmacionCitaDto` is in `AppointVaAPI.Models.Dtos.Publico`. `NegocioPublicoDto` — find the actual DTO name returned by `GET /api/publico/negocios/{slug}` before writing — it may be a different type name. Read `PublicoController.cs` to confirm.

- [ ] **Step 3: Run the new tests**

```
dotnet test AppointVaAPI.Tests --filter "PublicoAnticipoTests"
```

Expected: 3 passing.

- [ ] **Step 4: Run full suite to confirm no regressions**

```
dotnet test AppointVaAPI.Tests
```

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```
git add AppointVaAPI.Tests/Controllers/Integration/PublicoAnticipoTests.cs
git commit -m "test(anticipos): coverage for PublicoController anticipo snapshot"
```

---

### Task 2: Frontend — CitasPage anticipo badge + button tests

**Files:**
- Modify: `Front/src/pages/dashboard/CitasPage.test.tsx`

**Interfaces:**
- Consumes: existing `vi.mock("../../api/citas")` + `vi.mock("../../api/negocios")` mocks in the file
- Add `registrarAnticipo` to the citas mock

- [ ] **Step 1: Read the full `CitasPage.test.tsx`** to understand the mock structure, how `citasApi.obtenerTodas` is mocked, and what `makeCita` or inline cita objects look like.

- [ ] **Step 2: Add `registrarAnticipo` to the citas API mock**

In the existing `vi.mock("../../api/citas", ...)` block, add:

```typescript
registrarAnticipo: vi.fn().mockResolvedValue({}),
```

- [ ] **Step 3: Add 4 new test cases** for the anticipo badge and button.

Add a `describe("anticipo badge y botón", ...)` block at the end of the file:

```typescript
describe("anticipo badge y botón", () => {
  function renderWithCitas(citas: object[]) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: citas,
      total: citas.length,
      pagina: 1,
      tamano: 200,
    });
    return render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <CitasPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  const baseCita = {
    id: "cita-anticipo",
    codigoConfirmacion: "ANT001",
    clienteId: "c1",
    empleadoId: "e1",
    servicioId: "s1",
    nombreCliente: "Luis Pérez",
    telefonoCliente: "555-0001",
    nombreEmpleado: "Ana Gómez",
    nombreServicio: "Corte",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    estado: 2,
    estadoTexto: "Confirmada",
    inicioEn: new Date(Date.now() + 86400000).toISOString(),
    finEn: new Date(Date.now() + 86400000 + 1800000).toISOString(),
  };

  it("no muestra badge cuando anticipoRequerido es false", async () => {
    renderWithCitas([{ ...baseCita, anticipoRequerido: false }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.queryByText(/Anticipo/)).toBeNull();
  });

  it("muestra badge ámbar cuando anticipo pendiente", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: false,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.getByText("⏳ Anticipo")).toBeInTheDocument();
  });

  it("muestra badge verde cuando anticipo recibido", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: true,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.getByText("✓ Anticipo")).toBeInTheDocument();
  });

  it("muestra botón $ Anticipo cuando pendiente y no pagada", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: false,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.getByText("$ Anticipo")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

```
cd c:\Cursos\AppointVa\Front && npx vitest run src/pages/dashboard/CitasPage.test.tsx
```

Expected: all passing (existing + 4 new).

- [ ] **Step 5: Commit**

```
git add Front/src/pages/dashboard/CitasPage.test.tsx
git commit -m "test(anticipos): badge y botón en CitasPage"
```

---

### Task 3: Frontend — PagosPage anticipo banner + pre-fill tests

**Files:**
- Modify: `Front/src/pages/dashboard/PagosPage.test.tsx`

- [ ] **Step 1: Read the full `PagosPage.test.tsx`** to understand how the mock cita object is structured and where the test clicks to open the cobro modal.

- [ ] **Step 2: Add a cita fixture with anticipo** and add 3 new tests.

In the existing test file, add a `describe("anticipo en checkout", ...)` block:

```typescript
describe("anticipo en checkout", () => {
  const citaConAnticipo = {
    id: "cita-1",
    codigoConfirmacion: "ABC",
    clienteId: "c1",
    empleadoId: "e1",
    servicioId: "s1",
    nombreCliente: "Ana García",
    telefonoCliente: "555-0000",
    nombreEmpleado: "Sofía Hernández",
    nombreServicio: "Corte de dama",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    estado: 2,
    estadoTexto: "Confirmada",
    inicioEn: "2026-07-31T11:30:00Z",
    finEn: "2026-07-31T12:00:00Z",
    anticipoRequerido: true,
    anticipoRecibido: true,
    montoAnticipo: 50,
  };

  function renderWithAnticipo() {
    const { citasApi } = await import("../../api/citas"); // already mocked
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [citaConAnticipo],
      total: 1, pagina: 1, tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <MemoryRouter><QueryClientProvider client={qc}><PagosPage /></QueryClientProvider></MemoryRouter>
    );
  }

  it("muestra banner verde cuando anticipo está recibido", async () => {
    // Set mock data for this test
    vi.mocked(citasApi.obtenerTodas).mockResolvedValueOnce({
      datos: [citaConAnticipo], total: 1, pagina: 1, tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter><QueryClientProvider client={qc}><PagosPage /></QueryClientProvider></MemoryRouter>
    );
    await waitFor(() => screen.getByText("Ana García"));

    // Open cobro modal
    const cobrarBtn = screen.getByRole("button", { name: /cobrar/i });
    await userEvent.click(cobrarBtn);

    // Banner should be visible
    await waitFor(() =>
      expect(screen.getByText(/anticipo registrado/i)).toBeInTheDocument()
    );
  });

  it("pre-llena el total con precio menos anticipo", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValueOnce({
      datos: [citaConAnticipo], total: 1, pagina: 1, tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter><QueryClientProvider client={qc}><PagosPage /></QueryClientProvider></MemoryRouter>
    );
    await waitFor(() => screen.getByText("Ana García"));
    const cobrarBtn = screen.getByRole("button", { name: /cobrar/i });
    await userEvent.click(cobrarBtn);

    // Input should be pre-filled with 200 - 50 = 150
    await waitFor(() => {
      const input = screen.getByLabelText(/total a cobrar/i) as HTMLInputElement;
      expect(input.value).toBe("150");
    });
  });

  it("no muestra banner cuando anticipo no está recibido", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValueOnce({
      datos: [{
        ...citaConAnticipo,
        anticipoRecibido: false,
        montoAnticipo: 50,
      }],
      total: 1, pagina: 1, tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter><QueryClientProvider client={qc}><PagosPage /></QueryClientProvider></MemoryRouter>
    );
    await waitFor(() => screen.getByText("Ana García"));
    const cobrarBtn = screen.getByRole("button", { name: /cobrar/i });
    await userEvent.click(cobrarBtn);

    await waitFor(() => screen.getByText(/cobrar/i)); // modal open
    expect(screen.queryByText(/anticipo registrado/i)).toBeNull();
  });
});
```

> **Important:** The exact way to open the cobro modal (button label, click sequence) must match what's already in the file. Read the existing tests first and adapt.

- [ ] **Step 3: Run tests**

```
cd c:\Cursos\AppointVa\Front && npx vitest run src/pages/dashboard/PagosPage.test.tsx
```

Expected: all passing.

- [ ] **Step 4: Commit**

```
git add Front/src/pages/dashboard/PagosPage.test.tsx
git commit -m "test(anticipos): banner y pre-fill en PagosPage"
```

---

### Task 4: Frontend — PerfilPage 5-tab restructuring tests

**Files:**
- Create: `Front/src/pages/dashboard/PerfilPage.test.tsx`

- [ ] **Step 1: Read `PerfilPage.tsx`** to understand what API calls it makes (mocks needed): check imports from `api/negocios`, `api/horarios`, form hooks, etc.

- [ ] **Step 2: Create `PerfilPage.test.tsx`**

Read one other page test (e.g. `ServiciosPage.test.tsx` or `EmpleadosPage.test.tsx`) to understand the standard Vitest wrapper pattern for this project.

Then create the test file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PerfilPage from "./PerfilPage";

// Mock all external dependencies
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams(), vi.fn()] };
});

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn().mockResolvedValue({
      id: "n1", nombre: "Salón Test", slug: "salon-test", telefono: "5550000",
      email: "test@salon.com", descripcion: "", activo: true,
      requiereAnticipo: false, porcentajeAnticipo: 0,
      horasCancelacionConReembolso: 24, politicaCancelacionAnticipo: "",
      instruccionesAnticipo: "", autoConfirmar: false,
      listaEsperaActiva: false, zonaHoraria: "America/Mexico_City",
      moduloPagosHabilitado: true, planNombre: "Básico",
    }),
    actualizarPerfil: vi.fn().mockResolvedValue({}),
    actualizarColores: vi.fn().mockResolvedValue({}),
    obtenerGaleria: vi.fn().mockResolvedValue([]),
    obtenerQr: vi.fn().mockResolvedValue({ url: "" }),
  },
}));

vi.mock("../../api/horarios", () => ({
  horariosApi: {
    obtenerHorarios: vi.fn().mockResolvedValue([]),
    obtenerBloqueados: vi.fn().mockResolvedValue([]),
    guardarHorarios: vi.fn().mockResolvedValue([]),
    agregarBloqueado: vi.fn().mockResolvedValue({}),
    eliminarBloqueado: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: () => ({
    usuario: { id: "u1", nombre: "Owner", email: "owner@test.com", rol: "Propietario" },
    cerrarSesion: vi.fn(),
  }),
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: vi.fn() }),
}));

function renderPerfilPage(searchParams = "") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/perfil${searchParams}`]}>
      <QueryClientProvider client={qc}>
        <PerfilPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PerfilPage — 5 tabs", () => {
  it("muestra las 5 pestañas", async () => {
    renderPerfilPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Perfil" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Citas" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Anticipos" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Horarios" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cuenta" })).toBeInTheDocument();
    });
  });

  it("la pestaña activa por defecto es Perfil", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Perfil" }));
    // Perfil tab content should be visible (business name field)
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("clic en Anticipos muestra el toggle de RequiereAnticipo", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Anticipos" }));
    await userEvent.click(screen.getByRole("button", { name: "Anticipos" }));
    await waitFor(() =>
      expect(screen.getByText(/requerir anticipo/i)).toBeInTheDocument()
    );
  });

  it("habilitar anticipo revela el slider de porcentaje", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Anticipos" }));
    await userEvent.click(screen.getByRole("button", { name: "Anticipos" }));
    await waitFor(() => screen.getByText(/requerir anticipo/i));

    // Slider should not be visible before enabling
    expect(screen.queryByText(/porcentaje del anticipo/i)).toBeNull();

    // Enable the toggle
    const toggle = screen.getByRole("checkbox");
    await userEvent.click(toggle);

    // Slider should now be visible
    expect(screen.getByText(/porcentaje del anticipo/i)).toBeInTheDocument();
  });

  it("clic en Cuenta muestra la zona de peligro", async () => {
    renderPerfilPage();
    await waitFor(() => screen.getByRole("button", { name: "Cuenta" }));
    await userEvent.click(screen.getByRole("button", { name: "Cuenta" }));
    await waitFor(() =>
      expect(screen.getByText(/zona de peligro/i)).toBeInTheDocument()
    );
  });
});
```

> **Important:** The exact mock shape for `obtenerPerfil` must match what `PerfilPage.tsx` actually reads. Read the file first — add any field it accesses that's missing from the mock to avoid TypeScript/runtime errors during the test.

- [ ] **Step 3: Run tests**

```
cd c:\Cursos\AppointVa\Front && npx vitest run src/pages/dashboard/PerfilPage.test.tsx
```

Expected: 5 tests passing.

- [ ] **Step 4: Run full frontend test suite**

```
cd c:\Cursos\AppointVa\Front && npx vitest run
```

Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

```
git add Front/src/pages/dashboard/PerfilPage.test.tsx
git commit -m "test(mi-negocio): cobertura de PerfilPage 5 tabs"
```

---

## Post-Implementation Checklist

```
dotnet test AppointVaAPI.Tests
cd c:\Cursos\AppointVa\Front && npx vitest run
```

Both must pass with 0 failures.
