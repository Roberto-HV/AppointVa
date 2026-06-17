interface Props { password: string }

function calcScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (pw.length >= 8) s++;
  return s;
}

const BARS  = ["", "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-green-500"];
const LABEL = ["", "Débil", "Regular", "Buena", "Fuerte"];
const TEXT  = ["", "text-red-500", "text-orange-500", "text-amber-600", "text-green-600"];

export default function PasswordStrengthBar({ password }: Props) {
  const score = calcScore(password);
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? BARS[score] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${TEXT[score]}`}>{LABEL[score]}</p>
    </div>
  );
}
