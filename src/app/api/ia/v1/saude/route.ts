import { NextResponse } from "next/server";
import { tokenAutentico } from "@/lib/api-ia";

/** Teste de conexão do n8n: confirma que a URL e o token estão certos. */
export async function GET(requisicao: Request) {
  if (!tokenAutentico(requisicao.headers.get("authorization"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, versao: "v1" }, { headers: { "Cache-Control": "no-store" } });
}
