"use client";

import { useActionState, useState } from "react";
import { PapelNoAto, TipoPessoa, TipoProcurador } from "@prisma/client";
import { adicionarParte, type EstadoDeFormulario } from "@/acoes/atos";
import { cadastrarEVincular } from "@/acoes/pessoas";
import { Campo } from "@/components/ui/campo";
import { ROTULO_TIPO_PROCURADOR } from "@/lib/formato";
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
  const [nova, setNova] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    nova ? cadastrarEVincular : adicionarParte,
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
        {nova ? (
          <div className="sm:col-span-3">
            <div className="grid gap-x-3 sm:grid-cols-3">
              <Selecao
                rotulo="Tipo"
                name="tipo"
                defaultValue={TipoPessoa.FISICA}
                opcoes={[
                  { valor: TipoPessoa.FISICA, rotulo: "Pessoa física" },
                  { valor: TipoPessoa.JURIDICA, rotulo: "Pessoa jurídica" },
                ]}
              />
              <Campo rotulo="Nome ou razão social" name="nome" required />
              <Campo rotulo="CPF ou CNPJ" name="documento" required />
            </div>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Selecao
                rotulo="Natureza"
                name="tipoProcurador"
                vazio="—"
                opcoes={Object.values(TipoProcurador).map((t) => ({
                  valor: t,
                  rotulo: ROTULO_TIPO_PROCURADOR[t],
                }))}
                dica="Preencha quando for procurador."
              />
              <Campo rotulo="OAB" name="oab" placeholder="opcional" />
            </div>
          </div>
        ) : (
          <Selecao
            rotulo="Pessoa"
            name="pessoaId"
            vazio="Selecione"
            opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
            required
          />
        )}
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

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" variante="secundario" carregando={pendente}>
          {nova ? "Cadastrar e vincular" : "Vincular"}
        </Botao>
        <button
          type="button"
          onClick={() => setNova((estava) => !estava)}
          className="text-xs text-dourado-600 hover:underline"
        >
          {nova ? "Escolher alguém já cadastrado" : "A pessoa não está cadastrada"}
        </button>
      </div>
    </form>
  );
}
