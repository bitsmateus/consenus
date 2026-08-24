"use client";

import { useActionState, useState } from "react";
import { renomearAto, type EstadoDeFormulario } from "@/acoes/atos";

/**
 * Título de trabalho do procedimento.
 *
 * Pedido do cliente em 24/08: na listagem só aparecia o número, e ninguém sabia
 * de quem era o procedimento sem abrir. O número continua sendo a identidade
 * oficial — isto é apelido, e some da tela quando esvaziado.
 */
export function TituloDoProcedimento({
  atoId,
  titulo,
}: {
  atoId: string;
  titulo: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await renomearAto(anterior, entrada);
      if (!resultado.erro) setEditando(false);
      return resultado;
    },
    {}
  );

  if (!editando) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-sm text-carvao-700">
          {titulo ?? <span className="text-carvao-300">Sem título de trabalho</span>}
        </p>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-xs text-dourado-600 hover:underline"
        >
          {titulo ? "Renomear" : "Dar um título"}
        </button>
      </div>
    );
  }

  return (
    <form action={acao} className="mb-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="atoId" value={atoId} />

      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-medium text-carvao-700">
          Título de trabalho
        </span>
        <input
          name="titulo"
          defaultValue={titulo ?? ""}
          maxLength={120}
          autoFocus
          placeholder="Ex.: Mais Credit × Banco Itaú — consignado"
          className="w-full rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
        />
      </label>

      <button
        disabled={pendente}
        className="rounded-md bg-grafite-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-grafite-500 disabled:opacity-60"
      >
        Salvar
      </button>
      <button
        type="button"
        onClick={() => setEditando(false)}
        className="px-2 py-2.5 text-xs text-carvao-500 hover:underline"
      >
        Cancelar
      </button>

      {estado.erro && (
        <p role="alert" className="w-full text-xs text-erro">
          {estado.erro}
        </p>
      )}
      <p className="w-full text-[11px] text-carvao-300">
        Serve para achar o procedimento na listagem. Os documentos continuam
        saindo com o número {""}
        oficial.
      </p>
    </form>
  );
}
