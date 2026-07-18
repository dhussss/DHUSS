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
        ink: "#171a1d",
        paper: "#f7f8f6",
        line: "#dfe3de",
        gum: "#c34432",
        mint: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        moss: "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        yolk: "#9d6b16"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(23, 26, 29, 0.035), 0 8px 24px -16px rgba(23, 26, 29, 0.22)",
        lift: "0 1px 3px rgba(23, 26, 29, 0.06), 0 22px 60px -24px rgba(23, 26, 29, 0.28)",
        crisp: "0 1px 2px rgba(23, 26, 29, 0.045)"
      },
      borderRadius: {
        xl: "0.5rem",
        "2xl": "0.5rem"
      },
      fontWeight: {
        black: "700"
      },
      letterSpacing: {
        tightest: "-0.045em"
      }
    }
  },
  plugins: []
};

export default config;
