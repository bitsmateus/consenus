import type { NextAuthConfig } from "next-auth";
import type { Papel } from "@prisma/client";

/**
 * Configuração compatível com o runtime Edge — sem Prisma e sem argon2.
 * O middleware usa só esta parte; o provedor de credenciais, que precisa do
 * banco e do Argon2id, fica em src/auth.ts e roda apenas no runtime Node.
 */
export const configuracaoDeAutenticacao = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/entrar" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nome = (user as { nome: string }).nome;
        token.papel = (user as { papel: Papel }).papel;
        token.pessoaId = (user as { pessoaId: string | null }).pessoaId;
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
