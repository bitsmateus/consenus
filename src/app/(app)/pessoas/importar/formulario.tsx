"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importarPessoas, type ResultadoDeImportacao } from "@/acoes/pessoas";
import { Botao } from "@/components/ui/botao";

export function FormularioDeImportacao() {
  const [estado, acao, pendente] = useActionState<ResultadoDeImportacao, FormData>(
    importarPessoas,
    {}
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-6 rounded-lg border border-carvao-100 bg-white p-4">
        <p className="mb-3 text-sm text-carvao-700">
          A planilha modelo já vem com as colunas certas e uma aba de instruções — baixe, preencha
          uma linha por pessoa e envie de volta aqui.
        </p>
        <a
          href="/api/pessoas/modelo"
          className="inline-flex items-center gap-2 rounded-md border border-carvao-100 bg-white px-4 py-2.5 text-sm font-medium text-grafite-700 hover:border-dourado-600"
        >
          Baixar planilha modelo
        </a>
      </div>

      <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
        {estado.erro && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-erro/20 bg-erro-bg px-3 py-2 text-xs text-erro"
          >
            {estado.erro}
          </p>
        )}

        <label htmlFor="arquivo" className="mb-1.5 block text-xs font-medium text-carvao-700">
          Planilha preenchida (.xlsx)
        </label>
        <input
          id="arquivo"
          type="file"
          name="arquivo"
          accept=".xlsx"
          required
          className="mb-4 block w-full text-sm text-carvao-700 file:mr-3 file:rounded-md file:border-0 file:bg-grafite-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-grafite-500"
        />

        <Botao type="submit" carregando={pendente}>
          Importar
        </Botao>
      </form>

      {estado.resumo && (
        <div className="mt-6 rounded-lg border border-carvao-100 bg-white p-4">
          <p className="text-sm font-medium text-carvao-700">
            {estado.resumo.importadas} de {estado.resumo.total}{" "}
            {estado.resumo.total === 1 ? "pessoa importada" : "pessoas importadas"}.
          </p>

          {estado.resumo.erros.length > 0 && (
            <>
              <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                {estado.resumo.erros.length === 1
                  ? "1 linha não foi importada"
                  : `${estado.resumo.erros.length} linhas não foram importadas`}
              </p>
              <ul className="space-y-1.5">
                {estado.resumo.erros.map((e) => (
                  <li
                    key={e.linha}
                    className="rounded-md border border-erro/20 bg-erro-bg px-3 py-2 text-xs text-erro"
                  >
                    <span className="font-medium">
                      Linha {e.linha} — {e.nome}:
                    </span>{" "}
                    {e.motivo}
                  </li>
                ))}
              </ul>
            </>
          )}

          {estado.resumo.importadas > 0 && (
            <Link
              href="/pessoas"
              className="mt-4 inline-block text-xs font-medium text-dourado-600 hover:underline"
            >
              Ver pessoas cadastradas
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
