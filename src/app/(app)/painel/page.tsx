import Link from "next/link";
import { Papel, PapelNoAto, StatusAto } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { cn } from "@/lib/cn";
import { Etiqueta } from "@/components/ui/etiqueta";
import { listarAtos } from "@/lib/consultas";
import { db } from "@/lib/db";
import { ROTULO_STATUS, TOM_DO_STATUS, formatarData } from "@/lib/formato";
import { situacaoDoPrazo } from "@/lib/prazos";
import { ESTADOS_FINAIS, exigirUsuario, filtroDeAtosVisiveis } from "@/lib/sessao";
import { PortalDoProcurador } from "./portal-do-procurador";

export const metadata = { title: "Painel — Consensus One" };

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const usuario = await exigirUsuario();

  // O procurador tem tela própria, separada do portal do Interessado: ele
  // enxerga vários procedimentos e precisa saber quem representa em cada um.
  // Ver docs/10.
  if (usuario.papel === Papel.PROCURADOR && usuario.pessoaId) {
    const { busca } = await searchParams;
    return <PortalDoProcurador pessoaId={usuario.pessoaId} busca={busca} />;
  }

  const filtro = await filtroDeAtosVisiveis();

  const [emAndamento, aguardando, total, recentes] = await Promise.all([
    db.ato.count({ where: { AND: [filtro, { status: { notIn: ESTADOS_FINAIS } }] } }),
    db.ato.count({ where: { AND: [filtro, { status: StatusAto.AGUARDANDO_DOCUMENTACAO }] } }),
    db.ato.count({ where: filtro }),
    listarAtos({}),
  ]);

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
            href="/atos?situacao=em_andamento"
          />
          <Cartao
            numero={aguardando}
            rotulo="Aguardando documentação"
            destaque
            href={"/atos?status=" + StatusAto.AGUARDANDO_DOCUMENTACAO}
          />
          <Cartao numero={total} rotulo="Total de procedimentos" href="/atos" />
          {equipe && (
            <Cartao
              numero={vencidos.length}
              rotulo="Prazo vencido"
              alerta
              href="/atos?situacao=prazo_vencido"
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-carvao-500">
              Procedimentos recentes
            </h2>
            <Link href="/atos" className="text-xs text-dourado-600 hover:underline">
              Ver todos
            </Link>
          </div>

          {recentes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-carvao-100 bg-white px-4 py-8 text-center text-xs text-carvao-500">
              {equipe
                ? "Nenhum procedimento aberto ainda."
                : "Seus procedimentos aparecem aqui após a realização da sessão."}
            </p>
          ) : (
            <ul className="space-y-2">
              {recentes.slice(0, 8).map((ato) => (
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
}: {
  numero: number;
  rotulo: string;
  destaque?: boolean;
  alerta?: boolean;
  /** Quando informado, o cartão leva à listagem já filtrada. */
  href?: string;
}) {
  const cor = alerta && numero > 0 ? "text-erro" : destaque ? "text-dourado-600" : "text-preto-900";

  const conteudo = (
    <>
      <p className={cn("text-2xl font-semibold", cor)}>{numero}</p>
      <p className="mt-0.5 text-[11px] text-carvao-500">{rotulo}</p>
    </>
  );

  const moldura = "rounded-lg border border-carvao-100 bg-white p-4";

  if (!href) return <div className={moldura}>{conteudo}</div>;

  return (
    <Link
      href={href}
      className={cn(moldura, "block transition-colors hover:border-dourado-600")}
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
