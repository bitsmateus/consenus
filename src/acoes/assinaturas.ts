"use server";
import { revalidatePath } from "next/cache";
import { ProvedorAssinatura, StatusAssinatura, TipoDocumento, TipoEvento } from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { ANCORA } from "@/lib/ancoras-de-assinatura";
import {
  cadastrarNomes,
  cadastrarSignatarios,
  enviarParaAssinatura as dispararConvites,
  enviarPdf,
  explicarFalhaDaD4Sign,
  registrarWebhook,
  urlDoWebhook,
} from "@/lib/d4sign";
import {
  NOME_DO_PROVEDOR,
  provedorConfigurado,
  provedorEscolhido,
} from "@/lib/provedor-de-assinatura";
import * as zapsign from "@/lib/zapsign";
import { db } from "@/lib/db";
import { ErroDeNegocio, FluxoInvalido } from "@/lib/erros";
import { exigirAcessoAoAto, exigirEquipe } from "@/lib/sessao";
import { montarSignatarios, type ParteParaAssinatura } from "@/lib/signatarios";
import { baixarArquivo } from "@/lib/storage";

export type EstadoDeFormulario = { erro?: string; aviso?: string };

const pedido = z.object({ documentoId: z.string().min(1, "Documento não informado.") });

/** Só documento emitido pela câmara vai para assinatura. Anexo não se assina. */
const ASSINAVEIS: TipoDocumento[] = [TipoDocumento.ATA, TipoDocumento.TERMO_ACORDO];

const NOME_DO_TIPO: Partial<Record<TipoDocumento, string>> = {
  ATA: "Ata de Sessão Privada de Conciliação",
  TERMO_ACORDO: "Termo de Acordo",
};

/**
 * Envia a Ata ou o Termo de Acordo para assinatura eletrônica — Etapa 2.
 *
 * A plataforma é a de ASSINATURA_PROVEDOR (ver provedor-de-assinatura.ts).
 *
 * ZapSign: uma chamada só. O documento nasce com os signatários, cada um com
 * a âncora da sua linha (a assinatura sai no lugar certo), e os convites
 * partem junto. O retorno vem pelo webhook cadastrado no painel deles.
 *
 * D4Sign: são cinco chamadas, nesta ordem, e a ordem importa: o webhook
 * precisa estar registrado ANTES de o convite sair, senão a primeira
 * assinatura acontece antes de existir para onde avisar.
 *
 *   1. sobe o PDF          → devolve o UUID do documento
 *   2. cadastra signatários
 *   3. grava os nomes      (uma chamada por pessoa)
 *   4. registra o webhook
 *   5. dispara os convites
 *
 * Depois daqui nada mais passa por esta função: a D4Sign avisa cada assinatura
 * pelo webhook, e o documento assinado se arquiva sozinho.
 */
export async function enviarParaAssinatura(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const usuario = await exigirEquipe();

  const analise = pedido.safeParse({ documentoId: entrada.get("documentoId") });
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const provedor = provedorEscolhido();
  const nomeDoProvedor = NOME_DO_PROVEDOR[provedor];

  /** guardado fora do try para o catch conseguir registrar o que ficou na plataforma */
  let identificadorCriado: string | null = null;
  let atoId: string | null = null;

  try {
    if (!provedorConfigurado(provedor)) {
      throw new ErroDeNegocio(
        "A assinatura eletrônica não está configurada. Baixe o documento e colete as assinaturas pelo caminho de sempre."
      );
    }

    const enderecoDoWebhook =
      provedor === ProvedorAssinatura.ZAPSIGN ? zapsign.urlDoWebhook() : urlDoWebhook();
    if (!enderecoDoWebhook) {
      // enviar sem webhook funcionaria, e é justamente o problema: as
      // assinaturas aconteceriam sem ninguém aqui ficar sabendo
      throw new ErroDeNegocio(
        "O endereço de retorno da assinatura não está configurado. Sem ele, o documento assinado não voltaria sozinho."
      );
    }

    const documento = await db.documento.findUnique({
      where: { id: analise.data.documentoId },
      include: {
        emAssinatura: { select: { id: true } },
        ato: {
          include: {
            partes: {
              include: {
                pessoa: { select: { nome: true, email: true } },
                representa: { select: { papel: true } },
              },
            },
          },
        },
      },
    });

    if (!documento) throw new ErroDeNegocio("Documento não encontrado.");
    await exigirAcessoAoAto(documento.atoId, db);
    atoId = documento.atoId;

    if (!ASSINAVEIS.includes(documento.tipo)) {
      throw new FluxoInvalido("Só a Ata e o Termo de Acordo vão para assinatura eletrônica.");
    }
    if (documento.substituidoPorId) {
      throw new FluxoInvalido(
        "Esta ata foi retificada e substituída por outra. Envie a ata nova para assinatura."
      );
    }
    if (documento.emAssinatura) {
      throw new FluxoInvalido(
        "Este documento já foi enviado para assinatura. Acompanhe o andamento na linha do tempo."
      );
    }

    const partes: ParteParaAssinatura[] = documento.ato.partes.map((p) => ({
      papel: p.papel,
      compareceu: p.compareceu,
      representaPapel: p.representa?.papel ?? null,
      pessoa: p.pessoa,
    }));

    const { signatarios, semEmail } = montarSignatarios(partes);

    // Antes de qualquer chamada externa: falhar aqui não deixa documento órfão
    // na plataforma, não gasta documento do plano (a ZapSign cobra todo
    // documento criado), e a mensagem diz exatamente quem precisa de cadastro.
    if (semEmail.length > 0) {
      throw new ErroDeNegocio(
        `Falta e-mail no cadastro de: ${semEmail.join("; ")}. Sem e-mail não há como enviar para assinatura.`
      );
    }
    if (signatarios.length === 0) {
      throw new FluxoInvalido(
        "Nenhum participante registrado para assinar. Registre o comparecimento da sessão antes."
      );
    }

    const rotulo = NOME_DO_TIPO[documento.tipo] ?? "Documento";
    const mensagem = `${rotulo} do Procedimento ${documento.ato.numero} — Consensus One.`;
    const conteudo = await baixarArquivo(documento.chaveStorage);

    if (provedor === ProvedorAssinatura.ZAPSIGN) {
      const criado = await zapsign.criarDocumento({
        nome: `${rotulo} — Procedimento ${documento.ato.numero}`,
        pdf: conteudo,
        idExterno: documento.id,
        mensagem,
        signatarios: signatarios.map((s) => ({
          nome: s.nome,
          email: s.email,
          papel: s.papel,
          ancora: s.lugar ? ANCORA[s.lugar] : null,
        })),
      });
      identificadorCriado = criado.token;
    } else {
      identificadorCriado = await enviarPdf(conteudo, documento.nomeArquivo);
      await cadastrarSignatarios(identificadorCriado, signatarios);
      await cadastrarNomes(identificadorCriado, signatarios);
      await registrarWebhook(identificadorCriado, enderecoDoWebhook);
      await dispararConvites(identificadorCriado, mensagem);
    }
    const identificador = identificadorCriado;

    await db.$transaction(async (tx) => {
      await tx.operacaoAssinatura.create({
        data: {
          atoId: documento.atoId,
          documentoId: documento.id,
          provedor,
          identificadorExterno: identificador,
          status: StatusAssinatura.AGUARDANDO,
          totalSignatarios: signatarios.length,
          solicitadaPorId: usuario.id,
        },
      });
      await tx.eventoAto.create({
        data: {
          atoId: documento.atoId,
          tipo: TipoEvento.ASSINATURA_SOLICITADA,
          descricao: `${rotulo} enviada para assinatura eletrônica (${nomeDoProvedor}) de ${signatarios.length} ${
            signatarios.length === 1 ? "signatário" : "signatários"
          }: ${signatarios.map((s) => s.nome).join(", ")}.`,
          usuarioId: usuario.id,
          metadados: { documentoId: documento.id },
        },
      });
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "SOLICITOU_ASSINATURA",
      entidade: "Documento",
      entidadeId: documento.id,
      metadados: { atoId: documento.atoId, signatarios: signatarios.length, provedor },
    });

    revalidatePath(`/atos/${documento.atoId}`);
    return { aviso: "Enviado para assinatura. Os signatários receberam o convite por e-mail." };
  } catch (erro) {
    // O documento já foi criado na plataforma e algo depois falhou: registrar
    // o ocorrido na linha do tempo é o que evita um documento existir lá sem
    // ninguém aqui saber. O operador resolve pelo painel da plataforma.
    if (identificadorCriado && atoId) {
      await db.eventoAto
        .create({
          data: {
            atoId,
            tipo: TipoEvento.OBSERVACAO,
            descricao:
              provedor === ProvedorAssinatura.ZAPSIGN
                ? `Falha ao registrar o envio para assinatura eletrônica. O documento foi criado na ZapSign sob o identificador ${identificadorCriado} e os convites podem ter saído; confira pelo painel deles antes de reenviar.`
                : `Falha ao enviar para assinatura eletrônica. O documento ficou criado na D4Sign sob o identificador ${identificadorCriado} e o envio precisa ser concluído pelo painel deles.`,
            usuarioId: usuario.id,
          },
        })
        .catch(() => undefined);
    }

    if (erro instanceof ErroDeNegocio) return { erro: erro.message };

    console.error(`[assinatura] falha ao enviar para a ${nomeDoProvedor}`, erro);
    const motivo =
      provedor === ProvedorAssinatura.ZAPSIGN
        ? zapsign.explicarFalhaDaZapSign(erro)
        : explicarFalhaDaD4Sign(erro);
    // ficou documento criado lá: reenviar daqui cria um segundo (e, na
    // ZapSign, cobra outro documento)
    return {
      erro: identificadorCriado
        ? `${motivo} O documento chegou a ser criado na ${nomeDoProvedor} (veja a linha do tempo); confira pelo painel deles, ou cancele o documento lá antes de reenviar daqui.`
        : motivo,
    };
  }
}
