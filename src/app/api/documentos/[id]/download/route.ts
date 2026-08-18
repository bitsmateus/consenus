/**
 * Download de documento.
 *
 * Não serve o arquivo: gera URL pré-assinada com expiração de 10 minutos e
 * redireciona. A chave do bucket nunca chega ao navegador, e o bucket continua
 * privado (CLAUDE.md, regra 4).
 *
 * A verificação de sessão e de acesso ao procedimento está em
 * obterUrlDeDownload(), no servidor — não aqui na borda.
 */
import { NextResponse } from "next/server";
import { obterUrlDeDownload } from "@/acoes/documentos";
import { ErroDeNegocio } from "@/lib/erros";

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const url = await obterUrlDeDownload(id);
    return NextResponse.redirect(url, { status: 302 });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 403 });
    }
    // erro técnico não vaza para a tela
    console.error("falha ao gerar URL de download", erro);
    return NextResponse.json({ erro: "Não foi possível baixar o documento." }, { status: 500 });
  }
}
