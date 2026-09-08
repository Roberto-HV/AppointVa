import { Link } from "react-router-dom";
import { FileText, ChevronLeft } from "lucide-react";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="text-slate-400 hover:text-slate-700 transition"
          >
            <ChevronLeft size={20} />
          </button>
          <img src="/MasterLogo.png" alt="AppointVa" className="h-7 object-contain" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10 pb-16">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Términos de uso</h1>
            <p className="text-sm text-slate-400 mt-0.5">Última actualización: enero 2026</p>
          </div>
        </div>

        <div className="space-y-8">

          {/* 1 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">1. Aceptación de los términos</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Al acceder o utilizar la plataforma AppointVa —ya sea como negocio registrado o como cliente
              que agenda una cita— aceptas quedar vinculado por estos Términos de uso. Si no estás de acuerdo
              con alguna disposición, no utilices el servicio.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">2. Descripción del servicio</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              AppointVa es una plataforma de software como servicio (SaaS) que permite a negocios locales
              gestionar su agenda de citas en línea y a sus clientes reservar citas de forma autónoma.
              AppointVa actúa como intermediario tecnológico y no es parte de la relación contractual entre
              el negocio y sus clientes respecto al servicio prestado.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">3. Cuentas de negocio</h2>
            <ul className="text-sm text-slate-600 leading-relaxed space-y-2 list-none pl-0">
              {[
                "Debes proporcionar información veraz, completa y actualizada al registrarte.",
                "Eres responsable de mantener la confidencialidad de tus credenciales de acceso.",
                "Cualquier actividad realizada desde tu cuenta es de tu entera responsabilidad.",
                "Está prohibido registrar negocios ficticios, usar la plataforma para actividades ilegales o vulnerar los derechos de terceros.",
                "Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estos términos.",
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
            <h2 className="text-base font-bold text-slate-800 mb-2">4. Uso por parte de clientes</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Los clientes que reservan citas a través de la plataforma se comprometen a:
            </p>
            <ul className="text-sm text-slate-600 leading-relaxed space-y-2 list-none pl-0">
              {[
                "Proporcionar datos verídicos (nombre, teléfono, correo) al agendar.",
                "Respetar las políticas de cancelación y anticipo definidas por cada negocio.",
                "No hacer reservas con fines fraudulentos o de acoso.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">5. Pagos y anticipos</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cuando un negocio requiera un anticipo para confirmar tu cita, el pago se realiza directamente
              al negocio mediante los métodos que éste indique (transferencia bancaria, depósito, etc.).
              AppointVa <strong className="text-slate-700">no procesa ni retiene pagos</strong> en nombre de
              los negocios; únicamente facilita el registro de comprobantes de pago como evidencia.
              Cualquier disputa relacionada con pagos debe resolverse directamente con el negocio.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">6. Propiedad intelectual</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Todo el software, diseño, logotipos y contenidos de AppointVa son propiedad de AppointVa
              o sus licenciantes. El uso de la plataforma no te otorga ningún derecho sobre dicha propiedad
              intelectual. Los negocios conservan la propiedad de su contenido (logo, fotos, descripciones)
              y conceden a AppointVa una licencia limitada para mostrarlo en la plataforma.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">7. Limitación de responsabilidad</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              AppointVa no es responsable por:
            </p>
            <ul className="text-sm text-slate-600 leading-relaxed space-y-2 list-none pl-0 mt-3">
              {[
                "La calidad o cumplimiento de los servicios ofrecidos por los negocios.",
                "Daños derivados del incumplimiento de citas por parte del negocio o del cliente.",
                "Pérdidas indirectas, incidentales o de lucro cesante.",
                "Interrupciones del servicio por causas de fuerza mayor o mantenimiento programado.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">8. Disponibilidad del servicio</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Nos esforzamos por mantener la plataforma disponible de forma continua, pero no garantizamos
              una disponibilidad del 100%. Realizamos mantenimientos periódicos que pueden generar
              interrupciones breves. Notificaremos con anticipación las ventanas de mantenimiento programadas.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">9. Modificaciones a los términos</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Podemos modificar estos términos en cualquier momento. Los cambios significativos serán
              notificados por correo electrónico o mediante un aviso en la plataforma con al menos
              15 días de anticipación. El uso continuado del servicio después de la fecha de efectividad
              implica la aceptación de los nuevos términos.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">10. Legislación aplicable</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia
              se someterá a los tribunales competentes de la Ciudad de México, renunciando las partes a
              cualquier otro fuero que pudiera corresponderles.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-bold text-slate-800 mb-2">11. Contacto</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Para cualquier consulta sobre estos términos, escríbenos a{" "}
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
          <Link to="/privacidad" className="text-[11px] text-slate-400 hover:underline">
            Política de privacidad →
          </Link>
        </div>
      </div>
    </div>
  );
}
