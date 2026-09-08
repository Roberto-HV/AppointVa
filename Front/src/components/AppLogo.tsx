interface AppLogoProps {
  className?: string;
}

export function AppLogo({ className }: AppLogoProps) {
  return (
    <>
      <img
        src="/MasterLogo.png"
        alt="AppointVa"
        className={`dark:hidden ${className ?? ""}`}
      />
      <img
        src="/MaterLogoOscuro.png"
        alt="AppointVa"
        aria-hidden="true"
        className={`hidden dark:block ${className ?? ""}`}
      />
    </>
  );
}
