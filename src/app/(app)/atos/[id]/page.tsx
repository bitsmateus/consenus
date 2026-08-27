import { notFound } from "next/navigation";
import Link from "next/link";
import { Papel, PapelNoAto, StatusAto } from "@prisma/client";
import { removerParte } from "@/acoes/atos";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Etiqueta } from "@/components/ui/etiqueta";
import { ESTADOS_FINAIS } from "@/lib/autorizacao";
import { buscarAto, listarPessoas } from "@/lib/consultas";
import { formatarDocumento } from "@/lib/documentos";
import {
  ROTULO_MODALIDADE,
  paraCampoDeDataHora,
  ROTULO_PAPEL_NO_ATO,
  ROTULO_STATUS,
  ROTULO_TIPO_PROCURADOR,
  TOM_DO_STATUS,
  formatarData,
  formatarDataHora,
} from "@/lib/formato";
import { diasRestantes, prazoEhProvisorio, situacaoDoPrazo } from "@/lib/prazos";
import { exigirUsuario } from "@/lib/sessao";
import { FormularioDeObservacao } from "./observacao";
import { FormularioDeVinculo } from "./vinculos";
import { SecaoDeDocumentos } from "./secao-documentos";
import { assinaturaDigitalAtiva } from "@/lib/d4sign";
import { SecaoDeFluxo } from "./secao-fluxo";
import { AgendaDoProcedimento } from "./agenda";
import { TituloDoProcedimento } from "./titulo";

export const metadata = { title: "Procedimento — Consensus One" };

export default async function PaginaDoAto({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const { id } = await params;

  // buscarAto já aplica filtroDeAtosVisiveis: quem não pode ver, recebe 404
  const ato = await buscarAto(id);
  if (!ato) notFound();

  const equipe = usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR;

  const interessados = ato.partes.filter(
    (p) => p.papel === PapelNoAto.SOLICITANTE || p.papel === PapelNoAto.CONVIDADO
  );
  const vinculados = ato.partes.filter(
    (p) => p.papel === PapelNoAto.PROCURADOR || p.papel === PapelNoAto.CONCILIADOR
  );

  const jaVinculadas = new Set(ato.partes.map((p) => p.pessoaId));
  const disponiveis = equipe
    ? (await listarPessoas()).filter((p) => !jaVinculadas.has(p.id))
    : [];

  // depois da sessão registrada a data é fato consumado: está na Ata
  const podeAjustarAgenda =
    !ESTADOS_FINAIS.includes(ato.status) && ato.status !== StatusAto.SESSAO_REALIZADA;

  const prazo = ato.prazoDocumentacaoAte;
  const situacao = prazo ? situacaoDoPrazo(prazo) : null;
  const restantes = prazo ? diasRestantes(prazo) : null;
  // sem a ciência registrada, o prazo foi contado da emissão e não do
  // recebimento — serve de referência, não de fundamento (docs/02)
  const prazoProvisorio = prazoEhProvisorio(ato.dataCienciaSolicitante);

  return (
    <>
      <CabecalhoDePagina
        titulo={ato.titulo ?? "Procedimento " + ato.numero}
        descricao={
          ato.titulo
            ? "Procedimento " + ato.numero
            : (ato.objeto ?? "Procedimento Privado de Composição Consensual")
        }
        acao={<Etiqueta tom={TOM_DO_STATUS[ato.status]}>{ROTULO_STATUS[ato.status]}</Etiqueta>}
      />

      <div className="flex-1 p-4 md:p-6">
        {equipe && <TituloDoProcedimento atoId={ato.id} titulo={ato.titulo} />}
        <div className="mb-4 rounded-lg border border-dourado-200 bg-dourado-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-dourado-700">
            Etapa atual
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-carvao-700">{ROTULO_STATUS[ato.status]}</p>
            <Etiqueta tom={TOM_DO_STATUS[ato.status]}>{ROTULO_STATUS[ato.status]}</Etiqueta>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-carvao-600">
            {ato.status === StatusAto.RASCUNHO &&
              "O procedimento está em abertura. Emita a Carta-Convite ao Interessado Solicitante para iniciar o prazo documental."}
            {(ato.status === StatusAto.AGUARDANDO_DOCUMENTACAO ||
              ato.status === StatusAto.DOCUMENTACAO_EM_ANALISE) &&
              "A documentação do Interessado Solicitante está em análise. A conferência item a item libera a confirmação da data da sessão."}
            {ato.status === StatusAto.DATA_CONFIRMADA &&
              "A data da sessão foi validada. A próxima ação é a Carta-Convite ao Interessado Convidado."}
            {ato.status === StatusAto.CONVIDADO_CONVOCADO &&
              "O Interessado Convidado já foi convocado. Agora é necessário registrar a sessão e seguir para a ata."}
            {ato.status === StatusAto.SESSAO_REALIZADA &&
              "A sessão foi registrada. A ata e, se houver acordo, o termo de acordo encerram o procedimento."}
            {ato.status === StatusAto.CANCELADO &&
              "O procedimento foi cancelado e segue sem continuidade de fluxo."}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* ---------------------------------------------- interessados */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                Interessados
              </h2>
              <ul className="space-y-2">
                {interessados.map((parte) => (
                  <li
                    key={parte.id}
                    className="rounded-lg border border-carvao-100 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-carvao-700">
                          {equipe ? (
                            <Link
                              href={`/pessoas/${parte.pessoa.id}`}
                              className="hover:text-dourado-600"
                            >
                              {parte.pessoa.nome}
                            </Link>
                          ) : (
                            parte.pessoa.nome
                          )}
                        </p>
                        <p className="tabular mt-0.5 text-xs text-carvao-500">
                          {formatarDocumento(parte.pessoa.documento)}
                        </p>
                      </div>
                      <Etiqueta tom="andamento">{ROTULO_PAPEL_NO_ATO[parte.papel]}</Etiqueta>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* ---------------------------------------------- procuradores */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                Procuradores e conciliador
              </h2>

              {vinculados.length === 0 ? (
                <p className="mb-3 rounded-lg border border-dashed border-carvao-100 bg-white px-4 py-6 text-center text-xs text-carvao-500">
                  Nenhum procurador vinculado.
                </p>
              ) : (
                <ul className="mb-3 space-y-2">
                  {vinculados.map((parte) => (
                    <li
                      key={parte.id}
                      className="rounded-lg border border-carvao-100 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-carvao-700">
                            {equipe ? (
                              <Link
                                href={`/pessoas/${parte.pessoa.id}`}
                                className="hover:text-dourado-600"
                              >
                                {parte.pessoa.nome}
                              </Link>
                            ) : (
                              parte.pessoa.nome
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-carvao-500">
                            {parte.pessoa.tipoProcurador &&
                              ROTULO_TIPO_PROCURADOR[parte.pessoa.tipoProcurador]}
                            {parte.pessoa.oab && ` · OAB ${parte.pessoa.oab}`}
                            {parte.representa && ` · representa ${parte.representa.pessoa.nome}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Etiqueta>{ROTULO_PAPEL_NO_ATO[parte.papel]}</Etiqueta>
                          {equipe && (
                            <form action={removerParte}>
                              <input type="hidden" name="parteId" value={parte.id} />
                              <input type="hidden" name="atoId" value={ato.id} />
                              <button className="text-[11px] text-erro hover:underline">
                                Remover
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {equipe && disponiveis.length > 0 && (
                <FormularioDeVinculo
                  atoId={ato.id}
                  pessoas={disponiveis.map((p) => ({
                    id: p.id,
                    rotulo: `${p.nome} — ${formatarDocumento(p.documento)}`,
                  }))}
                  interessados={interessados.map((p) => ({
                    id: p.id,
                    rotulo: `${p.pessoa.nome} (${ROTULO_PAPEL_NO_ATO[p.papel]})`,
                  }))}
                />
              )}
            </section>

            {/* ---------------------------------------------- fluxo */}
            <SecaoDeFluxo ato={ato} equipe={equipe} />

            {/* ---------------------------------------------- documentos */}
            <SecaoDeDocumentos
              atoId={ato.id}
              documentos={ato.documentos.map((doc) => ({
                ...doc,
                assinatura: doc.emAssinatura
                  ? {
                      status: doc.emAssinatura.status,
                      totalSignatarios: doc.emAssinatura.totalSignatarios,
                      jaAssinaram: doc.emAssinatura.jaAssinaram,
                      temAssinado: Boolean(doc.emAssinatura.assinadoId),
                      ultimoErro: doc.emAssinatura.ultimoErro,
                    }
                  : null,
              }))}
              envios={ato.envios}
              interessados={interessados.map((p) => ({ id: p.pessoa.id, nome: p.pessoa.nome }))}
              equipe={equipe}
              assinaturaAtiva={assinaturaDigitalAtiva()}
            />

            {/* ---------------------------------------------- linha do tempo */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                Linha do tempo
              </h2>

              {equipe && <FormularioDeObservacao atoId={ato.id} />}

              <ol className="space-y-3 border-l border-carvao-100 pl-4">
                {ato.eventos.map((evento) => (
                  <li key={evento.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-dourado-600"
                    />
                    <p className="text-sm text-carvao-700">{evento.descricao}</p>
                    <p className="mt-0.5 text-[11px] text-carvao-300">
                      {formatarDataHora(evento.criadoEm)}
                      {evento.usuario && ` · ${evento.usuario.nome}`}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* ---------------------------------------------- painel lateral */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-carvao-100 bg-white p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                Agenda
              </h2>
              <dl className="space-y-2 text-xs">
                <Linha rotulo="Modalidade" valor={ROTULO_MODALIDADE[ato.modalidade]} />
                <Linha
                  rotulo={ato.dataConfirmada ? "Data confirmada" : "Data reservada"}
                  valor={formatarData(ato.dataConfirmada ?? ato.dataReservada)}
                />
                {!ato.dataConfirmada && (
                  <p className="rounded-md bg-atencao-bg px-2.5 py-2 leading-relaxed text-atencao">
                    Data provisória. Só é efetivada depois que a documentação for
                    conferida no passo 3.
                  </p>
                )}
              </dl>

              {equipe && podeAjustarAgenda && (
                <div className="mt-3 border-t border-carvao-100 pt-3">
                  <AgendaDoProcedimento
                    atoId={ato.id}
                    modalidade={ato.modalidade}
                    dataDaSessao={paraCampoDeDataHora(ato.dataConfirmada ?? ato.dataReservada)}
                    confirmada={ato.dataConfirmada !== null}
                  />
                </div>
              )}
            </div>

            {prazo && (
              <div className="rounded-lg border border-carvao-100 bg-white p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                  Prazo da documentação
                </h2>
                <p className="tabular text-sm font-medium text-carvao-700">
                  {formatarData(prazo)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {situacao === "vencido" ? (
                    <Etiqueta tom="encerrado">Vencido</Etiqueta>
                  ) : situacao === "vence_em_breve" ? (
                    <Etiqueta tom="atencao">
                      {restantes === 0 ? "Vence hoje" : `Faltam ${restantes} dias`}
                    </Etiqueta>
                  ) : (
                    <Etiqueta tom="sucesso">Faltam {restantes} dias</Etiqueta>
                  )}
                  {prazoProvisorio && <Etiqueta tom="atencao">Provisório</Etiqueta>}
                </div>

                {prazoProvisorio ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-carvao-500">
                    Contado da emissão. A carta conta os dias do{" "}
                    <strong>recebimento</strong>: registre a data do laudo de AR para
                    o prazo valer. Enquanto isso, não encerre o cadastro por perda de
                    prazo.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-carvao-500">
                    Contado da ciência em {formatarData(ato.dataCienciaSolicitante)}.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-lg border border-carvao-100 bg-white p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                Registro
              </h2>
              <dl className="space-y-2 text-xs">
                <Linha rotulo="Número" valor={ato.numero} />
                <Linha rotulo="Aberto em" valor={formatarData(ato.criadoEm)} />
                {equipe && <Linha rotulo="Aberto por" valor={ato.criadoPor.nome} />}
              </dl>
              {ato.observacoes && equipe && (
                <p className="mt-3 border-t border-carvao-100 pt-3 text-xs leading-relaxed text-carvao-500">
                  {ato.observacoes}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-carvao-300">{rotulo}</dt>
      <dd className="tabular text-right text-carvao-700">{valor}</dd>
    </div>
  );
}
