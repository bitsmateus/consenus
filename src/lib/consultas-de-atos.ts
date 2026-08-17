/**
 * Consultas de procedimento — parte pura.
 *
 * Toda função aqui recebe o `where` de visibilidade pronto, como primeiro
 * argumento. Não lê sessão e não importa Auth.js, por dois motivos: fica
 * testável sem servidor, e a visibilidade vira parâmetro explícito em vez de
 * efeito colateral escondido.
 *
 * Quem compõe isso com a sessão do usuário é `consultas.ts` — use aquele nas
 * páginas (CLAUDE.md, regra 3).
 */
import { PapelNoAto, Prisma, StatusAto } from "@prisma/client";
import { db } from "./db";
import { apenasDigitos } from "./documentos";

export type FiltrosDeAtos = {
  busca?: string;
  status?: StatusAto;
  procuradorId?: string;
};

/**
 * Busca livre: nome, CPF, CNPJ e OAB de qualquer pessoa vinculada, mais o
 * número e o objeto do procedimento. Requisito de docs/10 e da Sprint 1.
 */
export function filtroDeBusca(busca: string): Prisma.AtoWhereInput {
  const termo = busca.trim();
  const digitos = apenasDigitos(termo);

  const condicoes: Prisma.AtoWhereInput[] = [
    { numero: { contains: termo, mode: "insensitive" } },
    { objeto: { contains: termo, mode: "insensitive" } },
    { partes: { some: { pessoa: { nome: { contains: termo, mode: "insensitive" } } } } },
    { partes: { some: { pessoa: { oab: { contains: termo, mode: "insensitive" } } } } },
  ];

  // documento só entra com 3+ dígitos, senão "1" casaria com quase tudo
  if (digitos.length >= 3) {
    condicoes.push({ partes: { some: { pessoa: { documento: { contains: digitos } } } } });
  }

  return { OR: condicoes };
}

/** Compõe a visibilidade com os filtros da tela. */
export function comFiltros(
  visibilidade: Prisma.AtoWhereInput,
  filtros: FiltrosDeAtos
): Prisma.AtoWhereInput {
  const condicoes: Prisma.AtoWhereInput[] = [visibilidade];

  if (filtros.busca) condicoes.push(filtroDeBusca(filtros.busca));
  if (filtros.status) condicoes.push({ status: filtros.status });
  if (filtros.procuradorId) {
    condicoes.push({
      partes: { some: { pessoaId: filtros.procuradorId, papel: PapelNoAto.PROCURADOR } },
    });
  }

  return { AND: condicoes };
}

export async function listarAtosEm(where: Prisma.AtoWhereInput) {
  return db.ato.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: {
      partes: {
        include: {
          pessoa: { select: { id: true, nome: true, documento: true, tipoProcurador: true } },
        },
      },
    },
  });
}

export async function contarPorStatusEm(where: Prisma.AtoWhereInput) {
  const agrupado = await db.ato.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  return agrupado.reduce<Partial<Record<StatusAto, number>>>((acc, linha) => {
    acc[linha.status] = linha._count._all;
    return acc;
  }, {});
}

/**
 * Procuradores com contagem de procedimentos — os "chips" do painel (docs/10).
 *
 * A contagem sai de ParteDoAto, mas restrita aos atos que o `where` permite:
 * sem isso o número revelaria a existência de procedimentos fora do alcance do
 * usuário. Por isso a lista de ids visíveis vem antes do agrupamento.
 */
export async function contarProcuradoresEm(where: Prisma.AtoWhereInput) {
  const visiveis = await db.ato.findMany({ where, select: { id: true } });
  if (visiveis.length === 0) return [];

  const agrupado = await db.parteDoAto.groupBy({
    by: ["pessoaId"],
    where: {
      papel: PapelNoAto.PROCURADOR,
      atoId: { in: visiveis.map((a) => a.id) },
    },
    _count: { _all: true },
  });
  if (agrupado.length === 0) return [];

  const pessoas = await db.pessoa.findMany({
    where: { id: { in: agrupado.map((l) => l.pessoaId) } },
    select: { id: true, nome: true, tipoProcurador: true, oab: true },
  });

  return agrupado
    .map((linha) => {
      const pessoa = pessoas.find((p) => p.id === linha.pessoaId);
      return pessoa ? { ...pessoa, total: linha._count._all } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function buscarAtoEm(where: Prisma.AtoWhereInput) {
  return db.ato.findFirst({
    where,
    include: {
      criadoPor: { select: { nome: true } },
      partes: {
        orderBy: { criadoEm: "asc" },
        include: {
          pessoa: true,
          representa: { include: { pessoa: { select: { nome: true } } } },
          representados: { select: { id: true } },
        },
      },
      eventos: {
        orderBy: { criadoEm: "desc" },
        include: { usuario: { select: { nome: true } } },
      },
    },
  });
}

/** Pessoas para as telas de cadastro e vínculo. Não depende de visibilidade de ato. */
export async function listarPessoas(busca?: string, apenasProcuradores = false) {
  const termo = busca?.trim();
  const digitos = termo ? apenasDigitos(termo) : "";

  const where: Prisma.PessoaWhereInput = {};
  if (apenasProcuradores) where.tipoProcurador = { not: null };

  if (termo) {
    where.OR = [
      { nome: { contains: termo, mode: "insensitive" } },
      { oab: { contains: termo, mode: "insensitive" } },
      ...(digitos.length >= 3 ? [{ documento: { contains: digitos } }] : []),
    ];
  }

  return db.pessoa.findMany({
    where,
    orderBy: { nome: "asc" },
    take: 200,
    include: { _count: { select: { participacoes: true } } },
  });
}
