"use server";

import { revalidatePath } from "next/cache";
import {
  DesfechoSessao,
  ItemDaDocumentacao,
  PapelNoAto,
  StatusAto,
  TipoDocumento,
  TipoEvento,
} from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { configuracaoDoSistema } from "@/lib/configuracao";
import { db } from "@/lib/db";
import { emitirDocumento } from "@/lib/emissao";
import { ErroDeNegocio, FluxoInvalido } from "@/lib/erros";
import { DESFECHOS_COM_ACORDO } from "@/lib/desfechos";
import { cancelarReuniao, videoconferenciaAtiva } from "@/lib/zoom";
import { FUSO, sessaoAntesDaDataMarcada } from "@/lib/prazos";
import { faltamItens } from "@/lib/documentacao";
import { exigirAcessoAoAto, exigirEquipe } from "@/lib/sessao";
import { cartaAoConvidado } from "@/documentos/carta-convite";
import { ataDaSessao, type Desfecho } from "@/documentos/ata";
import { termoDeAcordo } from "@/documentos/termo-acordo";
import { ROTULO_MODALIDADE } from "@/lib/formato";

export type EstadoDeFormulario = { erro?: string; aviso?: string };


function descreverModalidade(modalidade: keyof typeof ROTULO_MODALIDADE): string {
  if (modalidade === "VIDEOCONFERENCIA") {
    return "por meio da plataforma oficial de videoconferência da Consensus One";
  }
  if (modalidade === "PRESENCIAL") return "de forma presencial";
  return "de forma híbrida";
}

function formatarData(data: Date | null): string {
  if (!data) return "a designar";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: FUSO }).format(data);
}

function formatarHora(data: Date | null): string {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  }).format(data);
}

const partesDaData = (data: Date) => {
  const fmt = (opcoes: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: FUSO }).format(data);
  return { dia: fmt({ day: "2-digit" }), mes: fmt({ month: "long" }), ano: fmt({ year: "numeric" }) };
};

/**
 * Passo 3 — conferência item a item.
 *
 * Marca um item como conferido, ou como não aplicável (a procuração só existe
 * "quando aplicável"). Não confirma data: isso é ação separada e explícita.
 */
export async function conferirItem(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();

  const atoId = String(entrada.get("atoId") ?? "");
  const item = String(entrada.get("item") ?? "") as ItemDaDocumentacao;
  const marcar = String(entrada.get("marcar") ?? "");

  if (!atoId || !Object.values(ItemDaDocumentacao).includes(item)) {
    throw new ErroDeNegocio("Item de conferência inválido.");
  }
  await exigirAcessoAoAto(atoId, db);

  const conferido = marcar === "conferido";
  const naoAplicavel = marcar === "nao_aplicavel";

  await db.conferenciaDeDocumento.upsert({
    where: { atoId_item: { atoId, item } },
    update: {
      conferido,
      naoAplicavel,
      conferidoPorId: usuario.id,
      conferidoEm: conferido || naoAplicavel ? new Date() : null,
    },
    create: {
      atoId,
      item,
      conferido,
      naoAplicavel,
      conferidoPorId: usuario.id,
      conferidoEm: conferido || naoAplicavel ? new Date() : null,
    },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "ALTEROU_ATO",
    entidade: "Ato",
    entidadeId: atoId,
    metadados: { conferencia: item, marcar },
  });

  revalidatePath(`/atos/${atoId}`);
}


/**
 * Passo 3 — o OK do operador que EFETIVA a data.
 *
 * docs/02, regra 1: nenhum outro caminho confirma data. E só depois disso a
 * segunda carta pode existir.
 */
export async function confirmarData(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();
  const atoId = String(entrada.get("atoId") ?? "");
  if (!atoId) throw new ErroDeNegocio("Procedimento não informado.");

  await exigirAcessoAoAto(atoId, db);

  const ato = await db.ato.findUnique({
    where: { id: atoId },
    include: { conferencias: true },
  });
  if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");

  if (ato.status !== StatusAto.AGUARDANDO_DOCUMENTACAO &&
      ato.status !== StatusAto.DOCUMENTACAO_EM_ANALISE) {
    throw new FluxoInvalido(
      "A data só pode ser confirmada enquanto o procedimento aguarda a documentação."
    );
  }
  if (!ato.dataReservada) {
    throw new FluxoInvalido("O procedimento não tem data reservada.");
  }

  const pendentes = faltamItens(ato.conferencias);
  if (pendentes.length > 0) {
    throw new FluxoInvalido(
      `Ainda faltam ${pendentes.length} item(ns) de documentação para conferir. ` +
        "O modelo é explícito: sem a documentação integral, a sessão não é confirmada."
    );
  }

  await db.$transaction(async (tx) => {
    await tx.ato.update({
      where: { id: atoId },
      data: { status: StatusAto.DATA_CONFIRMADA, dataConfirmada: ato.dataReservada },
    });
    await tx.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.DOCUMENTACAO_CONFERIDA,
        descricao: "Documentação conferida item a item pelo operador.",
        usuarioId: usuario.id,
      },
    });
    await tx.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.DATA_CONFIRMADA,
        descricao: `Data da sessão efetivada para ${formatarData(ato.dataReservada)}.`,
        usuarioId: usuario.id,
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "CONFIRMOU_DATA",
    entidade: "Ato",
    entidadeId: atoId,
    metadados: { data: ato.dataReservada.toISOString() },
  });

  revalidatePath(`/atos/${atoId}`);
}

/**
 * Passo 4 — Carta-Convite ao Interessado Convidado.
 *
 * BLOQUEADA até a confirmação da data. docs/02, regra 2: tentar antes é erro de
 * negócio, não erro de validação de formulário.
 */
export async function emitirCartaAoConvidado(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();
  const atoId = String(entrada.get("atoId") ?? "");
  if (!atoId) throw new ErroDeNegocio("Procedimento não informado.");

  await exigirAcessoAoAto(atoId, db);

  const ato = await db.ato.findUnique({
    where: { id: atoId },
    include: { partes: { include: { pessoa: { select: { nome: true } } } } },
  });
  if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");

  if (ato.status !== StatusAto.DATA_CONFIRMADA) {
    throw new FluxoInvalido(
      "A Carta-Convite ao Interessado Convidado só pode ser expedida depois da conferência " +
        "documental e da confirmação da sessão."
    );
  }

  const solicitante = ato.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
  const convidado = ato.partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
  if (!solicitante || !convidado) throw new FluxoInvalido("Interessados não vinculados.");

  const config = await configuracaoDoSistema();

  const { codigo } = await emitirDocumento({
    atoId,
    tipo: "CARTA_CONVITE_CONVIDADO",
    pasta: "cartas",
    usuarioId: usuario.id,
    montarHtml: (codigo) =>
      cartaAoConvidado({
        codigo,
        solicitante: solicitante.pessoa.nome,
        convidado: convidado.pessoa.nome,
        objeto: ato.objeto,
        dataDaSessao: formatarData(ato.dataConfirmada),
        horaDaSessao: formatarHora(ato.dataConfirmada),
        modalidade: descreverModalidade(ato.modalidade),
        link: ato.linkVideoconferencia,
        idReuniao: ato.idReuniao,
        senhaReuniao: ato.senhaReuniao,
        prazoDocumentacaoDias: config.prazoDocumentacaoDias,
        horasAvisoModalidade: config.horasAvisoModalidade,
      }),
    aoRegistrar: async (tx, codigo) => {
      await tx.ato.update({
        where: { id: atoId },
        data: { status: StatusAto.CONVIDADO_CONVOCADO },
      });
      await tx.eventoAto.create({
        data: {
          atoId,
          tipo: TipoEvento.CARTA_CONVIDADO_GERADA,
          descricao: `Carta-Convite ao Interessado Convidado emitida sob o código ${codigo}.`,
          usuarioId: usuario.id,
          metadados: { codigo },
        },
      });
    },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "GEROU_DOCUMENTO",
    entidade: "Documento",
    entidadeId: codigo,
    metadados: { atoId, tipo: TipoDocumento.CARTA_CONVITE_CONVIDADO },
  });

  revalidatePath(`/atos/${atoId}`);
}

const sessao = z.object({
  atoId: z.string().min(1),
  horaInicio: z.string().min(1, "Informe a hora de início."),
  horaEncerramento: z.string().min(1, "Informe a hora de encerramento."),
  desfecho: z.nativeEnum(DesfechoSessao),
  motivoPrejudicada: z.string().trim().optional(),
  observacoesSessao: z.string().trim().optional(),
  outrosPresentes: z.string().trim().max(500).optional(),
  // caixa marcada na tela quando a sessão é registrada antes da data marcada
  confirmaAntecipacao: z.string().optional(),
});

/** Situação final do procedimento, conforme o desfecho registrado na ata. */
const STATUS_DO_DESFECHO: Record<DesfechoSessao, StatusAto> = {
  COMPOSICAO_INTEGRAL: StatusAto.COMPOSICAO_INTEGRAL,
  COMPOSICAO_PARCIAL: StatusAto.COMPOSICAO_PARCIAL,
  REDESIGNACAO: StatusAto.REDESIGNADA,
  ENCERRAMENTO_SEM_COMPOSICAO: StatusAto.ENCERRADO_SEM_COMPOSICAO,
  SESSAO_PREJUDICADA: StatusAto.SESSAO_PREJUDICADA,
};

/**
 * Passo 5 — registro da sessão realizada.
 *
 * Grava horários, comparecimento e desfecho. A ata é gerada em seguida, e é
 * obrigatória em qualquer desfecho (docs/02, regra 3).
 */
export async function registrarSessao(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = sessao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const {
    atoId,
    horaInicio,
    horaEncerramento,
    desfecho,
    motivoPrejudicada,
    observacoesSessao,
    outrosPresentes,
    confirmaAntecipacao,
  } = analise.data;

  try {
    await exigirAcessoAoAto(atoId, db);

    const ato = await db.ato.findUnique({ where: { id: atoId }, include: { partes: true } });
    if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");

    if (ato.status !== StatusAto.CONVIDADO_CONVOCADO && ato.status !== StatusAto.DATA_CONFIRMADA) {
      throw new FluxoInvalido(
        "A sessão só pode ser registrada depois de a data ser confirmada e o Interessado Convidado convocado."
      );
    }
    if (desfecho === DesfechoSessao.SESSAO_PREJUDICADA && !motivoPrejudicada) {
      throw new FluxoInvalido("Sessão prejudicada exige o registro do motivo.");
    }

    // Registrar antes da data marcada é permitido — sessão antecipada de comum
    // acordo existe —, mas nunca por descuido: o registro lavra ata e libera os
    // documentos ao Interessado. A tela pede a confirmação; a checagem é aqui,
    // porque esconder a caixa no navegador não é controle de nada.
    const antecipada = sessaoAntesDaDataMarcada(ato.dataConfirmada ?? ato.dataReservada);
    if (antecipada && !confirmaAntecipacao) {
      throw new FluxoInvalido(
        "Esta sessão está marcada para " +
          formatarData(ato.dataConfirmada ?? ato.dataReservada) +
          ", que ainda não chegou. Confirme na tela que ela foi mesmo realizada antes da data."
      );
    }

    const base = ato.dataConfirmada ?? ato.dataReservada ?? new Date();
    const emData = (hora: string) => {
      const [h, m] = hora.split(":").map(Number);
      const data = new Date(base);
      data.setHours(h ?? 0, m ?? 0, 0, 0);
      return data;
    };

    // comparecimento veio como uma caixa por parte
    const presentes = entrada.getAll("presente").map(String);

    await db.$transaction(async (tx) => {
      await tx.ato.update({
        where: { id: atoId },
        data: {
          status: StatusAto.SESSAO_REALIZADA,
          horaInicio: emData(horaInicio),
          horaEncerramento: emData(horaEncerramento),
          desfecho,
          motivoPrejudicada: motivoPrejudicada || null,
          observacoesSessao: observacoesSessao || null,
          outrosPresentes: outrosPresentes || null,
        },
      });

      for (const parte of ato.partes) {
        await tx.parteDoAto.update({
          where: { id: parte.id },
          data: { compareceu: presentes.includes(parte.id) },
        });
      }

      await tx.eventoAto.create({
        data: {
          atoId,
          tipo: TipoEvento.SESSAO_REALIZADA,
          descricao:
            `Sessão Privada de Conciliação realizada. Desfecho registrado: ${desfecho}.` +
            (antecipada
              ? ` Registrada antes da data marcada, ${formatarData(ato.dataConfirmada ?? ato.dataReservada)}.`
              : ""),
          usuarioId: usuario.id,
          metadados: { desfecho, antecipada },
        },
      });
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ALTEROU_ATO",
      entidade: "Ato",
      entidadeId: atoId,
      metadados: { evento: "SESSAO_REALIZADA", desfecho, antecipada },
    });

    revalidatePath(`/atos/${atoId}`);
    return { aviso: "Sessão registrada. Agora lavre a ata." };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }
}

/** Lavra a ata. Obrigatória em toda sessão, qualquer que seja o desfecho. */
export async function gerarAta(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();
  const atoId = String(entrada.get("atoId") ?? "");
  if (!atoId) throw new ErroDeNegocio("Procedimento não informado.");

  await exigirAcessoAoAto(atoId, db);

  const ato = await db.ato.findUnique({
    where: { id: atoId },
    include: {
      partes: { include: { pessoa: { select: { nome: true } } } },
      documentos: { select: { tipo: true } },
    },
  });
  if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");

  if (!ato.desfecho || !ato.horaInicio) {
    throw new FluxoInvalido("Registre a sessão antes de lavrar a ata.");
  }
  if (ato.documentos.some((d) => d.tipo === TipoDocumento.ATA)) {
    throw new FluxoInvalido("A ata deste procedimento já foi lavrada.");
  }

  const solicitante = ato.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
  const convidado = ato.partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
  const conciliador = ato.partes.find((p) => p.papel === PapelNoAto.CONCILIADOR);
  const { dia, mes, ano } = partesDaData(ato.horaInicio);
  const desfechoRegistrado = ato.desfecho;

  const { codigo } = await emitirDocumento({
    atoId,
    tipo: "ATA",
    pasta: "ata",
    usuarioId: usuario.id,
    montarHtml: (codigo) =>
      ataDaSessao({
        codigo,
        solicitante: solicitante?.pessoa.nome ?? "—",
        convidado: convidado?.pessoa.nome ?? "—",
        objeto: ato.objeto,
        dia,
        mes,
        ano,
        horaInicio: formatarHora(ato.horaInicio),
        horaVerificacao: formatarHora(ato.horaInicio),
        horaEncerramento: formatarHora(ato.horaEncerramento),
        modalidade: ROTULO_MODALIDADE[ato.modalidade],
        presentes: [
          ...ato.partes.filter((p) => p.compareceu).map((p) => p.pessoa.nome),
          // quem participou sem estar vinculado ao procedimento: preposto,
          // contador, intérprete. Vai na mesma lista, que é o que a Ata prova.
          ...(ato.outrosPresentes ?? "")
            .split(",")
            .map((nome) => nome.trim())
            .filter(Boolean),
        ],
        ausentes: ato.partes.filter((p) => p.compareceu === false).map((p) => p.pessoa.nome),
        desfecho: desfechoRegistrado as Desfecho,
        motivoPrejudicada: ato.motivoPrejudicada,
        observacoes: ato.observacoesSessao,
        conciliador: conciliador?.pessoa.nome ?? null,
      }),
    aoRegistrar: async (tx, codigo) => {
      await tx.ato.update({
        where: { id: atoId },
        data: { status: STATUS_DO_DESFECHO[desfechoRegistrado] },
      });
      await tx.eventoAto.create({
        data: {
          atoId,
          tipo: TipoEvento.ATA_GERADA,
          descricao: `Ata de Sessão lavrada sob o código ${codigo}.`,
          usuarioId: usuario.id,
          metadados: { codigo, desfecho: desfechoRegistrado },
        },
      });
    },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "GEROU_DOCUMENTO",
    entidade: "Documento",
    entidadeId: codigo,
    metadados: { atoId, tipo: TipoDocumento.ATA },
  });

  revalidatePath(`/atos/${atoId}`);
}

const termo = z.object({
  atoId: z.string().min(1),
  objetoDoAcordo: z.string().trim().min(10, "Descreva o objeto do acordo."),
  obrigacoesPrimeiraParte: z.string().trim().min(5, "Descreva as obrigações da primeira parte."),
  obrigacoesSegundaParte: z.string().trim().min(5, "Descreva as obrigações da segunda parte."),
  condicoesEspecificas: z.string().trim().optional(),
  prazosDeCumprimento: z.string().trim().optional(),
  formaDeCumprimento: z.string().trim().optional(),
  formaDePagamento: z.string().trim().optional(),
  demaisCondicoes: z.string().trim().optional(),
});

/**
 * Termo de Acordo — opcional, e só quando houve composição.
 *
 * Salva os campos livres e emite o documento. Inadimplemento, confidencialidade,
 * força executiva e quitação não passam por aqui: são texto fixo do modelo,
 * travados na interface (docs/09, item 9).
 */
export async function gerarTermoDeAcordo(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = termo.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { atoId, ...campos } = analise.data;

  try {
    await exigirAcessoAoAto(atoId, db);

    const ato = await db.ato.findUnique({
      where: { id: atoId },
      include: {
        partes: { include: { pessoa: { select: { nome: true, cidade: true } } } },
        documentos: { select: { tipo: true } },
      },
    });
    if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");

    if (!ato.desfecho || !DESFECHOS_COM_ACORDO.includes(ato.desfecho)) {
      throw new FluxoInvalido(
        "O Termo de Acordo só existe quando a sessão terminou em composição, integral ou parcial."
      );
    }
    if (ato.documentos.some((d) => d.tipo === TipoDocumento.TERMO_ACORDO)) {
      throw new FluxoInvalido("O Termo de Acordo deste procedimento já foi emitido.");
    }

    const solicitante = ato.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
    const convidado = ato.partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
    const conciliador = ato.partes.find((p) => p.papel === PapelNoAto.CONCILIADOR);
    const { dia, mes, ano } = partesDaData(new Date());

    await db.termoDeAcordo.upsert({
      where: { atoId },
      update: { ...campos, criadoPorId: usuario.id },
      create: { atoId, ...campos, criadoPorId: usuario.id },
    });

    const { codigo } = await emitirDocumento({
      atoId,
      tipo: "TERMO_ACORDO",
      pasta: "termo",
      usuarioId: usuario.id,
      montarHtml: (codigo) =>
        termoDeAcordo({
          codigo,
          primeiraParte: solicitante?.pessoa.nome ?? "—",
          segundaParte: convidado?.pessoa.nome ?? "—",
          cidade: solicitante?.pessoa.cidade ?? "Mogi das Cruzes",
          dia,
          mes,
          ano,
          conciliador: conciliador?.pessoa.nome ?? null,
          objetoDoAcordo: campos.objetoDoAcordo,
          obrigacoesPrimeiraParte: campos.obrigacoesPrimeiraParte,
          obrigacoesSegundaParte: campos.obrigacoesSegundaParte,
          condicoesEspecificas: campos.condicoesEspecificas ?? null,
          prazosDeCumprimento: campos.prazosDeCumprimento ?? null,
          formaDeCumprimento: campos.formaDeCumprimento ?? null,
          formaDePagamento: campos.formaDePagamento ?? null,
          demaisCondicoes: campos.demaisCondicoes ?? null,
        }),
      aoRegistrar: async (tx, codigo) => {
        await tx.eventoAto.create({
          data: {
            atoId,
            tipo: TipoEvento.TERMO_GERADO,
            descricao: `Termo de Acordo emitido sob o código ${codigo}.`,
            usuarioId: usuario.id,
            metadados: { codigo },
          },
        });
      },
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "GEROU_DOCUMENTO",
      entidade: "Documento",
      entidadeId: codigo,
      metadados: { atoId, tipo: TipoDocumento.TERMO_ACORDO },
    });

    revalidatePath(`/atos/${atoId}`);
    return { aviso: "Termo de Acordo emitido." };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }
}

/**
 * Encerramento administrativo por falta de documentação.
 *
 * O próprio modelo prevê: "O não encaminhamento integral dos documentos no prazo
 * estabelecido impedirá a confirmação da sessão e a expedição da Carta-Convite ao
 * Interessado Convidado, podendo acarretar o encerramento administrativo do
 * cadastro." Ver docs/09, item 7.
 */
export async function cancelarAto(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();

  const atoId = String(entrada.get("atoId") ?? "");
  const motivo = String(entrada.get("motivo") ?? "").trim();
  if (!atoId) throw new ErroDeNegocio("Procedimento não informado.");
  if (motivo.length < 5) throw new ErroDeNegocio("Descreva o motivo do encerramento.");

  await exigirAcessoAoAto(atoId, db);

  const ato = await db.ato.findUnique({
    where: { id: atoId },
    select: { status: true, idReuniao: true },
  });
  if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");
  if (ato.status === StatusAto.SESSAO_REALIZADA || ato.status === StatusAto.CANCELADO) {
    throw new FluxoInvalido("Este procedimento não pode mais ser encerrado administrativamente.");
  }

  await db.$transaction(async (tx) => {
    await tx.ato.update({ where: { id: atoId }, data: { status: StatusAto.CANCELADO } });
    await tx.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.ATO_CANCELADO,
        descricao: `Encerramento administrativo do cadastro: ${motivo}`,
        usuarioId: usuario.id,
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "ALTEROU_ATO",
    entidade: "Ato",
    entidadeId: atoId,
    metadados: { evento: "CANCELADO", motivo },
  });

  // Sala órfã no Zoom é convite aberto para uma sessão que não vai acontecer.
  // Falhar aqui não desfaz o encerramento, que já está registrado.
  if (ato.idReuniao && videoconferenciaAtiva()) {
    try {
      await cancelarReuniao(ato.idReuniao);
    } catch (erro) {
      console.error("[zoom] falha ao cancelar a reunião", ato.idReuniao, erro);
    }
  }

  revalidatePath(`/atos/${atoId}`);
}
