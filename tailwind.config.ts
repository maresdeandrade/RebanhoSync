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
        display: ["2.5rem", { lineHeight: "3rem", fontWeight: "700" }],
        h1: ["2rem", { lineHeight: "2.5rem", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        h3: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        "body-sm": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "400" }],
        label: ["0.875rem", { lineHeight: "1.25rem", fontWeight: "600" }],
        caption: ["0.75rem", { lineHeight: "1rem", fontWeight: "500" }],
        kicker: [
          "0.75rem",
          { lineHeight: "1rem", fontWeight: "700", letterSpacing: "0.16em" },
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
        brand: {
          DEFAULT: "hsl(var(--brand-primary))",
          foreground: "hsl(var(--brand-primary-foreground))",
          accent: "hsl(var(--brand-accent))",
          "accent-foreground": "hsl(var(--brand-accent-foreground))",
        },
        neutral: {
          background: "hsl(var(--neutral-background))",
          foreground: "hsl(var(--neutral-foreground))",
          surface: "hsl(var(--neutral-surface))",
          muted: "hsl(var(--neutral-muted))",
          border: "hsl(var(--neutral-border))",
        },
        semantic: {
          success: {
            DEFAULT: "hsl(var(--semantic-success))",
            foreground: "hsl(var(--semantic-success-foreground))",
            muted: "hsl(var(--semantic-success-muted))",
            border: "hsl(var(--semantic-success-border))",
          },
          warning: {
            DEFAULT: "hsl(var(--semantic-warning))",
            foreground: "hsl(var(--semantic-warning-foreground))",
            muted: "hsl(var(--semantic-warning-muted))",
            border: "hsl(var(--semantic-warning-border))",
          },
          error: {
            DEFAULT: "hsl(var(--semantic-error))",
            foreground: "hsl(var(--semantic-error-foreground))",
            muted: "hsl(var(--semantic-error-muted))",
            border: "hsl(var(--semantic-error-border))",
          },
          info: {
            DEFAULT: "hsl(var(--semantic-info))",
            foreground: "hsl(var(--semantic-info-foreground))",
            muted: "hsl(var(--semantic-info-muted))",
            border: "hsl(var(--semantic-info-border))",
          },
          offline: {
            DEFAULT: "hsl(var(--semantic-offline))",
            foreground: "hsl(var(--semantic-offline-foreground))",
            muted: "hsl(var(--semantic-offline-muted))",
            border: "hsl(var(--semantic-offline-border))",
          },
          pending: {
            DEFAULT: "hsl(var(--semantic-pending))",
            foreground: "hsl(var(--semantic-pending-foreground))",
            muted: "hsl(var(--semantic-pending-muted))",
            border: "hsl(var(--semantic-pending-border))",
          },
          conflict: {
            DEFAULT: "hsl(var(--semantic-conflict))",
            foreground: "hsl(var(--semantic-conflict-foreground))",
            muted: "hsl(var(--semantic-conflict-muted))",
            border: "hsl(var(--semantic-conflict-border))",
          },
          unknown: {
            DEFAULT: "hsl(var(--semantic-unknown))",
            foreground: "hsl(var(--semantic-unknown-foreground))",
            muted: "hsl(var(--semantic-unknown-muted))",
            border: "hsl(var(--semantic-unknown-border))",
          },
          "not-permitted": {
            DEFAULT: "hsl(var(--semantic-not-permitted))",
            foreground: "hsl(var(--semantic-not-permitted-foreground))",
            muted: "hsl(var(--semantic-not-permitted-muted))",
            border: "hsl(var(--semantic-not-permitted-border))",
          },
        },
        overlay: "hsl(var(--overlay))",
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
