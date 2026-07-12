import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#15181d",
        paper: "#f6f4ee",
        line: "#e5e1d5",
        gum: "#b8442c",
        mint: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        moss: "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        yolk: "#a97a1d"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(21, 24, 29, 0.04), 0 10px 28px -6px rgba(21, 24, 29, 0.09)",
        lift: "0 2px 4px rgba(21, 24, 29, 0.05), 0 20px 44px -12px rgba(21, 24, 29, 0.16)",
        crisp: "0 1px 1px rgba(21, 24, 29, 0.04)"
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem"
      },
      fontWeight: {
        black: "800"
      },
      letterSpacing: {
        tightest: "-0.045em"
      }
    }
  },
  plugins: []
};

export default config;
