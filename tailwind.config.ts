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
        ink: "#17211c",
        paper: "#fbfaf6",
        line: "#e5e0d6",
        gum: "#f06f5d",
        mint: "#0f9f8f",
        moss: "#54745b",
        yolk: "#e7a82f"
      },
      boxShadow: {
        soft: "0 14px 45px rgba(28, 32, 26, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
