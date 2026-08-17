import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // identidade oficial — ver docs/05-design-system.md
        preto: { 900: "#0A0A0A" },
        grafite: { 700: "#1A1C1F", 500: "#33373D" },
        dourado: { 600: "#946810", 400: "#CC9933", 100: "#F8F1E2" },
        prata: { 400: "#D1D1D1" },
        carvao: { 700: "#2B2B2B", 500: "#5A5A5A", 300: "#A6A6A6", 100: "#E4E1DA" },
        fundo: "#F7F6F3",
        sucesso: "#2F6B4F",
        atencao: "#946810",
        erro: "#8E2A2A",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Lora", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
