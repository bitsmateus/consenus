/**
 * Agenda de sessões contra o banco: o que já está marcado e os dias sem sessão
 * cadastrados. As regras em si moram em `agenda.ts`, puras e testáveis.
 *
 * Roda só no servidor.
 */
import { Prisma, StatusAto } from "@prisma/client";
import { configuracaoDoSistema } from "./configuracao";
import { db } from "./db";
import type { DiaExtra, RegrasDaAgenda, SessaoMarcada } from "./agenda";

type Cliente = Prisma.TransactionClient | typeof db;

/** Chave da trava de aviso do Postgres: uma só para toda a agenda. */
const TRAVA_DA_AGENDA = 872_001;

/**
 * Serializa quem escolhe horário. Sem isto, dois operadores abrindo procedimento
 * no mesmo instante enxergam a mesma vaga livre e a agenda ganha duas sessões
 * no mesmo horário — exatamente o que a regra proíbe. A trava dura até o fim
 * da transação.
 */
export async function travarAgenda(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TRAVA_DA_AGENDA})`;
}

/** Sessão que deixou de ocupar a agenda: cancelada ou remarcada para data a definir. */
const STATUS_SEM_VAGA_OCUPADA = [StatusAto.CANCELADO, StatusAto.REDESIGNADA];

export async function carregarContextoDaAgenda(cliente: Cliente, ignorarAtoId?: string) {
  const config = await configuracaoDoSistema();

  const regras: RegrasDaAgenda = {
    inicio: config.agendaInicio,
    fim: config.agendaFim,
    almocoInicio: config.almocoInicio,
    almocoFim: config.almocoFim,
    duracaoMinutos: config.duracaoSessaoMinutos,
  };

  const [dias, atos] = await Promise.all([
    cliente.diaSemSessao.findMany({ orderBy: { data: "asc" } }),
    cliente.ato.findMany({
      where: {
        ...(ignorarAtoId ? { id: { not: ignorarAtoId } } : {}),
        status: { notIn: STATUS_SEM_VAGA_OCUPADA },
        OR: [{ dataConfirmada: { not: null } }, { dataReservada: { not: null } }],
      },
      select: { numero: true, dataReservada: true, dataConfirmada: true },
    }),
  ]);

  const extras: DiaExtra[] = dias.map((d) => ({
    data: d.data.toISOString().slice(0, 10),
    descricao: d.descricao,
  }));

  const marcadas: SessaoMarcada[] = [];
  for (const ato of atos) {
    const inicio = ato.dataConfirmada ?? ato.dataReservada;
    if (inicio) marcadas.push({ inicio, rotulo: `procedimento ${ato.numero}` });
  }

  return { regras, extras, marcadas };
}
