"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, TipoPessoa, TipoProcurador } from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { apenasDigitos, documentoEhValido } from "@/lib/documentos";
import { ErroDeNegocio } from "@/lib/erros";
import { exigirEquipe } from "@/lib/sessao";

export type EstadoDeFormulario = { erro?: string; campo?: string };

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

const esquema = z.object({
  tipo: z.nativeEnum(TipoPessoa),
  nome: z.string().trim().min(3, "Informe o nome completo."),
  documento: z
    .string()
    .trim()
    .min(1, "Informe o CPF ou CNPJ.")
    .refine((v) => documentoEhValido(v), "CPF ou CNPJ inválido. Confira os dígitos."),
  email: z.union([z.string().trim().email("E-mail inválido."), z.literal("")]).optional(),
  telefone: z.string().trim().optional(),
  logradouro: z.string().trim().optional(),
  numero: z.string().trim().optional(),
  complemento: z.string().trim().optional(),
  bairro: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  uf: z.union([z.enum(UFS), z.literal("")]).optional(),
  cep: z.string().trim().optional(),
  tipoProcurador: z.union([z.nativeEnum(TipoProcurador), z.literal("")]).optional(),
  oab: z.string().trim().optional(),
  vinculadoAId: z.string().trim().optional(),
});

/**
 * Coerência entre tipo de pessoa, documento e natureza de procurador.
 * As naturezas vêm de docs/10: advogado é CPF+OAB, escritório é CNPJ+OAB,
 * consultoria é CNPJ, representante é CPF.
 */
function conferirCoerencia(dados: z.infer<typeof esquema>) {
  const digitos = apenasDigitos(dados.documento);
  const ehCpf = digitos.length === 11;

  if (dados.tipo === TipoPessoa.FISICA && !ehCpf) {
    throw new ErroDeNegocio("Pessoa física precisa de CPF, com 11 dígitos.");
  }
  if (dados.tipo === TipoPessoa.JURIDICA && ehCpf) {
    throw new ErroDeNegocio("Pessoa jurídica precisa de CNPJ, com 14 dígitos.");
  }

  const natureza = dados.tipoProcurador || null;
  if (!natureza) return;

  const exigeCnpj =
    natureza === TipoProcurador.ESCRITORIO_ADVOCACIA ||
    natureza === TipoProcurador.EMPRESA_CONSULTORIA;

  if (exigeCnpj && ehCpf) {
    throw new ErroDeNegocio("Escritório de advocacia e consultoria são cadastrados com CNPJ.");
  }
  if (!exigeCnpj && !ehCpf) {
    throw new ErroDeNegocio("Advogado e representante de empresa são cadastrados com CPF.");
  }
  if (
    (natureza === TipoProcurador.ADVOGADO || natureza === TipoProcurador.ESCRITORIO_ADVOCACIA) &&
    !dados.oab
  ) {
    throw new ErroDeNegocio("Informe a OAB para advogado ou escritório de advocacia.");
  }
}

function montarDados(dados: z.infer<typeof esquema>) {
  return {
    tipo: dados.tipo,
    nome: dados.nome,
    documento: apenasDigitos(dados.documento),
    email: dados.email || null,
    telefone: dados.telefone || null,
    logradouro: dados.logradouro || null,
    numero: dados.numero || null,
    complemento: dados.complemento || null,
    bairro: dados.bairro || null,
    cidade: dados.cidade || null,
    uf: dados.uf || null,
    cep: dados.cep ? apenasDigitos(dados.cep) : null,
    tipoProcurador: dados.tipoProcurador || null,
    oab: dados.oab || null,
    vinculadoAId: dados.vinculadoAId || null,
  };
}

export async function salvarPessoa(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = esquema.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  const id = String(entrada.get("id") ?? "");
  let destino: string;

  try {
    conferirCoerencia(analise.data);
    const dados = montarDados(analise.data);

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
