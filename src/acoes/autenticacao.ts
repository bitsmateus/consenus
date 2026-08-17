"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";

const esquema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
  de: z.string().optional(),
});

export type EstadoLogin = { erro?: string };

export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const analise = esquema.safeParse(Object.fromEntries(dados));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { email, senha, de } = analise.data;

  try {
    await signIn("credentials", {
      email: email.toLowerCase(),
      senha,
      redirectTo: de && de.startsWith("/") ? de : "/painel",
    });
    return {};
  } catch (erro) {
    if (erro instanceof AuthError) {
      const usuario = await db.usuario.findUnique({ where: { email: email.toLowerCase() } });
      await registrarAuditoria({
        usuarioId: usuario?.id ?? null,
        acao: "LOGIN_FALHOU",
        entidade: "Usuario",
        entidadeId: usuario?.id ?? null,
        metadados: { email },
      });
      return { erro: "E-mail ou senha incorretos." };
    }
    throw erro;
  }
}

export async function sair() {
  await signOut({ redirectTo: "/entrar" });
}
