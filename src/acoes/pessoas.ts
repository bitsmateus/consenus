"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ErroDeNegocio } from "@/lib/erros";
import { conferirCoerencia, esquemaDePessoa, montarDadosDePessoa } from "@/lib/pessoas";
import { exigirEquipe } from "@/lib/sessao";
import { adicionarParte } from "./atos";

export type EstadoDeFormulario = { erro?: string; campo?: string };

export async function salvarPessoa(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = esquemaDePessoa.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  const id = String(entrada.get("id") ?? "");
  let destino: string;

  try {
    conferirCoerencia(analise.data);
    const dados = montarDadosDePessoa(analise.data);

    if (id) {
      const pessoa = await db.pessoa.update({ where: { id }, data: dados });
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "ALTEROU_PESSOA",
        entidade: "Pessoa",
        entidadeId: pessoa.id,
        metadados: { nome: pessoa.nome },
      });
      destino = `/pessoas/${pessoa.id}`;
    } else {
      const pessoa = await db.pessoa.create({ data: dados });
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "CRIOU_PESSOA",
        entidade: "Pessoa",
        entidadeId: pessoa.id,
        metadados: { nome: pessoa.nome },
      });
      destino = `/pessoas/${pessoa.id}`;
    }
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    // documento duplicado: o banco tem índice único e é ele quem decide
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: "Já existe cadastro com este CPF ou CNPJ.", campo: "documento" };
    }
    throw erro;
  }

  revalidatePath("/pessoas");
  redirect(destino);
}

/**
 * Cadastra a pessoa e já a vincula ao procedimento, sem sair da tela.
 *
 * Pedido do cliente em 24/08: na hora de lavrar a ata descobre-se que o
 * advogado do Interessado Convidado não está cadastrado, e hoje é preciso
 * abandonar o procedimento, ir ao cadastro e voltar. O vínculo reaproveita
 * `adicionarParte`, para a regra de quem-representa-quem continuar num lugar só.
 */
export async function cadastrarEVincular(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = esquemaDePessoa.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  let pessoaId: string;
  try {
    conferirCoerencia(analise.data);
    const pessoa = await db.pessoa.create({ data: montarDadosDePessoa(analise.data) });
    pessoaId = pessoa.id;

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "CRIOU_PESSOA",
      entidade: "Pessoa",
      entidadeId: pessoa.id,
      metadados: { nome: pessoa.nome, origem: "vinculo-no-procedimento" },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: "Já existe pessoa com este CPF ou CNPJ.", campo: "documento" };
    }
    throw erro;
  }

  // a pessoa já existe a partir daqui: se o vínculo falhar, o cadastro fica de
  // pé e o operador só refaz a vinculação, sem redigitar tudo
  const vinculo = new FormData();
  vinculo.set("atoId", String(entrada.get("atoId") ?? ""));
  vinculo.set("pessoaId", pessoaId);
  vinculo.set("papel", String(entrada.get("papel") ?? ""));
  vinculo.set("representaId", String(entrada.get("representaId") ?? ""));

  return adicionarParte({}, vinculo);
}
