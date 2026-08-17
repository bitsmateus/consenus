import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "perigo";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
}

const estilos: Record<Variante, string> = {
  primario: "bg-grafite-700 text-white hover:bg-grafite-500",
  secundario: "bg-white text-grafite-700 border border-carvao-100 hover:border-dourado-600",
  perigo: "bg-white text-erro border border-erro/25 hover:bg-erro/5",
};

export function Botao({ variante = "primario", carregando, className, children, ...resto }: Props) {
  return (
    <button
      {...resto}
      disabled={resto.disabled || carregando}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        estilos[variante],
        className
      )}
    >
      {carregando ? "Aguarde..." : children}
    </button>
  );
}
