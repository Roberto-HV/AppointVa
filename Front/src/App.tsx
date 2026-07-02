import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import RutaProtegida from "./components/RutaProtegida";
import RutaPublica from "./components/RutaPublica";
import ToastContainer from "./components/ui/ToastContainer";
import { TooltipProvider } from "./components/ui/Tooltip";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";

import LoginPage from "./pages/auth/LoginPage";
import RecuperarContrasenaPage from "./pages/auth/RecuperarContrasenaPage";
import RestablecerContrasenaPage from "./pages/auth/RestablecerContrasenaPage";
import RegistroNegocioPage from "./pages/auth/RegistroNegocioPage";
import VerificarEmailPage from "./pages/auth/VerificarEmailPage";
import InicioPage from "./pages/dashboard/InicioPage";
import CitasPage from "./pages/dashboard/CitasPage";
import EmpleadosPage from "./pages/dashboard/EmpleadosPage";
import ServiciosPage from "./pages/dashboard/ServiciosPage";
import ClientesPage from "./pages/dashboard/ClientesPage";
import PerfilPage from "./pages/dashboard/PerfilPage";
import ReportesPage from "./pages/dashboard/ReportesPage";
import DosFactoresPage from "./pages/dashboard/DosFactoresPage";
import BookingPage from "./pages/publico/BookingPage";
import ConfirmacionPage from "./pages/publico/ConfirmacionPage";
import MisCitasPage from "./pages/publico/MisCitasPage";
import ResenaPage from "./pages/publico/ResenaPage";
import PrivacidadPage from "./pages/publico/PrivacidadPage";
import TerminosPage from "./pages/publico/TerminosPage";
import CancelarCitaPage from "./pages/publico/CancelarCitaPage";
import NegociosAdminPage from "./pages/admin/NegociosAdminPage";
import AuditLogPage from "./pages/admin/AuditLogPage";
import MiPerfilPage from "./pages/dashboard/MiPerfilPage";
import GaleriaPage from "./pages/dashboard/GaleriaPage";
import ListaEsperaPage from "./pages/dashboard/ListaEsperaPage";
import IntakePage from "./pages/dashboard/IntakePage";
import DescuentosPage from "./pages/dashboard/DescuentosPage";
import NotFoundPage from "./pages/NotFoundPage";

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
              {/* Accesibles para ambos roles */}
              <Route path="/dashboard" element={<InicioPage />} />
              <Route path="/dashboard/citas" element={<CitasPage />} />
              <Route path="/dashboard/seguridad" element={<DosFactoresPage />} />
              <Route path="/dashboard/mi-perfil" element={<MiPerfilPage />} />

              {/* Solo Propietario */}
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
      </BrowserRouter>
      <ToastContainer />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
