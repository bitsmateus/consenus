/**
 * Numeração do procedimento — formato ANO.SEQUENCIAL, ex.: 2026.0001.
 *
 * Diferente do código de documento (CO-CC-2026-000001, ver codigo-documento.ts):
 * este é o número do procedimento, usado no painel e nas telas.
 * O sequencial reinicia a cada ano.
 */
import type { Prisma } from "@prisma/client";

const PADRAO = /^(\d{4})\.(\d{4,})$/;

export function montarNumeroDoAto(ano: number, sequencial: number): string {
  return `${ano}.${String(sequencial).padStart(4, "0")}`;
}

export function analisarNumeroDoAto(numero: string): { ano: number; sequencial: number } | null {
  const m = PADRAO.exec(numero.trim());
  if (!m) return null;
  return { ano: Number(m[1]), sequencial: Number(m[2]) };
}

/**
 * Próximo número do ano, a partir do maior já usado.
 *
 * Recebe o client da transação de propósito: a leitura do último número e a
 * criação do ato precisam acontecer na mesma transação, senão dois cadastros
 * simultâneos recebem o mesmo número. `Ato.numero` é único no banco, então a
 * corrida vira erro em vez de duplicata — e o chamador tenta de novo.
 */
export async function proximoNumeroDoAto(
  tx: Prisma.TransactionClient,
  ano: number
): Promise<string> {
  const ultimo = await tx.ato.findFirst({
    where: { numero: { startsWith: `${ano}.` } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  const anterior = ultimo ? analisarNumeroDoAto(ultimo.numero)?.sequencial : undefined;
  return montarNumeroDoAto(ano, (anterior ?? 0) + 1);
}
