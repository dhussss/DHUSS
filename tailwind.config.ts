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
        ink: "#20241f",
        paper: "#f6f1e9",
        line: "#ded6c8",
        gum: "#f06f5d",
        mint: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        moss: "rgb(var(--color-secondary-rgb) / <alpha-value>)",
        yolk: "#e7a82f"
      },
      boxShadow: {
        soft: "0 18px 55px rgba(40, 34, 25, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
