import Link from "next/link";
import { Papel, PapelNoAto, StatusAto } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { cn } from "@/lib/cn";
import { Etiqueta } from "@/components/ui/etiqueta";
import { listarAtos } from "@/lib/consultas";
import type { FiltrosDeAtos } from "@/lib/consultas-de-atos";
import { db } from "@/lib/db";
import { ROTULO_STATUS, TOM_DO_STATUS, formatarData } from "@/lib/formato";
import { situacaoDoPrazo } from "@/lib/prazos";
import { ESTADOS_FINAIS, exigirUsuario, filtroDeAtosVisiveis } from "@/lib/sessao";
import { PortalDoProcurador } from "./portal-do-procurador";

export const metadata = { title: "Painel — Consensus One" };

type FiltrosDaUrl = {
  busca?: string;
  situacao?: string;
  status?: string;
  dataDe?: string;
  dataAte?: string;
};

/** Monta a URL do próprio painel preservando os demais filtros ativos. */
function comFiltro(atual: FiltrosDaUrl, mudanca: Partial<FiltrosDaUrl>): string {
  const params = new URLSearchParams();
  const final = { ...atual, ...mudanca };
  if (final.situacao) params.set("situacao", final.situacao);
  if (final.status) params.set("status", final.status);
  if (final.dataDe) params.set("dataDe", final.dataDe);
  if (final.dataAte) params.set("dataAte", final.dataAte);
  const query = params.toString();
  return query ? `/painel?${query}` : "/painel";
}

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<FiltrosDaUrl>;
}) {
  const usuario = await exigirUsuario();
  const filtrosDaUrl = await searchParams;

  // O procurador tem tela própria, separada do portal do Interessado: ele
  // enxerga vários procedimentos e precisa saber quem representa em cada um.
  // Ver docs/10.
  if (usuario.papel === Papel.PROCURADOR && usuario.pessoaId) {
    return <PortalDoProcurador pessoaId={usuario.pessoaId} busca={filtrosDaUrl.busca} />;
  }

  const filtro = await filtroDeAtosVisiveis();

  // veio da URL: só entra se for um dos recortes que os cartões oferecem
  const situacao: FiltrosDeAtos["situacao"] =
    filtrosDaUrl.situacao === "em_andamento" || filtrosDaUrl.situacao === "prazo_vencido"
      ? filtrosDaUrl.situacao
      : undefined;
  const status =
    filtrosDaUrl.status && filtrosDaUrl.status in StatusAto
      ? (filtrosDaUrl.status as StatusAto)
      : undefined;

  const filtrosDaLista: FiltrosDeAtos = {
    situacao,
    status,
    dataDe: filtrosDaUrl.dataDe,
    dataAte: filtrosDaUrl.dataAte,
  };
  const filtroAtivo = Boolean(situacao || status || filtrosDaUrl.dataDe || filtrosDaUrl.dataAte);

  const [emAndamento, aguardando, total, recentes, listaFiltrada] = await Promise.all([
    db.ato.count({ where: { AND: [filtro, { status: { notIn: ESTADOS_FINAIS } }] } }),
    db.ato.count({ where: { AND: [filtro, { status: StatusAto.AGUARDANDO_DOCUMENTACAO }] } }),
    db.ato.count({ where: filtro }),
    // não filtrado: alimenta "Próxima ação" e "Prazo vencido", que precisam
    // continuar valendo para todo o acervo, mesmo com um filtro aplicado na
    // lista abaixo
    listarAtos({}),
    filtroAtivo ? listarAtos(filtrosDaLista) : Promise.resolve(null),
  ]);

  const listaExibida = listaFiltrada ?? recentes;

  const equipe = usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR;

  // prazo vencido só interessa a quem conduz o fluxo
  const vencidos = equipe
    ? recentes.filter(
        (a) =>
          a.prazoDocumentacaoAte &&
          !ESTADOS_FINAIS.includes(a.status) &&
          situacaoDoPrazo(a.prazoDocumentacaoAte) === "vencido"
      )
    : [];

  const acaoPrioritaria = equipe
    ? vencidos[0] ??
      recentes.find((a) => a.status === StatusAto.AGUARDANDO_DOCUMENTACAO) ??
      recentes.find((a) => a.status === StatusAto.DATA_CONFIRMADA) ??
      recentes[0] ??
      null
    : null;

  return (
    <>
      <CabecalhoDePagina
        titulo={equipe ? "Painel" : "Meus procedimentos"}
        descricao={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        })}
        acao={
          equipe ? (
            <Link
              href="/atos/novo"
              className="rounded-md bg-grafite-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-grafite-500"
            >
              Novo procedimento
            </Link>
          ) : undefined
        }
      />

      <div className="flex-1 p-4 md:p-6">
        {acaoPrioritaria && (
          <div className="mb-4 rounded-lg border border-dourado-200 bg-dourado-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-dourado-700">
              Próxima ação
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Link href={`/atos/${acaoPrioritaria.id}`} className="text-sm font-medium text-carvao-700 hover:text-dourado-600">
                {acaoPrioritaria.numero}
              </Link>
              <Etiqueta tom={TOM_DO_STATUS[acaoPrioritaria.status]}>
                {ROTULO_STATUS[acaoPrioritaria.status]}
              </Etiqueta>
            </div>
            <p className="mt-2 text-xs text-carvao-600">
              {acaoPrioritaria.status === StatusAto.AGUARDANDO_DOCUMENTACAO
                ? "Conferir documentação e liberar a data da sessão."
                : acaoPrioritaria.status === StatusAto.DATA_CONFIRMADA
                  ? "Emitir a Carta-Convite ao Interessado Convidado."
                  : vencidos.length > 0
                    ? "Revisar prazo vencido e ajustar a condução do procedimento."
                    : "Acompanhar o procedimento mais recente e avançar para o próximo passo."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Cartao
            numero={emAndamento}
            rotulo="Em andamento"
            href={comFiltro(filtrosDaUrl, { situacao: "em_andamento", status: undefined })}
            ativo={situacao === "em_andamento"}
          />
          <Cartao
            numero={aguardando}
            rotulo="Aguardando documentação"
            destaque
            href={comFiltro(filtrosDaUrl, {
              status: StatusAto.AGUARDANDO_DOCUMENTACAO,
              situacao: undefined,
            })}
            ativo={status === StatusAto.AGUARDANDO_DOCUMENTACAO}
          />
          <Cartao
            numero={total}
            rotulo="Total de procedimentos"
            href={comFiltro(filtrosDaUrl, { situacao: undefined, status: undefined })}
            ativo={!situacao && !status}
          />
          {equipe && (
            <Cartao
              numero={vencidos.length}
              rotulo="Prazo vencido"
              alerta
              href={comFiltro(filtrosDaUrl, { situacao: "prazo_vencido", status: undefined })}
              ativo={situacao === "prazo_vencido"}
            />
          )}
        </div>

        {vencidos.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-erro">
              Prazo de documentação vencido
            </h2>
            <ul className="space-y-2">
              {vencidos.map((ato) => (
                <li key={ato.id}>
                  <Link
                    href={`/atos/${ato.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-erro/20 bg-erro-bg px-4 py-3 hover:border-erro"
                  >
                    <span className="tabular text-sm font-medium text-carvao-700">
                      {ato.numero}
                    </span>
                    <span className="tabular text-xs text-erro">
                      venceu em {formatarData(ato.prazoDocumentacaoAte)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
              Procedimentos recentes
            </h2>
            <div className="flex items-center gap-3">
              {filtroAtivo && (
                <Link href="/painel" className="text-xs text-carvao-500 hover:underline">
                  Limpar filtros
                </Link>
              )}
              <Link href="/atos" className="text-xs text-dourado-600 hover:underline">
                Ver todos
              </Link>
            </div>
          </div>

          <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
            {situacao && <input type="hidden" name="situacao" value={situacao} />}
            {status && <input type="hidden" name="status" value={status} />}
            <label className="text-xs text-carvao-500">
              De
              <input
                type="date"
                name="dataDe"
                defaultValue={filtrosDaUrl.dataDe ?? ""}
                className="mt-1 block rounded-md border border-carvao-100 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-grafite-500"
              />
            </label>
            <label className="text-xs text-carvao-500">
              Até
              <input
                type="date"
                name="dataAte"
                defaultValue={filtrosDaUrl.dataAte ?? ""}
                className="mt-1 block rounded-md border border-carvao-100 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-grafite-500"
              />
            </label>
            <button className="rounded-md border border-carvao-100 bg-white px-3 py-1.5 text-xs font-medium text-grafite-700 hover:border-dourado-600">
              Filtrar por data
            </button>
            {(filtrosDaUrl.dataDe || filtrosDaUrl.dataAte) && (
              <Link
                href={comFiltro(filtrosDaUrl, { dataDe: undefined, dataAte: undefined })}
                className="text-xs text-carvao-500 hover:underline"
              >
                Limpar data
              </Link>
            )}
          </form>

          {listaExibida.length === 0 ? (
            <p className="rounded-lg border border-dashed border-carvao-100 bg-white px-4 py-8 text-center text-xs text-carvao-500">
              {filtroAtivo
                ? "Nenhum procedimento encontrado com os filtros aplicados."
                : equipe
                  ? "Nenhum procedimento aberto ainda."
                  : "Seus procedimentos aparecem aqui após a realização da sessão."}
            </p>
          ) : (
            <ul className="space-y-2">
              {listaExibida.slice(0, 8).map((ato) => (
                <li key={ato.id}>
                  <Link
                    href={"/atos/" + ato.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-carvao-100 bg-white px-4 py-3 hover:border-dourado-600"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-carvao-700">
                        {ato.titulo ?? ato.numero}
                      </span>
                      <span className="block truncate text-[11px] text-carvao-300">
                        {ato.titulo && <span className="tabular">{ato.numero} · </span>}
                        {envolvidos(ato.partes)}
                      </span>
                    </span>
                    <span className="tabular text-xs text-carvao-500">
                      {formatarData(ato.dataConfirmada ?? ato.dataReservada)}
                    </span>
                    <Etiqueta tom={TOM_DO_STATUS[ato.status]}>
                      {ROTULO_STATUS[ato.status]}
                    </Etiqueta>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Cartao({
  numero,
  rotulo,
  destaque,
  alerta,
  href,
  ativo,
}: {
  numero: number;
  rotulo: string;
  destaque?: boolean;
  alerta?: boolean;
  /** Quando informado, o cartão filtra a lista de "Procedimentos recentes" aqui mesmo. */
  href?: string;
  /** Recorte que está sendo mostrado agora na lista abaixo. */
  ativo?: boolean;
}) {
  const cor = alerta && numero > 0 ? "text-erro" : destaque ? "text-dourado-600" : "text-preto-900";

  const conteudo = (
    <>
      <p className={cn("text-2xl font-semibold", cor)}>{numero}</p>
      <p className="mt-0.5 text-[11px] text-carvao-500">{rotulo}</p>
    </>
  );

  const moldura = "rounded-lg border bg-white p-4";

  if (!href) return <div className={cn(moldura, "border-carvao-100")}>{conteudo}</div>;

  return (
    <Link
      href={href}
      className={cn(
        moldura,
        "block transition-colors",
        ativo ? "border-dourado-600 ring-1 ring-dourado-600" : "border-carvao-100 hover:border-dourado-600"
      )}
    >
      {conteudo}
    </Link>
  );
}

/**
 * Quem são os Interessados, para a linha do painel dizer de quem é o
 * procedimento — antes só aparecia o número, e o operador tinha que abrir cada
 * um para saber. Pedido do cliente em 24/08.
 */
function envolvidos(partes: { papel: PapelNoAto; pessoa: { nome: string } }[]): string {
  const nome = (papel: PapelNoAto) => partes.find((p) => p.papel === papel)?.pessoa.nome;
  const solicitante = nome(PapelNoAto.SOLICITANTE);
  const convidado = nome(PapelNoAto.CONVIDADO);
  return [solicitante, convidado].filter(Boolean).join(" × ") || "sem partes vinculadas";
}
