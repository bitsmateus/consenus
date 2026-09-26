"use client";

import { useActionState } from "react";
import {
  adicionarDiaSemSessao,
  removerDiaSemSessao,
  type EstadoDoCalendario,
} from "@/acoes/calendario";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

/** Dias bloqueados à mão, além dos feriados e pontos facultativos nacionais. */
export function DiasSemSessao({
  dias,
}: {
  dias: { id: string; dataFormatada: string; descricao: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDoCalendario, FormData>(
    adicionarDiaSemSessao,
    {}
  );

  return (
    <section className="rounded-lg border border-carvao-100 bg-white p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-carvao-500">
        Dias sem sessão cadastrados
      </h2>
      <p className="mb-4 text-xs leading-relaxed text-carvao-500">
        Além de fim de semana, feriados e pontos facultativos nacionais (que o sistema já
        conhece), bloqueie aqui feriado municipal, recesso ou manutenção. Sessão já
        marcada no dia não é movida: o sistema avisa quantas são.
      </p>

      {dias.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {dias.map((dia) => (
            <li
              key={dia.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-carvao-100 px-3 py-2"
            >
              <span className="text-xs text-carvao-700">
                <span className="tabular font-medium">{dia.dataFormatada}</span> · {dia.descricao}
              </span>
              <form action={removerDiaSemSessao}>
                <input type="hidden" name="id" value={dia.id} />
                <button className="text-[11px] text-erro hover:underline">Liberar</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={acao} className="grid gap-x-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Campo rotulo="Data" name="data" type="date" required />
        <Campo rotulo="Motivo" name="descricao" required maxLength={120} />
        <Botao type="submit" variante="secundario" carregando={pendente} className="mb-4">
          Bloquear dia
        </Botao>
      </form>

      {estado.erro && (
        <p role="alert" className="rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="text-xs text-sucesso">{estado.aviso}</p>}
    </section>
  );
}
