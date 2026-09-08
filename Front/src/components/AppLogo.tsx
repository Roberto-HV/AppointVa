import { useEffect, useState } from "react";

interface AppLogoProps {
  className?: string;
}

function getIsDark(): boolean {
  try {
    const stored = localStorage.getItem("appointva-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

export function AppLogo({ className }: AppLogoProps) {
  const [isDark, setIsDark] = useState(getIsDark);

  useEffect(() => {
    const handler = (e: Event) => {
      setIsDark((e as CustomEvent<string>).detail === "dark");
    };
    window.addEventListener("appointva-theme-changed", handler);
    return () => window.removeEventListener("appointva-theme-changed", handler);
  }, []);

  return (
    <img
      src={isDark ? "/MaterLogoOscuro.png" : "/MasterLogo.png"}
      alt="AppointVa"
      className={className ?? ""}
      style={isDark ? { mixBlendMode: "screen" } : undefined}
    />
  );
}
