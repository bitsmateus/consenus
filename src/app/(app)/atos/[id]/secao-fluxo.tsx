import { DesfechoSessao, ItemDaDocumentacao, StatusAto, TipoDocumento } from "@prisma/client";
import {
  cancelarAto,
  conferirItem,
  confirmarData,
  emitirCartaAoConvidado,
  gerarAta,
} from "@/acoes/fluxo";
import { ITENS_DA_DOCUMENTACAO, faltamItens } from "@/lib/documentacao";
import { emitirCartaAoSolicitante } from "@/acoes/documentos";
import { Botao } from "@/components/ui/botao";
import { Etiqueta } from "@/components/ui/etiqueta";
import { formatarData } from "@/lib/formato";
import { sessaoAntesDaDataMarcada } from "@/lib/prazos";
import { FormularioDaSessao, FormularioDoTermo } from "./formularios-da-sessao";

type Conferencia = {
  item: ItemDaDocumentacao;
  conferido: boolean;
  naoAplicavel: boolean;
  conferidoPor: { nome: string } | null;
  conferidoEm: Date | null;
};

/**
 * Conduz o operador pelos cinco passos de docs/02.
 *
 * Cada passo só aparece quando é a vez dele. Os bloqueios não são só visuais —
 * as Server Actions recusam a chamada fora de ordem; esconder o botão é
 * cortesia com o operador, não controle de acesso.
 */
export function SecaoDeFluxo({
  ato,
  equipe,
}: {
  ato: {
    id: string;
    status: StatusAto;
    dataReservada: Date | null;
    dataConfirmada: Date | null;
    desfecho: DesfechoSessao | null;
    conferencias: Conferencia[];
    documentos: { tipo: TipoDocumento }[];
    partes: { id: string; pessoa: { nome: string }; papel: string }[];
  };
  equipe: boolean;
}) {
  if (!equipe) return null;

  const temAta = ato.documentos.some((d) => d.tipo === TipoDocumento.ATA);
  const temTermo = ato.documentos.some((d) => d.tipo === TipoDocumento.TERMO_ACORDO);
  const pendentes = faltamItens(ato.conferencias);
  const cabeAcordo =
    ato.desfecho === DesfechoSessao.COMPOSICAO_INTEGRAL ||
    ato.desfecho === DesfechoSessao.COMPOSICAO_PARCIAL;

  const encerrado =
    ato.status === StatusAto.CANCELADO ||
    (temAta && ato.status !== StatusAto.SESSAO_REALIZADA);

  const proximoPasso =
    ato.status === StatusAto.RASCUNHO
      ? "Emitir a Carta-Convite ao Interessado Solicitante"
      : ato.status === StatusAto.AGUARDANDO_DOCUMENTACAO ||
          ato.status === StatusAto.DOCUMENTACAO_EM_ANALISE
        ? "Conferir a documentação do Interessado Solicitante"
        : ato.status === StatusAto.DATA_CONFIRMADA
          ? "Emitir a Carta-Convite ao Interessado Convidado"
          : ato.status === StatusAto.CONVIDADO_CONVOCADO
            ? "Registrar a sessão"
            : ato.status === StatusAto.SESSAO_REALIZADA && !temAta
              ? "Lavrar a Ata"
              : temAta && cabeAcordo && !temTermo
                ? "Preencher o Termo de Acordo"
                : null;

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
        Condução do procedimento
      </h2>

      {proximoPasso && !encerrado && (
        <div className="mb-4 rounded-lg border border-dourado-200 bg-dourado-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dourado-700">
            Próxima ação
          </p>
          <p className="mt-1 text-sm font-medium text-carvao-700">{proximoPasso}</p>
        </div>
      )}

      {/* ---------------------------------------------- passo 2 */}
      {ato.status === StatusAto.RASCUNHO && (
        <form action={emitirCartaAoSolicitante} className="mb-3 rounded-lg bg-dourado-100 p-4">
          <input type="hidden" name="atoId" value={ato.id} />
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dourado-600">
            Passo 2
          </p>
          <p className="mb-3 text-xs leading-relaxed text-dourado-600">
            Emitir a Carta-Convite ao Interessado Solicitante. O sistema numera o
            documento, aplica o timbrado com QR Code e abre o prazo de documentação.
            A data da sessão segue apenas reservada.
          </p>
          <Botao type="submit">Emitir Carta-Convite</Botao>
        </form>
      )}

      {/* ---------------------------------------------- passo 3 */}
      {(ato.status === StatusAto.AGUARDANDO_DOCUMENTACAO ||
        ato.status === StatusAto.DOCUMENTACAO_EM_ANALISE) && (
        <div className="mb-3 rounded-lg border border-carvao-100 bg-white p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dourado-600">
            Passo 3 — conferência da documentação
          </p>
          <p className="mb-3 text-xs leading-relaxed text-carvao-500">
            Confira item a item. A data da sessão só é efetivada quando os cinco
            itens estiverem resolvidos — é o que diz a Carta-Convite.
          </p>

          <ul className="mb-4 space-y-1.5">
            {ITENS_DA_DOCUMENTACAO.map((definicao) => {
              const registro = ato.conferencias.find((c) => c.item === definicao.item);
              const resolvido = registro?.conferido || registro?.naoAplicavel;

              return (
                <li
                  key={definicao.item}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-carvao-100 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-xs text-carvao-700">
                    {definicao.rotulo}
                    {registro?.conferidoPor && (
                      <span className="ml-1 text-carvao-300">
                        · {registro.conferidoPor.nome}
                      </span>
                    )}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {registro?.conferido && <Etiqueta tom="sucesso">Conferido</Etiqueta>}
                    {registro?.naoAplicavel && <Etiqueta>Não se aplica</Etiqueta>}
                    {!resolvido && <Etiqueta tom="atencao">Pendente</Etiqueta>}

                    <form action={conferirItem} className="flex gap-1">
                      <input type="hidden" name="atoId" value={ato.id} />
                      <input type="hidden" name="item" value={definicao.item} />
                      <button
                        name="marcar"
                        value={resolvido ? "pendente" : "conferido"}
                        className="rounded border border-carvao-100 px-2 py-1 text-[11px] hover:border-dourado-600"
                      >
                        {resolvido ? "Reabrir" : "Conferir"}
                      </button>
                      {definicao.opcional && !resolvido && (
                        <button
                          name="marcar"
                          value="nao_aplicavel"
                          className="rounded border border-carvao-100 px-2 py-1 text-[11px] text-carvao-500 hover:border-dourado-600"
                        >
                          Não se aplica
                        </button>
                      )}
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          <form action={confirmarData}>
            <input type="hidden" name="atoId" value={ato.id} />
            <Botao type="submit" disabled={pendentes.length > 0}>
              Confirmar a data da sessão
            </Botao>
            {pendentes.length > 0 && (
              <p className="mt-2 text-xs text-atencao">
                Faltam {pendentes.length} item(ns). Sem documentação integral, a
                sessão não é confirmada.
              </p>
            )}
          </form>
        </div>
      )}

      {/* ---------------------------------------------- passo 4 */}
      {ato.status === StatusAto.DATA_CONFIRMADA && (
        <form action={emitirCartaAoConvidado} className="mb-3 rounded-lg bg-dourado-100 p-4">
          <input type="hidden" name="atoId" value={ato.id} />
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dourado-600">
            Passo 4
          </p>
          <p className="mb-3 text-xs leading-relaxed text-dourado-600">
            Data confirmada para {formatarData(ato.dataConfirmada)}. Agora a
            Carta-Convite ao Interessado Convidado pode ser expedida — ela traz
            apenas data e link, sem exigir documentação dele.
          </p>
          <Botao type="submit">Emitir Carta-Convite ao Convidado</Botao>
        </form>
      )}

      {/* ---------------------------------------------- passo 5 */}
      {ato.status === StatusAto.CONVIDADO_CONVOCADO && (
        <div className="mb-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dourado-600">
            Passo 5 — registro da sessão
          </p>
          <FormularioDaSessao
            atoId={ato.id}
            partes={ato.partes.map((p) => ({
              id: p.id,
              nome: p.pessoa.nome,
              papel: p.papel,
            }))}
            dataDaSessao={formatarData(ato.dataConfirmada ?? ato.dataReservada)}
            antesDaData={sessaoAntesDaDataMarcada(ato.dataConfirmada ?? ato.dataReservada)}
          />
        </div>
      )}

      {/* ---------------------------------------------- ata */}
      {ato.status === StatusAto.SESSAO_REALIZADA && !temAta && (
        <form action={gerarAta} className="mb-3 rounded-lg bg-dourado-100 p-4">
          <input type="hidden" name="atoId" value={ato.id} />
          <p className="mb-3 text-xs leading-relaxed text-dourado-600">
            Sessão registrada. <strong>A ata é obrigatória</strong> e encerra a
            esteira — vale para qualquer desfecho, inclusive quando ninguém
            comparece ou não houve acordo.
          </p>
          <Botao type="submit">Lavrar a Ata</Botao>
        </form>
      )}

      {/* ---------------------------------------------- termo de acordo */}
      {temAta && cabeAcordo && !temTermo && (
        <div className="mb-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dourado-600">
            Termo de Acordo — opcional
          </p>
          <FormularioDoTermo atoId={ato.id} />
        </div>
      )}

      {temAta && !cabeAcordo && (
        <p className="mb-3 rounded-lg border border-carvao-100 bg-white px-4 py-3 text-xs text-carvao-500">
          A esteira terminou com a ata. O Termo de Acordo só existe quando há
          composição, integral ou parcial.
        </p>
      )}

      {/* ---------------------------------------------- encerramento administrativo */}
      {!encerrado && ato.status !== StatusAto.SESSAO_REALIZADA && (
        <details className="rounded-lg border border-carvao-100 bg-white p-4">
          <summary className="cursor-pointer text-xs font-medium text-carvao-500">
            Encerrar o cadastro administrativamente
          </summary>
          <form action={cancelarAto} className="mt-3">
            <input type="hidden" name="atoId" value={ato.id} />
            <p className="mb-3 text-xs leading-relaxed text-carvao-500">
              Previsto na própria Carta-Convite: sem o envio integral dos documentos
              no prazo, a sessão não é confirmada e o cadastro pode ser encerrado,
              sem prejuízo de nova solicitação.
            </p>
            <input
              name="motivo"
              required
              minLength={5}
              placeholder="Motivo do encerramento"
              className="mb-3 w-full rounded-md border border-carvao-100 px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
            />
            <Botao type="submit" variante="perigo">
              Encerrar cadastro
            </Botao>
          </form>
        </details>
      )}
    </section>
  );
}
