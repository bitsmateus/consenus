"use client";

import Link from "next/link";
import { useActionState } from "react";
import { solicitarRedefinicao, type EstadoDeRedefinicao } from "@/acoes/redefinicao-de-senha";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioDePedido() {
  const [estado, acao, pendente] = useActionState<EstadoDeRedefinicao, FormData>(
    solicitarRedefinicao,
    {}
  );

  return (
    <form action={acao} noValidate>
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        erro={estado.campo === "email" ? estado.erro : undefined}
      />

      {estado.erro && estado.campo !== "email" && (
        <p role="alert" className="mb-4 rounded-md border border-erro/20 bg-erro/5 px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="mb-4 rounded-md border border-sucesso/20 bg-sucesso-bg px-3 py-2 text-xs text-sucesso">
          {estado.aviso}
        </p>
      )}

      <Botao type="submit" carregando={pendente} className="w-full py-3">
        Enviar link
      </Botao>

      <p className="mt-4 text-center text-xs">
        <Link href="/entrar" className="text-carvao-500 hover:text-dourado-600 hover:underline">
          Voltar ao acesso
        </Link>
      </p>
    </form>
  );
}
