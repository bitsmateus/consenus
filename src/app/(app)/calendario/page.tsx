import Link from "next/link";
import { PapelNoAto, Papel, StatusAto } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta } from "@/components/ui/etiqueta";
import {
  diaCivil,
  diasBloqueadosDoAno,
  diasDoMes,
  interpretarMes,
  intervaloDoMes,
  mesVizinho,
  motivoDoDiaBloqueado,
  resumoDasRegras,
  textoDoMes,
  type DiaExtra,
  type RegrasDaAgenda,
} from "@/lib/agenda";
import { ESTADOS_FINAIS } from "@/lib/autorizacao";
import { configuracaoDoSistema } from "@/lib/configuracao";
import { listarCompromissos } from "@/lib/consultas";
import { db } from "@/lib/db";
import {
  ROTULO_MODALIDADE,
  ROTULO_PAPEL_NO_ATO,
  ROTULO_STATUS,
  TOM_DO_STATUS,
  formatarData,
  formatarRepresentantes,
  paraCampoDeDataHora,
} from "@/lib/formato";
import { FUSO } from "@/lib/prazos";
import { exigirEquipe } from "@/lib/sessao";
import { temAcessoCompleto } from "@/lib/permissoes";
import { AgendaDoProcedimento } from "../atos/[id]/agenda";
import { DetalhesDoCompromisso } from "./detalhes";
import { DiasSemSessao } from "./dias-sem-sessao";

export const metadata = { title: "Calendário — Consensus One" };

const DIAS_DA_SEMANA_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function hora(instante: Date): string {
  return formatInTimeZone(instante, FUSO, "HH:mm");
}

function tituloDoMes(ano: number, mes: number): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 15)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function tituloDoDia(dia: string): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dia}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function PaginaDoCalendario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const usuario = await exigirEquipe();
  const { mes: mesInformado } = await searchParams;

  const hoje = new Date();
  const { ano, mes } = interpretarMes(mesInformado, hoje);
  const { de, ate } = intervaloDoMes(ano, mes);
  const anterior = mesVizinho(ano, mes, -1);
  const proximo = mesVizinho(ano, mes, 1);
  const hojeMes = interpretarMes(undefined, hoje);
  const mesDeHoje = textoDoMes(hojeMes.ano, hojeMes.mes);

  const [compromissos, config, diasCadastrados] = await Promise.all([
    listarCompromissos(de, ate),
    configuracaoDoSistema(),
    db.diaSemSessao.findMany({ orderBy: { data: "asc" } }),
  ]);

  const regras: RegrasDaAgenda = {
    inicio: config.agendaInicio,
    fim: config.agendaFim,
    almocoInicio: config.almocoInicio,
    almocoFim: config.almocoFim,
    duracaoMinutos: config.duracaoSessaoMinutos,
  };
  const extras: DiaExtra[] = diasCadastrados.map((d) => ({
    data: d.data.toISOString().slice(0, 10),
    descricao: d.descricao,
  }));

  const dias = diasDoMes(ano, mes);
  const porDia = new Map<string, typeof compromissos>();
  for (const compromisso of compromissos) {
    const chave = diaCivil(compromisso.inicio);
    porDia.set(chave, [...(porDia.get(chave) ?? []), compromisso]);
  }
  const diasComSessao = dias.filter((d) => porDia.has(d.dia));

  const feriadosDoMes = dias
    .map((d) => ({ dia: d.dia, feriado: diasBloqueadosDoAno(ano).get(d.dia) }))
    .filter((d) => d.feriado);

  const admin = usuario.papel === Papel.ADMIN;
  const podeEditar = temAcessoCompleto(usuario);
  const resumo = resumoDasRegras(regras);

  return (
    <>
      <CabecalhoDePagina
        titulo="Calendário"
        descricao="Sessões marcadas, com acesso direto ao procedimento"
      />

      <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/calendario?mes=${textoDoMes(anterior.ano, anterior.mes)}`}
              aria-label="Mês anterior"
              className="rounded-md border border-carvao-100 bg-white px-3 py-2 text-sm hover:border-dourado-600"
            >
              ←
            </Link>
            <h2 className="min-w-40 text-center text-base font-semibold text-carvao-700">
              {tituloDoMes(ano, mes)}
            </h2>
            <Link
              href={`/calendario?mes=${textoDoMes(proximo.ano, proximo.mes)}`}
              aria-label="Próximo mês"
              className="rounded-md border border-carvao-100 bg-white px-3 py-2 text-sm hover:border-dourado-600"
            >
              →
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-carvao-500">
              {compromissos.length === 1 ? "1 sessão" : `${compromissos.length} sessões`} no mês
            </span>
            {textoDoMes(ano, mes) !== mesDeHoje && (
              <Link
                href="/calendario"
                className="rounded-md border border-carvao-100 bg-white px-3 py-2 text-xs font-medium text-grafite-700 hover:border-dourado-600"
              >
                Hoje
              </Link>
            )}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-carvao-500">{resumo}</p>

        {/* quadro do mês: só a partir de md; no celular a lista abaixo basta */}
        <div className="hidden overflow-hidden rounded-lg border border-carvao-100 bg-white md:block">
          <div className="grid grid-cols-7 border-b border-carvao-100 bg-carvao-100/30">
            {DIAS_DA_SEMANA_CURTOS.map((nome) => (
              <div
                key={nome}
                className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-carvao-500"
              >
                {nome}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: dias[0]?.diaDaSemana ?? 0 }, (_, i) => (
              <div key={`vazio-${i}`} className="min-h-24 border-b border-r border-carvao-100/60 bg-carvao-100/20" />
            ))}
            {dias.map(({ dia }) => {
              const bloqueio = motivoDoDiaBloqueado(dia, extras);
              const sessoes = porDia.get(dia) ?? [];
              const ehHoje = dia === diaCivil(hoje);
              return (
                <div
                  key={dia}
                  className={
                    "min-h-24 border-b border-r border-carvao-100/60 p-1.5 " +
                    (bloqueio ? "bg-carvao-100/40" : "bg-white")
                  }
                >
                  <div className="mb-1 flex items-start justify-between gap-1">
                    <span
                      className={
                        "tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] " +
                        (ehHoje ? "bg-grafite-700 font-semibold text-white" : "text-carvao-700")
                      }
                    >
                      {Number(dia.slice(8))}
                    </span>
                    {bloqueio && !/^(sábado|domingo)$/.test(bloqueio) && (
                      <span
                        title={bloqueio}
                        className="truncate text-[9px] leading-tight text-carvao-300"
                      >
                        {bloqueio.replace(/^[^—]+— /, "")}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {sessoes.slice(0, 4).map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#c-${s.id}`}
                          className="tabular block truncate rounded bg-dourado-100 px-1 py-0.5 text-[10px] text-dourado-600 hover:bg-dourado-200"
                        >
                          {hora(s.inicio)} · {s.numero}
                        </a>
                      </li>
                    ))}
                    {sessoes.length > 4 && (
                      <li className="px-1 text-[10px] text-carvao-500">+{sessoes.length - 4} sessões</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Sessões de {tituloDoMes(ano, mes)}
          </h2>

          {compromissos.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma sessão neste mês"
              descricao="As sessões aparecem aqui assim que o procedimento é aberto ou a data é alterada."
            />
          ) : (
            <div className="space-y-6">
              {diasComSessao.map(({ dia }) => (
                <div key={dia}>
                  <h3 className="mb-2 text-sm font-semibold text-carvao-700">
                    {tituloDoDia(dia)}
                  </h3>
                  <ul className="space-y-2">
                    {(porDia.get(dia) ?? []).map((s) => {
                      const solicitante = s.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
                      const convidado = s.partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
                      const procuradoresDe = (parteId: string | undefined) =>
                        formatarRepresentantes(
                          s.partes
                            .filter((p) => p.papel === PapelNoAto.PROCURADOR && p.representaId === parteId)
                            .map((p) => p.pessoa)
                        );
                      const editavel =
                        podeEditar &&
                        !ESTADOS_FINAIS.includes(s.status) &&
                        s.status !== StatusAto.SESSAO_REALIZADA;
                      const fim = new Date(s.inicio.getTime() + config.duracaoSessaoMinutos * 60_000);

                      return (
                        <li key={s.id}>
                          <DetalhesDoCompromisso
                            id={`c-${s.id}`}
                            resumo={
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-carvao-700">
                                    <span className="tabular mr-2 text-dourado-600">
                                      {hora(s.inicio)}–{hora(fim)}
                                    </span>
                                    {s.titulo ?? `Procedimento ${s.numero}`}
                                  </p>
                                  <p className="mt-0.5 text-xs text-carvao-500">
                                    <span className="tabular">{s.numero}</span>
                                    {solicitante && convidado && (
                                      <>
                                        {" · "}
                                        {solicitante.pessoa.nome} x {convidado.pessoa.nome}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Etiqueta>{ROTULO_MODALIDADE[s.modalidade]}</Etiqueta>
                                  <Etiqueta tom={TOM_DO_STATUS[s.status]}>{ROTULO_STATUS[s.status]}</Etiqueta>
                                </div>
                              </div>
                            }
                          >
                            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                              <Info rotulo="Data da sessão">
                                {formatarData(s.inicio)}, das {hora(s.inicio)} às {hora(fim)}{" "}
                                <span className="text-carvao-300">
                                  ({s.dataConfirmada ? "confirmada" : "reservada, ainda não confirmada"})
                                </span>
                              </Info>
                              <Info rotulo="Modalidade">{ROTULO_MODALIDADE[s.modalidade]}</Info>
                              {s.modalidade !== "PRESENCIAL" && (
                                <Info rotulo="Videoconferência">
                                  {s.linkVideoconferencia ? (
                                    <>
                                      <span className="break-all">{s.linkVideoconferencia}</span>
                                      <br />
                                      ID {s.idReuniao ?? "—"} · senha {s.senhaReuniao ?? "—"}
                                    </>
                                  ) : (
                                    "Sala ainda não criada"
                                  )}
                                </Info>
                              )}
                              {s.modalidade !== "VIDEOCONFERENCIA" && (
                                <Info rotulo="Local">{s.localPresencial ?? "A ser informado"}</Info>
                              )}
                              {solicitante && (
                                <Info rotulo={ROTULO_PAPEL_NO_ATO.SOLICITANTE}>
                                  {solicitante.pessoa.nome}
                                  {procuradoresDe(solicitante.id) && (
                                    <span className="block text-carvao-500">
                                      Representado(a) por: {procuradoresDe(solicitante.id)}
                                    </span>
                                  )}
                                </Info>
                              )}
                              {convidado && (
                                <Info rotulo={ROTULO_PAPEL_NO_ATO.CONVIDADO}>
                                  {convidado.pessoa.nome}
                                  {procuradoresDe(convidado.id) && (
                                    <span className="block text-carvao-500">
                                      Representado(a) por: {procuradoresDe(convidado.id)}
                                    </span>
                                  )}
                                </Info>
                              )}
                              {s.objeto && <Info rotulo="Objeto">{s.objeto}</Info>}
                              {s.prazoDocumentacaoAte && (
                                <Info rotulo="Prazo da documentação">
                                  {formatarData(s.prazoDocumentacaoAte)}
                                </Info>
                              )}
                              {s.observacoes && <Info rotulo="Observações internas">{s.observacoes}</Info>}
                            </dl>

                            <div className="mt-4 flex flex-wrap items-start gap-4 border-t border-carvao-100 pt-4">
                              <Link
                                href={`/atos/${s.id}`}
                                className="rounded-md bg-grafite-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-grafite-500"
                              >
                                Abrir procedimento
                              </Link>
                              {editavel && (
                                <div className="min-w-0 flex-1 basis-72">
                                  <AgendaDoProcedimento
                                    atoId={s.id}
                                    modalidade={s.modalidade}
                                    localPresencial={s.localPresencial}
                                    dataDaSessao={paraCampoDeDataHora(s.inicio)}
                                    confirmada={s.dataConfirmada !== null}
                                    regras={resumo}
                                  />
                                </div>
                              )}
                            </div>
                          </DetalhesDoCompromisso>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {feriadosDoMes.length > 0 && (
          <section className="rounded-lg border border-carvao-100 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-carvao-500">
              Sem sessão neste mês, além de fim de semana
            </h2>
            <ul className="space-y-1 text-xs text-carvao-700">
              {feriadosDoMes.map(({ dia, feriado }) => (
                <li key={dia}>
                  <span className="tabular font-medium">{dia.slice(8)}/{dia.slice(5, 7)}</span> ·{" "}
                  {feriado!.descricao}{" "}
                  <span className="text-carvao-300">
                    ({feriado!.tipo === "FERIADO" ? "feriado" : "ponto facultativo"})
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {admin && (
          <DiasSemSessao
            dias={diasCadastrados.map((d) => ({
              id: d.id,
              dataFormatada: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d.data),
              descricao: d.descricao,
            }))}
          />
        )}
      </div>
    </>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-carvao-300">
        {rotulo}
      </dt>
      <dd className="leading-relaxed text-carvao-700">{children}</dd>
    </div>
  );
}
