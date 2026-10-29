/**
 * Retificação da Ata — regra de quando ela ainda pode ser corrigida.
 *
 * Decisão do cliente em 29/10: ata que alguém já assinou não se retifica. Só
 * a que não foi para assinatura, ou foi e ninguém assinou ainda (nesse caso o
 * envio na D4Sign é cancelado). Módulo puro, para testar sem servidor.
 */
import { StatusAssinatura } from "@prisma/client";

const ASSINATURA_INICIADA: StatusAssinatura[] = [
  StatusAssinatura.PARCIAL,
  StatusAssinatura.CONCLUIDA,
  StatusAssinatura.ARQUIVADA,
  // FALHOU = assinado por todos, só o arquivo não voltou
  StatusAssinatura.FALHOU,
];

export function ataJaAssinada(
  assinatura: { status: StatusAssinatura; jaAssinaram: number } | null | undefined
): boolean {
  if (!assinatura) return false;
  return assinatura.jaAssinaram > 0 || ASSINATURA_INICIADA.includes(assinatura.status);
}

/** Envio na D4Sign ainda aberto, que precisa ser cancelado ao retificar. */
export function envioAindaAberto(
  assinatura: { status: StatusAssinatura } | null | undefined
): boolean {
  return assinatura?.status === StatusAssinatura.AGUARDANDO;
}
