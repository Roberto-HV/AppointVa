// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRespuesta {
  token: string;
  tokenExpiracion: string;
  refreshToken: string;
  usuario: UsuarioInfo;
  requiere2FA?: boolean;
  challengeToken?: string;
}

export interface UsuarioInfo {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: string;
  negocioId: string | null;
}

// ── Público (booking) ─────────────────────────────────────────────────────────
export interface ImagenGaleria {
  id: string;
  url: string;
  descripcion?: string;
  orden: number;
}

export interface ResenaPublica {
  rating: number;
  comentario?: string;
  nombreCliente: string;
  fechaCreacion: string;
}

export interface NegocioPublico {
  id: string;
  slug: string;
  nombre: string;
  descripcion?: string;
  logoUrl?: string;
  portadaUrl?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  telefono?: string;
  telefonoWhatsApp?: string;
  horasCancelacion: number;
  autoConfirmar: boolean;
  requiereAnticipo: boolean;
  montoAnticipo: number;
  instruccionesAnticipo?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  servicios: ServicioPublico[];
  empleados: EmpleadoPublico[];
  galeria: ImagenGaleria[];
  promedioResenas: number;
  totalResenas: number;
  resenas: ResenaPublica[];
}

export interface ServicioPublico {
  id: string;
  categoriaId?: string;
  categoriaNombre?: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  bufferMinutos: number;
  precio: number;
  imagenUrl?: string;
  orden: number;
}

export interface EmpleadoPublico {
  id: string;
  nombre: string;
  fotoUrl?: string;
  biografia?: string;
  servicioIds: string[];
  promedioResenas: number;
  totalResenas: number;
}

export interface SlotDisponible {
  inicio: string;
  fin: string;
  horaTexto: string;
  empleadoId?: string;
  empleadoNombre?: string;
}

export interface ConfirmacionCita {
  id: string;
  codigoConfirmacion: string;
  nombreNegocio: string;
  negocioSlug: string;
  servicioId: string;
  empleadoId: string;
  nombreServicio: string;
  nombreEmpleado: string;
  nombreCliente: string;
  inicioEn: string;
  finEn: string;
  precio: number;
  estado: number;
  estadoTexto: string;
  notas?: string;
  icalUrl?: string;
  webcalUrl?: string;
  googleCalUrl?: string;
  horasCancelacion: number;
  requiereAnticipo: boolean;
  montoAnticipo: number;
  instruccionesAnticipo?: string;
  comprobanteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface ResumenDashboard {
  citasHoy: number;
  citasSemana: number;
  citasMes: number;
  ingresosHoy: number;
  ingresosSemana: number;
  ingresosMes: number;
  proximasCitas: CitaResumen[];
  topServicios: ServicioPopular[];
}

export interface PuntoDatos {
  etiqueta: string;
  citas: number;
  ingresos: number;
}

export interface CitaResumen {
  id: string;
  inicioEn: string;
  nombreCliente: string;
  nombreServicio: string;
  nombreEmpleado: string;
  estadoTexto: string;
}

export interface ServicioPopular {
  nombre: string;
  totalCitas: number;
  ingresos: number;
}

// ── Citas ─────────────────────────────────────────────────────────────────────
export interface CitaDto {
  id: string;
  codigoConfirmacion: string;
  clienteId: string;
  empleadoId: string;
  servicioId: string;
  nombreCliente: string;
  telefonoCliente: string;
  emailCliente?: string;
  nombreEmpleado: string;
  nombreServicio: string;
  duracionMinutos: number;
  precio: number;
  pagada: boolean;
  metodoPago?: string;
  inicioEn: string;
  finEn: string;
  estado: number;
  estadoTexto: string;
  notas?: string;
  motivoCancelacion?: string;
  comprobanteUrl?: string;
  fechaCreacion: string;
}

// ── Clientes ──────────────────────────────────────────────────────────────────
export interface ClienteDto {
  id: string;
  nombreCompleto: string;
  telefono: string;
  email?: string;
  notas?: string;
  totalCitas: number;
  cantidadInasistencias: number;
  ultimaCitaEn?: string;
  fechaCreacion: string;
}

export interface ClienteCitaDto {
  id: string;
  nombreServicio: string;
  nombreEmpleado: string;
  inicioEn: string;
  precio: number;
  estado: number;
  estadoTexto: string;
}

// ── Empleados ─────────────────────────────────────────────────────────────────
export interface BloqueoDto {
  id?: string;
  inicioEn: string; // ISO datetime
  finEn: string;
  motivo?: string;
}

export interface HorarioDto {
  id?: string;
  diaSemana: number; // 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
  horaInicio: string; // "09:00"
  horaFin: string;    // "19:00"
  activo: boolean;
}

export interface EmpleadoDto {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  fotoUrl?: string;
  biografia?: string;
  activo: boolean;
  servicioIds: string[];
}

export interface CrearEmpleadoDto {
  nombre: string;
  telefono?: string;
  email?: string;
  biografia?: string;
  servicioIds: string[];
}

// ── Servicios ─────────────────────────────────────────────────────────────────
export interface ServicioDto {
  id: string;
  categoriaId?: string;
  categoriaNombre?: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  bufferMinutos: number;
  precio: number;
  imagenUrl?: string;
  orden: number;
  activo: boolean;
}

export interface CategoriaDto {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface CrearServicioDto {
  categoriaId?: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  bufferMinutos: number;
  precio: number;
  orden: number;
}

// ── Negocio ───────────────────────────────────────────────────────────────────
export interface NegocioDto {
  id: string;
  slug: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  descripcion?: string;
  logoUrl?: string;
  portadaUrl?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  zonaHoraria?: string;
  moneda?: string;
  horasRecordatorio?: number;
  horasCancelacion?: number;
  autoConfirmar?: boolean;
  metodoNotificacion?: string;
  telefonoWhatsApp?: string;
  requiereAnticipo?: boolean;
  montoAnticipo?: number;
  instruccionesAnticipo?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  activo: boolean;
  planNombre?: string;
}

export interface ActualizarNegocioDto {
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  descripcion?: string;
  zonaHoraria?: string;
  horasRecordatorio?: number;
  horasCancelacion?: number;
  autoConfirmar?: boolean;
  metodoNotificacion?: string;
  telefonoWhatsApp?: string;
  requiereAnticipo?: boolean;
  montoAnticipo?: number;
  instruccionesAnticipo?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
}

export interface ActualizarColoresNegocioDto {
  colorPrimario?: string;
  colorSecundario?: string;
}

export interface BloqueoNegocioDto {
  id: string;
  fecha: string;
  motivo?: string;
}

export interface CrearNegocioDto {
  nombre: string;
  slug: string;
  telefono?: string;
  email?: string;
  descripcion?: string;
  planId?: string;
}
