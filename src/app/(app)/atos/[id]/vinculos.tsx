"use client";

import { useActionState } from "react";
import { PapelNoAto } from "@prisma/client";
import { adicionarParte, type EstadoDeFormulario } from "@/acoes/atos";
import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/selecao";

/**
 * Vínculo de procurador ou conciliador.
 *
 * Procurador precisa dizer quem representa — é esse vínculo que libera o
 * acesso dele ao procedimento (docs/10). O servidor recusa sem isso; aqui a
 * exigência aparece antes, para o operador não descobrir no erro.
 */
export function FormularioDeVinculo({
  atoId,
  pessoas,
  interessados,
}: {
  atoId: string;
  pessoas: { id: string; rotulo: string }[];
  interessados: { id: string; rotulo: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    adicionarParte,
    {}
  );

  return (
    <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
      <input type="hidden" name="atoId" value={atoId} />

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-x-3 sm:grid-cols-3">
        <Selecao
          rotulo="Pessoa"
          name="pessoaId"
          vazio="Selecione"
          opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
          required
        />
        <Selecao
          rotulo="Papel"
          name="papel"
          defaultValue={PapelNoAto.PROCURADOR}
          opcoes={[
            { valor: PapelNoAto.PROCURADOR, rotulo: "Procurador" },
            { valor: PapelNoAto.CONCILIADOR, rotulo: "Conciliador" },
          ]}
        />
        <Selecao
          rotulo="Representa"
          name="representaId"
          vazio="—"
          opcoes={interessados.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
          dica="Obrigatório para procurador."
        />
      </div>

      <Botao type="submit" variante="secundario" carregando={pendente}>
        Vincular
      </Botao>
    </form>
  );
}
