import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { Papel } from "@prisma/client";
import { configuracaoDeAutenticacao } from "@/auth.config";

const MINUTOS_BLOQUEIO = 15;
const MAX_TENTATIVAS = 5;

const entrada = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

declare module "next-auth" {
  interface User {
    nome: string;
    papel: Papel;
    pessoaId: string | null;
  }
  interface Session {
    user: {
      id: string;
      nome: string;
      papel: Papel;
      pessoaId: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...configuracaoDeAutenticacao,
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(dados) {
        const analise = entrada.safeParse(dados);
        if (!analise.success) return null;

        const { email, senha } = analise.data;
        const usuario = await db.usuario.findUnique({ where: { email: email.toLowerCase() } });

        // resposta em tempo semelhante mesmo quando o usuário não existe
        if (!usuario || !usuario.ativo) {
          await argon2.hash(senha);
          return null;
        }

        if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) return null;

        const confere = await argon2.verify(usuario.senhaHash, senha);

        if (!confere) {
          const tentativas = usuario.tentativasFalhas + 1;
          await db.usuario.update({
            where: { id: usuario.id },
            data: {
              tentativasFalhas: tentativas,
              bloqueadoAte:
                tentativas >= MAX_TENTATIVAS
                  ? new Date(Date.now() + MINUTOS_BLOQUEIO * 60_000)
                  : null,
            },
          });
          return null;
        }

        await db.usuario.update({
          where: { id: usuario.id },
          data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLoginEm: new Date() },
        });

        return {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          pessoaId: usuario.pessoaId,
        };
      },
    }),
  ],
  // session e jwt vêm de configuracaoDeAutenticacao (src/auth.config.ts)
});
