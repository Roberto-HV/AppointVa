interface AppLogoProps {
  className?: string;
  isDark?: boolean;
}

export function AppLogo({ className, isDark = false }: AppLogoProps) {
  return (
    <img
      src={isDark ? "/MaterLogoOscuro.png" : "/MasterLogo.png"}
      alt="AppointVa"
      className={className ?? ""}
      style={isDark ? { mixBlendMode: "screen" } : undefined}
    />
  );
}
