"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ModalidadeSessao,
  PapelNoAto,
  Prisma,
  StatusAto,
  TipoEvento,
  TipoPessoa,
  TipoProcurador,
} from "@prisma/client";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { ESTADOS_FINAIS } from "@/lib/autorizacao";
import { registrarAuditoria } from "@/lib/auditoria";
import { ROTULO_MODALIDADE } from "@/lib/formato";
import { cancelarReuniao, criarReuniao, remarcarReuniao, videoconferenciaAtiva } from "@/lib/zoom";
import { configuracaoDoSistema } from "@/lib/configuracao";
import { db } from "@/lib/db";
import { ErroDeNegocio } from "@/lib/erros";
import { proximoNumeroDoAto } from "@/lib/numeracao";
import { conferirCoerencia, esquemaDePessoa, montarDadosDePessoa } from "@/lib/pessoas";
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
  // procurador é opcional, e já pode ser vinculado na abertura (pedido do
  // cliente em 28/08) — antes só dava para vincular depois, na tela do ato
  // select sempre presente no formulário: quando ninguém escolhe, o HTML
  // manda string vazia, não ausência — .optional() sozinho não cobre isso
  procuradorRepresenta: z.union([z.enum(["solicitante", "convidado"]), z.literal("")]).optional(),
  procuradorPessoaId: z.string().trim().optional(),
  procuradorNovo: z.string().optional(),
  procuradorTipo: z.nativeEnum(TipoPessoa).optional(),
  procuradorNome: z.string().trim().optional(),
  procuradorDocumento: z.string().trim().optional(),
  procuradorTipoProcurador: z.nativeEnum(TipoProcurador).optional(),
  procuradorOab: z.string().trim().optional(),
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

  const {
    solicitanteId,
    convidadoId,
    objeto,
    modalidade,
    observacoes,
    procuradorRepresenta,
    procuradorPessoaId,
    procuradorNovo,
    procuradorTipo,
    procuradorNome,
    procuradorDocumento,
    procuradorTipoProcurador,
    procuradorOab,
  } = analise.data;

  if (solicitanteId === convidadoId) {
    return {
      erro: "O Interessado Solicitante e o Interessado Convidado precisam ser pessoas diferentes.",
      campo: "convidadoId",
    };
  }

  // Resolvido ANTES da transação de numeração: se o operador cadastrou o
  // procurador na hora, a pessoa só precisa nascer uma vez, mesmo que a
  // numeração colida e a tentativa seguinte rode de novo.
  let procuradorPessoaResolvidoId: string | null = null;
  if (procuradorRepresenta) {
    if (procuradorNovo === "true") {
      if (!procuradorTipoProcurador) {
        return { erro: "Selecione a natureza do procurador.", campo: "procuradorTipoProcurador" };
      }
      const analisePessoa = esquemaDePessoa.safeParse({
        tipo: procuradorTipo ?? TipoPessoa.FISICA,
        nome: procuradorNome ?? "",
        documento: procuradorDocumento ?? "",
        tipoProcurador: procuradorTipoProcurador,
        oab: procuradorOab ?? "",
      });
      if (!analisePessoa.success) {
        return {
          erro: analisePessoa.error.issues[0]?.message ?? "Dados do procurador inválidos.",
        };
      }
      try {
        conferirCoerencia(analisePessoa.data);
        const pessoa = await db.pessoa.create({ data: montarDadosDePessoa(analisePessoa.data) });
        procuradorPessoaResolvidoId = pessoa.id;
        await registrarAuditoria({
          usuarioId: usuario.id,
          acao: "CRIOU_PESSOA",
          entidade: "Pessoa",
          entidadeId: pessoa.id,
          metadados: { nome: pessoa.nome, origem: "abertura-do-procedimento" },
        });
      } catch (erro) {
        if (erro instanceof ErroDeNegocio) return { erro: erro.message };
        if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
          return { erro: "Já existe pessoa com este CPF ou CNPJ.", campo: "procuradorDocumento" };
        }
        throw erro;
      }
    } else if (procuradorPessoaId) {
      if (procuradorPessoaId === solicitanteId || procuradorPessoaId === convidadoId) {
        return {
          erro: "O procurador precisa ser uma pessoa diferente do Solicitante e do Convidado.",
          campo: "procuradorPessoaId",
        };
      }
      procuradorPessoaResolvidoId = procuradorPessoaId;
    } else {
      return {
        erro: "Selecione o procurador já cadastrado, ou informe os dados de um novo.",
        campo: "procuradorPessoaId",
      };
    }
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
            dataReservada: calcularDataDaSessao(agora, config.diasAteSessao, config.horaDaSessao),
            prazoDocumentacaoAte: calcularPrazoDocumentacao(agora, config.prazoDocumentacaoDias),
            criadoPorId: usuario.id,
            partes: {
              create: [
                { pessoaId: solicitanteId, papel: PapelNoAto.SOLICITANTE },
                { pessoaId: convidadoId, papel: PapelNoAto.CONVIDADO },
              ],
            },
          },
          include: { partes: true },
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

        if (procuradorPessoaResolvidoId && procuradorRepresenta) {
          const representado = criado.partes.find((p) =>
            procuradorRepresenta === "solicitante"
              ? p.papel === PapelNoAto.SOLICITANTE
              : p.papel === PapelNoAto.CONVIDADO
          );
          if (!representado) {
            throw new ErroDeNegocio("Interessado representado não encontrado.");
          }

          const parteDoProcurador = await tx.parteDoAto.create({
            data: {
              atoId: criado.id,
              pessoaId: procuradorPessoaResolvidoId,
              papel: PapelNoAto.PROCURADOR,
              representaId: representado.id,
            },
            include: { pessoa: { select: { nome: true } } },
          });

          await tx.eventoAto.create({
            data: {
              atoId: criado.id,
              tipo: TipoEvento.PARTE_ADICIONADA,
              descricao: `${parteDoProcurador.pessoa.nome} vinculado como procurador.`,
              usuarioId: usuario.id,
            },
          });
        }

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

      await agendarVideoconferencia(ato, config, usuario.id);
      break;
    } catch (erro) {
      if (erro instanceof ErroDeNegocio) return { erro: erro.message };

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

const renomeacao = z.object({
  atoId: z.string().min(1),
  titulo: z.string().trim().max(120, "O título cabe em 120 caracteres.").optional(),
});

/**
 * Título de trabalho do procedimento — pedido do cliente em 24/08.
 *
 * É apelido de listagem, não identidade: o número continua sendo o que vai nos
 * documentos e no código de verificação. Título vazio limpa o campo e a tela
 * volta a mostrar só o número.
 */
export async function renomearAto(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = renomeacao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { atoId, titulo } = analise.data;
  const ato = await exigirAcessoAoAto(atoId, db);

  const novo = titulo || null;
  if (novo === ato.titulo) return {};

  await db.ato.update({ where: { id: atoId }, data: { titulo: novo } });

  await db.eventoAto.create({
    data: {
      atoId,
      tipo: TipoEvento.OBSERVACAO,
      descricao: novo
        ? `Título do procedimento definido como "${novo}".`
        : "Título do procedimento removido.",
      usuarioId: usuario.id,
    },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "ALTEROU_ATO",
    entidade: "Ato",
    entidadeId: atoId,
    metadados: { evento: "TITULO", de: ato.titulo, para: novo },
  });

  revalidatePath("/atos/" + atoId);
  revalidatePath("/atos");
  return {};
}

/**
 * Agenda a Sessão Privada de Conciliação no Zoom e grava link, ID e senha.
 *
 * Roda FORA da transação e engole a falha de propósito: a reunião é
 * conveniência, o procedimento é o registro. Se o Zoom estiver fora do ar, o
 * cadastro não pode cair junto — a falha vai para a linha do tempo e o
 * operador informa os dados por fora, como fazia antes da integração.
 *
 * Só para sessão que tem videoconferência: presencial não precisa de sala.
 */
async function agendarVideoconferencia(
  ato: { id: string; numero: string; modalidade: ModalidadeSessao; dataReservada: Date | null },
  config: { duracaoSessaoMinutos: number },
  usuarioId: string
): Promise<void> {
  const temVideo =
    ato.modalidade === ModalidadeSessao.VIDEOCONFERENCIA ||
    ato.modalidade === ModalidadeSessao.HIBRIDA;

  if (!temVideo || !ato.dataReservada || !videoconferenciaAtiva()) return;

  try {
    const reuniao = await criarReuniao({
      numeroDoAto: ato.numero,
      quando: ato.dataReservada,
      duracaoMinutos: config.duracaoSessaoMinutos,
    });

    await db.ato.update({
      where: { id: ato.id },
      data: {
        linkVideoconferencia: reuniao.link,
        idReuniao: reuniao.idReuniao,
        senhaReuniao: reuniao.senha,
      },
    });

    await db.eventoAto.create({
      data: {
        atoId: ato.id,
        tipo: TipoEvento.ATO_CRIADO,
        descricao: `Sala da videoconferência agendada no Zoom (reunião ${reuniao.idReuniao}).`,
        usuarioId,
      },
    });
  } catch (erro) {
    console.error("[zoom] falha ao agendar a sessão do ato", ato.numero, erro);

    await db.eventoAto.create({
      data: {
        atoId: ato.id,
        tipo: TipoEvento.OBSERVACAO,
        descricao:
          "Não foi possível agendar a sala no Zoom. Informe link, ID e senha da reunião antes de emitir a Carta-Convite.",
        usuarioId,
      },
    });
  }
}

const agenda = z.object({
  atoId: z.string().min(1),
  modalidade: z.nativeEnum(ModalidadeSessao),
  /** "AAAA-MM-DDTHH:MM" do input datetime-local, em horário de São Paulo. */
  dataDaSessao: z.string().trim().min(1, "Informe a data e a hora da sessão."),
});

/**
 * Ajusta modalidade e data da sessão depois de o procedimento estar aberto.
 *
 * Pedido do cliente em 24/08: a data nascia sempre em D+20 e não havia como
 * mexer, nem para corrigir engano nem para atender remarcação combinada entre
 * as partes.
 *
 * Só antes da sessão registrada: depois disso a data é fato consumado, está na
 * Ata, e mudá-la seria reescrever o que aconteceu.
 */
export async function alterarAgenda(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = agenda.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { atoId, modalidade, dataDaSessao } = analise.data;

  try {
    await exigirAcessoAoAto(atoId, db);

    const ato = await db.ato.findUnique({
      where: { id: atoId },
      select: {
        numero: true,
        status: true,
        modalidade: true,
        dataReservada: true,
        dataConfirmada: true,
        idReuniao: true,
      },
    });
    if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");

    if (ESTADOS_FINAIS.includes(ato.status) || ato.status === StatusAto.SESSAO_REALIZADA) {
      throw new ErroDeNegocio(
        "A sessão deste procedimento já foi registrada. A data consta da Ata e não pode ser alterada."
      );
    }

    const nova = interpretarDataDaSessao(dataDaSessao);
    const confirmada = ato.dataConfirmada !== null;

    await db.ato.update({
      where: { id: atoId },
      data: {
        modalidade,
        dataReservada: nova,
        // se a data já estava confirmada, ela continua confirmada na data nova
        ...(confirmada ? { dataConfirmada: nova } : {}),
      },
    });

    await db.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.OBSERVACAO,
        descricao:
          `Agenda alterada: sessão em ${formatarDataHoraDaSessao(nova)}, ` +
          `${ROTULO_MODALIDADE[modalidade].toLowerCase()}.`,
        usuarioId: usuario.id,
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ALTEROU_ATO",
      entidade: "Ato",
      entidadeId: atoId,
      metadados: {
        evento: "AGENDA",
        de: ato.dataReservada?.toISOString() ?? null,
        para: nova.toISOString(),
        modalidade,
      },
    });

    await ajustarSalaDoZoom(atoId, ato, modalidade, nova, usuario.id);
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }

  revalidatePath(`/atos/${atoId}`);
  revalidatePath("/atos");
  return {};
}

/**
 * Lê o "AAAA-MM-DDTHH:MM" do input, que vem em hora de parede de São Paulo.
 *
 * Sem declarar o fuso, `new Date()` interpretaria no fuso do servidor — que em
 * produção é o do container. Já mordeu neste projeto antes, e a sessão sairia
 * na hora errada na Carta-Convite e no Zoom.
 */
function interpretarDataDaSessao(entrada: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(entrada)) {
    throw new ErroDeNegocio("Data ou hora da sessão inválida.");
  }
  return fromZonedTime(`${entrada}:00`, FUSO);
}

function formatarDataHoraDaSessao(quando: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO,
  }).format(quando);
}

/**
 * Mantém a sala do Zoom coerente com a agenda.
 *
 * Passar a presencial cancela a sala; voltar para videoconferência cria uma.
 * Mudar só a data remarca. Falha aqui não desfaz a alteração da agenda, que já
 * está registrada — vira aviso na linha do tempo.
 */
async function ajustarSalaDoZoom(
  atoId: string,
  ato: { numero: string; idReuniao: string | null },
  modalidade: ModalidadeSessao,
  quando: Date,
  usuarioId: string
): Promise<void> {
  if (!videoconferenciaAtiva()) return;

  const precisaDeSala =
    modalidade === ModalidadeSessao.VIDEOCONFERENCIA ||
    modalidade === ModalidadeSessao.HIBRIDA;

  const config = await configuracaoDoSistema();

  try {
    if (!precisaDeSala && ato.idReuniao) {
      await cancelarReuniao(ato.idReuniao);
      await db.ato.update({
        where: { id: atoId },
        data: { idReuniao: null, linkVideoconferencia: null, senhaReuniao: null },
      });
      await anotar(atoId, "Sessão passou a presencial: a sala do Zoom foi cancelada.", usuarioId);
      return;
    }

    if (precisaDeSala && ato.idReuniao) {
      await remarcarReuniao({
        idReuniao: ato.idReuniao,
        quando,
        duracaoMinutos: config.duracaoSessaoMinutos,
      });
      await anotar(atoId, "Sala do Zoom remarcada para a nova data.", usuarioId);
      return;
    }

    if (precisaDeSala && !ato.idReuniao) {
      const reuniao = await criarReuniao({
        numeroDoAto: ato.numero,
        quando,
        duracaoMinutos: config.duracaoSessaoMinutos,
      });
      await db.ato.update({
        where: { id: atoId },
        data: {
          idReuniao: reuniao.idReuniao,
          linkVideoconferencia: reuniao.link,
          senhaReuniao: reuniao.senha,
        },
      });
      await anotar(atoId, `Sala da videoconferência agendada no Zoom (reunião ${reuniao.idReuniao}).`, usuarioId);
    }
  } catch (erro) {
    console.error("[zoom] falha ao ajustar a sala do ato", ato.numero, erro);
    await anotar(
      atoId,
      "A agenda mudou, mas não foi possível ajustar a sala no Zoom. Confira o link antes de reenviar a Carta-Convite.",
      usuarioId
    );
  }
}

async function anotar(atoId: string, descricao: string, usuarioId: string): Promise<void> {
  await db.eventoAto.create({
    data: { atoId, tipo: TipoEvento.OBSERVACAO, descricao, usuarioId },
  });
}
