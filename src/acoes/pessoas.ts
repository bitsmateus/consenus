"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { apenasDigitos } from "@/lib/documentos";
import { ErroDeNegocio } from "@/lib/erros";
import {
  inferirTipoPessoa,
  lerLinhasDaPlanilha,
  resolverNatureza,
  type LinhaDaPlanilha,
} from "@/lib/importacao-pessoas";
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

export type ErroDeImportacao = { linha: number; nome: string; motivo: string };
export type ResultadoDeImportacao = {
  erro?: string;
  resumo?: { total: number; importadas: number; erros: ErroDeImportacao[] };
};

const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB — de sobra para uma planilha de cadastro

/**
 * Importa pessoas de uma planilha .xlsx — pedido do cliente em 28/08, para a
 * base de Interessados e procuradores não depender de cadastro um a um.
 *
 * Processa linha por linha, não numa transação só: uma linha com erro não
 * derruba as outras, e o resumo devolvido mostra exatamente quais falharam e
 * por quê. Pessoa com CPF/CNPJ que já existe — no banco ou numa linha
 * anterior desta mesma planilha — é reportada como erro, nunca sobrescrita:
 * corrigir cadastro existente é tela, não planilha.
 */
export async function importarPessoas(
  _anterior: ResultadoDeImportacao,
  entrada: FormData
): Promise<ResultadoDeImportacao> {
  const usuario = await exigirEquipe();

  const arquivo = entrada.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione o arquivo da planilha." };
  }
  if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
    return { erro: "Envie um arquivo .xlsx — baixe a planilha modelo para preencher os dados." };
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return { erro: "Arquivo muito grande. O limite é 5 MB." };
  }

  let linhas: LinhaDaPlanilha[];
  try {
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    linhas = await lerLinhasDaPlanilha(buffer);
  } catch {
    return { erro: "Não foi possível ler a planilha. Confira se é um arquivo .xlsx válido." };
  }
  if (linhas.length === 0) {
    return { erro: "A planilha não tem nenhuma linha preenchida." };
  }

  // documento (só dígitos) -> id, para resolver "empresa vinculada" — já
  // cadastradas e as que forem criadas ao longo desta mesma importação
  const mapaDeDocumentos = new Map<string, string>();
  for (const p of await db.pessoa.findMany({ select: { id: true, documento: true } })) {
    mapaDeDocumentos.set(p.documento, p.id);
  }

  const erros: ErroDeImportacao[] = [];
  let importadas = 0;

  for (const { numero, valores } of linhas) {
    const nomeParaErro = valores.nome || `(sem nome, linha ${numero})`;
    try {
      const documentoDigitos = apenasDigitos(valores.documento ?? "");
      if (mapaDeDocumentos.has(documentoDigitos)) {
        throw new ErroDeNegocio("Já existe cadastro com este CPF ou CNPJ.");
      }

      const natureza = resolverNatureza(valores.natureza);
      let vinculadoAId: string | undefined;
      if (valores.vinculadoA) {
        vinculadoAId = mapaDeDocumentos.get(apenasDigitos(valores.vinculadoA));
        if (!vinculadoAId) {
          throw new ErroDeNegocio(
            `Empresa vinculada não encontrada para o CPF/CNPJ ${valores.vinculadoA}.`
          );
        }
      }

      const analise = esquemaDePessoa.safeParse({
        tipo: inferirTipoPessoa(valores.documento ?? ""),
        nome: valores.nome ?? "",
        documento: valores.documento ?? "",
        email: valores.email ?? "",
        telefone: valores.telefone,
        logradouro: valores.logradouro,
        numero: valores.numero,
        complemento: valores.complemento,
        bairro: valores.bairro,
        cidade: valores.cidade,
        uf: (valores.uf ?? "").toUpperCase(),
        cep: valores.cep,
        tipoProcurador: natureza,
        oab: valores.oab,
        vinculadoAId,
      });
      if (!analise.success) {
        throw new ErroDeNegocio(analise.error.issues[0]?.message ?? "Dados inválidos.");
      }
      conferirCoerencia(analise.data);

      const pessoa = await db.pessoa.create({ data: montarDadosDePessoa(analise.data) });
      mapaDeDocumentos.set(documentoDigitos, pessoa.id);
      importadas++;

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "CRIOU_PESSOA",
        entidade: "Pessoa",
        entidadeId: pessoa.id,
        metadados: { nome: pessoa.nome, origem: "importacao-planilha" },
      });
    } catch (erro) {
      const motivo =
        erro instanceof ErroDeNegocio
          ? erro.message
          : erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002"
            ? "Já existe cadastro com este CPF ou CNPJ."
            : "Erro inesperado ao importar esta linha.";
      erros.push({ linha: numero, nome: nomeParaErro, motivo });
    }
  }

  revalidatePath("/pessoas");
  return { resumo: { total: linhas.length, importadas, erros } };
}
