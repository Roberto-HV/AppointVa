import { useEffect, useState } from "react";
import { CLAVE_TEMA, temaPreferido, type Tema } from "../lib/temaPorRuta";

export function useTheme() {
  const [theme, setTheme] = useState<Tema>(temaPreferido);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(CLAVE_TEMA, theme);
    } catch {}
    window.dispatchEvent(new CustomEvent("appointva-theme-changed", { detail: theme }));
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
