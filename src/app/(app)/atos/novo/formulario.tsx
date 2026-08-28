"use client";

import { useActionState, useState } from "react";
import { ModalidadeSessao, TipoPessoa, TipoProcurador } from "@prisma/client";
import { criarAto, type EstadoDeFormulario } from "@/acoes/atos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { SeletorDePessoa } from "@/components/ui/seletor-de-pessoa";
import { ROTULO_MODALIDADE, ROTULO_TIPO_PROCURADOR } from "@/lib/formato";

export function FormularioDeNovoAto({
  pessoas,
  diasAteSessao,
  prazoDocumentacaoDias,
}: {
  pessoas: { id: string; rotulo: string; email: string | null; telefone: string | null }[];
  diasAteSessao: number;
  prazoDocumentacaoDias: number;
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(criarAto, {});
  const [representa, setRepresenta] = useState<"" | "solicitante" | "convidado">("");
  const [procuradorNovo, setProcuradorNovo] = useState(false);
  const [natureza, setNatureza] = useState<TipoProcurador | "">("");
  const [solicitanteId, setSolicitanteId] = useState("");
  const [convidadoId, setConvidadoId] = useState("");

  const contatoDe = (id: string) => pessoas.find((p) => p.id === id) ?? null;

  const ehAdvogado =
    natureza === TipoProcurador.ADVOGADO || natureza === TipoProcurador.ESCRITORIO_ADVOCACIA;

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

      <SeletorDePessoa
        rotulo="Interessado Solicitante"
        name="solicitanteId"
        pessoas={pessoas}
        dica="Quem provoca o procedimento."
        required
        aoSelecionar={setSolicitanteId}
      />
      {solicitanteId && (
        <div className="mb-4 grid gap-x-3 sm:grid-cols-2">
          <Campo
            key={`solicitante-email-${solicitanteId}`}
            rotulo="E-mail do Solicitante"
            name="solicitanteEmail"
            type="email"
            defaultValue={contatoDe(solicitanteId)?.email ?? ""}
            dica="Usado no envio da Carta-Convite. Confira ou corrija."
          />
          <Campo
            key={`solicitante-telefone-${solicitanteId}`}
            rotulo="Telefone do Solicitante"
            name="solicitanteTelefone"
            defaultValue={contatoDe(solicitanteId)?.telefone ?? ""}
          />
        </div>
      )}

      <SeletorDePessoa
        rotulo="Interessado Convidado"
        name="convidadoId"
        pessoas={pessoas}
        dica="A outra parte."
        required
        aoSelecionar={setConvidadoId}
      />
      {convidadoId && (
        <div className="mb-4 grid gap-x-3 sm:grid-cols-2">
          <Campo
            key={`convidado-email-${convidadoId}`}
            rotulo="E-mail do Convidado"
            name="convidadoEmail"
            type="email"
            defaultValue={contatoDe(convidadoId)?.email ?? ""}
            dica="Usado no envio da Carta-Convite. Confira ou corrija."
          />
          <Campo
            key={`convidado-telefone-${convidadoId}`}
            rotulo="Telefone do Convidado"
            name="convidadoTelefone"
            defaultValue={contatoDe(convidadoId)?.telefone ?? ""}
          />
        </div>
      )}

      <fieldset className="mb-4 rounded-lg border border-carvao-100 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-carvao-500">
          Procurador (opcional)
        </legend>

        <Selecao
          rotulo="Representa"
          name="procuradorRepresenta"
          value={representa}
          onChange={(e) => setRepresenta(e.target.value as typeof representa)}
          vazio="Nenhum procurador nesta abertura"
          opcoes={[
            { valor: "solicitante", rotulo: "Interessado Solicitante" },
            { valor: "convidado", rotulo: "Interessado Convidado" },
          ]}
          dica="Também dá para vincular depois, na tela do procedimento."
        />

        {representa && (
          <>
            {procuradorNovo ? (
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Selecao
                  rotulo="Tipo"
                  name="procuradorTipo"
                  defaultValue={TipoPessoa.FISICA}
                  opcoes={[
                    { valor: TipoPessoa.FISICA, rotulo: "Pessoa física" },
                    { valor: TipoPessoa.JURIDICA, rotulo: "Pessoa jurídica" },
                  ]}
                />
                <Campo rotulo="Nome ou razão social" name="procuradorNome" required />
                <Campo rotulo="CPF ou CNPJ" name="procuradorDocumento" required />
                <Selecao
                  rotulo="Natureza"
                  name="procuradorTipoProcurador"
                  vazio="Selecione"
                  value={natureza}
                  onChange={(e) => setNatureza(e.target.value as TipoProcurador | "")}
                  opcoes={Object.values(TipoProcurador).map((t) => ({
                    valor: t,
                    rotulo: ROTULO_TIPO_PROCURADOR[t],
                  }))}
                  required
                />
                {ehAdvogado && (
                  <Campo
                    rotulo="OAB"
                    name="procuradorOab"
                    dica="Ex.: OAB/SP 214.887"
                    required
                  />
                )}
                <input type="hidden" name="procuradorNovo" value="true" />
              </div>
            ) : (
              <SeletorDePessoa rotulo="Procurador" name="procuradorPessoaId" pessoas={pessoas} required />
            )}

            <button
              type="button"
              onClick={() => setProcuradorNovo((estava) => !estava)}
              className="mb-4 text-xs text-dourado-600 hover:underline"
            >
              {procuradorNovo ? "Escolher alguém já cadastrado" : "A pessoa não está cadastrada"}
            </button>
          </>
        )}
      </fieldset>

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
