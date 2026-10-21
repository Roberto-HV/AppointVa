import { puntajeContrasena } from "../utils/contrasena";

interface Props { password: string }

const BARS  = ["", "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-green-500"];
const LABEL = ["", "Débil", "Regular", "Buena", "Fuerte"];
const TEXT  = ["", "text-red-600", "text-orange-600", "text-amber-700", "text-green-700"];

export default function PasswordStrengthBar({ password }: Props) {
  const score = puntajeContrasena(password);
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? BARS[score] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${TEXT[score]}`} aria-live="polite">
        <span className="sr-only">Seguridad de la contraseña: </span>
        {LABEL[score]}
      </p>
    </div>
  );
}
