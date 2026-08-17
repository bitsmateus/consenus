"use client";

import { useActionState } from "react";
import { ativarSegundoFator, type EstadoSegundoFator } from "@/acoes/seguranca";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioDeAtivacao() {
  const [estado, acao, pendente] = useActionState<EstadoSegundoFator, FormData>(
    ativarSegundoFator,
    {}
  );

  return (
    <form action={acao} className="max-w-[220px]">
      <Campo
        rotulo="Código de 6 dígitos"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className="tabular"
        required
      />

      {estado.erro && (
        <p role="alert" className="mb-3 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-3 text-xs text-sucesso">{estado.aviso}</p>}

      <Botao type="submit" carregando={pendente} className="w-full">
        Ativar
      </Botao>
    </form>
  );
}
