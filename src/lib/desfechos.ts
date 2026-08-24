/**
 * Desfechos da Sessão Privada de Conciliação — docs/09, item 4.
 *
 * São cinco, não dois. O cliente pediu em 24/08 que a tela pergunte primeiro
 * "houve acordo?", que é como ele raciocina; mas reduzir a duas opções perderia
 * redesignação e sessão prejudicada, que estão nos modelos oficiais. A saída é
 * esta: a pergunta do acordo é um filtro sobre os cinco, não um substituto.
 *
 * Módulo puro de propósito, na mesma linha de `autorizacao.ts`: é regra de
 * negócio e precisa de teste sem servidor.
 */
import { DesfechoSessao } from "@prisma/client";

/** Desfechos que autorizam Termo de Acordo. docs/02, regra 4. */
export const DESFECHOS_COM_ACORDO: DesfechoSessao[] = [
  DesfechoSessao.COMPOSICAO_INTEGRAL,
  DesfechoSessao.COMPOSICAO_PARCIAL,
];

export const DESFECHOS_SEM_ACORDO: DesfechoSessao[] = [
  DesfechoSessao.ENCERRAMENTO_SEM_COMPOSICAO,
  DesfechoSessao.REDESIGNACAO,
  DesfechoSessao.SESSAO_PREJUDICADA,
];

export function houveAcordo(desfecho: DesfechoSessao): boolean {
  return DESFECHOS_COM_ACORDO.includes(desfecho);
}

/** Desfechos oferecidos depois de o operador responder se houve acordo. */
export function desfechosPara(acordo: boolean): DesfechoSessao[] {
  return acordo ? DESFECHOS_COM_ACORDO : DESFECHOS_SEM_ACORDO;
}
