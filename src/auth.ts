import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { Papel } from "@prisma/client";
import { configuracaoDeAutenticacao } from "@/auth.config";
import { registrarAuditoria } from "@/lib/auditoria";
import { codigoConfere } from "@/lib/totp";

const MINUTOS_BLOQUEIO = 15;
const MAX_TENTATIVAS = 5;

/**
 * Registro de tentativa fracassada. Fica aqui, e não na Server Action de
 * login, porque /api/auth/callback/credentials é público por natureza: quem
 * chama o endpoint direto tem que cair na mesma trilha (CLAUDE.md, regra 6).
 */
async function auditarFalha(email: string, usuarioId: string | null, motivo: string) {
  await registrarAuditoria({
    usuarioId,
    acao: "LOGIN_FALHOU",
    entidade: "Usuario",
    entidadeId: usuarioId,
    metadados: { email, motivo },
  });
}

const entrada = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
  codigo: z.string().optional(),
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

        const { email, senha, codigo } = analise.data;
        const usuario = await db.usuario.findUnique({ where: { email: email.toLowerCase() } });

        // resposta em tempo semelhante mesmo quando o usuário não existe
        if (!usuario || !usuario.ativo) {
          await argon2.hash(senha);
          await auditarFalha(email, usuario?.id ?? null, usuario ? "conta inativa" : "conta inexistente");
          return null;
        }

        if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
          await auditarFalha(email, usuario.id, "conta bloqueada");
          return null;
        }

        const confere = await argon2.verify(usuario.senhaHash, senha);

        if (!confere) {
          const tentativas = usuario.tentativasFalhas + 1;
          const bloqueia = tentativas >= MAX_TENTATIVAS;

          await db.usuario.update({
            where: { id: usuario.id },
            data: {
              tentativasFalhas: tentativas,
              bloqueadoAte: bloqueia
                ? new Date(Date.now() + MINUTOS_BLOQUEIO * 60_000)
                : null,
            },
          });

          // bloquear uma conta altera dado e é evento de segurança: vai para a
          // trilha de auditoria (CLAUDE.md, regra 6)
          if (bloqueia) {
            await registrarAuditoria({
              usuarioId: usuario.id,
              acao: "USUARIO_BLOQUEADO",
              entidade: "Usuario",
              entidadeId: usuario.id,
              metadados: { tentativas, minutosBloqueio: MINUTOS_BLOQUEIO },
            });
          }
          await auditarFalha(email, usuario.id, "senha incorreta");
          return null;
        }

        // segundo fator, quando ativado para esta conta
        if (usuario.totpAtivo) {
          if (!usuario.totpSecret || !codigo || !codigoConfere(codigo, usuario.totpSecret)) {
            await auditarFalha(email, usuario.id, "segundo fator inválido");
            return null;
          }
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
  /**
   * Auditoria de login e logout no ponto por onde TODO acesso passa — inclusive
   * chamada direta a /api/auth, que não atravessa a Server Action de login.
   */
  events: {
    async signIn({ user }) {
      await registrarAuditoria({
        usuarioId: user.id ?? null,
        acao: "LOGIN",
        entidade: "Usuario",
        entidadeId: user.id ?? null,
      });
    },
    async signOut(evento) {
      const usuarioId = "token" in evento ? ((evento.token?.id as string | undefined) ?? null) : null;
      await registrarAuditoria({
        usuarioId,
        acao: "LOGOUT",
        entidade: "Usuario",
        entidadeId: usuarioId,
      });
    },
  },
  // session e jwt vêm de configuracaoDeAutenticacao (src/auth.config.ts)
});
