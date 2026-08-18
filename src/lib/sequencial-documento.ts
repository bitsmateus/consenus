/**
 * Sequencial do código de documento — CO-SIGLA-ANO-NNNNNN.
 *
 * O contador é por SIGLA e por ano, não por TipoDocumento: as duas cartas
 * convite dividem a sigla CC e precisam dividir a mesma sequência, senão a
 * carta ao Convidado repetiria o código da carta ao Solicitante e o índice
 * único de Documento.codigoVerificacao rejeitaria. Ver codigo-documento.ts.
 */
import { Prisma, TipoDocumento } from "@prisma/client";
import {
  montarCodigo,
  siglaDoTipo,
  tiposQueCompartilhamSequencia,
  type TipoComCodigo,
} from "./codigo-documento";

/** Tipos emitidos pela esteira. Anexo recebido não recebe código. */
export const TIPOS_EMITIDOS: TipoComCodigo[] = [
  "CARTA_CONVITE_SOLICITANTE",
  "CARTA_CONVITE_CONVIDADO",
  "ATA",
  "TERMO_ACORDO",
];

export function ehTipoEmitido(tipo: TipoDocumento): tipo is TipoDocumento & TipoComCodigo {
  return (TIPOS_EMITIDOS as string[]).includes(tipo);
}

/**
 * Próximo código do ano para a sigla do tipo.
 *
 * Recebe o client da transação de propósito: a leitura do último sequencial e
 * a criação do documento precisam correr na mesma transação. `codigoVerificacao`
 * é único no banco, então uma corrida vira erro e o chamador repete — nunca
 * código duplicado.
 */
export async function proximoCodigoDeDocumento(
  tx: Prisma.TransactionClient,
  tipo: TipoComCodigo,
  ano: number
): Promise<string> {
  const sigla = siglaDoTipo(tipo);
  const prefixo = `CO-${sigla}-${ano}-`;

  const ultimo = await tx.documento.findFirst({
    where: {
      codigoVerificacao: { startsWith: prefixo },
      tipo: { in: tiposQueCompartilhamSequencia(tipo) as TipoDocumento[] },
    },
    orderBy: { codigoVerificacao: "desc" },
    select: { codigoVerificacao: true },
  });

  const anterior = ultimo?.codigoVerificacao
    ? Number(ultimo.codigoVerificacao.slice(prefixo.length, prefixo.length + 6))
    : 0;

  return montarCodigo(tipo, ano, anterior + 1);
}
