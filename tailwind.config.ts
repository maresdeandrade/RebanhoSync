import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // DS §3.1 — Família tipográfica
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"Roboto Mono"',
          "ui-monospace",
          "monospace",
        ],
      },
      // DS §3.2 — Escala tipográfica nomeada (mobile-first, base 16 px)
      fontSize: {
        // text-display: 32 px mobile / 40 px desktop, lh 1.1, peso 700
        display: ["2rem", { lineHeight: "1.1", fontWeight: "700" }],
        // text-h1: 24 px mobile / 28 px desktop, lh 1.2, peso 700
        h1: ["1.5rem", { lineHeight: "1.2", fontWeight: "700" }],
        // text-h2: 20 px mobile / 24 px desktop, lh 1.25, peso 700
        h2: ["1.25rem", { lineHeight: "1.25", fontWeight: "700" }],
        // text-h3: 18 px mobile / 20 px desktop, lh 1.3, peso 600
        h3: ["1.125rem", { lineHeight: "1.3", fontWeight: "600" }],
        // text-body: 16 px, lh 1.5, peso 500 — padrão de campo
        body: ["1rem", { lineHeight: "1.5", fontWeight: "500" }],
        // text-body-sm: 14 px, lh 1.5, peso 500 — desktop denso
        "body-sm": ["0.875rem", { lineHeight: "1.5", fontWeight: "500" }],
        // text-label: 13 px, lh 1.4, peso 600 — labels de form, headers de tabela
        label: ["0.8125rem", { lineHeight: "1.4", fontWeight: "600" }],
        // text-caption: 12 px, lh 1.4, peso 500 — meta, timestamps
        caption: ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
        // text-kicker: 11 px, tracking 0.18em, peso 700 — sobre-título (já em .app-kicker)
        kicker: [
          "0.6875rem",
          { lineHeight: "1", fontWeight: "700", letterSpacing: "0.18em" },
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          muted: "hsl(var(--success-muted))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          muted: "hsl(var(--warning-muted))",
          strong: "hsl(var(--warning-strong))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          muted: "hsl(var(--info-muted))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          muted: "hsl(var(--surface-muted))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 30px -20px rgba(15, 23, 42, 0.16)",
        crisp:
          "0 0 0 1px rgba(15, 23, 42, 0.04), 0 20px 45px -28px rgba(15, 23, 42, 0.22)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
