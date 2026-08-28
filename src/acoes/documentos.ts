"use server";
import { revalidatePath } from "next/cache";
import {
  CanalEnvio,
  PapelNoAto,
  StatusAto,
  TipoDocumento,
  TipoEvento,
} from "@prisma/client";
import { z } from "zod";
import { envioAutomaticoAtivo, enviarNotificacao } from "@/lib/ar-online";
import { registrarAuditoria } from "@/lib/auditoria";
import { configuracaoDoSistema } from "@/lib/configuracao";
import { db } from "@/lib/db";
import { ErroDeNegocio, FluxoInvalido } from "@/lib/erros";
import { FUSO, calcularPrazoDocumentacao, interpretarDataDeCiencia } from "@/lib/prazos";
import { validarArquivo, extensaoDoTipo } from "@/lib/mime";
import { emitirDocumento } from "@/lib/emissao";
import { baixarArquivo, enviarArquivo, gerarUrlDeDownload, montarChave } from "@/lib/storage";
import { exigirAcessoAoAto, exigirEquipe } from "@/lib/sessao";
import { cartaAoSolicitante } from "@/documentos/carta-convite";
import { formatarRepresentantes, ROTULO_MODALIDADE } from "@/lib/formato";
export type EstadoDeFormulario = { erro?: string; aviso?: string };
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
function descreverModalidade(modalidade: keyof typeof ROTULO_MODALIDADE): string {
  if (modalidade === "VIDEOCONFERENCIA") {
    return "por meio da plataforma oficial de videoconferência da Consensus One";
  }
  if (modalidade === "PRESENCIAL") return "de forma presencial";
  return "de forma híbrida";
}
/**
 * Emite a Carta-Convite ao Interessado Solicitante — passo 2 do fluxo.
 *
 * Gera o código, monta o PDF a partir do modelo oficial, guarda no object
 * storage e move o procedimento para AGUARDANDO_DOCUMENTACAO. A data continua
 * apenas RESERVADA: só o OK do operador no passo 3 a efetiva (docs/02, regra 1).
 *
 * O prazo de documentação é recontado a partir da emissão, porque o modelo diz
 * "contados do recebimento desta comunicação".
 */
export async function emitirCartaAoSolicitante(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();
  const atoId = String(entrada.get("atoId") ?? "");
  if (!atoId) throw new ErroDeNegocio("Procedimento não informado.");
  await exigirAcessoAoAto(atoId, db);
  const ato = await db.ato.findUnique({
    where: { id: atoId },
    include: {
      partes: {
        include: { pessoa: { select: { nome: true, tipoProcurador: true } } },
      },
    },
  });
  if (!ato) throw new ErroDeNegocio("Procedimento não encontrado.");
  if (ato.status !== StatusAto.RASCUNHO) {
    throw new FluxoInvalido(
      "A Carta-Convite ao Interessado Solicitante já foi emitida neste procedimento."
    );
  }
  const solicitante = ato.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
  const convidado = ato.partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
  if (!solicitante || !convidado) {
    throw new FluxoInvalido(
      "O procedimento precisa ter Interessado Solicitante e Interessado Convidado antes da emissão."
    );
  }
  const procuradorSolicitante = formatarRepresentantes(
    ato.partes
      .filter((p) => p.papel === PapelNoAto.PROCURADOR && p.representaId === solicitante.id)
      .map((p) => p.pessoa)
  );
  const procuradorConvidado = formatarRepresentantes(
    ato.partes
      .filter((p) => p.papel === PapelNoAto.PROCURADOR && p.representaId === convidado.id)
      .map((p) => p.pessoa)
  );
  const config = await configuracaoDoSistema();
  const emitidoEm = new Date();
  const { codigo } = await emitirDocumento({
    atoId: ato.id,
    tipo: "CARTA_CONVITE_SOLICITANTE",
    pasta: "cartas",
    usuarioId: usuario.id,
    montarHtml: (codigo) =>
      cartaAoSolicitante({
        codigo,
        solicitante: solicitante.pessoa.nome,
        convidado: convidado.pessoa.nome,
        procuradorSolicitante,
        procuradorConvidado,
        objeto: ato.objeto,
        dataDaSessao: formatarData(ato.dataConfirmada ?? ato.dataReservada),
        horaDaSessao: formatarHora(ato.dataConfirmada ?? ato.dataReservada),
        modalidade: descreverModalidade(ato.modalidade),
        link: ato.linkVideoconferencia,
        idReuniao: ato.idReuniao,
        senhaReuniao: ato.senhaReuniao,
        prazoDocumentacaoDias: config.prazoDocumentacaoDias,
        horasAvisoModalidade: config.horasAvisoModalidade,
      }),
    aoRegistrar: async (tx, codigo) => {
      await tx.ato.update({
        where: { id: ato.id },
        data: {
          status: StatusAto.AGUARDANDO_DOCUMENTACAO,
          // o modelo conta o prazo do recebimento desta comunicação
          prazoDocumentacaoAte: calcularPrazoDocumentacao(emitidoEm, config.prazoDocumentacaoDias),
        },
      });
      await tx.eventoAto.create({
        data: {
          atoId: ato.id,
          tipo: TipoEvento.CARTA_SOLICITANTE_GERADA,
          descricao: `Carta-Convite ao Interessado Solicitante emitida sob o código ${codigo}.`,
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
    metadados: { atoId: ato.id, tipo: TipoDocumento.CARTA_CONVITE_SOLICITANTE },
  });
  revalidatePath(`/atos/${ato.id}`);
}
const anexo = z.object({
  atoId: z.string().min(1),
  tipo: z.enum([
    TipoDocumento.DOCUMENTO_DA_PARTE,
    TipoDocumento.LAUDO_AR,
    TipoDocumento.DOCUMENTO_ASSINADO,
    TipoDocumento.OUTRO,
  ]),
  descricao: z.string().trim().max(200).optional(),
});
/**
 * Anexa documento recebido. Diferente do emitido pela esteira, não recebe
 * código: `codigoVerificacao` fica nulo, porque anexo não é documento da câmara.
 *
 * O tipo é conferido pela assinatura binária, não pela extensão nem pelo
 * cabeçalho que o navegador declara (docs/04).
 */
export async function anexarDocumento(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();
  const analise = anexo.safeParse({
    atoId: entrada.get("atoId"),
    tipo: entrada.get("tipo"),
    descricao: entrada.get("descricao") ?? undefined,
  });
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { atoId, tipo, descricao } = analise.data;
  const arquivo = entrada.get("arquivo");
  try {
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      throw new ErroDeNegocio("Selecione um arquivo.");
    }
    await exigirAcessoAoAto(atoId, db);
    const conteudo = Buffer.from(await arquivo.arrayBuffer());
    const tipoReal = validarArquivo(conteudo, arquivo.name);
    const nomeArquivo = arquivo.name.toLowerCase().endsWith(extensaoDoTipo(tipoReal))
      ? arquivo.name
      : `${arquivo.name}.${extensaoDoTipo(tipoReal)}`;
    const chave = montarChave(atoId, tipo.toLowerCase(), nomeArquivo);
    const guardado = await enviarArquivo({ chave, conteudo, mimeType: tipoReal });
    const documento = await db.documento.create({
      data: {
        atoId,
        tipo,
        codigoVerificacao: null,
        emitidoPelaCamara: false,
        nomeArquivo,
        chaveStorage: guardado.chave,
        mimeType: tipoReal,
        tamanhoBytes: guardado.tamanhoBytes,
        hashSha256: guardado.hashSha256,
        enviadoPorId: usuario.id,
      },
    });
    await db.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.DOCUMENTO_RECEBIDO,
        descricao: descricao
          ? `Documento anexado: ${descricao} (${nomeArquivo}).`
          : `Documento anexado: ${nomeArquivo}.`,
        usuarioId: usuario.id,
      },
    });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ENVIOU_DOCUMENTO",
      entidade: "Documento",
      entidadeId: documento.id,
      metadados: { atoId, tipo, hash: guardado.hashSha256 },
    });
    revalidatePath(`/atos/${atoId}`);
    return { aviso: "Documento anexado." };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }
}
const envio = z.object({
  atoId: z.string().min(1),
  documentoId: z.string().min(1, "Selecione o documento enviado."),
  destinatarioId: z.string().min(1, "Selecione o destinatário."),
  canal: z.nativeEnum(CanalEnvio),
});
/** Registra o envio de um documento emitido a um Interessado. */
export async function registrarEnvio(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();
  const analise = envio.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { atoId, documentoId, destinatarioId, canal } = analise.data;
  try {
    await exigirAcessoAoAto(atoId, db);
    const documento = await db.documento.findFirst({
      where: { id: documentoId, atoId },
      select: { id: true, tipo: true, codigoVerificacao: true },
    });
    if (!documento) throw new ErroDeNegocio("Documento não pertence a este procedimento.");

    const registro = await db.envio.create({
      data: {
        atoId,
        documentoId,
        destinatarioId,
        canal,
        status: "ENVIADO",
        enviadoEm: new Date(),
      },
    });

    // Canal AR digital com a integração ligada: dispara de verdade, em vez de
    // só anotar que alguém enviou por fora.
    if (canal === CanalEnvio.AR_DIGITAL && envioAutomaticoAtivo()) {
      await dispararPelaArOnline(registro.id, atoId, documentoId, destinatarioId);
    }
    const eventoDeEnvio =
      documento.tipo === TipoDocumento.CARTA_CONVITE_CONVIDADO
        ? TipoEvento.CARTA_CONVIDADO_ENVIADA
        : TipoEvento.CARTA_SOLICITANTE_ENVIADA;
    await db.eventoAto.create({
      data: {
        atoId,
        tipo: eventoDeEnvio,
        descricao: `${documento.codigoVerificacao ?? "Documento"} enviado por ${canal === CanalEnvio.AR_DIGITAL ? "AR digital" : canal === CanalEnvio.EMAIL ? "e-mail" : "entrega manual"}.`,
        usuarioId: usuario.id,
      },
    });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ENVIOU_DOCUMENTO",
      entidade: "Envio",
      entidadeId: documentoId,
      metadados: { atoId, canal },
    });
    revalidatePath(`/atos/${atoId}`);
    return { aviso: "Envio registrado." };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }
}
/**
 * Vincula o laudo de AR ao envio e registra a DATA DE RECEBIMENTO nele impressa.
 *
 * Essa data não é detalhe de cadastro: a Carta-Convite conta os 15 dias "do
 * recebimento desta comunicação", e não da emissão. Como a carta vai por AR
 * digital, entre uma coisa e outra passam dias — contar da emissão encurta o
 * prazo de quem recebeu, e o modelo prevê encerramento administrativo do
 * cadastro para quem perder esse prazo. Ver docs/02 e docs/08.
 *
 * Quando o laudo é o da carta ao Solicitante, o prazo é RECALCULADO a partir
 * da ciência e deixa de ser provisório.
 */
export async function vincularLaudo(entrada: FormData): Promise<void> {
  const usuario = await exigirEquipe();
  const atoId = String(entrada.get("atoId") ?? "");
  const envioId = String(entrada.get("envioId") ?? "");
  const laudoId = String(entrada.get("laudoId") ?? "");
  const dataInformada = String(entrada.get("dataCiencia") ?? "");
  if (!atoId || !envioId || !laudoId) throw new ErroDeNegocio("Dados incompletos.");
  await exigirAcessoAoAto(atoId, db);

  const recebidoEm = interpretarDataDeCiencia(dataInformada);

  const laudo = await db.documento.findFirst({
    where: { id: laudoId, atoId, tipo: TipoDocumento.LAUDO_AR },
    select: { id: true, nomeArquivo: true },
  });
  if (!laudo) throw new ErroDeNegocio("Laudo de AR não encontrado neste procedimento.");

  const envio = await db.envio.findFirst({
    where: { id: envioId, atoId },
    select: { id: true, documento: { select: { tipo: true } } },
  });
  if (!envio) throw new ErroDeNegocio("Envio não encontrado neste procedimento.");

  const ehCartaAoSolicitante =
    envio.documento.tipo === TipoDocumento.CARTA_CONVITE_SOLICITANTE;

  await db.$transaction(async (tx) => {
    await tx.envio.update({
      where: { id: envioId },
      data: { comprovanteId: laudo.id, status: "ENTREGUE", entregueEm: recebidoEm },
    });

    if (ehCartaAoSolicitante) {
      const config = await tx.configuracaoSistema.findFirst();
      const prazo = calcularPrazoDocumentacao(
        recebidoEm,
        config?.prazoDocumentacaoDias ?? 15
      );
      await tx.ato.update({
        where: { id: atoId },
        data: { dataCienciaSolicitante: recebidoEm, prazoDocumentacaoAte: prazo },
      });
      await tx.eventoAto.create({
        data: {
          atoId,
          tipo: TipoEvento.OBSERVACAO,
          descricao:
            `Ciência do Interessado Solicitante em ${formatarData(recebidoEm)}. ` +
            `Prazo da documentação recalculado para ${formatarData(prazo)}.`,
          usuarioId: usuario.id,
        },
      });
    }

    await tx.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.OBSERVACAO,
        descricao: `Laudo de AR anexado ao envio: ${laudo.nomeArquivo}.`,
        usuarioId: usuario.id,
      },
    });
  });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "ALTEROU_ATO",
    entidade: "Envio",
    entidadeId: envioId,
    metadados: { atoId, laudoId },
  });
  revalidatePath(`/atos/${atoId}`);
}
/**
 * URL assinada de download, com expiração de 10 minutos.
 * A chave do bucket nunca chega ao navegador (docs/04).
 */
export async function obterUrlDeDownload(documentoId: string): Promise<string> {
  const usuario = await exigirEquipe();
  const documento = await db.documento.findUnique({
    where: { id: documentoId },
    select: { id: true, atoId: true, chaveStorage: true, nomeArquivo: true },
  });
  if (!documento) throw new ErroDeNegocio("Documento não encontrado.");
  // mesmo para a equipe, o acesso passa pelo filtro de visibilidade
  await exigirAcessoAoAto(documento.atoId, db);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "BAIXOU_DOCUMENTO",
    entidade: "Documento",
    entidadeId: documento.id,
    metadados: { atoId: documento.atoId },
  });
  return gerarUrlDeDownload(documento.chaveStorage, documento.nomeArquivo);
}

/**
 * Dispara a notificação pela AR Online e guarda o protocolo.
 *
 * Engole a falha de propósito: o envio já está registrado, e o operador
 * continua podendo mandar por fora. Derrubar o registro porque a AR Online
 * está fora do ar seria trocar um problema pequeno por um grande.
 *
 * O anexo é o próprio PDF emitido: a Carta-Convite tem que chegar junto do
 * aviso, não só a notificação de que ela existe.
 */
async function dispararPelaArOnline(
  envioId: string,
  atoId: string,
  documentoId: string,
  destinatarioId: string
): Promise<void> {
  try {
    const [ato, documento, destinatario, config] = await Promise.all([
      db.ato.findUnique({
        where: { id: atoId },
        select: {
          numero: true,
          objeto: true,
          partes: {
            where: { papel: PapelNoAto.SOLICITANTE },
            select: { pessoa: { select: { nome: true } } },
          },
        },
      }),
      db.documento.findUnique({
        where: { id: documentoId },
        select: { chaveStorage: true, nomeArquivo: true, tipo: true },
      }),
      db.pessoa.findUnique({
        where: { id: destinatarioId },
        select: { nome: true, email: true, telefone: true },
      }),
      configuracaoDoSistema(),
    ]);

    if (!ato || !documento || !destinatario) return;

    const { protocolo, canais } = await enviarNotificacao({
      destinatario,
      assunto: `Carta-Convite — Procedimento ${ato.numero}`,
      conteudoHtml:
        `<p>Prezado(a) ${destinatario.nome},</p>` +
        `<p>Segue a Carta-Convite do Procedimento Privado de Composição Consensual ` +
        `nº ${ato.numero}, administrado pela ${config.nomeCamara}.</p>` +
        `<p>O documento em anexo traz a data, o horário e a modalidade da Sessão ` +
        `Privada de Conciliação.</p>`,
      referencia: envioId,
      anexo: {
        nome: documento.nomeArquivo,
        conteudo: await baixarArquivo(documento.chaveStorage),
      },
      variaveisDoTemplate: {
        NOME_EMPRESA: config.nomeCamara,
        PROCEDIMENTO: ato.objeto ?? "Procedimento Privado de Composição Consensual",
        N_PROCEDIMENTO: ato.numero,
        SOLICITANTE: ato.partes[0]?.pessoa.nome ?? destinatario.nome,
      },
    });

    await db.envio.update({
      where: { id: envioId },
      data: { protocoloExterno: protocolo },
    });

    await db.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.OBSERVACAO,
        descricao: `Enviado pela AR Online (${canais.join(" e ")}), protocolo ${protocolo}.`,
      },
    });
  } catch (erro) {
    console.error("[ar-online] falha ao enviar", envioId, erro);

    await db.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.OBSERVACAO,
        descricao:
          "O disparo automático pela AR Online falhou. O envio segue registrado; confirme por fora e anexe o laudo quando chegar.",
      },
    });
  }
}
