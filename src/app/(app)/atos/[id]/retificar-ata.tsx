"use client";

import { useActionState, useState } from "react";
import { retificarAta, type EstadoDeFormulario } from "@/acoes/fluxo";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

/**
 * Retificação da ata — pedido do cliente em 29/10, para erro de digitação.
 *
 * Reabre os dados da sessão que a ata imprime. O desfecho não muda aqui: a
 * retificação corrige o texto, não o resultado da sessão. Ao salvar sai uma
 * ata nova, com código novo, e a anterior fica marcada como substituída.
 */
export function RetificarAta({
  atoId,
  codigoVigente,
  enviadaParaAssinatura,
  partes,
  horaInicio,
  horaEncerramento,
  outrosPresentes,
  motivoPrejudicada,
  observacoesSessao,
  prejudicada,
}: {
  atoId: string;
  codigoVigente: string;
  /** está na D4Sign esperando assinatura, sem ninguém ter assinado */
  enviadaParaAssinatura: boolean;
  partes: { id: string; nome: string; papel: string; compareceu: boolean }[];
  horaInicio: string;
  horaEncerramento: string;
  outrosPresentes: string;
  motivoPrejudicada: string;
  observacoesSessao: string;
  prejudicada: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    async (anterior, entrada) => {
      const resultado = await retificarAta(anterior, entrada);
      if (!resultado.erro) setAberto(false);
      return resultado;
    },
    {}
  );

  if (!aberto) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-md border border-carvao-100 bg-white px-3 py-2 text-xs font-medium text-grafite-700 hover:border-dourado-600"
        >
          Retificar ata
        </button>
        <span className="text-[11px] text-carvao-300">
          Para corrigir erro de digitação antes de alguém assinar.
        </span>
        {estado.aviso && <p className="w-full text-xs text-sucesso">{estado.aviso}</p>}
      </div>
    );
  }

  return (
    <form action={acao} className="mb-3 rounded-lg border border-carvao-100 bg-white p-4">
      <input type="hidden" name="atoId" value={atoId} />

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dourado-600">
        Retificar ata {codigoVigente}
      </p>
      <p className="mb-4 text-xs leading-relaxed text-carvao-500">
        Sai uma ata nova, com código novo. A {codigoVigente} continua no repositório,
        marcada como substituída, e a página de verificação passa a informar isso.
        {enviadaParaAssinatura &&
          " O envio dela para assinatura na D4Sign será cancelado; envie a ata nova em seguida."}{" "}
        O desfecho da sessão não muda.
      </p>

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <Campo
        rotulo="O que está sendo corrigido"
        name="motivoRetificacao"
        required
        maxLength={500}
        placeholder="Ex.: nome do preposto digitado errado"
        dica="Fica na linha do tempo e na auditoria."
      />

      <fieldset className="mb-4">
        <legend className="mb-1.5 block text-xs font-medium text-carvao-700">Comparecimento</legend>
        <div className="space-y-1.5 rounded-md border border-carvao-100 p-3">
          {partes.map((parte) => (
            <label key={parte.id} className="flex items-center gap-2 text-sm text-carvao-700">
              <input
                type="checkbox"
                name="presente"
                value={parte.id}
                defaultChecked={parte.compareceu}
                className="h-4 w-4"
              />
              <span>
                {parte.nome}
                <span className="ml-1 text-xs text-carvao-300">({parte.papel})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Campo
        rotulo="Outros presentes"
        name="outrosPresentes"
        defaultValue={outrosPresentes}
        dica="Separe por vírgula."
      />

      {prejudicada && (
        <Campo
          rotulo="Motivo da sessão prejudicada"
          name="motivoPrejudicada"
          defaultValue={motivoPrejudicada}
          required
        />
      )}

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Hora de início" name="horaInicio" type="time" defaultValue={horaInicio} required />
        <Campo
          rotulo="Hora de encerramento"
          name="horaEncerramento"
          type="time"
          defaultValue={horaEncerramento}
          required
        />
      </div>

      <Campo rotulo="Observações" name="observacoesSessao" defaultValue={observacoesSessao} />

      <div className="flex items-center gap-2">
        <Botao type="submit" carregando={pendente}>
          Emitir ata retificada
        </Botao>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="px-2 py-2 text-xs text-carvao-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
