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
import { addDays } from "date-fns";
import { ModalidadeSessao, PapelNoAto, Prisma, StatusAto } from "@prisma/client";
import { ESTADOS_FINAIS } from "./autorizacao";
import { db } from "./db";
import { apenasDigitos } from "./documentos";
import { inicioDoDiaOuIndefinido } from "./prazos";

export type FiltrosDeAtos = {
  busca?: string;
  status?: StatusAto;
  procuradorId?: string;
  interessadoId?: string;
  conciliadorId?: string;
  modalidade?: ModalidadeSessao;
  /** Separa quem tem procurador vinculado de quem não tem. */
  comProcuracao?: "sim" | "nao";
  /**
   * Recortes que o painel usa nos cartões, para o clique cair na lista já
   * filtrada em vez de despejar tudo.
   */
  situacao?: "em_andamento" | "prazo_vencido";
  /**
   * Intervalo pela data da sessão — a confirmada quando existe, senão a
   * reservada, a mesma que aparece na lista. "AAAA-MM-DD", de um
   * `<input type="date">`; inválido ou vazio é ignorado, não é erro.
   */
  dataDe?: string;
  dataAte?: string;
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

  // Interessado é quem figura como Solicitante ou Convidado. Procurador tem
  // filtro próprio: quem representa não é parte interessada no procedimento.
  if (filtros.interessadoId) {
    condicoes.push({
      partes: {
        some: {
          pessoaId: filtros.interessadoId,
          papel: { in: [PapelNoAto.SOLICITANTE, PapelNoAto.CONVIDADO] },
        },
      },
    });
  }

  if (filtros.conciliadorId) {
    condicoes.push({
      partes: { some: { pessoaId: filtros.conciliadorId, papel: PapelNoAto.CONCILIADOR } },
    });
  }

  if (filtros.modalidade) condicoes.push({ modalidade: filtros.modalidade });

  if (filtros.comProcuracao === "sim") {
    condicoes.push({ partes: { some: { papel: PapelNoAto.PROCURADOR } } });
  }
  if (filtros.comProcuracao === "nao") {
    condicoes.push({ partes: { none: { papel: PapelNoAto.PROCURADOR } } });
  }

  if (filtros.situacao === "em_andamento") {
    condicoes.push({ status: { notIn: ESTADOS_FINAIS } });
  }

  // Prazo vencido só faz sentido em procedimento vivo: encerrado não tem mais
  // prazo a perder.
  if (filtros.situacao === "prazo_vencido") {
    condicoes.push({
      status: { notIn: ESTADOS_FINAIS },
      prazoDocumentacaoAte: { lt: new Date() },
    });
  }

  const inicio = inicioDoDiaOuIndefinido(filtros.dataDe);
  const fimDoDia = inicioDoDiaOuIndefinido(filtros.dataAte);
  const fimValido = fimDoDia ? addDays(fimDoDia, 1) : undefined;

  if (inicio || fimValido) {
    const intervalo: Prisma.DateTimeFilter = {};
    if (inicio) intervalo.gte = inicio;
    if (fimValido) intervalo.lt = fimValido;

    // a data que aparece na lista é a confirmada quando existe, senão a
    // reservada — o filtro precisa olhar para a mesma coluna que é mostrada
    condicoes.push({
      OR: [{ dataConfirmada: intervalo }, { AND: [{ dataConfirmada: null }, { dataReservada: intervalo }] }],
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
  return contarPessoasPorPapelEm(where, [PapelNoAto.PROCURADOR], {
    tipoProcurador: true,
    oab: true,
  });
}

/** Conciliadores com contagem de procedimentos — mesmo desenho do filtro por procurador. */
export async function contarConciliadoresEm(where: Prisma.AtoWhereInput) {
  return contarPessoasPorPapelEm(where, [PapelNoAto.CONCILIADOR], {});
}

export async function contarPorModalidadeEm(where: Prisma.AtoWhereInput) {
  const agrupado = await db.ato.groupBy({
    by: ["modalidade"],
    where,
    _count: { _all: true },
  });

  return agrupado.reduce<Partial<Record<ModalidadeSessao, number>>>((acc, linha) => {
    acc[linha.modalidade] = linha._count._all;
    return acc;
  }, {});
}

/** Quantos procedimentos do recorte têm procurador vinculado, e quantos não têm. */
export async function contarPorProcuracaoEm(
  where: Prisma.AtoWhereInput
): Promise<{ sim: number; nao: number }> {
  const [sim, total] = await Promise.all([
    db.ato.count({ where: { AND: [where, { partes: { some: { papel: PapelNoAto.PROCURADOR } } }] } }),
    db.ato.count({ where }),
  ]);
  return { sim, nao: total - sim };
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
      documentos: {
        orderBy: { criadoEm: "desc" },
        include: {
          enviadoPor: { select: { nome: true } },
          // situação da assinatura eletrônica, quando o documento foi enviado
          emAssinatura: {
            select: {
              status: true,
              totalSignatarios: true,
              jaAssinaram: true,
              assinadoId: true,
              ultimoErro: true,
            },
          },
        },
      },
      conferencias: { include: { conferidoPor: { select: { nome: true } } } },
      termoDeAcordo: true,
      envios: {
        orderBy: { criadoEm: "desc" },
        include: {
          documento: { select: { id: true, codigoVerificacao: true, nomeArquivo: true } },
          destinatario: { select: { nome: true } },
          comprovante: { select: { id: true, nomeArquivo: true } },
        },
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

/**
 * Pessoas com contagem de procedimentos, por papel no ato.
 *
 * A contagem sai de ParteDoAto, mas restrita aos atos que o `where` permite:
 * sem isso o número revelaria a existência de procedimentos fora do alcance do
 * usuário. Por isso a lista de ids visíveis vem antes do agrupamento.
 */
async function contarPessoasPorPapelEm(
  where: Prisma.AtoWhereInput,
  papeis: PapelNoAto[],
  select: Prisma.PessoaSelect
) {
  // O recorte de visibilidade entra como filtro da relação, e não como lista de
  // ids buscada antes: uma consulta em vez de duas, e o banco resolve o vínculo.
  // A garantia é a mesma — sem isso a contagem denunciaria a existência de
  // procedimento fora do alcance de quem consulta.
  const agrupado = await db.parteDoAto.groupBy({
    by: ["pessoaId"],
    where: { papel: { in: papeis }, ato: where },
    _count: { _all: true },
  });
  if (agrupado.length === 0) return [];

  const pessoas = await db.pessoa.findMany({
    where: { id: { in: agrupado.map((l) => l.pessoaId) } },
    select: { id: true, nome: true, ...select },
  });

  return agrupado
    .map((linha) => {
      const pessoa = pessoas.find((p) => p.id === linha.pessoaId);
      return pessoa ? { ...pessoa, total: linha._count._all } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Interessados com contagem de procedimentos.
 *
 * Pedido do cliente em 24/08: buscar pelo Interessado, não só pelo procurador
 * — é como a câmara enxerga a carteira ("todos os procedimentos do Itaú").
 */
export async function contarInteressadosEm(where: Prisma.AtoWhereInput) {
  return contarPessoasPorPapelEm(
    where,
    [PapelNoAto.SOLICITANTE, PapelNoAto.CONVIDADO],
    { documento: true, tipo: true }
  );
}
