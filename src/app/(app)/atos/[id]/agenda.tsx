"use client";

import { useActionState, useState } from "react";
import { ModalidadeSessao } from "@prisma/client";
import { alterarAgenda, type EstadoDeFormulario } from "@/acoes/atos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { ROTULO_MODALIDADE } from "@/lib/formato";

/**
 * Ajuste da agenda: modalidade e data da sessão.
 *
 * Pedido do cliente em 24/08. A data continua nascendo em D+30 — isto é para
 * corrigir engano e para remarcação combinada entre as partes, não para
 * substituir o cálculo automático.
 */
export function AgendaDoProcedimento({
  atoId,
  modalidade,
  dataDaSessao,
  confirmada,
}: {
  atoId: string;
  modalidade: ModalidadeSessao;
  /** "AAAA-MM-DDTHH:MM" no fuso da câmara, pronto para o input. */
  dataDaSessao: string;
  confirmada: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await alterarAgenda(anterior, entrada);
      if (!resultado.erro) setEditando(false);
      return resultado;
    },
    {}
  );

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="text-xs text-dourado-600 hover:underline"
      >
        Alterar data ou modalidade
      </button>
    );
  }

  return (
    <form action={acao} className="mt-2 rounded-md border border-carvao-100 p-3">
      <input type="hidden" name="atoId" value={atoId} />

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <Campo
        rotulo="Data e hora da sessão"
        name="dataDaSessao"
        type="datetime-local"
        defaultValue={dataDaSessao}
        required
      />

      <Selecao
        rotulo="Modalidade"
        name="modalidade"
        defaultValue={modalidade}
        opcoes={Object.values(ModalidadeSessao).map((m) => ({
          valor: m,
          rotulo: ROTULO_MODALIDADE[m],
        }))}
      />

      <p className="mb-3 text-[11px] text-carvao-300">
        {confirmada
          ? "A data já está confirmada: alterar aqui mantém a confirmação na data nova."
          : "A data ainda é provisória e só se efetiva com a conferência da documentação."}{" "}
        A sala do Zoom acompanha a mudança.
      </p>

      <div className="flex items-center gap-3">
        <Botao type="submit" variante="secundario" carregando={pendente}>
          Salvar agenda
        </Botao>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="text-xs text-carvao-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
