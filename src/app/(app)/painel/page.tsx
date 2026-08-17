import Link from "next/link";
import { Papel, StatusAto } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Etiqueta } from "@/components/ui/etiqueta";
import { listarAtos } from "@/lib/consultas";
import { db } from "@/lib/db";
import { ROTULO_STATUS, TOM_DO_STATUS, formatarData } from "@/lib/formato";
import { situacaoDoPrazo } from "@/lib/prazos";
import { ESTADOS_FINAIS, exigirUsuario, filtroDeAtosVisiveis } from "@/lib/sessao";

export const metadata = { title: "Painel — Consensus One" };

export default async function Painel() {
  const usuario = await exigirUsuario();
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Cartao numero={emAndamento} rotulo="Em andamento" />
          <Cartao numero={aguardando} rotulo="Aguardando documentação" destaque />
          <Cartao numero={total} rotulo="Total de procedimentos" />
          {equipe && <Cartao numero={vencidos.length} rotulo="Prazo vencido" alerta />}
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
                    href={`/atos/${ato.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-carvao-100 bg-white px-4 py-3 hover:border-dourado-600"
                  >
                    <span className="tabular text-sm font-medium text-carvao-700">
                      {ato.numero}
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
}: {
  numero: number;
  rotulo: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  const cor = alerta && numero > 0 ? "text-erro" : destaque ? "text-dourado-600" : "text-preto-900";
  return (
    <div className="rounded-lg border border-carvao-100 bg-white p-4">
      <p className={`text-2xl font-semibold ${cor}`}>{numero}</p>
      <p className="mt-0.5 text-[11px] text-carvao-500">{rotulo}</p>
    </div>
  );
}
