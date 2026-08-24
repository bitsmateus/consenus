import Link from "next/link";
import { Papel, PapelNoAto, StatusAto } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta } from "@/components/ui/etiqueta";
import {
  contarPorInteressado,
  contarPorProcurador,
  contarPorStatus,
  listarAtos,
} from "@/lib/consultas";
import type { FiltrosDeAtos } from "@/lib/consultas-de-atos";
import { formatarDocumento } from "@/lib/documentos";
import {
  ROTULO_STATUS,
  ROTULO_TIPO_PROCURADOR,
  TOM_DO_STATUS,
  formatarData,
} from "@/lib/formato";
import { exigirUsuario } from "@/lib/sessao";

export const metadata = { title: "Procedimentos — Consensus One" };

type Busca = {
  busca?: string;
  status?: string;
  procurador?: string;
  interessado?: string;
  situacao?: string;
};

/** Monta a query string preservando os demais filtros. */
function comFiltro(atual: Busca, mudanca: Partial<Busca>): string {
  const params = new URLSearchParams();
  const final = { ...atual, ...mudanca };
  if (final.busca) params.set("busca", final.busca);
  if (final.status) params.set("status", final.status);
  if (final.procurador) params.set("procurador", final.procurador);
  if (final.interessado) params.set("interessado", final.interessado);
  if (final.situacao) params.set("situacao", final.situacao);
  const query = params.toString();
  return query ? `/atos?${query}` : "/atos";
}

export default async function PaginaDeAtos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const usuario = await exigirUsuario();
  const filtrosDaUrl = await searchParams;

  const status =
    filtrosDaUrl.status && filtrosDaUrl.status in StatusAto
      ? (filtrosDaUrl.status as StatusAto)
      : undefined;

  // veio da URL: só entra se for um dos recortes que o painel usa
  const situacao: FiltrosDeAtos["situacao"] =
    filtrosDaUrl.situacao === "em_andamento" || filtrosDaUrl.situacao === "prazo_vencido"
      ? filtrosDaUrl.situacao
      : undefined;

  const filtros = {
    busca: filtrosDaUrl.busca,
    status,
    procuradorId: filtrosDaUrl.procurador,
    interessadoId: filtrosDaUrl.interessado,
    situacao,
  };

  const [atos, porStatus, procuradores, interessados] = await Promise.all([
    listarAtos(filtros),
    contarPorStatus(filtros),
    contarPorProcurador(filtros),
    contarPorInteressado(filtros),
  ]);

  const equipe = usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR;

  return (
    <>
      <CabecalhoDePagina
        titulo="Procedimentos"
        descricao="Procedimento Privado de Composição Consensual"
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
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {filtrosDaUrl.procurador && (
            <input type="hidden" name="procurador" value={filtrosDaUrl.procurador} />
          )}
          {filtrosDaUrl.interessado && (
            <input type="hidden" name="interessado" value={filtrosDaUrl.interessado} />
          )}
          {situacao && <input type="hidden" name="situacao" value={situacao} />}
          <input
            name="busca"
            defaultValue={filtrosDaUrl.busca ?? ""}
            placeholder="Número, nome, CPF, CNPJ ou OAB"
            aria-label="Buscar procedimento"
            className="min-w-0 flex-1 rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
          />
          <button className="rounded-md border border-carvao-100 bg-white px-4 py-2.5 text-sm font-medium text-grafite-700 hover:border-dourado-600">
            Buscar
          </button>
        </form>

        {/* filtro por situação */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip href={comFiltro(filtrosDaUrl, { status: undefined })} ativo={!status}>
            Todos
          </Chip>
          {Object.entries(porStatus).map(([chave, total]) => (
            <Chip
              key={chave}
              href={comFiltro(filtrosDaUrl, { status: chave })}
              ativo={status === chave}
            >
              {ROTULO_STATUS[chave as StatusAto]} · {total}
            </Chip>
          ))}
        </div>

        {/* filtro por procurador, com contagem por representante (docs/10) */}
        {procuradores.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-carvao-300">
              Por procurador
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                href={comFiltro(filtrosDaUrl, { procurador: undefined })}
                ativo={!filtrosDaUrl.procurador}
              >
                Todos
              </Chip>
              {procuradores.map((p) => (
                <Chip
                  key={p.id}
                  href={comFiltro(filtrosDaUrl, { procurador: p.id })}
                  ativo={filtrosDaUrl.procurador === p.id}
                  titulo={p.tipoProcurador ? ROTULO_TIPO_PROCURADOR[p.tipoProcurador] : undefined}
                >
                  {p.nome} · {p.total}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* filtro por Interessado — pedido do cliente em 24/08 */}
        {interessados.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-carvao-300">
              Por interessado
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                href={comFiltro(filtrosDaUrl, { interessado: undefined })}
                ativo={!filtrosDaUrl.interessado}
              >
                Todos
              </Chip>
              {interessados.map((p) => (
                <Chip
                  key={p.id}
                  href={comFiltro(filtrosDaUrl, { interessado: p.id })}
                  ativo={filtrosDaUrl.interessado === p.id}
                  titulo={formatarDocumento(p.documento)}
                >
                  {p.nome} · {p.total}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {atos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum procedimento encontrado"
            descricao={
              filtrosDaUrl.busca || status || filtrosDaUrl.procurador
                ? "Nenhum resultado com os filtros aplicados."
                : equipe
                  ? "Comece cadastrando os Interessados e abrindo o primeiro procedimento."
                  : "Os procedimentos aparecem aqui após a realização da sessão."
            }
          />
        ) : (
          <ul className="space-y-2">
            {atos.map((ato) => {
              const solicitante = ato.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
              const convidado = ato.partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
              const procuradoresDoAto = ato.partes.filter(
                (p) => p.papel === PapelNoAto.PROCURADOR
              );

              return (
                <li key={ato.id}>
                  <Link
                    href={`/atos/${ato.id}`}
                    className="block rounded-lg border border-carvao-100 bg-white p-4 transition-colors hover:border-dourado-600"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        {ato.titulo ? (
                          <>
                            <span className="block truncate text-sm font-semibold text-preto-900">
                              {ato.titulo}
                            </span>
                            <span className="tabular text-[11px] text-carvao-300">
                              {ato.numero}
                            </span>
                          </>
                        ) : (
                          <span className="tabular text-sm font-semibold text-preto-900">
                            {ato.numero}
                          </span>
                        )}
                      </div>
                      <Etiqueta tom={TOM_DO_STATUS[ato.status]}>
                        {ROTULO_STATUS[ato.status]}
                      </Etiqueta>
                    </div>

                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-carvao-300">Solicitante:</dt>
                        <dd className="truncate text-carvao-700">
                          {solicitante?.pessoa.nome ?? "—"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-carvao-300">Convidado:</dt>
                        <dd className="truncate text-carvao-700">
                          {convidado?.pessoa.nome ?? "—"}
                        </dd>
                      </div>
                      {procuradoresDoAto.length > 0 && (
                        <div className="flex gap-1.5 sm:col-span-2">
                          <dt className="shrink-0 text-carvao-300">Procurador:</dt>
                          <dd className="truncate text-carvao-700">
                            {procuradoresDoAto.map((p) => p.pessoa.nome).join(", ")}
                          </dd>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-carvao-300">Sessão:</dt>
                        <dd className="tabular text-carvao-700">
                          {formatarData(ato.dataConfirmada ?? ato.dataReservada)}
                          {!ato.dataConfirmada && (
                            <span className="ml-1 text-carvao-300">(reservada)</span>
                          )}
                        </dd>
                      </div>
                      {solicitante && (
                        <div className="flex gap-1.5">
                          <dt className="shrink-0 text-carvao-300">Documento:</dt>
                          <dd className="tabular text-carvao-700">
                            {formatarDocumento(solicitante.pessoa.documento)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function Chip({
  href,
  ativo,
  titulo,
  children,
}: {
  href: string;
  ativo?: boolean;
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={titulo}
      className={
        ativo
          ? "rounded-full bg-grafite-700 px-3 py-1.5 text-[11px] font-medium text-white"
          : "rounded-full border border-carvao-100 bg-white px-3 py-1.5 text-[11px] text-carvao-500 hover:border-dourado-600"
      }
    >
      {children}
    </Link>
  );
}
