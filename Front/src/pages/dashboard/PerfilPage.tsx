import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProtegerNavegacion } from "../../hooks/useCambiosSinGuardar";
import Select from "../../components/ui/Select";
import Tabs from "../../components/ui/Tabs";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Download, Mail, Trash2 } from "lucide-react";
import { SiInstagram, SiFacebook, SiTiktok } from "react-icons/si";
import { QRCodeCanvas } from "qrcode.react";
import { negociosApi } from "../../api/negocios";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { Skeleton } from "../../components/ui/Skeleton";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import Switch from "../../components/ui/Switch";
import SelectorFondoPortada from "../../components/dashboard/SelectorFondoPortada";
import { fondoPortada } from "../../lib/portadaPresets";
import { TimePicker, DatePicker } from "../../components/ui/DateTimePicker";
import { hoy } from "../../utils/fechas";
import { mensajeError } from "../../utils/errores";
import { capitalizarPrimera } from "../../utils/formatters";
import type { ActualizarNegocioDto, HorarioDiaDto, NegocioDto } from "../../types";

const ZONAS_HORARIAS = [
  { valor: "America/Mexico_City",     texto: "Ciudad de México (CST/CDT)" },
  { valor: "America/Monterrey",       texto: "Monterrey (CST/CDT)" },
  { valor: "America/Tijuana",         texto: "Tijuana (PST/PDT)" },
  { valor: "America/Hermosillo",      texto: "Hermosillo (MST)" },
  { valor: "America/Cancun",          texto: "Cancún (EST)" },
  { valor: "America/Bogota",          texto: "Bogotá (COT)" },
  { valor: "America/Lima",            texto: "Lima (PET)" },
  { valor: "America/Santiago",        texto: "Santiago (CLT/CLST)" },
  { valor: "America/Buenos_Aires",    texto: "Buenos Aires (ART)" },
  { valor: "America/New_York",        texto: "Nueva York (EST/EDT)" },
  { valor: "America/Los_Angeles",     texto: "Los Ángeles (PST/PDT)" },
  { valor: "UTC",                     texto: "UTC" },
];

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Velos de la vista previa del booking. Van de arriba abajo porque aquí el texto
// está arriba; en la portada real va abajo y el velo se invierte.
// Sobre una foto blanca —el peor caso— el tramo que cubre el bloque de texto
// (19%-74% de la altura) deja el nombre en 12.7:1 y la descripción en 6.2:1.
const VELO_PREVIEW_FOTO =
  "linear-gradient(to bottom, rgba(12,12,15,0.86) 0%, rgba(12,12,15,0.84) 50%, " +
  "rgba(12,12,15,0.70) 74%, rgba(12,12,15,0.38) 88%, rgba(12,12,15,0.12) 100%)";
// El degradado de marca solo necesita que no queme arriba: lo justo para pasar el
// 4.5:1 con margen sin apagar el color que el negocio está eligiendo.
const HEX_COMPLETO = /^#[0-9A-Fa-f]{6}$/;

const VELO_PREVIEW_MARCA =
  "linear-gradient(to bottom, rgba(12,12,15,0.42) 0%, rgba(12,12,15,0.22) 70%, rgba(12,12,15,0) 100%)";

const HORAS_RECORDATORIO = [
  { valor: 2,  texto: "2 horas antes" },
  { valor: 4,  texto: "4 horas antes" },
  { valor: 12, texto: "12 horas antes" },
  { valor: 24, texto: "24 horas antes (1 día)" },
  { valor: 48, texto: "48 horas antes (2 días)" },
];

const HORAS_CANCELACION = [
  { valor: 0,  texto: "Sin restricción" },
  { valor: 1,  texto: "1 hora antes" },
  { valor: 2,  texto: "2 horas antes" },
  { valor: 4,  texto: "4 horas antes" },
  { valor: 12, texto: "12 horas antes" },
  { valor: 24, texto: "24 horas antes (1 día)" },
  { valor: 48, texto: "48 horas antes (2 días)" },
];

const schema = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  telefono: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
  descripcion: z.string().max(500).optional(),
  zonaHoraria: z.string().optional(),
  horasRecordatorio: z.coerce.number().optional(),
  horasCancelacion: z.coerce.number().optional(),
  diasAnticipacionMinima: z.coerce.number().optional(),
  autoConfirmar: z.boolean().optional(),
  listaEsperaActiva: z.boolean().optional(),
  metodoNotificacion: z.enum(["Correo", "WhatsApp", "Ambos"]).optional(),
  telefonoWhatsApp: z.string().max(30).optional(),
  requiereAnticipo: z.boolean().optional(),
  montoAnticipo: z.coerce.number().min(0).optional(),
  instruccionesAnticipo: z.string().max(500).optional(),
  // El porcentaje solo significa algo cuando se exige anticipo. El mínimo real
  // (10, igual que el default del backend) se exige en el superRefine de abajo;
  // aquí el rango queda abierto para que ningún valor heredado deje a un negocio
  // sin poder guardar las demás pestañas.
  porcentajeAnticipo: z.number().int().min(0).max(100).default(10),
  horasCancelacionConReembolso: z.number().int().min(0).default(24),
  politicaCancelacionAnticipo: z.string().max(500).default(''),
  instagramUrl: z.string().max(200).optional(),
  facebookUrl: z.string().max(200).optional(),
  tiktokUrl: z.string().max(200).optional(),
}).superRefine((datos, ctx) => {
  // 10–80 es el rango del deslizador y el que acepta la API (`[Range(0, 80)]`).
  if (datos.requiereAnticipo && (datos.porcentajeAnticipo < 10 || datos.porcentajeAnticipo > 80)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["porcentajeAnticipo"],
      message: "El porcentaje de anticipo debe estar entre 10% y 80%.",
    });
  }
});
type PerfilForm = z.infer<typeof schema>;

type Tab = "perfil" | "citas" | "anticipos" | "horarios" | "cuenta";

/** Posición guardada ("top", "center", "50% 20%"…) en el formato del arrastre. */
function normalizarPosicion(raw: string | null | undefined): string {
  if (!raw || raw === "center") return "50% 50%";
  if (raw === "top") return "50% 0%";
  if (raw === "bottom") return "50% 100%";
  return raw;
}

/** Acciones que cambian la página pública al instante y se confirman antes. */
type AccionPublica =
  | { tipo: "logo" }
  | { tipo: "portada" }
  | { tipo: "politicas" }
  | { tipo: "desbloquear"; id: string; fecha: string };

/** Pestaña donde vive cada campo, para poder mostrar el error que lo rechazó. */
const TAB_DEL_CAMPO: Record<keyof PerfilForm, Tab> = {
  nombre: "perfil",
  telefono: "perfil",
  email: "perfil",
  direccion: "perfil",
  descripcion: "perfil",
  instagramUrl: "perfil",
  facebookUrl: "perfil",
  tiktokUrl: "perfil",
  zonaHoraria: "citas",
  horasRecordatorio: "citas",
  horasCancelacion: "citas",
  diasAnticipacionMinima: "citas",
  autoConfirmar: "citas",
  listaEsperaActiva: "citas",
  metodoNotificacion: "citas",
  telefonoWhatsApp: "citas",
  requiereAnticipo: "anticipos",
  montoAnticipo: "anticipos",
  instruccionesAnticipo: "anticipos",
  porcentajeAnticipo: "anticipos",
  horasCancelacionConReembolso: "anticipos",
  politicaCancelacionAnticipo: "anticipos",
};

export default function PerfilPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const navigate = useNavigate();
  const { refreshToken, cerrarSesion, usuario } = useAuthStore();
  const logoRef = useRef<HTMLInputElement>(null);
  const portadaRef = useRef<HTMLInputElement>(null);
  const politicasRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabRaw = searchParams.get("tab");
  const tab: Tab = (["perfil", "citas", "anticipos", "horarios", "cuenta"] as Tab[]).includes(tabRaw as Tab)
    ? (tabRaw as Tab)
    : "perfil";
  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });
  const [modalEliminar, setModalEliminar] = useState(false);
  const [contrasenaEliminar, setContrasenaEliminar] = useState("");
  const [accionPublica, setAccionPublica] = useState<AccionPublica | null>(null);

  const { data: negocio, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<PerfilForm>({
    resolver: zodResolver(schema) as Resolver<PerfilForm>,
  });

  // Lo último que llegó del servidor. Cada subida de logo o portada vuelve a
  // pedir el perfil; sin esto, esa recarga borraba lo que el dueño estaba
  // editando (campos, color, fondo y posición de la portada).
  const negocioPrevio = useRef<NegocioDto | null>(null);

  useEffect(() => {
    if (negocio) {
      const previo = negocioPrevio.current;
      negocioPrevio.current = negocio;
      reset({
        nombre: negocio.nombre, telefono: negocio.telefono ?? "",
        email: negocio.email || usuario?.email || "", direccion: negocio.direccion ?? "",
        descripcion: negocio.descripcion ?? "", zonaHoraria: negocio.zonaHoraria ?? "",
        horasRecordatorio: negocio.horasRecordatorio ?? 24,
        horasCancelacion: negocio.horasCancelacion ?? 0,
        diasAnticipacionMinima: negocio.diasAnticipacionMinima ?? 0,
        autoConfirmar: negocio.autoConfirmar ?? true,
        listaEsperaActiva: negocio.listaEsperaActiva ?? false,
        metodoNotificacion: (negocio.metodoNotificacion as "Correo" | "WhatsApp" | "Ambos") ?? "Correo",
        telefonoWhatsApp: negocio.telefonoWhatsApp ?? "",
        requiereAnticipo: negocio.requiereAnticipo ?? false,
        montoAnticipo: negocio.montoAnticipo ?? 0,
        instruccionesAnticipo: negocio.instruccionesAnticipo ?? "",
        // `|| 10`, no `?? 10`: el backend ya nace en 10, pero una base sin la
        // migración `SetNegocioPorcentajeAnticipoDefault` aún puede devolver 0 y
        // ese 0 dejaría el deslizador (mínimo 10%) fuera de su propio rango.
        porcentajeAnticipo: negocio.porcentajeAnticipo || 10,
        horasCancelacionConReembolso: negocio.horasCancelacionConReembolso ?? 24,
        politicaCancelacionAnticipo: negocio.politicaCancelacionAnticipo ?? '',
        instagramUrl: negocio.instagramUrl ?? "",
        facebookUrl: negocio.facebookUrl ?? "",
        tiktokUrl: negocio.tiktokUrl ?? "",
      }, { keepDirtyValues: true });
      // Lo local solo se pisa si no tenía cambios (seguía igual a lo guardado).
      const c = negocio.colorPrimario ?? "#334155";
      setColorPrimario((actual) => (!previo || actual === (previo.colorPrimario ?? "#334155") ? c : actual));
      setColorGuardado(c);
      const pos = normalizarPosicion(negocio.portadaObjectPosition);
      setPortadaObjectPosition((actual) =>
        !previo || actual === normalizarPosicion(previo.portadaObjectPosition) ? pos : actual);
      const preset = negocio.portadaPreset ?? null;
      setPortadaPreset((actual) => (!previo || actual === (previo.portadaPreset ?? null) ? preset : actual));
    }
  }, [negocio, reset]);

  const { mutate: guardar } = useMutation({
    mutationFn: (dto: ActualizarNegocioDto) => negociosApi.actualizarPerfil(dto),
    onSuccess: (actualizado, variables) => {
      reset(variables as unknown as PerfilForm);
      // La respuesta ya es el perfil guardado: los avisos de "sin guardar"
      // (posición, fondo) se apagan sin esperar a la recarga.
      if (actualizado?.id) qc.setQueryData(["negocio-perfil"], actualizado);
      qc.invalidateQueries({ queryKey: ["negocio-perfil"] });
      toast("Cambios guardados");
    },
    onError: () => toast("No se pudieron guardar los cambios. Intenta de nuevo.", "error"),
  });

  const { mutate: subirLogo, isPending: subiendoLogo } = useMutation({
    mutationFn: (file: File) => negociosApi.subirLogo(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Logo actualizado"); },
    onError: () => toast("No se pudo subir el logo. Intenta de nuevo.", "error"),
  });

  const { mutate: subirPortada, isPending: subiendoPortada } = useMutation({
    mutationFn: (file: File) => negociosApi.subirPortada(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Portada actualizada"); },
    onError: () => toast("No se pudo subir la portada. Intenta de nuevo.", "error"),
  });

  function abrirPortadaModal(src: string, file?: File) {
    setPortadaModalPos(portadaObjectPosition.includes('%') ? portadaObjectPosition : "50% 50%");
    setPortadaModal({ src, file });
  }
  function confirmarPortadaModal() {
    if (!portadaModal) return;
    setPortadaObjectPosition(portadaModalPos);
    if (portadaModal.file) { subirPortada(portadaModal.file); URL.revokeObjectURL(portadaModal.src); }
    setPortadaModal(null);
  }
  function cancelarPortadaModal() {
    if (portadaModal?.file) URL.revokeObjectURL(portadaModal.src);
    setPortadaModal(null);
  }

  const { mutate: subirPoliticas, isPending: subiendoPoliticas } = useMutation({
    mutationFn: (file: File) => negociosApi.subirPoliticas(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); toast("Imagen de políticas actualizada"); },
    onError: () => toast("No se pudo subir la imagen. Intenta de nuevo.", "error"),
  });

  const { mutate: eliminarLogo, isPending: eliminandoLogo } = useMutation({
    mutationFn: () => negociosApi.eliminarLogo(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); setAccionPublica(null); toast("Logo eliminado"); },
    onError: () => toast("No se pudo eliminar el logo. Intenta de nuevo.", "error"),
  });

  const { mutate: eliminarPortada, isPending: eliminandoPortada } = useMutation({
    mutationFn: () => negociosApi.eliminarPortada(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); setPortadaObjectPosition("50% 50%"); setAccionPublica(null); toast("Portada eliminada"); },
    onError: () => toast("No se pudo eliminar la portada. Intenta de nuevo.", "error"),
  });

  const { mutate: eliminarPoliticas, isPending: eliminandoPoliticas } = useMutation({
    mutationFn: () => negociosApi.eliminarPoliticas(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["negocio-perfil"] }); setAccionPublica(null); toast("Imagen de políticas eliminada"); },
    onError: () => toast("No se pudo eliminar la imagen. Intenta de nuevo.", "error"),
  });

  const onSubmit = (data: PerfilForm) => {
    // Cadena vacía quita el fondo en el backend; `undefined` lo dejaría intacto.
    guardar({
      ...data,
      email: data.email || undefined,
      telefono: data.telefono || undefined,
      portadaObjectPosition,
      portadaPreset: portadaPreset ?? "",
    });
    // Exige el hexadecimal completo: `length >= 4` dejaba pasar un "#FF0" a medio
    // teclear y lo guardaba como color de la marca.
    if (colorPrimario !== colorGuardado && HEX_COMPLETO.test(colorPrimario)) {
      guardarColores();
    }
  };

  // Sin esto el botón "Guardar cambios" no hace nada visible cuando la
  // validación rechaza un campo que vive en otra pestaña: el dueño se queda sin
  // enterarse de por qué no se guardó.
  const onInvalid = (erroresForm: FieldErrors<PerfilForm>) => {
    const campo = (Object.keys(erroresForm) as (keyof PerfilForm)[])[0];
    if (!campo) return;
    const destino = TAB_DEL_CAMPO[campo];
    if (destino && destino !== tab) setTab(destino);
    const detalle = erroresForm[campo]?.message;
    toast(
      typeof detalle === "string" && detalle
        ? `No se guardó: ${detalle}`
        : "No se guardó: revisa los campos marcados en rojo.",
      "error"
    );
  };

  const { mutate: eliminarCuenta, isPending: eliminando } = useMutation({
    mutationFn: () => authApi.eliminarCuenta(contrasenaEliminar),
    onSuccess: async () => {
      try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignored */ }
      cerrarSesion();
      navigate("/login");
    },
    onError: () => toast("Contraseña incorrecta o no se pudo eliminar la cuenta.", "error"),
  });

  // ── Horarios ─────────────────────────────────────────────────────────────
  const [portadaObjectPosition, setPortadaObjectPosition] = useState<string>("50% 50%");
  const [portadaPreset, setPortadaPreset] = useState<string | null>(null);
  const [portadaModal, setPortadaModal] = useState<{ src: string; file?: File } | null>(null);
  const [portadaModalPos, setPortadaModalPos] = useState("50% 50%");
  const portadaModalDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const [colorPrimario, setColorPrimario] = useState("#334155");
  const [colorGuardado, setColorGuardado] = useState("#334155");
  // Lo que se teclea va aparte del color aplicado: así el campo se puede vaciar o
  // dejar a medias mientras se escribe, sin que un `#FF0` llegue a la vista previa
  // ni al guardado. `colorPrimario` solo cambia con un hexadecimal completo.
  const [colorTexto, setColorTexto] = useState("#334155");
  useEffect(() => { setColorTexto(colorPrimario); }, [colorPrimario]);

  // Al salir del campo: normaliza un pegado sin "#" y, si quedó incompleto,
  // devuelve el último color válido en vez de dejar al dueño con un campo roto.
  const confirmarColorTexto = () => {
    const normalizado = colorTexto.startsWith("#") ? colorTexto : `#${colorTexto}`;
    if (HEX_COMPLETO.test(normalizado)) {
      setColorPrimario(normalizado);
      setColorTexto(normalizado);
    } else {
      setColorTexto(colorPrimario);
    }
  };

  // El color viaja siempre con "Guardar cambios" —nunca se guarda solo—, así que
  // en éxito calla: habla "Cambios guardados" por los dos. Un clic, un veredicto.
  // El fallo sí habla, o un verde anunciaría un guardado a medias; va redactado
  // como detalle de ese guardado y no como un segundo veredicto en competencia.
  const { mutate: guardarColores } = useMutation({
    mutationFn: () => negociosApi.actualizarColores(colorPrimario),
    onSuccess: () => {
      setColorGuardado(colorPrimario);
      qc.invalidateQueries({ queryKey: ["negocio-perfil"] });
    },
    onError: () => toast("El color no se guardó. Intenta de nuevo.", "error"),
  });

  const [horarios, setHorarios] = useState<HorarioDiaDto[]>([]);
  const [horariosDirty, setHorariosDirty] = useState(false);

  const { data: horariosData } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: negociosApi.obtenerHorarios,
    enabled: !!negocio,
  });

  useEffect(() => {
    if (horariosData) { setHorarios(horariosData); setHorariosDirty(false); }
  }, [horariosData]);

  const { mutate: guardarHorarios, isPending: guardandoHorarios } = useMutation({
    mutationFn: () => negociosApi.actualizarHorarios(horarios),
    onSuccess: (data) => {
      setHorarios(data); setHorariosDirty(false);
      qc.invalidateQueries({ queryKey: ["horarios-negocio"] });
      toast("Horarios guardados");
    },
    onError: () => toast("No se pudieron guardar los horarios. Intenta de nuevo.", "error"),
  });

  const toggleDia = (diaSemana: number) => {
    setHorarios(prev => prev.map(h =>
      h.diaSemana === diaSemana
        ? {
            ...h,
            activo: !h.activo,
            intervalos: !h.activo && h.intervalos.length === 0
              ? [{ horaInicio: "09:00", horaFin: "18:00" }]
              : h.intervalos
          }
        : h
    ));
    setHorariosDirty(true);
  };

  const actualizarIntervalo = (
    diaSemana: number,
    idx: number,
    campo: "horaInicio" | "horaFin",
    valor: string
  ) => {
    setHorarios(prev => prev.map(h =>
      h.diaSemana === diaSemana
        ? {
            ...h,
            intervalos: h.intervalos.map((iv, i) =>
              i === idx ? { ...iv, [campo]: valor } : iv
            )
          }
        : h
    ));
    setHorariosDirty(true);
  };

  const agregarIntervalo = (diaSemana: number) => {
    setHorarios(prev => prev.map(h => {
      if (h.diaSemana !== diaSemana) return h;
      const ultimo = h.intervalos[h.intervalos.length - 1];
      const nuevaHora = ultimo?.horaFin ?? "09:00";
      return {
        ...h,
        intervalos: [...h.intervalos, { horaInicio: nuevaHora, horaFin: nuevaHora }]
      };
    }));
    setHorariosDirty(true);
  };

  const eliminarIntervalo = (diaSemana: number, idx: number) => {
    setHorarios(prev => prev.map(h =>
      h.diaSemana === diaSemana
        ? { ...h, intervalos: h.intervalos.filter((_, i) => i !== idx) }
        : h
    ));
    setHorariosDirty(true);
  };

  const intervaloInvalido = (h: HorarioDiaDto): boolean => {
    if (!h.activo) return false;
    for (const iv of h.intervalos) {
      if (!iv.horaInicio || !iv.horaFin || iv.horaInicio >= iv.horaFin) return true;
    }
    for (let i = 0; i < h.intervalos.length - 1; i++) {
      if (h.intervalos[i].horaFin > h.intervalos[i + 1].horaInicio) return true;
    }
    return false;
  };

  // ── Días bloqueados ───────────────────────────────────────────────────────
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoMotivo, setNuevoMotivo] = useState("");

  const { data: diasBloqueados = [] } = useQuery({
    queryKey: ["dias-bloqueados"],
    queryFn: negociosApi.obtenerDiasBloqueados,
    enabled: !!negocio,
  });

  const { mutate: bloquearDia, isPending: bloqueando } = useMutation({
    mutationFn: () => negociosApi.bloquearDia(nuevaFecha, nuevoMotivo || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dias-bloqueados"] });
      setNuevaFecha(""); setNuevoMotivo(""); toast("Día bloqueado");
    },
    onError: (err) => toast(mensajeError(err, "No se pudo bloquear el día. Intenta de nuevo."), "error"),
  });

  const { mutate: desbloquear, isPending: desbloqueando } = useMutation({
    mutationFn: (id: string) => negociosApi.desbloquearDia(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dias-bloqueados"] }); setAccionPublica(null); toast("Día desbloqueado"); },
    onError: () => toast("No se pudo desbloquear el día. Intenta de nuevo.", "error"),
  });

  // ── Cambios sin guardar ───────────────────────────────────────────────────
  // Una sola regla para toda la página: campos del formulario, color, fondo,
  // posición de la portada y horarios. Avisa al cerrar la pestaña y al seguir
  // un enlace interno (antes un clic en el menú lateral lo perdía todo).
  const colorSinGuardar = colorPrimario !== colorGuardado;
  const presetSinGuardar = !!negocio && portadaPreset !== (negocio.portadaPreset ?? null);
  const posicionSinGuardar = !!negocio?.portadaUrl
    && portadaObjectPosition !== normalizarPosicion(negocio.portadaObjectPosition);
  const hayCambiosSinGuardar = isDirty || colorSinGuardar || presetSinGuardar || posicionSinGuardar || horariosDirty;
  const dialogoNavegacion = useProtegerNavegacion(hayCambiosSinGuardar);

  const confirmarAccionPublica = () => {
    if (!accionPublica) return;
    if (accionPublica.tipo === "logo") eliminarLogo();
    else if (accionPublica.tipo === "portada") eliminarPortada();
    else if (accionPublica.tipo === "politicas") eliminarPoliticas();
    else desbloquear(accionPublica.id);
  };

  const textoAccionPublica: Record<AccionPublica["tipo"], { titulo: string; confirmar: string }> = {
    logo: { titulo: "Eliminar logo", confirmar: "Eliminar logo" },
    portada: { titulo: "Eliminar foto de portada", confirmar: "Eliminar portada" },
    politicas: { titulo: "Eliminar imagen de políticas", confirmar: "Eliminar imagen" },
    desbloquear: { titulo: "Quitar día sin atención", confirmar: "Abrir el día a reservas" },
  };

  const mensajeAccionPublica = (accion: AccionPublica) => {
    switch (accion.tipo) {
      case "logo":
        return "El logo deja de verse en tu página de reservas al instante. Para recuperarlo tendrás que volver a subir el archivo.";
      case "portada":
        return "La foto de portada deja de verse en tu página de reservas al instante. Para recuperarla tendrás que volver a subir el archivo.";
      case "politicas":
        return "La imagen de políticas deja de verse en tu página de reservas al instante. Para recuperarla tendrás que volver a subir el archivo.";
      case "desbloquear":
        return `El ${accion.fecha} vuelve a estar disponible y los clientes podrán reservar ese día.`;
    }
  };

  const pendienteAccionPublica =
    eliminandoLogo || eliminandoPortada || eliminandoPoliticas || desbloqueando;

  // ── URL de reservas ───────────────────────────────────────────────────────
  const bookingUrl = negocio ? `${window.location.origin}/b/${negocio.slug}` : "";

  const descargarQR = () => {
    const canvas = document.getElementById("qr-reservas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `qr-${negocio?.slug ?? "reservas"}.png`; a.click();
  };

  // ── Portada: misma regla que el booking ──────────────────────────────────
  // El fondo elegido gana sobre la foto. Se deriva del estado local, no de lo
  // guardado, para que la miniatura y la vista previa reflejen la elección
  // antes de pulsar "Guardar cambios".
  const presetPortada = portadaPreset || null;
  const mostrarFotoPortada = !presetPortada && !!negocio?.portadaUrl;
  const fondoPortadaActual = fondoPortada(presetPortada, colorPrimario);
  const fotoOcultaPorFondo = !!presetPortada && !!negocio?.portadaUrl;
  // Velo del texto de la vista previa, medido sobre los píxeles que se renderizan.
  // La maqueta mide 64 px y pone el texto arriba; la portada real mide 180-340 px
  // y lo pone abajo, así que lo que cae bajo el texto no es lo mismo en cada caso:
  //  · Foto: puede ser blanca. Sin velo el nombre queda en 1:1, y con un velo suave
  //    en 3.7:1. Necesita el mismo peso que el velo de la portada real.
  //  · Fondo elegido: ya nace oscuro, incluso comprimido en 64 px (el peor caso
  //    medido es 6.2:1). Taparlo mentiría sobre cómo se ve el fondo que se eligió.
  //  · Degradado de marca: va de L 42% a L 9%, y en la portada real el texto cae en
  //    el extremo oscuro. Aquí cae en el claro —un dorado da 4.2:1— y pide un velo
  //    ligero, el mínimo para no desteñir el color de marca que se está eligiendo.
  const veloPreviewPortada = mostrarFotoPortada
    ? VELO_PREVIEW_FOTO
    : presetPortada
      ? null
      : VELO_PREVIEW_MARCA;

  // ── Barra de guardado compartida ─────────────────────────────────────────
  // Las tres pestañas del formulario son largas y el botón vivía al final de
  // cada una: editar algo de arriba dejaba al dueño sin ver cómo guardar.
  const btnGuardar = (
    <button
      type="submit"
      disabled={isSubmitting}
      className="bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950"
    >
      {isSubmitting ? "Guardando..." : "Guardar cambios"}
    </button>
  );

  // El centinela va justo debajo de la barra: mientras no se vea, queda página
  // por debajo y la barra está pegada al fondo. Solo entonces se despega del
  // contenido con borde y sombra; al llegar al final vuelve a ser una fila más.
  const centinelaBarra = useRef<HTMLDivElement>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const [barraPegada, setBarraPegada] = useState(false);

  useEffect(() => {
    const el = centinelaBarra.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setBarraPegada(!e.isIntersecting), { threshold: 1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [tab, isLoading]);

  // Los toasts viven en `fixed bottom-5 right-5`. Medido a 390 px, el de error
  // ocupa dos líneas y tapaba el botón entero. La barra publica su alto para que
  // aterricen encima de ella; al desmontarse, los toasts vuelven a su sitio.
  useEffect(() => {
    const alto = barraRef.current?.offsetHeight;
    if (!alto) return;
    document.documentElement.style.setProperty("--barra-accion", `${alto}px`);
    return () => { document.documentElement.style.removeProperty("--barra-accion"); };
  }, [tab, isLoading]);

  // `sticky`, no `fixed`: el contenedor que hace scroll es la columna <main> del
  // dashboard, así que la barra se queda dentro de ella sola. Una barra fija
  // abarcaría todo el viewport y habría que compensarla a mano para el sidebar
  // abierto, cerrado y móvil. Los márgenes negativos la llevan al borde de la
  // columna, contra el padding del contenedor de la página.
  const barraGuardar = (
    <>
      <div
        ref={barraRef}
        data-testid="barra-guardar"
        className={`sticky bottom-0 z-20 -mx-4 sm:-mx-8 mt-6 flex items-center px-4 sm:px-8 pt-3
          pb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-t-2xl border-t transition-colors ${
            barraPegada
              ? "border-gray-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur " +
                "shadow-[0_-4px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.45)]"
              : "border-transparent"
          }`}
      >
        {btnGuardar}
      </div>
      <div ref={centinelaBarra} aria-hidden className="h-px" />
    </>
  );

  if (isLoading) return (
    <div className="p-4 sm:p-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
        <Skeleton className="h-4 w-36 mb-3" /><Skeleton className="h-10 rounded-lg" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo="Mi negocio"
        subtitulo="Datos públicos, horarios de atención y reglas de reserva"
      />

      {/* Tabs */}
      <Tabs
        etiqueta="Secciones del negocio"
        valor={tab}
        onChange={setTab}
        className="mb-6"
        opciones={[
          { id: "perfil", label: "Perfil" },
          { id: "citas", label: "Citas" },
          { id: "anticipos", label: "Anticipos" },
          { id: "horarios", label: "Horarios" },
          { id: "cuenta", label: "Cuenta" },
        ]}
      />

      {/* ── TAB: PERFIL ─────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className={tab !== "perfil" ? "hidden" : "space-y-6"}>

          {/* Información del negocio */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Información del negocio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del negocio *</label>
                <input {...register("nombre")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100
                    ${errors.nombre ? "border-red-400 bg-red-50" : "border-gray-200 dark:border-slate-600"}`} />
                {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                <input {...register("telefono")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo de contacto</label>
                <input type="email" {...register("email")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100
                    ${errors.email ? "border-red-400 bg-red-50" : "border-gray-200 dark:border-slate-600"}`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                <input {...register("direccion")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea rows={3} maxLength={500} {...register("descripcion")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 resize-none" />
                <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-0.5">{(watch("descripcion") ?? "").length}/500</p>
              </div>
            </div>
          </div>

          {/* Imágenes */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Imágenes</h2>
            <div className="grid grid-cols-4 gap-3">
              {/* Logo */}
              <div className="flex flex-col items-center">
                <div className="w-full aspect-square rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden mb-2 flex items-center justify-center">
                  {negocio?.logoUrl
                    ? <img src={negocio.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    : <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">{negocio?.nombre?.charAt(0)}</span>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ""; }} />
                <button type="button" onClick={() => logoRef.current?.click()} disabled={subiendoLogo}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:underline disabled:opacity-50">
                  {subiendoLogo ? "Subiendo..." : "Cambiar logo"}
                </button>
                <div className="mt-auto pt-1 min-h-[1.25rem]">
                  {negocio?.logoUrl && (
                    <button type="button" onClick={() => setAccionPublica({ tipo: "logo" })} disabled={eliminandoLogo}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50">
                      {eliminandoLogo ? "Eliminando..." : "Eliminar"}
                    </button>
                  )}
                </div>
              </div>
              {/* Portada */}
              <div className="flex flex-col items-center col-span-2">
                {/* Muestra lo que realmente se verá en la portada: la foto, o el
                    fondo elegido, que gana sobre ella. */}
                <div
                  className="w-full aspect-[2/1] rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden mb-2 flex items-center justify-center"
                  style={presetPortada ? fondoPortadaActual : undefined}
                >
                  {mostrarFotoPortada && (
                    <img src={negocio!.portadaUrl!} alt="Portada" className="w-full h-full object-cover" style={{ objectPosition: portadaObjectPosition }} />
                  )}
                  {!mostrarFotoPortada && !presetPortada && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Sin portada</span>
                  )}
                </div>
                <input ref={portadaRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    abrirPortadaModal(URL.createObjectURL(f), f);
                    e.target.value = '';
                  }} />
                <button type="button" onClick={() => portadaRef.current?.click()} disabled={subiendoPortada}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:underline disabled:opacity-50">
                  {subiendoPortada ? "Subiendo..." : "Cambiar portada"}
                </button>
                {/* La posición viaja con "Guardar cambios" (el backend no tiene una
                    ruta para guardarla sola): se avisa igual que con el color. */}
                {posicionSinGuardar && (
                  <p role="status" className="text-xs text-amber-700 dark:text-amber-400 text-center mt-1">
                    Posición sin guardar — se guardará con "Guardar cambios"
                  </p>
                )}
                {/* Sin este aviso, "Eliminar" borraría una foto que la miniatura no muestra. */}
                {fotoOcultaPorFondo && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-1">
                    Tu foto sigue guardada, oculta tras el fondo elegido.
                  </p>
                )}
                <div className="mt-auto pt-1 min-h-[1.25rem] flex items-center gap-3">
                  {negocio?.portadaUrl && (
                    <>
                      <button type="button" onClick={() => abrirPortadaModal(negocio.portadaUrl!)}
                        className="text-xs text-indigo-500 hover:underline">
                        Posicionar
                      </button>
                      <button type="button" onClick={() => setAccionPublica({ tipo: "portada" })} disabled={eliminandoPortada}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50">
                        {eliminandoPortada ? "Eliminando..." : "Eliminar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Políticas */}
              <div className="flex flex-col items-center">
                <div className="w-full aspect-square rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden mb-2 flex items-center justify-center">
                  {negocio?.politicasUrl
                    ? <img src={negocio.politicasUrl} alt="Políticas" className="w-full h-full object-contain" />
                    : <span className="text-xs text-gray-400 dark:text-gray-500">Sin políticas</span>}
                </div>
                <input ref={politicasRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirPoliticas(f); e.target.value = ""; }} />
                <button type="button" onClick={() => politicasRef.current?.click()} disabled={subiendoPoliticas}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:underline disabled:opacity-50">
                  {subiendoPoliticas ? "Subiendo..." : "Cambiar políticas"}
                </button>
                <div className="mt-auto pt-1 min-h-[1.25rem]">
                  {negocio?.politicasUrl && (
                    <button type="button" onClick={() => setAccionPublica({ tipo: "politicas" })} disabled={eliminandoPoliticas}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50">
                      {eliminandoPoliticas ? "Eliminando..." : "Eliminar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Color del booking */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Color de tu página de reservas</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Se usa en botones, selección de servicios, fechas y el encabezado de tu página.</p>
            <div className="flex gap-3 items-center mb-4">
              <input
                type="color"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200 dark:border-slate-600 p-0.5 shrink-0"
              />
              <input
                type="text"
                value={colorTexto}
                onChange={(e) => {
                  const v = e.target.value;
                  // Acepta vacío, parcial y pegado sin "#"; aplicar es otra cosa.
                  if (!/^#?[0-9A-Fa-f]{0,6}$/.test(v)) return;
                  setColorTexto(v);
                  if (HEX_COMPLETO.test(v)) setColorPrimario(v);
                }}
                onBlur={confirmarColorTexto}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarColorTexto(); } }}
                aria-label="Color en hexadecimal"
                className="w-32 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 font-mono uppercase"
                maxLength={7}
                placeholder="#334155"
              />
            </div>
            {/* Vista previa del header del booking */}
            <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 mb-4">
              {/* Refleja la portada real: foto, fondo elegido, o el degradado de
                  marca. Antes era un negro fijo, que no era ninguno de los tres. */}
              <div className="px-4 pt-3 pb-3 flex items-start gap-3 relative"
                style={mostrarFotoPortada ? { background: "#0C0C0F" } : fondoPortadaActual}>
                {mostrarFotoPortada && (
                  <img src={negocio!.portadaUrl!} alt="" aria-hidden
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    style={{ objectPosition: portadaObjectPosition }} />
                )}
                {/* El glow solo donde el booking lo pone: sin foto y sin fondo elegido. */}
                {!mostrarFotoPortada && !presetPortada && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse 80% 120% at 0% 0%, ${colorPrimario}38 0%, transparent 70%)` }} />
                )}
                {/* Velo del texto, solo donde el fondo de verdad se aclara bajo él. */}
                {veloPreviewPortada && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: veloPreviewPortada }} />
                )}
                <div className="w-10 h-10 rounded-xl shrink-0 relative z-10"
                  style={{ background: `${colorPrimario}28`, border: `1.5px solid ${colorPrimario}60` }} />
                <div className="relative z-10">
                  <div className="text-white text-sm font-bold leading-tight">Tu negocio</div>
                  {/* Mismo blanco que la descripción de la portada real: al 0.35 no
                      llegaba al 4.5:1 sobre ningún fondo, y además se leía apagada
                      comparada con lo que el cliente acaba viendo. */}
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.92)" }}>Descripción breve...</div>
                </div>
              </div>
              <div className="px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#18181B" }}>
                {[1,2,3,4].map((i) => (
                  <div key={i} style={{
                    height: "3px", borderRadius: "2px",
                    width: i === 1 ? "34px" : "22px",
                    background: i === 1 ? colorPrimario : "rgba(255,255,255,0.1)",
                  }} />
                ))}
              </div>
              <div className="bg-white px-4 py-3">
                <div className="h-2.5 w-3/4 rounded bg-slate-100 mb-1.5" />
                <div className="h-2 w-1/2 rounded bg-slate-50 mb-3" />
                <div className="rounded-xl border-2 px-3 py-2.5 flex items-center gap-3"
                  style={{ borderColor: colorPrimario, background: `${colorPrimario}0D` }}>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0" />
                  <div className="flex-1">
                    <div className="h-2.5 w-24 rounded mb-1" style={{ background: colorPrimario, opacity: 0.8 }} />
                    <div className="h-2 w-16 rounded bg-slate-100" />
                  </div>
                  <div className="h-3 w-12 rounded font-bold text-xs" style={{ background: colorPrimario, opacity: 0.8 }} />
                </div>
              </div>
            </div>
            {colorSinGuardar && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Color sin guardar — se guardará con "Guardar cambios"
              </p>
            )}
          </div>

          {/* Fondo de portada */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Fondo de portada</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              {negocio?.portadaUrl
                ? "Elige un fondo si prefieres no mostrar tu foto. Tu foto se conserva: puedes volver a ella cuando quieras."
                : "Cada fondo se dibuja con tu color de marca, así que ningún otro negocio tiene el tuyo."}
            </p>
            <SelectorFondoPortada
              valor={portadaPreset}
              onCambiar={setPortadaPreset}
              color={colorPrimario}
              portadaUrl={negocio?.portadaUrl}
              portadaObjectPosition={portadaObjectPosition}
            />
            {presetSinGuardar && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                Fondo sin guardar — se guardará con "Guardar cambios"
              </p>
            )}
          </div>

          {/* Redes sociales */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Redes sociales</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Se muestran en tu página de reservas para que los clientes te sigan.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)" }}>
                  <SiInstagram className="w-4 h-4 text-white" />
                </div>
                <input {...register("instagramUrl")} placeholder="https://instagram.com/tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                  <SiFacebook className="w-4 h-4 text-white" />
                </div>
                <input {...register("facebookUrl")} placeholder="https://facebook.com/tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0">
                  <SiTiktok className="w-4 h-4 text-white" />
                </div>
                <input {...register("tiktokUrl")} placeholder="https://tiktok.com/@tu_negocio"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Pega la URL completa. Deja vacío si no usas esa red.</p>
          </div>

          {/* QR */}
          {negocio && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Código QR de reservas</h2>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm inline-block shrink-0">
                  <QRCodeCanvas id="qr-reservas" value={bookingUrl} size={120} level="M"
                    includeMargin={false} bgColor="#ffffff" fgColor="#1a1a1a" />
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                    Comparte este código en tu negocio para que los clientes reserven escaneándolo.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={descargarQR}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition">
                      <Download size={14} /> Descargar PNG
                    </button>
                    <button type="button" onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition">
                      Imprimir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── TAB: CITAS ──────────────────────────────────────────────────────── */}
        {tab === "citas" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ajustes de citas</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zona horaria</label>
                  <Select {...register("zonaHoraria")} value={watch("zonaHoraria") ?? ""} className="w-full">
                    <option value="">Seleccionar...</option>
                    {ZONAS_HORARIAS.map((z) => (
                      <option key={z.valor} value={z.valor}>{z.texto}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recordatorio al cliente</label>
                  <Select {...register("horasRecordatorio")} value={watch("horasRecordatorio") ?? ""} className="w-full">
                    {HORAS_RECORDATORIO.map((h) => (
                      <option key={h.valor} value={h.valor}>{h.texto}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cuánto antes se envía el recordatorio por email.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Política de cancelación</label>
                  <Select {...register("horasCancelacion")} value={watch("horasCancelacion") ?? ""} className="w-full">
                    {HORAS_CANCELACION.map((h) => (
                      <option key={h.valor} value={h.valor}>{h.texto}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Anticipación mínima para que el cliente cancele.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anticipación mínima para agendar</label>
                  <select
                    {...register("diasAnticipacionMinima")}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value={0}>Mismo día</option>
                    <option value={1}>1 día antes</option>
                    <option value={2}>2 días antes</option>
                    <option value={3}>3 días antes</option>
                  </select>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Días mínimos de anticipación para que el cliente pueda reservar.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <div className="flex-1">
                  <p id="ajuste-autoconfirmar" className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmación automática de citas</p>
                  <p id="ajuste-autoconfirmar-desc" className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Activado: las reservas quedan confirmadas de inmediato.<br />
                    Desactivado: quedan pendientes y debes confirmarlas manualmente.
                  </p>
                </div>
                <Switch
                  activo={watch("autoConfirmar") ?? true}
                  onCambiar={(v) => setValue("autoConfirmar", v, { shouldDirty: true })}
                  idEtiqueta="ajuste-autoconfirmar"
                  idDescripcion="ajuste-autoconfirmar-desc"
                  className="-my-2.5"
                />
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <div className="flex-1">
                  <p id="ajuste-lista-espera" className="text-sm font-medium text-gray-700 dark:text-gray-300">Lista de espera</p>
                  <p id="ajuste-lista-espera-desc" className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Activado: cuando canceles una cita se notificará automáticamente al primer cliente en espera.<br />
                    Desactivado: la lista de espera no genera notificaciones automáticas.
                  </p>
                </div>
                <Switch
                  activo={!!watch("listaEsperaActiva")}
                  onCambiar={(v) => setValue("listaEsperaActiva", v, { shouldDirty: true })}
                  idEtiqueta="ajuste-lista-espera"
                  idDescripcion="ajuste-lista-espera-desc"
                  className="-my-2.5"
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Canal de notificaciones al cliente</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button type="button"
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-white">
                    <Mail size={13} /> Correo
                  </button>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Los clientes reciben confirmaciones, recordatorios y cancelaciones por correo electrónico.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: ANTICIPOS ──────────────────────────────────────────────────── */}
        {tab === "anticipos" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Anticipo al reservar</h3>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Requerir anticipo al reservar</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">El cliente deberá pagar un anticipo antes de confirmar su cita</p>
                </div>
                <input type="checkbox" {...register("requiereAnticipo")} className="w-4 h-4 rounded" />
              </div>

              {watch("requiereAnticipo") && (
                <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-slate-700">

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      Porcentaje del anticipo
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={10}
                        max={80}
                        step={5}
                        {...register("porcentajeAnticipo", { valueAsNumber: true })}
                        className="flex-1 accent-slate-700"
                      />
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-12 text-right">
                        {watch("porcentajeAnticipo")}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Entre 10% y 80% del costo del servicio</p>
                    {errors.porcentajeAnticipo && (
                      <p className="text-red-500 text-xs mt-1">{errors.porcentajeAnticipo.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Horas mínimas de anticipación para reembolso
                    </label>
                    <input
                      type="number"
                      min={0}
                      {...register("horasCancelacionConReembolso", { valueAsNumber: true })}
                      className="w-32 px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = sin reembolso en ningún caso</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Política de cancelación <span className="text-gray-400">(visible para el cliente)</span>
                    </label>
                    <textarea
                      maxLength={500}
                      rows={3}
                      placeholder="Ej: El anticipo es reembolsable si cancelas con al menos 24 horas de anticipación..."
                      {...register("politicaCancelacionAnticipo")}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {(watch("politicaCancelacionAnticipo") ?? '').length}/500 caracteres
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Instrucciones de pago del anticipo <span className="text-gray-400">(visible para el cliente)</span>
                    </label>
                    <textarea
                      maxLength={500}
                      rows={3}
                      placeholder="Ej: Transferir a la cuenta CLABE 012345678901234567 a nombre de..."
                      {...register("instruccionesAnticipo")}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Horarios y Días bloqueados tienen sus propias mutaciones y sus
            propios botones; este formulario no los guarda. */}
        {tab !== "horarios" && tab !== "cuenta" && barraGuardar}
      </form>

      {/* ── Modal: eliminar cuenta ─────────────────────────────────────────── */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">¿Eliminar tu cuenta?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Esta acción es irreversible. Ingresa tu contraseña actual para confirmar.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Contraseña actual"
              value={contrasenaEliminar}
              onChange={(e) => setContrasenaEliminar(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-red-400 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalEliminar(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!contrasenaEliminar || eliminando}
                onClick={() => eliminarCuenta()}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {eliminando ? "Eliminando..." : "Sí, eliminar cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CUENTA ─────────────────────────────────────────────────────── */}
      {tab === "cuenta" && (
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wide mb-1">Tu suscripción</p>
            <p className="text-base font-bold text-slate-800 dark:text-gray-200">
              {negocio?.planNombre ?? "Sin plan asignado"}
            </p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
              ¿Quieres cambiar de plan? Escríbenos a{" "}
              <a
                href="mailto:hola@appointva.com"
                className="text-slate-600 dark:text-gray-400 font-semibold underline"
              >
                hola@appointva.com
              </a>
            </p>
          </div>

          <div className="border border-red-200 dark:border-red-900/60 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
              <Trash2 size={15} /> Zona de peligro
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Eliminar tu cuenta es permanente. Todos tus datos personales serán eliminados de forma irreversible. El historial de citas se conservará de forma anonimizada.
            </p>
            <button
              type="button"
              onClick={() => { setContrasenaEliminar(""); setModalEliminar(true); }}
              className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition
                dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/70"
            >
              Eliminar mi cuenta
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: HORARIOS ───────────────────────────────────────────────────── */}
      {tab === "horarios" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Horarios de atención</h2>
            <div className="space-y-1">
              {horarios.map((h) => (
                <div key={h.diaSemana} className="py-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
                  {/* Interruptor del día + nombre (el nombre también lo cambia) */}
                  <div className="flex items-center gap-1 -ml-2 mb-1">
                    <Switch
                      activo={h.activo}
                      onCambiar={() => toggleDia(h.diaSemana)}
                      idEtiqueta={`horario-negocio-dia-${h.diaSemana}`}
                    />
                    <span
                      id={`horario-negocio-dia-${h.diaSemana}`}
                      onClick={() => toggleDia(h.diaSemana)}
                      className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                    >
                      {DIAS[h.diaSemana]}
                    </span>
                  </div>

                  {h.activo ? (
                    <div className="pl-11 space-y-1.5">
                      {h.intervalos.map((iv, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <TimePicker
                              value={iv.horaInicio}
                              onChange={(v) => actualizarIntervalo(h.diaSemana, idx, "horaInicio", v)}
                            />
                          </div>
                          <span className="text-gray-400 dark:text-gray-500 text-sm shrink-0">—</span>
                          <div className="flex-1 min-w-0">
                            <TimePicker
                              value={iv.horaFin}
                              onChange={(v) => actualizarIntervalo(h.diaSemana, idx, "horaFin", v)}
                              minTime={iv.horaInicio}
                            />
                          </div>
                          {h.intervalos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarIntervalo(h.diaSemana, idx)}
                              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition"
                              aria-label="Eliminar intervalo"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {intervaloInvalido(h) && (
                        <p className="text-xs text-red-500">Verifica que los horarios no se solapan y que la hora de fin sea posterior a la de inicio.</p>
                      )}
                      <button
                        type="button"
                        onClick={() => agregarIntervalo(h.diaSemana)}
                        className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mt-1 transition"
                      >
                        + Agregar intervalo
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500 pl-11">Cerrado</span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => guardarHorarios()} disabled={guardandoHorarios || !horariosDirty || horarios.some(intervaloInvalido)}
              className="mt-4 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm">
              {guardandoHorarios ? "Guardando..." : "Guardar horarios"}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Días sin atención</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Bloquea días donde el negocio no trabajará (feriados, vacaciones). Los clientes no podrán reservar esos días.</p>
            <div className="flex gap-2 mb-4 flex-wrap items-end">
              <div className="w-48">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
                <DatePicker value={nuevaFecha} onChange={(v) => setNuevaFecha(v)} minDate={hoy()} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Motivo <span className="text-gray-400 dark:text-gray-500">(opcional)</span></label>
                <input type="text" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)}
                  placeholder="Ej: Día festivo, Vacaciones..." maxLength={100}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700" />
              </div>
              <button onClick={() => nuevaFecha && bloquearDia()} disabled={!nuevaFecha || bloqueando}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition">
                {bloqueando ? "Guardando..." : "+ Bloquear día"}
              </button>
            </div>
            {diasBloqueados.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No hay días bloqueados próximos.</p>
            ) : (
              <div className="space-y-2">
                {diasBloqueados.map((b) => {
                  const fecha = new Date(b.fecha + "T12:00:00");
                  const fechaTexto = capitalizarPrimera(fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/\bDe\b/g, "de"));
                  return (
                    <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-status-cancelled-bg border border-status-cancelled-dot rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-status-cancelled-fg">
                          {fechaTexto}
                        </span>
                        {b.motivo && <span className="text-xs text-status-cancelled-fg ml-2">— {b.motivo}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAccionPublica({ tipo: "desbloquear", id: b.id, fecha: fechaTexto })}
                        className="text-xs font-medium text-status-cancelled-fg hover:underline px-2 min-h-[32px] rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>

    <ConfirmarAccion
      abierto={!!accionPublica}
      titulo={accionPublica ? textoAccionPublica[accionPublica.tipo].titulo : ""}
      mensaje={accionPublica ? <p>{mensajeAccionPublica(accionPublica)}</p> : null}
      etiquetaConfirmar={accionPublica ? textoAccionPublica[accionPublica.tipo].confirmar : ""}
      destructiva={accionPublica?.tipo !== "desbloquear"}
      pendiente={pendienteAccionPublica}
      onConfirmar={confirmarAccionPublica}
      onCerrar={() => setAccionPublica(null)}
    />

    {dialogoNavegacion}

    {/* ── Modal de posicionamiento de portada ─────────────────────────────── */}
    {portadaModal && (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Barra superior */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <button type="button" onClick={cancelarPortadaModal}
            className="text-white/60 text-sm hover:text-white transition">Cancelar</button>
          <span className="text-white font-medium text-sm">Vista previa de portada</span>
          <button type="button" onClick={confirmarPortadaModal}
            className="text-indigo-400 text-sm font-semibold hover:text-indigo-300 transition">Confirmar</button>
        </div>

        {/* Simulación del header del booking — draggable, mismas clases que el booking real */}
        <div
          className="relative overflow-hidden flex flex-col justify-end min-h-[180px] sm:min-h-[260px] cursor-grab active:cursor-grabbing select-none"
          style={{ background: "#0C0C0F" }}
          onPointerDown={(e) => {
            e.preventDefault();
            const parts = portadaModalPos.replace(/%/g, "").split(" ");
            const posX = parseFloat(parts[0]) || 50;
            const posY = parseFloat(parts[1]) || 50;
            portadaModalDragRef.current = { startX: e.clientX, startY: e.clientY, posX, posY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!portadaModalDragRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const { startX, startY, posX, posY } = portadaModalDragRef.current;
            const dx = ((e.clientX - startX) / rect.width) * 150;
            const dy = ((e.clientY - startY) / rect.height) * 150;
            const newX = Math.max(0, Math.min(100, posX + dx));
            const newY = Math.max(0, Math.min(100, posY + dy));
            setPortadaModalPos(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
          }}
          onPointerUp={() => { portadaModalDragRef.current = null; }}
        >
          {/* Portada */}
          <img src={portadaModal.src} alt="" draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ opacity: 0.5, objectPosition: portadaModalPos }} />
          {/* Gradiente igual que el booking */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(12,12,15,0.15) 0%, rgba(12,12,15,0.92) 100%)" }} />
          {/* Contenido simulado — mismas clases responsive que el booking real */}
          <div className="relative z-10 px-5 sm:px-8 pt-4 pb-4 sm:pb-6">
            <div className="flex items-start gap-3.5 sm:gap-5">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl overflow-hidden shrink-0 bg-slate-700 border-2 border-white/20">
                {negocio?.logoUrl
                  ? <img src={negocio.logoUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
                  : <span className="w-full h-full flex items-center justify-center text-2xl sm:text-4xl font-bold text-white/40">
                      {negocio?.nombre?.charAt(0)}
                    </span>}
              </div>
              <div>
                <p className="text-white font-black text-[1.05rem] sm:text-2xl leading-tight pointer-events-none">{negocio?.nombre}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Instrucción */}
        <div className="px-5 pt-5 shrink-0 text-center">
          <p className="text-white/50 text-xs sm:text-sm">Arrastra para ajustar la posición</p>
          <p className="text-white/30 text-[11px] sm:text-xs mt-1">Así se verá en tu página de reservas</p>
        </div>

        <div className="flex-1" />
      </div>
    )}
    </>
  );
}
