/** @type {import('tailwindcss').Config} */

// Escala neutra: slate, gray y zinc apuntan a la rampa --neutral-* de src/index.css
// (cálida por defecto, fría con [data-sector="salud"]), así que las clases crudas
// siguen al tema del producto en vez del gris frío por defecto de Tailwind.
const neutra = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((paso) => [
    paso,
    `rgb(var(--neutral-${paso}) / <alpha-value>)`,
  ])
);

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: neutra,
        gray:  neutra,
        zinc:  neutra,
        // ── Tinta cálida (botones, titulares, bloques oscuros); clara en dark ──
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        // ── Colores propios del tema AppointVa (RGB channels para opacity modifiers) ──
        primary: {
          DEFAULT:    "rgb(var(--color-primary) / <alpha-value>)",
          dark:       "rgb(var(--color-primary-dark) / <alpha-value>)",
          light:      "rgb(var(--color-primary-light) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground))",   /* blanco — shadcn button */
        },
        // ── shadcn/ui color tokens (HSL format) ──────────────────────────────
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          // Acento de marca AppointVa (terracota; #0F4C75 en salud): text-accent-brand …
          // Nunca en la página de reserva: ahí manda el color del negocio (brandSolid).
          brand:      "rgb(var(--color-accent-brand) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // ── Estados de cita: bg-status-pending-bg text-status-pending-fg … ──────
        status: Object.fromEntries(
          ["pending", "confirmed", "completed", "cancelled", "absent"].map((estado) => [
            estado,
            {
              bg:  `var(--status-${estado}-bg)`,
              fg:  `var(--status-${estado}-fg)`,
              dot: `var(--status-${estado}-dot)`,
            },
          ])
        ),
        // ── Sidebar del sector salud: bg-sidebar-salud text-sidebar-salud-fg … ──
        "sidebar-salud": {
          DEFAULT: "var(--sidebar-salud-bg)",
          fg:      "var(--sidebar-salud-fg)",
          muted:   "var(--sidebar-salud-muted)",
          active:  "var(--sidebar-salud-active)",
          hover:   "var(--sidebar-salud-hover)",
        },
        // ── Estrellas de reseñas (el dorado de marca es solo para el logo) ────
        rating: "var(--rating)",
        // ── Paleta categórica (series, avatares): bg-categoria-1 … bg-categoria-8 ──
        categoria: Object.fromEntries(
          [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [n, `var(--categoria-${n})`])
        ),
      },
      borderRadius: {
        lg: "var(--radius)",              // 10px: controles
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "14px",                       // tarjetas
      },
      boxShadow: {
        // Elevación cálida de tarjeta: sombra O borde, nunca ambos.
        card: "var(--shadow-card)",
      },
      transitionTimingFunction: {
        // ease-out-quint: movimiento que se asienta. Con duration-calma (220 ms).
        calma: "cubic-bezier(.22, 1, .36, 1)",
      },
      transitionDuration: {
        calma: "220ms",
      },
      fontFamily: {
        // Inter autohospedada en src/index.css (@font-face) con la pila del sistema de respaldo.
        sans: ["Inter", "system-ui", "-apple-system", "\"Segoe UI\"", "Roboto", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        // Fraunces (src/index.css): solo landing H1/H2, nombre del negocio en la reserva,
        // titular de la confirmación y saludo de Inicio. Nunca en el chrome del panel.
        display: ["Fraunces", "Georgia", "\"Times New Roman\"", "serif"],
      },
      animation: {
        "fade-in":        "fadeIn 0.2s cubic-bezier(.22, 1, .36, 1)",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
