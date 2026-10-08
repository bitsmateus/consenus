"use client";

import { useActionState, useState } from "react";
import { atualizarObservacaoDoDocumento, type EstadoDeFormulario } from "@/acoes/documentos";

/**
 * Observação (informação complementar) de um documento anexado — pedido do
 * cliente em 08/10. Anotação interna da equipe: não faz parte do arquivo.
 */
export function ObservacaoDoDocumento({
  documentoId,
  observacao,
  editavel,
}: {
  documentoId: string;
  observacao: string | null;
  editavel: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await atualizarObservacaoDoDocumento(anterior, entrada);
      if (!resultado.erro) setEditando(false);
      return resultado;
    },
    {}
  );

  if (!editando) {
    if (!observacao && !editavel) return null;
    return (
      <div className="mt-3 border-t border-carvao-100 pt-3 text-xs">
        {observacao && (
          <p className="whitespace-pre-line leading-relaxed text-carvao-600">
            <span className="font-medium text-carvao-700">Observação: </span>
            {observacao}
          </p>
        )}
        {editavel && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="mt-1 text-dourado-600 hover:underline"
          >
            {observacao ? "Editar observação" : "Adicionar observação"}
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={acao} className="mt-3 border-t border-carvao-100 pt-3">
      <input type="hidden" name="documentoId" value={documentoId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-carvao-700">Observação</span>
        <textarea
          name="observacao"
          defaultValue={observacao ?? ""}
          maxLength={2000}
          rows={3}
          autoFocus
          placeholder="Informação complementar sobre este documento"
          className="w-full rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
        />
      </label>
      <div className="mt-2 flex items-center gap-2">
        <button
          disabled={pendente}
          className="rounded-md bg-grafite-700 px-4 py-2 text-xs font-medium text-white hover:bg-grafite-500 disabled:opacity-60"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="px-2 py-2 text-xs text-carvao-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
      {estado.erro && (
        <p role="alert" className="mt-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
