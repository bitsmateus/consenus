/**
 * Log de auditoria. Obrigatório em: login, download de documento, alteração de
 * ato e consulta de documento. Ver Cláusula 17ª do contrato.
 *
 * Nunca registre senha, token ou conteúdo de documento.
 */
import { headers } from "next/headers";
import { db } from "./db";

export type AcaoAuditada =
  | "LOGIN"
  | "LOGIN_FALHOU"
  | "LOGOUT"
  | "USUARIO_BLOQUEADO"
  | "PREPAROU_SEGUNDO_FATOR"
  | "ATIVOU_SEGUNDO_FATOR"
  | "DESATIVOU_SEGUNDO_FATOR"
  | "CRIOU_PESSOA"
  | "ALTEROU_PESSOA"
  | "CRIOU_ATO"
  | "ALTEROU_ATO"
  | "ADICIONOU_PARTE"
  | "REMOVEU_PARTE"
  | "CONFIRMOU_DATA"
  | "GEROU_DOCUMENTO"
  | "ENVIOU_DOCUMENTO"
  | "SOLICITOU_ASSINATURA"
  | "ARQUIVOU_ASSINADO"
  | "BAIXOU_DOCUMENTO"
  | "CONSULTOU_VERIFICACAO"
  | "VARREDURA_SUSPEITA"
  | "CRIOU_USUARIO"
  | "ALTEROU_PERMISSAO";

export async function registrarAuditoria(params: {
  usuarioId?: string | null;
  acao: AcaoAuditada;
  entidade: string;
  entidadeId?: string | null;
  metadados?: Record<string, unknown>;
  /**
   * Não grava IP nem user-agent. Usado só na página pública de verificação:
   * docs/03 manda registrar a consulta "sem identificar o consultante", porque
   * a página é aberta e o interesse é auditar o uso, não vigiar quem consulta.
   */
  semIdentificacao?: boolean;
}): Promise<void> {
  const cabecalhos = params.semIdentificacao ? null : await headers();

  await db.logAuditoria.create({
    data: {
      usuarioId: params.usuarioId ?? null,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId ?? null,
      ip: cabecalhos?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: cabecalhos?.get("user-agent") ?? null,
      metadados: params.metadados ? JSON.parse(JSON.stringify(params.metadados)) : undefined,
    },
  });
}
