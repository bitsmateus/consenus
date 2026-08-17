"use client";

import { useActionState } from "react";
import { Papel } from "@prisma/client";
import {
  alterarPermissao,
  criarUsuario,
  type EstadoDeFormulario,
} from "@/acoes/usuarios";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { ROTULO_PAPEL } from "@/lib/formato";

const OPCOES_DE_PAPEL = Object.values(Papel).map((p) => ({ valor: p, rotulo: ROTULO_PAPEL[p] }));

export function FormularioDeNovoUsuario({
  pessoas,
}: {
  pessoas: { id: string; rotulo: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(criarUsuario, {});

  return (
    <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-3 text-xs text-sucesso">{estado.aviso}</p>}

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Nome" name="nome" required />
        <Campo rotulo="E-mail" name="email" type="email" required />
        <Selecao rotulo="Perfil" name="papel" defaultValue={Papel.OPERADOR} opcoes={OPCOES_DE_PAPEL} />
        <Campo
          rotulo="Senha provisória"
          name="senha"
          type="password"
          dica="Ao menos 12 caracteres, com maiúscula, minúscula e número."
          required
        />
        <div className="sm:col-span-2">
          <Selecao
            rotulo="Pessoa vinculada"
            name="pessoaId"
            vazio="Nenhuma"
            opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
            dica="Obrigatório para perfil de Interessado ou Procurador — é o vínculo que define o que a conta enxerga."
          />
        </div>
      </div>

      <Botao type="submit" carregando={pendente}>
        Criar conta
      </Botao>
    </form>
  );
}

export function FormularioDePermissao({
  usuarioId,
  papel,
  ativo,
}: {
  usuarioId: string;
  papel: Papel;
  ativo: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    alterarPermissao,
    {}
  );

  return (
    <form action={acao} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <div className="w-40">
        <Selecao rotulo="Perfil" name="papel" defaultValue={papel} opcoes={OPCOES_DE_PAPEL} />
      </div>
      <div className="w-32">
        <Selecao
          rotulo="Situação"
          name="ativo"
          defaultValue={ativo ? "sim" : "nao"}
          opcoes={[
            { valor: "sim", rotulo: "Ativa" },
            { valor: "nao", rotulo: "Inativa" },
          ]}
        />
      </div>
      <Botao type="submit" variante="secundario" carregando={pendente} className="mb-4">
        Salvar
      </Botao>

      {estado.erro && (
        <p role="alert" className="mb-4 w-full text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-4 w-full text-xs text-sucesso">{estado.aviso}</p>}
    </form>
  );
}
