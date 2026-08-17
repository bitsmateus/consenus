import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  dica?: string;
  erro?: string;
  opcoes: { valor: string; rotulo: string }[];
  vazio?: string;
}

export function Selecao({ rotulo, dica, erro, opcoes, vazio, className, id, ...resto }: Props) {
  const idCampo = id ?? resto.name;
  return (
    <div className="mb-4">
      <label htmlFor={idCampo} className="mb-1.5 block text-xs font-medium text-carvao-700">
        {rotulo}
      </label>
      <select
        {...resto}
        id={idCampo}
        aria-invalid={!!erro}
        className={cn(
          "w-full rounded-md border bg-white px-3 py-2.5 text-sm text-carvao-700",
          "outline-none focus:border-grafite-500",
          erro ? "border-erro" : "border-carvao-100",
          className
        )}
      >
        {vazio && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erro && <p className="mt-1 text-xs text-erro">{erro}</p>}
      {!erro && dica && <p className="mt-1 text-xs text-carvao-300">{dica}</p>}
    </div>
  );
}
