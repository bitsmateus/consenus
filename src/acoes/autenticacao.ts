"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { destinoSeguro } from "@/lib/navegacao";
import { segundoFatorPendente } from "@/lib/totp";

const esquema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
  codigo: z.string().optional(),
  de: z.string().optional(),
});

export type EstadoLogin = { erro?: string };

export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const analise = esquema.safeParse(Object.fromEntries(dados));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { senha, codigo, de } = analise.data;
  const email = analise.data.email.toLowerCase();

  try {
    // redirect: false para o fluxo voltar até aqui e o destino ser validado.
    // A auditoria de LOGIN e LOGIN_FALHOU fica em src/auth.ts, na camada de
    // autenticação: ali ela cobre também quem chama /api/auth diretamente.
    await signIn("credentials", { email, senha, codigo, redirect: false });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { erro: "E-mail ou senha incorretos." };
    }
    throw erro;
  }

  // Manda direto para o destino final. O layout também barra quem tem segundo
  // fator pendente, mas deixar o desvio para lá encadearia dois redirecionamentos
  // na resposta da Server Action — e o roteador do Next quebra nessa cadeia.
  const conta = await db.usuario.findUnique({
    where: { email },
    select: { papel: true, totpAtivo: true },
  });

  const destino = conta && segundoFatorPendente(conta)
    ? "/seguranca"
    : destinoSeguro(de);

  // fora do try: redirect() sinaliza por exceção e não pode ser capturado acima
  redirect(destino);
}

export async function sair() {
  // LOGOUT é auditado pelo evento em src/auth.ts
  await signOut({ redirectTo: "/entrar" });
}
