"use client";

import { useActionState, useState } from "react";
import { Papel, SubPapelOperador } from "@prisma/client";
import {
  alterarPermissao,
  criarUsuario,
  editarUsuario,
  excluirUsuario,
  redefinirSegundoFator,
  redefinirSenhaDeUsuario,
  type EstadoDeFormulario,
} from "@/acoes/usuarios";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { ROTULO_PAPEL, ROTULO_SUBPAPEL } from "@/lib/formato";

const OPCOES_DE_PAPEL = Object.values(Papel).map((p) => ({ valor: p, rotulo: ROTULO_PAPEL[p] }));
const OPCOES_DE_SUBPAPEL = Object.values(SubPapelOperador).map((s) => ({
  valor: s,
  rotulo: ROTULO_SUBPAPEL[s],
}));

export function FormularioDeNovoUsuario({
  pessoas,
}: {
  pessoas: { id: string; rotulo: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(criarUsuario, {});
  const [papel, setPapel] = useState<Papel>(Papel.OPERADOR);

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
        <Selecao
          rotulo="Perfil"
          name="papel"
          defaultValue={Papel.OPERADOR}
          opcoes={OPCOES_DE_PAPEL}
          onChange={(e) => setPapel(e.target.value as Papel)}
        />
        {papel === Papel.OPERADOR && (
          <Selecao
            rotulo="Sub-perfil"
            name="subPapelOperador"
            vazio="Nenhum — acesso a todo o fluxo"
            opcoes={OPCOES_DE_SUBPAPEL}
            dica="Restringe o operador às ações de uma etapa. Deixe em branco para acesso total."
          />
        )}
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
  subPapelOperador,
  ativo,
}: {
  usuarioId: string;
  papel: Papel;
  subPapelOperador: SubPapelOperador | null;
  ativo: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    alterarPermissao,
    {}
  );
  const [papelSelecionado, setPapelSelecionado] = useState<Papel>(papel);

  return (
    <form action={acao} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <div className="w-40">
        <Selecao
          rotulo="Perfil"
          name="papel"
          defaultValue={papel}
          opcoes={OPCOES_DE_PAPEL}
          onChange={(e) => setPapelSelecionado(e.target.value as Papel)}
        />
      </div>
      {papelSelecionado === Papel.OPERADOR && (
        <div className="w-64">
          <Selecao
            rotulo="Sub-perfil"
            name="subPapelOperador"
            defaultValue={subPapelOperador ?? ""}
            vazio="Nenhum — acesso a todo o fluxo"
            opcoes={OPCOES_DE_SUBPAPEL}
          />
        </div>
      )}
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

export function FormularioDeEdicao({
  usuarioId,
  nome,
  email,
  pessoaId,
  pessoas,
}: {
  usuarioId: string;
  nome: string;
  email: string;
  pessoaId: string | null;
  pessoas: { id: string; rotulo: string }[];
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await editarUsuario(anterior, entrada);
      if (!resultado.erro) setEditando(false);
      return resultado;
    },
    {}
  );

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="mt-2 text-[11px] text-carvao-500 hover:underline"
      >
        Editar dados
      </button>
    );
  }

  return (
    <form action={acao} className="mt-2 rounded-md border border-carvao-100 bg-carvao-100/30 p-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      {estado.erro && (
        <p role="alert" className="mb-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Nome" name="nome" defaultValue={nome} required />
        <Campo rotulo="E-mail" name="email" type="email" defaultValue={email} required />
        <div className="sm:col-span-2">
          <Selecao
            rotulo="Pessoa vinculada"
            name="pessoaId"
            defaultValue={pessoaId ?? ""}
            vazio="Nenhuma"
            opcoes={pessoas.map((p) => ({ valor: p.id, rotulo: p.rotulo }))}
            dica="Obrigatório para perfil de Interessado ou Procurador."
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Botao type="submit" variante="secundario" carregando={pendente}>
          Salvar
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

export function FormularioDeSenha({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await redefinirSenhaDeUsuario(anterior, entrada);
      if (!resultado.erro) setAberto(false);
      return resultado;
    },
    {}
  );

  if (!aberto) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-[11px] text-carvao-500 hover:underline"
        >
          Alterar senha
        </button>
        {estado.aviso && <p className="mt-1 text-xs text-sucesso">{estado.aviso}</p>}
      </div>
    );
  }

  return (
    <form action={acao} className="w-full rounded-md border border-carvao-100 bg-carvao-100/30 p-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      {estado.erro && (
        <p role="alert" className="mb-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <Campo
        rotulo={`Nova senha de ${nome}`}
        name="novaSenha"
        type="password"
        autoComplete="new-password"
        dica="Ao menos 12 caracteres, com maiúscula, minúscula e número. Não muda o segundo fator."
        required
      />

      <div className="flex gap-2">
        <Botao type="submit" variante="secundario" carregando={pendente}>
          Salvar senha
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

export function BotaoDeRedefinicao2FA({ usuarioId }: { usuarioId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    redefinirSegundoFator,
    {}
  );

  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (
          !window.confirm(
            "Redefinir o segundo fator? A pessoa vai precisar configurar o aplicativo autenticador de novo no próximo acesso."
          )
        ) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <Botao type="submit" variante="secundario" carregando={pendente} className="px-3 py-1.5 text-xs">
        Redefinir 2FA
      </Botao>
      {estado.erro && <p role="alert" className="mt-1 text-xs text-erro">{estado.erro}</p>}
      {estado.aviso && <p className="mt-1 text-xs text-sucesso">{estado.aviso}</p>}
    </form>
  );
}

export function BotaoDeExclusao({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    excluirUsuario,
    {}
  );

  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (
          !window.confirm(
            `Excluir a conta de ${nome}? Isso só é possível se a conta nunca teve atividade no sistema (ato, documento ou auditoria) — caso contrário, use Inativa.`
          )
        ) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <Botao type="submit" variante="perigo" carregando={pendente} className="px-3 py-1.5 text-xs">
        Excluir conta
      </Botao>
      {estado.erro && <p role="alert" className="mt-1 text-xs text-erro">{estado.erro}</p>}
    </form>
  );
}
