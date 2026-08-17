import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  dica?: string;
  erro?: string;
}

export function Campo({ rotulo, dica, erro, className, id, ...resto }: Props) {
  const idCampo = id ?? resto.name;
  return (
    <div className="mb-4">
      <label htmlFor={idCampo} className="mb-1.5 block text-xs font-medium text-carvao-700">
        {rotulo}
      </label>
      <input
        {...resto}
        id={idCampo}
        aria-invalid={!!erro}
        className={cn(
          "w-full rounded-md border bg-white px-3 py-2.5 text-sm text-carvao-700",
          "outline-none focus:border-grafite-500",
          erro ? "border-erro" : "border-carvao-100",
          className
        )}
      />
      {erro && <p className="mt-1 text-xs text-erro">{erro}</p>}
      {!erro && dica && <p className="mt-1 text-xs text-carvao-300">{dica}</p>}
    </div>
  );
}
