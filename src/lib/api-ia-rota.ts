/**
 * Casca comum das rotas /api/ia/v1: autentica, limita, identifica a pessoa e
 * padroniza a resposta. Cada rota só diz o que devolver quando achou.
 */
import { NextResponse } from "next/server";
import {
  auditarConsultaIA,
  dentroDoLimite,
  identificarPessoa,
  tokenAutentico,
} from "./api-ia";

const SEM_CACHE = { "Cache-Control": "no-store" };

function json(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE });
}

export async function tratarConsulta(
  requisicao: Request,
  rota: string,
  quandoEncontrada: (pessoaId: string) => Promise<Record<string, unknown>>
) {
  if (!tokenAutentico(requisicao.headers.get("authorization"))) {
    // 401 sem detalhe: não diz se o token está errado ou a API desligada
    return json({ erro: "não autorizado" }, 401);
  }
  if (!dentroDoLimite()) {
    return json({ erro: "muitas consultas; tente em instantes" }, 429);
  }

  const url = new URL(requisicao.url);
  const entrada = {
    telefone: url.searchParams.get("telefone"),
    documento: url.searchParams.get("documento"),
  };

  const id = await identificarPessoa(entrada);

  if (id.tipo === "invalida") {
    return json({ erro: id.motivo }, 400);
  }
  if (id.tipo === "nao_encontrada") {
    await auditarConsultaIA(rota, entrada, "nao_encontrada");
    return json({ encontrado: false, motivo: "nao_encontrada" });
  }
  if (id.tipo === "ambigua") {
    await auditarConsultaIA(rota, entrada, "ambigua");
    // não escolhe entre pessoas: a Clara pede o CPF/CNPJ e chama de novo
    return json({ encontrado: false, motivo: "ambigua", acao: "pedir_documento" });
  }

  await auditarConsultaIA(rota, entrada, "encontrada", id.pessoaId);
  return json({ encontrado: true, ...(await quandoEncontrada(id.pessoaId)) });
}
