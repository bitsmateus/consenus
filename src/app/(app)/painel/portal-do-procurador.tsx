import Link from "next/link";
import { PapelNoAto } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { db } from "@/lib/db";
import { formatarDocumento } from "@/lib/documentos";
import { ROTULO_PAPEL_NO_ATO, ROTULO_STATUS, TOM_DO_STATUS, formatarData } from "@/lib/formato";
import { montarFiltroDeAtos } from "@/lib/autorizacao";

/**
 * Portal do procurador — docs/10.
 *
 * Mostra todos os procedimentos em que ele representa alguém, com contadores por
 * posição e busca pelo representado. A regra de liberação continua valendo: o
 * filtro de autorização só devolve procedimento com sessão realizada.
 * Representar não antecipa acesso.
 */
export async function PortalDoProcurador({
  pessoaId,
  busca,
}: {
  pessoaId: string;
  busca?: string;
}) {
  const visiveis = montarFiltroDeAtos({ papel: "PROCURADOR", pessoaId });

  const atos = await db.ato.findMany({
    where: visiveis,
    orderBy: { dataConfirmada: "desc" },
    include: {
      partes: {
        include: {
          pessoa: { select: { id: true, nome: true, documento: true } },
          representa: { include: { pessoa: { select: { nome: true, documento: true } } } },
        },
      },
    },
  });

  /** Para cada procedimento, quem este procurador representa e de que lado. */
  const linhas = atos.map((ato) => {
    const meuVinculo = ato.partes.find(
      (p) => p.pessoaId === pessoaId && p.papel === PapelNoAto.PROCURADOR
    );
    const representado = meuVinculo?.representa;
    return {
      id: ato.id,
      numero: ato.numero,
      status: ato.status,
      data: ato.dataConfirmada ?? ato.dataReservada,
      representado: representado?.pessoa.nome ?? "—",
      documento: representado?.pessoa.documento ?? "",
      posicao: representado?.papel ?? null,
    };
  });

  const termo = busca?.trim().toLowerCase();
  const digitos = termo?.replace(/\D/g, "") ?? "";
  const filtradas = termo
    ? linhas.filter(
        (l) =>
          l.representado.toLowerCase().includes(termo) ||
          // só compara documento quando o termo tem dígitos: includes("") é
          // sempre verdadeiro e faria a busca por texto casar com tudo
          (digitos.length > 0 && l.documento.includes(digitos))
      )
    : linhas;

  const comoSolicitante = linhas.filter((l) => l.posicao === PapelNoAto.SOLICITANTE).length;
  const comoConvidado = linhas.filter((l) => l.posicao === PapelNoAto.CONVIDADO).length;

  return (
    <>
      <CabecalhoDePagina
        titulo="Procedimentos que represento"
        descricao="Acesso liberado após a realização da sessão"
      />

      <div className="flex-1 p-4 md:p-6">
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Cartao numero={linhas.length} rotulo="Total" />
          <Cartao numero={comoSolicitante} rotulo="Como Solicitante" />
          <Cartao numero={comoConvidado} rotulo="Como Convidado" />
        </div>

        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Nome, CPF ou CNPJ do representado"
            aria-label="Buscar representado"
            className="min-w-0 flex-1 rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
          />
          <button className="rounded-md border border-carvao-100 bg-white px-4 py-2.5 text-sm font-medium text-grafite-700 hover:border-dourado-600">
            Buscar
          </button>
        </form>

        {filtradas.length === 0 ? (
          <EstadoVazio
            titulo={termo ? "Nenhum representado encontrado" : "Nenhum procedimento disponível"}
            descricao={
              termo
                ? "Confira a grafia ou tente pelo documento."
                : "Os procedimentos que você representa aparecem aqui depois da realização da sessão."
            }
          />
        ) : (
          <ul className="space-y-2">
            {filtradas.map((linha) => (
              <li key={linha.id}>
                <Link
                  href={`/atos/${linha.id}`}
                  className="block rounded-lg border border-carvao-100 bg-white p-4 transition-colors hover:border-dourado-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="tabular text-sm font-semibold text-preto-900">
                      {linha.numero}
                    </span>
                    <Etiqueta tom={TOM_DO_STATUS[linha.status]}>
                      {ROTULO_STATUS[linha.status]}
                    </Etiqueta>
                  </div>

                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-carvao-300">Represento:</dt>
                      <dd className="truncate text-carvao-700">{linha.representado}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-carvao-300">Posição:</dt>
                      <dd className="text-carvao-700">
                        {linha.posicao ? ROTULO_PAPEL_NO_ATO[linha.posicao] : "—"}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-carvao-300">Sessão:</dt>
                      <dd className="tabular text-carvao-700">{formatarData(linha.data)}</dd>
                    </div>
                    {linha.documento && (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-carvao-300">Documento:</dt>
                        <dd className="tabular text-carvao-700">
                          {formatarDocumento(linha.documento)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Cartao({ numero, rotulo }: { numero: number; rotulo: string }) {
  return (
    <div className="rounded-lg border border-carvao-100 bg-white p-4">
      <p className="text-2xl font-semibold text-preto-900">{numero}</p>
      <p className="mt-0.5 text-[11px] text-carvao-500">{rotulo}</p>
    </div>
  );
}
