"use client";

import { useActionState, useState } from "react";
import { DesfechoSessao } from "@prisma/client";
import {
  gerarTermoDeAcordo,
  registrarSessao,
  type EstadoDeFormulario,
} from "@/acoes/fluxo";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { ROTULO_DESFECHO } from "@/lib/formato";

/** Passo 5 — registro da sessão realizada. */
export function FormularioDaSessao({
  atoId,
  partes,
}: {
  atoId: string;
  partes: { id: string; nome: string; papel: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    registrarSessao,
    {}
  );
  const [desfecho, setDesfecho] = useState<DesfechoSessao>(DesfechoSessao.COMPOSICAO_INTEGRAL);

  return (
    <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
      <input type="hidden" name="atoId" value={atoId} />

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="Hora de início" name="horaInicio" type="time" defaultValue="14:00" required />
        <Campo
          rotulo="Hora de encerramento"
          name="horaEncerramento"
          type="time"
          defaultValue="15:00"
          required
        />
      </div>

      <fieldset className="mb-4">
        <legend className="mb-1.5 block text-xs font-medium text-carvao-700">
          Comparecimento
        </legend>
        <div className="space-y-1.5 rounded-md border border-carvao-100 p-3">
          {partes.map((parte) => (
            <label key={parte.id} className="flex items-center gap-2 text-sm text-carvao-700">
              <input
                type="checkbox"
                name="presente"
                value={parte.id}
                defaultChecked
                className="h-4 w-4"
              />
              <span>
                {parte.nome}
                <span className="ml-1 text-xs text-carvao-300">({parte.papel})</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-carvao-300">
          Quem ficar desmarcado é registrado como ausente na ata.
        </p>
      </fieldset>

      <Selecao
        rotulo="Desfecho"
        name="desfecho"
        defaultValue={DesfechoSessao.COMPOSICAO_INTEGRAL}
        onChange={(e) => setDesfecho(e.target.value as DesfechoSessao)}
        opcoes={Object.values(DesfechoSessao).map((d) => ({
          valor: d,
          rotulo: ROTULO_DESFECHO[d],
        }))}
      />

      {desfecho === DesfechoSessao.SESSAO_PREJUDICADA && (
        <Campo
          rotulo="Motivo"
          name="motivoPrejudicada"
          dica="O modelo exige o registro do motivo."
          required
        />
      )}

      <Campo rotulo="Observações" name="observacoesSessao" placeholder="opcional" />

      <Botao type="submit" carregando={pendente}>
        Registrar sessão
      </Botao>
    </form>
  );
}

/** Termo de Acordo — só os campos livres. O resto do modelo é fixo. */
export function FormularioDoTermo({ atoId }: { atoId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    gerarTermoDeAcordo,
    {}
  );

  return (
    <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
      <input type="hidden" name="atoId" value={atoId} />

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-3 text-xs text-sucesso">{estado.aviso}</p>}

      <p className="mb-4 rounded-md bg-atencao-bg px-3 py-2 text-xs leading-relaxed text-atencao">
        🔒 As cláusulas de inadimplemento, confidencialidade, força executiva e
        quitação são texto fixo do modelo e não aparecem aqui. Alterá-las é
        decisão jurídica da câmara, não do operador.
      </p>

      <Campo rotulo="Cláusula Primeira — objeto do acordo" name="objetoDoAcordo" required />
      <Campo
        rotulo="Cláusula Segunda — obrigações da primeira parte"
        name="obrigacoesPrimeiraParte"
        required
      />
      <Campo
        rotulo="Cláusula Terceira — obrigações da segunda parte"
        name="obrigacoesSegundaParte"
        required
      />
      <Campo rotulo="Cláusula Quarta — condições específicas" name="condicoesEspecificas" />

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Campo rotulo="§ 1º Prazos de cumprimento" name="prazosDeCumprimento" />
        <Campo rotulo="§ 2º Forma de cumprimento" name="formaDeCumprimento" />
        <Campo rotulo="§ 3º Forma de pagamento" name="formaDePagamento" />
        <Campo rotulo="§ 4º Demais condições" name="demaisCondicoes" />
      </div>

      <Botao type="submit" carregando={pendente}>
        Emitir Termo de Acordo
      </Botao>
    </form>
  );
}
