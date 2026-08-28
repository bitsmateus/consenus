import type { NextAuthConfig } from "next-auth";
import { encode as codificarComPadraoDoAuthJs } from "next-auth/jwt";
import type { Papel } from "@prisma/client";

const OITO_HORAS = 8 * 60 * 60;
const TRINTA_DIAS = 30 * 24 * 60 * 60;

/**
 * Configuração compatível com o runtime Edge — sem Prisma e sem argon2.
 * O middleware usa só esta parte; o provedor de credenciais, que precisa do
 * banco e do Argon2id, fica em src/auth.ts e roda apenas no runtime Node.
 */
export const configuracaoDeAutenticacao = {
  // Teto do cookie: 30 dias, para caber a sessão de quem marcou "lembrar".
  // Quem NÃO marcou continua limitado a 8h de verdade — não pelo cookie, mas
  // pelo `exp` gravado dentro do próprio token, no `jwt.encode` abaixo. O
  // cookie sobreviver mais tempo no navegador não importa: o token dentro
  // dele expira sozinho, e a sessão deixa de valer.
  session: { strategy: "jwt", maxAge: TRINTA_DIAS },
  jwt: {
    encode: (parametros) =>
      codificarComPadraoDoAuthJs({
        ...parametros,
        maxAge: parametros.token?.lembrar ? TRINTA_DIAS : OITO_HORAS,
      }),
  },
  pages: { signIn: "/entrar" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nome = (user as { nome: string }).nome;
        token.papel = (user as { papel: Papel }).papel;
        token.pessoaId = (user as { pessoaId: string | null }).pessoaId;
        token.lembrar = (user as { lembrar: boolean }).lembrar;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.nome = token.nome as string;
      session.user.papel = token.papel as Papel;
      session.user.pessoaId = (token.pessoaId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
