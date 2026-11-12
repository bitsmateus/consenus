/**
 * Arquivamento do PDF assinado, comum às duas plataformas de assinatura.
 *
 * Saiu de dentro do webhook da D4Sign quando chegou a ZapSign (11/2026): o que
 * muda entre elas é só COMO se baixa o arquivo, e isso vem por parâmetro.
 * Guardar, registrar na linha do tempo e auditar é igual, e não pode divergir.
 */
import { StatusAssinatura, TipoDocumento, TipoEvento } from "@prisma/client";
import { registrarAuditoria } from "./auditoria";
import { db } from "./db";
import { enviarArquivo, montarChave } from "./storage";

/**
 * Baixa o PDF assinado e o guarda no nosso repositório.
 *
 * Enquanto isso não acontece, o documento assinado só existe na plataforma — e o
 * acervo da câmara não pode depender de terceiro. O assinado entra como
 * documento novo, do tipo DOCUMENTO_ASSINADO: o original emitido continua
 * intacto, com seu código de verificação.
 */
export async function arquivarAssinado(
  operacaoId: string,
  baixar: (identificadorExterno: string) => Promise<{ conteudo: Buffer }>,
  origem: string
): Promise<void> {
  const operacao = await db.operacaoAssinatura.findUniqueOrThrow({
    where: { id: operacaoId },
    include: { documento: { select: { tipo: true, nomeArquivo: true } } },
  });

  // já arquivado: aviso repetido não duplica documento
  if (operacao.assinadoId) return;

  const { conteudo } = await baixar(operacao.identificadorExterno);

  const nomeArquivo = operacao.documento.nomeArquivo.replace(/\.pdf$/i, "") + "-assinado.pdf";
  const chaveStorage = montarChave(
    operacao.atoId,
    TipoDocumento.DOCUMENTO_ASSINADO.toLowerCase(),
    nomeArquivo
  );
  const guardado = await enviarArquivo({ chave: chaveStorage, conteudo, mimeType: "application/pdf" });

  const frase =
    operacao.documento.tipo === TipoDocumento.ATA
      ? "Ata assinada eletronicamente"
      : "Termo de Acordo assinado eletronicamente";

  const assinado = await db.$transaction(async (tx) => {
    const criado = await tx.documento.create({
      data: {
        atoId: operacao.atoId,
        tipo: TipoDocumento.DOCUMENTO_ASSINADO,
        // anexo não recebe código: o código é do documento emitido pela esteira
        codigoVerificacao: null,
        emitidoPelaCamara: false,
        nomeArquivo,
        chaveStorage: guardado.chave,
        mimeType: "application/pdf",
        tamanhoBytes: guardado.tamanhoBytes,
        hashSha256: guardado.hashSha256,
      },
    });
    await tx.operacaoAssinatura.update({
      where: { id: operacao.id },
      data: {
        status: StatusAssinatura.ARQUIVADA,
        assinadoId: criado.id,
        concluidaEm: new Date(),
        ultimoErro: null,
      },
    });
    await tx.eventoAto.create({
      data: {
        atoId: operacao.atoId,
        tipo: TipoEvento.DOCUMENTO_ASSINADO_ANEXADO,
        descricao: `${frase} e arquivado automaticamente no repositório da câmara.`,
        metadados: { hash: guardado.hashSha256 },
      },
    });
    return criado;
  });

  await registrarAuditoria({
    usuarioId: null,
    acao: "ARQUIVOU_ASSINADO",
    entidade: "Documento",
    entidadeId: assinado.id,
    metadados: {
      atoId: operacao.atoId,
      origem,
      hash: guardado.hashSha256,
    },
  });
}
