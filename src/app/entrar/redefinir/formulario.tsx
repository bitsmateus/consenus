"use client";

import Link from "next/link";
import { useActionState } from "react";
import { redefinirSenha, type EstadoDeRedefinicao } from "@/acoes/redefinicao-de-senha";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioDeNovaSenha({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeRedefinicao, FormData>(
    redefinirSenha,
    {}
  );

  return (
    <form action={acao} noValidate>
      <input type="hidden" name="token" value={token} />

      <Campo
        rotulo="Nova senha"
        name="novaSenha"
        type="password"
        autoComplete="new-password"
        dica="Ao menos 12 caracteres, com maiúscula, minúscula e número."
        required
        autoFocus
        erro={estado.campo === "novaSenha" ? estado.erro : undefined}
      />
      <Campo
        rotulo="Repita a nova senha"
        name="confirmacao"
        type="password"
        autoComplete="new-password"
        required
        erro={estado.campo === "confirmacao" ? estado.erro : undefined}
      />

      {estado.erro && estado.campo !== "novaSenha" && estado.campo !== "confirmacao" && (
        <p role="alert" className="mb-4 rounded-md border border-erro/20 bg-erro/5 px-3 py-2 text-xs text-erro">
          {estado.erro}{" "}
          <Link href="/entrar/esqueci-senha" className="underline">
            Pedir novo link
          </Link>
        </p>
      )}

      <Botao type="submit" carregando={pendente} className="w-full py-3">
        Salvar nova senha
      </Botao>
    </form>
  );
}
