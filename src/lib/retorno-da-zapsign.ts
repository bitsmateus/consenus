/**
 * O que fazer quando a ZapSign avisa que algo mudou num documento.
 *
 * O aviso da ZapSign não é assinado, então ele NUNCA é a fonte da verdade:
 * serve só para dizer "olhe o documento X". Aqui se consulta a API, com a
 * chave da câmara, e se compara com o que está gravado. Aviso forjado, no
 * máximo, faz o sistema reconferir um documento que já é dele.
 *
 * Idempotente por desenho, porque a ZapSign reenvia o que não recebeu 200 e
 * manda um "doc_signed" por signatário: o contador só sobe com UPDATE
 * condicional, e o arquivamento não repete (`assinadoId`).
 */
import { StatusAssinatura, TipoEvento } from "@prisma/client";
import { arquivarAssinado } from "./arquivar-assinado";
import { db } from "./db";
import { baixarAssinado, consultarDocumento, type DocumentoNaZapSign } from "./zapsign";

export type EnvioDaZapSign = {
  id: string;
  atoId: string;
  identificadorExterno: string;
  status: StatusAssinatura;
  totalSignatarios: number;
};

export type ResultadoDaSincronizacao = "arquivado" | "cancelado" | "atualizado" | "sem_mudanca";

/** Estados de onde não se sai: já arquivado, ou cancelado aqui ou lá. */
const ENCERRADOS: StatusAssinatura[] = [StatusAssinatura.ARQUIVADA, StatusAssinatura.CANCELADA];

export async function sincronizarEnvioDaZapSign(
  envio: EnvioDaZapSign,
  dependencias: {
    consultar?: (token: string) => Promise<DocumentoNaZapSign>;
    baixar?: (token: string) => Promise<{ conteudo: Buffer }>;
  } = {}
): Promise<ResultadoDaSincronizacao> {
  if (ENCERRADOS.includes(envio.status)) return "sem_mudanca";

  const consultar = dependencias.consultar ?? consultarDocumento;
  const baixar = dependencias.baixar ?? baixarAssinado;

  const documento = await consultar(envio.identificadorExterno);

  if (documento.situacao === "cancelado") {
    const mudou = await db.operacaoAssinatura.updateMany({
      where: { id: envio.id, status: { notIn: ENCERRADOS } },
      data: { status: StatusAssinatura.CANCELADA },
    });
    if (mudou.count === 1) {
      await db.eventoAto.create({
        data: {
          atoId: envio.atoId,
          tipo: TipoEvento.ASSINATURA_CANCELADA,
          descricao: "A assinatura eletrônica do documento foi cancelada na ZapSign.",
        },
      });
    }
    return "cancelado";
  }

  const assinaram = documento.assinaram.length;
  let atualizou = false;

  if (assinaram > 0) {
    // condicional: dois avisos simultâneos não registram a mesma assinatura duas vezes
    const subiu = await db.operacaoAssinatura.updateMany({
      where: { id: envio.id, jaAssinaram: { lt: assinaram } },
      data: {
        jaAssinaram: assinaram,
        ...(documento.situacao === "assinado" ? {} : { status: StatusAssinatura.PARCIAL }),
      },
    });
    if (subiu.count === 1) {
      atualizou = true;
      const total = Math.max(envio.totalSignatarios, documento.totalSignatarios);
      await db.eventoAto.create({
        data: {
          atoId: envio.atoId,
          tipo: TipoEvento.ASSINATURA_REGISTRADA,
          descricao: `Assinatura eletrônica registrada (${assinaram} de ${total}). Já assinaram: ${documento.assinaram
            .map((s) => s.nome || s.email)
            .join(", ")}.`,
        },
      });
    }
  }

  if (documento.situacao === "assinado") {
    await arquivarAssinado(envio.id, baixar, "webhook ZapSign");
    return "arquivado";
  }

  return atualizou ? "atualizado" : "sem_mudanca";
}
