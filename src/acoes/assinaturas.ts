"use server";
import { revalidatePath } from "next/cache";
import { StatusAssinatura, TipoDocumento, TipoEvento } from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  assinaturaDigitalAtiva,
  cadastrarNomes,
  cadastrarSignatarios,
  enviarParaAssinatura as dispararConvites,
  enviarPdf,
  registrarWebhook,
  urlDoWebhook,
} from "@/lib/d4sign";
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
 * São cinco chamadas à D4Sign, nesta ordem, e a ordem importa: o webhook
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

  /** guardado fora do try para o catch conseguir registrar o que ficou na D4Sign */
  let uuidNaD4Sign: string | null = null;
  let atoId: string | null = null;

  try {
    if (!assinaturaDigitalAtiva()) {
      throw new ErroDeNegocio(
        "A assinatura eletrônica não está configurada. Baixe o documento e colete as assinaturas pelo caminho de sempre."
      );
    }

    const enderecoDoWebhook = urlDoWebhook();
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
    // na D4Sign, não gasta requisição do limite, e a mensagem diz exatamente
    // quem precisa de cadastro.
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
    const conteudo = await baixarArquivo(documento.chaveStorage);

    uuidNaD4Sign = await enviarPdf(conteudo, documento.nomeArquivo);
    await cadastrarSignatarios(uuidNaD4Sign, signatarios);
    await cadastrarNomes(uuidNaD4Sign, signatarios);
    await registrarWebhook(uuidNaD4Sign, enderecoDoWebhook);
    await dispararConvites(
      uuidNaD4Sign,
      `${rotulo} do Procedimento ${documento.ato.numero} — Consensus One.`
    );

    await db.$transaction(async (tx) => {
      await tx.operacaoAssinatura.create({
        data: {
          atoId: documento.atoId,
          documentoId: documento.id,
          identificadorExterno: uuidNaD4Sign!,
          status: StatusAssinatura.AGUARDANDO,
          totalSignatarios: signatarios.length,
          solicitadaPorId: usuario.id,
        },
      });
      await tx.eventoAto.create({
        data: {
          atoId: documento.atoId,
          tipo: TipoEvento.ASSINATURA_SOLICITADA,
          descricao: `${rotulo} enviada para assinatura eletrônica de ${signatarios.length} ${
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
      metadados: { atoId: documento.atoId, signatarios: signatarios.length },
    });

    revalidatePath(`/atos/${documento.atoId}`);
    return { aviso: "Enviado para assinatura. Os signatários receberam o convite por e-mail." };
  } catch (erro) {
    // O documento já subiu para a D4Sign e algo depois falhou: registrar o
    // ocorrido na linha do tempo é o que evita um documento existir lá sem
    // ninguém aqui saber. O operador termina o envio pelo painel da D4Sign.
    if (uuidNaD4Sign && atoId) {
      await db.eventoAto
        .create({
          data: {
            atoId,
            tipo: TipoEvento.OBSERVACAO,
            descricao: `Falha ao enviar para assinatura eletrônica. O documento ficou criado na D4Sign sob o identificador ${uuidNaD4Sign} e o envio precisa ser concluído pelo painel deles.`,
            usuarioId: usuario.id,
          },
        })
        .catch(() => undefined);
    }

    if (erro instanceof ErroDeNegocio) return { erro: erro.message };

    console.error("[assinatura] falha ao enviar para a D4Sign", erro);
    const mensagem =
      erro instanceof Error && erro.message.includes("Limite de requisições")
        ? "A D4Sign recusou por limite de requisições. Aguarde alguns minutos e tente de novo."
        : "Não foi possível falar com o serviço de assinatura agora. Tente de novo em alguns minutos.";
    return { erro: mensagem };
  }
}
