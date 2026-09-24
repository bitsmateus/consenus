"use client";

import { useActionState } from "react";
import { excluirAto, type EstadoDeFormulario } from "@/acoes/atos";
import { Botao } from "@/components/ui/botao";

/**
 * Exclusão do procedimento, só para o administrador. O botão só habilita
 * quando o número digitado confere; a checagem que vale é a do servidor.
 */
export function ExcluirProcedimento({ atoId, numero }: { atoId: string; numero: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(excluirAto, {});

  return (
    <details className="rounded-lg border border-erro/25 bg-white p-4">
      <summary className="cursor-pointer text-xs font-medium text-erro">
        Excluir procedimento
      </summary>

      <form action={acao} className="mt-3">
        <input type="hidden" name="atoId" value={atoId} />

        <p className="mb-3 text-xs leading-relaxed text-carvao-500">
          Apaga o procedimento, as partes vinculadas, os documentos (inclusive os arquivos),
          envios e assinaturas. <strong>Não dá para desfazer.</strong> Os códigos de
          verificação dos documentos emitidos deixam de existir na página pública.
        </p>

        {estado.erro && (
          <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
            {estado.erro}
          </p>
        )}

        <label htmlFor="confirmacao" className="mb-1.5 block text-xs font-medium text-carvao-700">
          Digite <span className="tabular">{numero}</span> para confirmar
        </label>
        <input
          id="confirmacao"
          name="confirmacao"
          autoComplete="off"
          className="tabular mb-3 w-full rounded-md border border-carvao-100 px-3 py-2.5 text-sm outline-none focus:border-erro"
        />

        <Botao type="submit" variante="perigo" carregando={pendente}>
          Excluir definitivamente
        </Botao>
      </form>
    </details>
  );
}
