/**
 * Token de "esqueci minha senha".
 *
 * O token tem 256 bits aleatórios e só existe no e-mail: no banco vai o SHA-256,
 * então quem lê a tabela não consegue montar um link válido. Uso único, e vale
 * por uma hora — tempo de sobra para abrir o e-mail, e curto para o link
 * esquecido numa caixa de entrada não virar chave permanente.
 */
import { createHash, randomBytes } from "node:crypto";

export const MINUTOS_DE_VALIDADE = 60;

/** Quantos pedidos por conta na janela abaixo: freia quem usa a tela para lotar a caixa de alguém. */
export const MAXIMO_DE_PEDIDOS_NA_JANELA = 3;
export const JANELA_DE_PEDIDOS_MINUTOS = 15;

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validoAte(agora = new Date()): Date {
  return new Date(agora.getTime() + MINUTOS_DE_VALIDADE * 60_000);
}

export function montarLink(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/entrar/redefinir?token=${encodeURIComponent(token)}`;
}
