import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { configuracaoDeAutenticacao } from "@/auth.config";

/**
 * Proteção de rotas. Públicas: /entrar, /verificar, os endpoints do Auth.js e
 * os webhooks da assinatura eletrônica e do AR digital.
 * A autorização fina (quem vê qual ato) NÃO acontece aqui — está em
 * src/lib/sessao.ts, no servidor, a cada consulta. Ver CLAUDE.md, regra 2.
 *
 * Usa só a configuração compatível com Edge: o middleware apenas lê o JWT,
 * nunca o banco nem o Argon2id.
 */
const { auth } = NextAuth(configuracaoDeAutenticacao);

/** Únicas rotas que respondem sem sessão. Ver docs/04. */
function ehPublica(pathname: string): boolean {
  return (
    pathname.startsWith("/entrar") ||
    pathname.startsWith("/verificar") ||
    pathname.startsWith("/api/auth") ||
    // Webhook da D4Sign: quem chama é servidor deles, não tem como ter
    // sessão. A defesa não é a sessão — é o token secreto no caminho e o
    // Content-Hmac, conferidos dentro da rota.
    pathname.startsWith("/api/webhooks/d4sign") ||
    // Webhook da AR Online, mesma razão. A defesa é o valor fixo do header
    // Authorization e, sobretudo, o fato de o aviso não virar conteúdo:
    // o laudo é buscado na API deles pelo protocolo já gravado aqui.
    pathname.startsWith("/api/webhooks/ar-online")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (req.auth || ehPublica(pathname)) {
    // o layout precisa saber o caminho para decidir sobre o segundo fator
    // pendente; Server Component não recebe pathname por outro meio
    const cabecalhos = new Headers(req.headers);
    cabecalhos.set("x-caminho", pathname);
    return NextResponse.next({ request: { headers: cabecalhos } });
  }

  // Rota de API responde 401; redirecionar devolveria HTML para quem espera JSON
  if (pathname.startsWith("/api")) {
    return Response.json(
      { erro: "Sessão expirada. Entre novamente." },
      { status: 401 }
    );
  }

  const url = new URL("/entrar", req.nextUrl.origin);
  url.searchParams.set("de", pathname);
  return Response.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|marca).*)"],
};
