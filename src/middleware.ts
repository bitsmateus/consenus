import NextAuth from "next-auth";
import { configuracaoDeAutenticacao } from "@/auth.config";

/**
 * Proteção de rotas. Públicas: /entrar e /verificar.
 * A autorização fina (quem vê qual ato) NÃO acontece aqui — está em
 * src/lib/sessao.ts, no servidor, a cada consulta. Ver CLAUDE.md, regra 2.
 *
 * Usa só a configuração compatível com Edge: o middleware apenas lê o JWT,
 * nunca o banco nem o Argon2id.
 */
const { auth } = NextAuth(configuracaoDeAutenticacao);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const publica = pathname.startsWith("/entrar") || pathname.startsWith("/verificar");

  if (!req.auth && !publica) {
    const url = new URL("/entrar", req.nextUrl.origin);
    url.searchParams.set("de", pathname);
    return Response.redirect(url);
  }
  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|marca).*)"],
};
