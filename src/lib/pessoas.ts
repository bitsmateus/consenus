/**
 * Regras de cadastro de pessoa — parte pura, compartilhada entre
 * `acoes/pessoas.ts` (tela de cadastro) e `acoes/atos.ts` (cadastro rápido de
 * procurador junto com a abertura do procedimento). Vive aqui, e não em
 * `acoes/pessoas.ts`, porque esse arquivo importa de `acoes/atos.ts`
 * (`adicionarParte`) — duas Server Actions importando uma da outra formaria
 * ciclo.
 */
import { TipoPessoa, TipoProcurador } from "@prisma/client";
import { z } from "zod";
import { apenasDigitos, documentoEhValido } from "@/lib/documentos";
import { ErroDeNegocio } from "@/lib/erros";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

export const esquemaDePessoa = z.object({
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
export function conferirCoerencia(dados: z.infer<typeof esquemaDePessoa>) {
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

export function montarDadosDePessoa(dados: z.infer<typeof esquemaDePessoa>) {
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
