"use client";

import { useActionState } from "react";
import { ModalidadeSessao } from "@prisma/client";
import { criarAto, type EstadoDeFormulario } from "@/acoes/atos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { ROTULO_MODALIDADE } from "@/lib/formato";

export function FormularioDeNovoAto({
  pessoas,
  diasAteSessao,
  prazoDocumentacaoDias,
}: {
  pessoas: { id: string; rotulo: string }[];
  diasAteSessao: number;
  prazoDocumentacaoDias: number;
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(criarAto, {});

  const opcoes = pessoas.map((p) => ({ valor: p.id, rotulo: p.rotulo }));

  return (
    <form action={acao} className="max-w-2xl">
      {estado.erro && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-erro/20 bg-erro-bg px-3 py-2 text-xs text-erro"
        >
          {estado.erro}
        </p>
      )}

      <Selecao
        rotulo="Interessado Solicitante"
        name="solicitanteId"
        vazio="Selecione"
        opcoes={opcoes}
        dica="Quem provoca o procedimento."
        required
      />

      <Selecao
        rotulo="Interessado Convidado"
        name="convidadoId"
        vazio="Selecione"
        opcoes={opcoes}
        dica="A outra parte."
        required
      />

      <Campo
        rotulo="Objeto do procedimento"
        name="objeto"
        dica="Aparece nos documentos emitidos."
      />

      <Selecao
        rotulo="Modalidade da sessão"
        name="modalidade"
        defaultValue={ModalidadeSessao.VIDEOCONFERENCIA}
        opcoes={Object.values(ModalidadeSessao).map((m) => ({
          valor: m,
          rotulo: ROTULO_MODALIDADE[m],
        }))}
      />

      <Campo rotulo="Observações internas" name="observacoes" />

      <p className="mb-5 rounded-md bg-dourado-100 px-3 py-2.5 text-xs leading-relaxed text-dourado-600">
        Ao abrir, o sistema numera o procedimento, <strong>reserva</strong> a data da sessão
        em D+{diasAteSessao} e marca o prazo de {prazoDocumentacaoDias} dias para o
        Interessado Solicitante enviar a documentação. A data só é confirmada depois
        que você conferir os documentos.
      </p>

      <Botao type="submit" carregando={pendente}>
        Abrir procedimento
      </Botao>
    </form>
  );
}
