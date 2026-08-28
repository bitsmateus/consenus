"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "@/acoes/autenticacao";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioDeLogin({ de }: { de?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} noValidate>
      {de && <input type="hidden" name="de" value={de} />}

      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required autoFocus />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Campo
        rotulo="Código de verificação"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className="tabular"
        dica="Só para contas com verificação em duas etapas."
      />

      <label className="mb-4 flex items-center gap-2 text-xs text-carvao-500">
        <input
          type="checkbox"
          name="lembrar"
          value="true"
          className="h-3.5 w-3.5 rounded border-carvao-100 text-dourado-600 focus:ring-dourado-600"
        />
        Manter conectado por 30 dias
      </label>

      {estado.erro && (
        <p role="alert" className="mb-4 rounded-md border border-erro/20 bg-erro/5 px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <Botao type="submit" carregando={pendente} className="w-full py-3">
        Entrar
      </Botao>
    </form>
  );
}
