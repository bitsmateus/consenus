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
  | "CRIOU_ATO"
  | "ALTEROU_ATO"
  | "CONFIRMOU_DATA"
  | "GEROU_DOCUMENTO"
  | "ENVIOU_DOCUMENTO"
  | "BAIXOU_DOCUMENTO"
  | "CONSULTOU_VERIFICACAO"
  | "CRIOU_USUARIO"
  | "ALTEROU_PERMISSAO";

export async function registrarAuditoria(params: {
  usuarioId?: string | null;
  acao: AcaoAuditada;
  entidade: string;
  entidadeId?: string | null;
  metadados?: Record<string, unknown>;
}): Promise<void> {
  const cabecalhos = await headers();

  await db.logAuditoria.create({
    data: {
      usuarioId: params.usuarioId ?? null,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId ?? null,
      ip: cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: cabecalhos.get("user-agent") ?? null,
      metadados: params.metadados ? JSON.parse(JSON.stringify(params.metadados)) : undefined,
    },
  });
}
