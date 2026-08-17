"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ModalidadeSessao,
  PapelNoAto,
  Prisma,
  StatusAto,
  TipoEvento,
} from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { configuracaoDoSistema } from "@/lib/configuracao";
import { db } from "@/lib/db";
import { ErroDeNegocio } from "@/lib/erros";
import { proximoNumeroDoAto } from "@/lib/numeracao";
import { calcularDataDaSessao, calcularPrazoDocumentacao, FUSO } from "@/lib/prazos";
import { exigirAcessoAoAto, exigirEquipe } from "@/lib/sessao";

export type EstadoDeFormulario = { erro?: string; campo?: string };

const TENTATIVAS_DE_NUMERACAO = 5;

const criacao = z.object({
  solicitanteId: z.string().min(1, "Selecione o Interessado Solicitante."),
  convidadoId: z.string().min(1, "Selecione o Interessado Convidado."),
  objeto: z.string().trim().max(2000).optional(),
  modalidade: z.nativeEnum(ModalidadeSessao).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});

/**
 * Criação do procedimento.
 *
 * Faz numeração, prazos e vínculo das duas partes numa transação só: um
 * procedimento sem Interessado Solicitante e Convidado não é um estado válido
 * do sistema, e não pode existir nem por um instante.
 *
 * Os prazos saem de ConfiguracaoSistema, nunca de número fixo (regra 12):
 *   dataReservada        = criação + diasAteSessao (D+20)
 *   prazoDocumentacaoAte = criação + prazoDocumentacaoDias (15 dias)
 *
 * A data fica RESERVADA, nunca confirmada: só o OK do operador no passo 3
 * efetiva a data (docs/02, regra 1). E a reserva vale para a primeira carta,
 * que é da Sprint 2 — na emissão dela o prazo é recontado a partir do envio.
 */
export async function criarAto(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = criacao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  const { solicitanteId, convidadoId, objeto, modalidade, observacoes } = analise.data;

  if (solicitanteId === convidadoId) {
    return {
      erro: "O Interessado Solicitante e o Interessado Convidado precisam ser pessoas diferentes.",
      campo: "convidadoId",
    };
  }

  const config = await configuracaoDoSistema();
  const agora = new Date();
  const ano = Number(
    new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: FUSO }).format(agora)
  );

  let atoId = "";

  // O número é único no banco. Se dois cadastros simultâneos disputarem o mesmo
  // sequencial, um recebe P2002 e repete — em vez de gerar número duplicado.
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_NUMERACAO; tentativa++) {
    try {
      const ato = await db.$transaction(async (tx) => {
        const numero = await proximoNumeroDoAto(tx, ano);

        const criado = await tx.ato.create({
          data: {
            numero,
            status: StatusAto.RASCUNHO,
            objeto: objeto || null,
            modalidade: modalidade ?? ModalidadeSessao.VIDEOCONFERENCIA,
            observacoes: observacoes || null,
            dataReservada: calcularDataDaSessao(agora, config.diasAteSessao),
            prazoDocumentacaoAte: calcularPrazoDocumentacao(agora, config.prazoDocumentacaoDias),
            criadoPorId: usuario.id,
            partes: {
              create: [
                { pessoaId: solicitanteId, papel: PapelNoAto.SOLICITANTE },
                { pessoaId: convidadoId, papel: PapelNoAto.CONVIDADO },
              ],
            },
          },
        });

        await tx.eventoAto.create({
          data: {
            atoId: criado.id,
            tipo: TipoEvento.ATO_CRIADO,
            descricao: `Procedimento ${numero} aberto.`,
            usuarioId: usuario.id,
            metadados: {
              diasAteSessao: config.diasAteSessao,
              prazoDocumentacaoDias: config.prazoDocumentacaoDias,
            },
          },
        });

        await tx.eventoAto.create({
          data: {
            atoId: criado.id,
            tipo: TipoEvento.PARTE_ADICIONADA,
            descricao: "Interessado Solicitante e Interessado Convidado vinculados.",
            usuarioId: usuario.id,
          },
        });

        return criado;
      });

      atoId = ato.id;

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "CRIOU_ATO",
        entidade: "Ato",
        entidadeId: ato.id,
        metadados: { numero: ato.numero },
      });
      break;
    } catch (erro) {
      const colisaoDeNumero =
        erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";

      if (colisaoDeNumero && tentativa < TENTATIVAS_DE_NUMERACAO) continue;
      if (colisaoDeNumero) {
        return { erro: "Não foi possível gerar a numeração agora. Tente novamente." };
      }
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
        return { erro: "Interessado não encontrado. Atualize a página e tente de novo." };
      }
      throw erro;
    }
  }

  revalidatePath("/atos");
  redirect(`/atos/${atoId}`);
}

const vinculo = z.object({
  atoId: z.string().min(1),
  pessoaId: z.string().min(1, "Selecione a pessoa."),
  papel: z.nativeEnum(PapelNoAto),
  representaId: z.string().trim().optional(),
});

/**
 * Vincula procurador (ou conciliador) ao procedimento.
 *
 * Procurador precisa dizer quem representa: é esse vínculo que docs/10 exige
 * para liberar acesso, e é por ele que o painel conta procedimentos por
 * representante.
 */
export async function adicionarParte(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = vinculo.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  const { atoId, pessoaId, papel, representaId } = analise.data;

  // mesmo sendo equipe, a consulta passa pelo filtro de visibilidade
  await exigirAcessoAoAto(atoId, db);

  try {
    if (papel === PapelNoAto.PROCURADOR && !representaId) {
      throw new ErroDeNegocio("Informe qual Interessado este procurador representa.");
    }

    if (representaId) {
      const representado = await db.parteDoAto.findFirst({
        where: { id: representaId, atoId },
        select: { id: true },
      });
      if (!representado) {
        throw new ErroDeNegocio("O Interessado representado não pertence a este procedimento.");
      }
    }

    const parte = await db.parteDoAto.create({
      data: {
        atoId,
        pessoaId,
        papel,
        representaId: papel === PapelNoAto.PROCURADOR ? representaId : null,
      },
      include: { pessoa: { select: { nome: true } } },
    });

    await db.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.PARTE_ADICIONADA,
        descricao: `${parte.pessoa.nome} vinculado como ${papel === PapelNoAto.PROCURADOR ? "procurador" : "conciliador"}.`,
        usuarioId: usuario.id,
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ADICIONOU_PARTE",
      entidade: "Ato",
      entidadeId: atoId,
      metadados: { pessoaId, papel },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: "Esta pessoa já está vinculada ao procedimento com este papel." };
    }
    throw erro;
  }

  revalidatePath(`/atos/${atoId}`);
  return {};
}

/** Remove vínculo. Interessado Solicitante e Convidado não podem ser removidos. */
export async function removerParte(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();

  const parteId = String(entrada.get("parteId") ?? "");
  const atoId = String(entrada.get("atoId") ?? "");
  if (!parteId || !atoId) throw new ErroDeNegocio("Vínculo não informado.");

  await exigirAcessoAoAto(atoId, db);

  const parte = await db.parteDoAto.findFirst({
    where: { id: parteId, atoId },
    include: { pessoa: { select: { nome: true } }, representados: { select: { id: true } } },
  });
  if (!parte) throw new ErroDeNegocio("Vínculo não encontrado neste procedimento.");

  if (parte.papel === PapelNoAto.SOLICITANTE || parte.papel === PapelNoAto.CONVIDADO) {
    throw new ErroDeNegocio(
      "O Interessado Solicitante e o Interessado Convidado não podem ser removidos do procedimento."
    );
  }
  if (parte.representados.length > 0) {
    throw new ErroDeNegocio("Remova antes os procuradores vinculados a este Interessado.");
  }

  await db.parteDoAto.delete({ where: { id: parteId } });

  await db.eventoAto.create({
    data: {
      atoId,
      tipo: TipoEvento.OBSERVACAO,
      descricao: `Vínculo de ${parte.pessoa.nome} removido.`,
      usuarioId: usuario.id,
    },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "REMOVEU_PARTE",
    entidade: "Ato",
    entidadeId: atoId,
    metadados: { parteId, papel: parte.papel },
  });

  revalidatePath(`/atos/${atoId}`);
}

const anotacao = z.object({
  atoId: z.string().min(1),
  descricao: z.string().trim().min(3, "Escreva a observação."),
});

/** Observação manual na linha do tempo. */
export async function registrarObservacao(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = anotacao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { atoId, descricao } = analise.data;
  await exigirAcessoAoAto(atoId, db);

  await db.eventoAto.create({
    data: { atoId, tipo: TipoEvento.OBSERVACAO, descricao, usuarioId: usuario.id },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "ALTEROU_ATO",
    entidade: "Ato",
    entidadeId: atoId,
    metadados: { evento: "OBSERVACAO" },
  });

  revalidatePath(`/atos/${atoId}`);
  return {};
}
