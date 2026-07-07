import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import RutaProtegida from "./components/RutaProtegida";
import RutaPublica from "./components/RutaPublica";
import ToastContainer from "./components/ui/ToastContainer";
import { TooltipProvider } from "./components/ui/Tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageLoader } from "./components/ui/Skeleton";

// ── Layouts (eager — pequeños, siempre necesarios tras login) ─────────────
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";

// ── Rutas públicas críticas (eager — primera pantalla del usuario) ─────────
import LoginPage from "./pages/auth/LoginPage";
import BookingPage from "./pages/publico/BookingPage";

// ── Auth ──────────────────────────────────────────────────────────────────
const RecuperarContrasenaPage = lazy(() => import("./pages/auth/RecuperarContrasenaPage"));
const RestablecerContrasenaPage = lazy(() => import("./pages/auth/RestablecerContrasenaPage"));
const RegistroNegocioPage = lazy(() => import("./pages/auth/RegistroNegocioPage"));
const VerificarEmailPage = lazy(() => import("./pages/auth/VerificarEmailPage"));

// ── Públicas de booking ───────────────────────────────────────────────────
const ConfirmacionPage = lazy(() => import("./pages/publico/ConfirmacionPage"));
const MisCitasPage = lazy(() => import("./pages/publico/MisCitasPage"));
const ResenaPage = lazy(() => import("./pages/publico/ResenaPage"));
const PrivacidadPage = lazy(() => import("./pages/publico/PrivacidadPage"));
const TerminosPage = lazy(() => import("./pages/publico/TerminosPage"));
const CancelarCitaPage = lazy(() => import("./pages/publico/CancelarCitaPage"));

// ── Dashboard ─────────────────────────────────────────────────────────────
const InicioPage = lazy(() => import("./pages/dashboard/InicioPage"));
const CitasPage = lazy(() => import("./pages/dashboard/CitasPage"));
const CitaDetallePage = lazy(() => import("./pages/dashboard/CitaDetallePage"));
const EmpleadosPage = lazy(() => import("./pages/dashboard/EmpleadosPage"));
const ServiciosPage = lazy(() => import("./pages/dashboard/ServiciosPage"));
const ClientesPage = lazy(() => import("./pages/dashboard/ClientesPage"));
const PerfilPage = lazy(() => import("./pages/dashboard/PerfilPage"));
const ReportesPage = lazy(() => import("./pages/dashboard/ReportesPage"));
const DosFactoresPage = lazy(() => import("./pages/dashboard/DosFactoresPage"));
const MiPerfilPage = lazy(() => import("./pages/dashboard/MiPerfilPage"));
const GaleriaPage = lazy(() => import("./pages/dashboard/GaleriaPage"));
const ListaEsperaPage = lazy(() => import("./pages/dashboard/ListaEsperaPage"));
const IntakePage = lazy(() => import("./pages/dashboard/IntakePage"));
const DescuentosPage = lazy(() => import("./pages/dashboard/DescuentosPage"));

// ── Admin ─────────────────────────────────────────────────────────────────
const NegociosAdminPage = lazy(() => import("./pages/admin/NegociosAdminPage"));
const AuditLogPage = lazy(() => import("./pages/admin/AuditLogPage"));

// ── 404 ───────────────────────────────────────────────────────────────────
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* ── Rutas públicas (redirigen si ya hay sesión) ── */}
                <Route element={<RutaPublica />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/registro" element={<RegistroNegocioPage />} />
                  <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
                  <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
                </Route>

                {/* ── Verificación de email (siempre accesible) ── */}
                <Route path="/verificar-email" element={<VerificarEmailPage />} />

                {/* ── Rutas públicas de booking (siempre accesibles) ── */}
                <Route path="/b/:slug" element={<BookingPage />} />
                <Route path="/b/:slug/confirmacion/:codigo" element={<ConfirmacionPage />} />
                <Route path="/b/:slug/mis-citas" element={<MisCitasPage />} />
                <Route path="/cita/:codigo" element={<ConfirmacionPage />} />
                <Route path="/resena/:token" element={<ResenaPage />} />
                <Route path="/privacidad" element={<PrivacidadPage />} />
                <Route path="/terminos" element={<TerminosPage />} />
                <Route path="/cancelar/:codigo" element={<CancelarCitaPage />} />

                {/* ── Dashboard (requiere auth) ── */}
                <Route element={<RutaProtegida roles={["Propietario", "Empleado"]} />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<InicioPage />} />
                    <Route path="/dashboard/citas" element={<CitasPage />} />
                    <Route path="/dashboard/citas/:id" element={<CitaDetallePage />} />
                    <Route path="/dashboard/seguridad" element={<DosFactoresPage />} />
                    <Route path="/dashboard/mi-perfil" element={<MiPerfilPage />} />

                    <Route element={<RutaProtegida roles={["Propietario"]} />}>
                      <Route path="/dashboard/empleados" element={<EmpleadosPage />} />
                      <Route path="/dashboard/servicios" element={<ServiciosPage />} />
                      <Route path="/dashboard/clientes" element={<ClientesPage />} />
                      <Route path="/dashboard/perfil" element={<PerfilPage />} />
                      <Route path="/dashboard/galeria" element={<GaleriaPage />} />
                      <Route path="/dashboard/espera" element={<ListaEsperaPage />} />
                      <Route path="/dashboard/intake" element={<IntakePage />} />
                      <Route path="/dashboard/descuentos" element={<DescuentosPage />} />
                      <Route path="/dashboard/reportes" element={<ReportesPage />} />
                    </Route>
                  </Route>
                </Route>

                {/* ── Admin (solo SuperAdmin) ── */}
                <Route element={<RutaProtegida roles={["SuperAdmin"]} />}>
                  <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<NegociosAdminPage />} />
                    <Route path="/admin/audit" element={<AuditLogPage />} />
                  </Route>
                </Route>

                {/* Default */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        <ToastContainer />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
