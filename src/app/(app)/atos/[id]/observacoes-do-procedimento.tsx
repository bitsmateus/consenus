"use client";

import { useActionState, useState } from "react";
import { atualizarObservacoesDoAto, type EstadoDeFormulario } from "@/acoes/atos";

/**
 * Observações gerais do procedimento, na visão geral — pedido do cliente em
 * 08/10: antes só se escrevia na abertura. Anotação interna da equipe.
 */
export function ObservacoesDoProcedimento({
  atoId,
  observacoes,
}: {
  atoId: string;
  observacoes: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await atualizarObservacoesDoAto(anterior, entrada);
      if (!resultado.erro) setEditando(false);
      return resultado;
    },
    {}
  );

  if (!editando) {
    return (
      <div className="mt-3 border-t border-carvao-100 pt-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-carvao-300">
          Observações
        </p>
        {observacoes ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-carvao-500">
            {observacoes}
          </p>
        ) : (
          <p className="text-xs text-carvao-300">Nenhuma observação.</p>
        )}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="mt-1.5 text-xs text-dourado-600 hover:underline"
        >
          {observacoes ? "Editar observações" : "Adicionar observações"}
        </button>
      </div>
    );
  }

  return (
    <form action={acao} className="mt-3 border-t border-carvao-100 pt-3">
      <input type="hidden" name="atoId" value={atoId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-carvao-700">Observações</span>
        <textarea
          name="observacoes"
          defaultValue={observacoes ?? ""}
          maxLength={2000}
          rows={5}
          autoFocus
          placeholder="Informações complementares sobre o procedimento"
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
