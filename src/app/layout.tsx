import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });
const lora = Lora({ subsets: ["latin"], weight: ["500", "600"], variable: "--fonte-lora", display: "swap" });

export const metadata: Metadata = {
  title: "Consensus One — Câmara Privada de Composição Estratégica Consensual",
  description: "Sistema de gestão de procedimentos de composição consensual.",
  robots: { index: false, follow: false },
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
