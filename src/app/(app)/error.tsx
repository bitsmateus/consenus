"use client";

import { useEffect } from "react";

/**
 * Limite de erro das telas internas.
 *
 * Existe por causa de um episódio real: uma tela passou a abrir em branco em
 * produção, sem erro no log do servidor e sem erro no console do navegador.
 * Sem este limite, falha de renderização vira página vazia — e página vazia
 * não diz nada a quem está usando nem a quem vai depurar.
 *
 * O `digest` é a única pista que o Next expõe do erro do servidor em produção,
 * e casa com a linha correspondente no log do container. Por isso ele aparece
 * na tela: sem ele, o suporte fica perguntando "que erro deu?".
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[tela]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md rounded-lg border border-carvao-100 bg-white p-6 text-center">
        <h1 className="text-base font-semibold text-preto-900">
          Não foi possível abrir esta tela
        </h1>
        <p className="mt-2 text-sm text-carvao-500">
          O procedimento e os documentos não foram afetados. Tente de novo; se
          continuar, avise o suporte com o código abaixo.
        </p>

        {error.digest && (
          <p className="tabular mt-3 rounded-md bg-fundo px-3 py-2 text-xs text-carvao-500">
            {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="mt-4 rounded-md bg-grafite-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-grafite-500"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
