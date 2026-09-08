import { Link } from "react-router-dom";
import { ChevronLeft, Shield } from "lucide-react";

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="text-slate-400 hover:text-slate-700 transition"
            onClick={(e) => { e.preventDefault(); window.history.back(); }}
          >
            <ChevronLeft size={20} />
          </Link>
          <img src="/MasterLogo.png" alt="AppointVa" className="h-7 object-contain" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10 pb-16">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Política de privacidad</h1>
            <p className="text-sm text-slate-400 mt-0.5">Última actualización: enero 2026</p>
          </div>
        </div>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">

          {/* 1 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">1. ¿Quiénes somos?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              AppointVa es una plataforma de gestión de citas que conecta a negocios locales con sus clientes.
              Al utilizar nuestros servicios —ya sea como propietario de un negocio o como cliente que reserva
              una cita— confías en nosotros con tu información personal. Esta política explica qué datos
              recopilamos, cómo los usamos y cuáles son tus derechos.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">2. Información que recopilamos</h2>
            <ul className="text-sm text-slate-600 leading-relaxed space-y-2 list-none pl-0">
              {[
                ["Datos de registro", "Nombre completo, correo electrónico y contraseña cuando creas una cuenta de negocio."],
                ["Datos del negocio", "Nombre comercial, teléfono, dirección, descripción, logo y horarios de atención."],
                ["Datos de clientes", "Nombre, teléfono y correo electrónico proporcionados al agendar una cita."],
                ["Datos de citas", "Fecha, hora, servicio seleccionado, notas y estado de la cita."],
                ["Comprobantes de pago", "Imágenes de comprobantes de anticipo subidas voluntariamente por el cliente."],
                ["Datos de uso", "Registros de acceso, tipo de dispositivo y región geográfica general (sin rastreo de ubicación exacta)."],
              ].map(([titulo, desc]) => (
                <li key={titulo} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-2" />
                  <span><strong className="text-slate-700">{titulo}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">3. Cómo usamos tu información</h2>
            <ul className="text-sm text-slate-600 leading-relaxed space-y-2 list-none pl-0">
              {[
                "Gestionar citas, recordatorios y notificaciones.",
                "Permitir a los negocios identificar y atender a sus clientes.",
                "Enviar correos electrónicos transaccionales (confirmaciones, recordatorios, verificación de cuenta).",
                "Mejorar la plataforma detectando errores y patrones de uso anónimos.",
                "Cumplir obligaciones legales y fiscales cuando corresponda.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">4. Compartir información con terceros</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Tus datos de cliente (nombre, teléfono, correo y detalle de la cita) se comparten
              exclusivamente con el <strong className="text-slate-700">negocio con el que agendaste</strong>.
              Dicho negocio es responsable del uso que le dé a tu información en el marco de la prestación
              del servicio contratado.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              No vendemos, alquilamos ni cedemos tu información a anunciantes ni a terceros con fines
              comerciales propios. Únicamente compartimos datos con proveedores de infraestructura
              (hosting, almacenamiento de archivos, servicio de correo) bajo estrictos acuerdos de
              confidencialidad y solo en la medida necesaria para operar la plataforma.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">5. Seguridad de la información</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Implementamos medidas técnicas y organizativas para proteger tu información:
              transmisión cifrada mediante TLS/HTTPS, contraseñas almacenadas con hash seguro (bcrypt),
              autenticación de dos factores opcional y control de acceso por roles.
              Ningún sistema es 100% infalible, por lo que te recomendamos usar contraseñas únicas
              y activar la verificación en dos pasos.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">6. Retención de datos</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Conservamos tu información mientras tu cuenta esté activa o sea necesario para prestarte
              el servicio. Si solicitas la eliminación de tu cuenta, procederemos a borrar o anonimizar
              tus datos personales en un plazo máximo de 30 días hábiles, salvo obligación legal de
              retención.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">7. Cookies y tecnologías similares</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Usamos cookies de sesión estrictamente necesarias para mantener tu inicio de sesión activo.
              No utilizamos cookies de seguimiento publicitario ni herramientas de análisis de comportamiento
              de terceros (como Google Analytics).
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">8. Tus derechos</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              De acuerdo con la legislación aplicable, tienes derecho a:
            </p>
            <ul className="text-sm text-slate-600 leading-relaxed space-y-2 list-none pl-0">
              {[
                ["Acceso", "Conocer qué datos tenemos sobre ti."],
                ["Rectificación", "Corregir datos inexactos o incompletos."],
                ["Cancelación", "Solicitar la eliminación de tus datos cuando ya no sean necesarios."],
                ["Oposición", "Oponerte al tratamiento de tus datos en determinados supuestos."],
                ["Portabilidad", "Recibir tus datos en un formato estructurado y legible."],
              ].map(([titulo, desc]) => (
                <li key={titulo} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-2" />
                  <span><strong className="text-slate-700">{titulo}:</strong> {desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              Para ejercer cualquiera de estos derechos, escríbenos a{" "}
              <a href="mailto:privacidad@appointva.com" className="text-slate-700 hover:underline font-medium">
                privacidad@appointva.com
              </a>.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">9. Cambios a esta política</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Podemos actualizar esta política para reflejar cambios en la plataforma o en la legislación
              aplicable. Te notificaremos por correo electrónico o mediante un aviso en la plataforma con
              al menos 15 días de anticipación antes de que los cambios entren en vigor.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">10. Contacto</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Si tienes preguntas o inquietudes sobre esta política, puedes contactarnos en{" "}
              <a href="mailto:soporte@appointva.com" className="text-slate-700 hover:underline font-medium">
                soporte@appointva.com
              </a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col items-center gap-2">
          <img src="/MasterLogo.png" alt="AppointVa" className="h-6 object-contain opacity-25" />
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} AppointVa · Todos los derechos reservados
          </p>
          <Link to="/terminos" className="text-[11px] text-slate-400 hover:underline">
            Términos de uso →
          </Link>
        </div>
      </div>
    </div>
  );
}
