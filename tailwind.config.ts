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
        ink: "#252823",
        paper: "#f5f3ed",
        line: "#dcd8ce",
        gum: "#c9694f",
        mint: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        moss: "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        yolk: "#c7933f"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(43, 47, 39, 0.055), 0 2px 8px rgba(43, 47, 39, 0.035)"
      },
      fontWeight: {
        black: "700"
      }
    }
  },
  plugins: []
};

export default config;
