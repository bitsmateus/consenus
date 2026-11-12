/**
 * Onde cada pessoa assina na Ata e no Termo de Acordo.
 *
 * O modelo oficial tem cinco linhas fixas: o conciliador e, de cada lado, o
 * titular e o procurador. Cada linha leva um texto âncora INVISÍVEL (branco,
 * sem ocupar espaço) logo acima do traço; a ZapSign procura esse texto no PDF
 * e desenha a assinatura ali (`signature_placement`). Pedido do cliente em
 * 11/2026: na D4Sign as assinaturas saíam numa página à parte, fora do lugar.
 *
 * Não mexe em palavra do modelo (CLAUDE.md, regra 11): é marcação técnica, que
 * não aparece na impressão. Módulo puro, compartilhado pelo documento (onde a
 * âncora é escrita) e pelo envio (onde ela é informada à ZapSign) — duas
 * listas separadas se desencontrariam no primeiro ajuste.
 */
import type { PapelNoAto } from "@prisma/client";

export type LugarDaAssinatura =
  | "conciliador"
  | "solicitante"
  | "procuradorSolicitante"
  | "convidado"
  | "procuradorConvidado";

/** `<<…>>` é o formato que a ZapSign recomenda, para não casar com texto comum. */
export const ANCORA: Record<LugarDaAssinatura, string> = {
  conciliador: "<<assina-conciliador>>",
  solicitante: "<<assina-solicitante>>",
  procuradorSolicitante: "<<assina-procurador-solicitante>>",
  convidado: "<<assina-convidado>>",
  procuradorConvidado: "<<assina-procurador-convidado>>",
};

/**
 * Em que linha a pessoa assina. Lado A do documento é o Interessado
 * Solicitante (Parte 1 no Termo); lado B, o Convidado (Parte 2).
 * Procurador sem representado conhecido não tem linha: assina sem posição.
 */
export function lugarDaAssinatura(
  papel: PapelNoAto,
  representaPapel: PapelNoAto | null
): LugarDaAssinatura | null {
  if (papel === "CONCILIADOR") return "conciliador";
  if (papel === "SOLICITANTE") return "solicitante";
  if (papel === "CONVIDADO") return "convidado";
  if (papel === "PROCURADOR") {
    if (representaPapel === "SOLICITANTE") return "procuradorSolicitante";
    if (representaPapel === "CONVIDADO") return "procuradorConvidado";
  }
  return null;
}

/**
 * A âncora no HTML do documento. Altura zero, para não deslocar nada do
 * layout do modelo; branca, para não aparecer na impressão.
 */
export function marcaDaAncora(lugar: LugarDaAssinatura): string {
  const texto = ANCORA[lugar].replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div class="ancora-assinatura">${texto}</div>`;
}
