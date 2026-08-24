import Link from "next/link";
import { PapelNoAto, Prisma, TipoDocumento } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { apenasDigitos, formatarDocumento } from "@/lib/documentos";
import { formatarDataHora } from "@/lib/formato";
import { formatarTamanho } from "@/lib/mime";
import { exigirUsuario, filtroDeAtosVisiveis } from "@/lib/sessao";

export const metadata = { title: "Documentos — Consensus One" };

const ROTULO: Record<TipoDocumento, string> = {
  CARTA_CONVITE_SOLICITANTE: "Carta-Convite ao Solicitante",
  CARTA_CONVITE_CONVIDADO: "Carta-Convite ao Convidado",
  ATA: "Ata de Sessão",
  TERMO_ACORDO: "Termo de Acordo",
  DOCUMENTO_DA_PARTE: "Documento do Interessado",
  LAUDO_AR: "Laudo de AR",
  DOCUMENTO_ASSINADO: "Documento assinado",
  OUTRO: "Outro",
};

type Busca = { busca?: string; tipo?: string };

function comFiltro(atual: Busca, mudanca: Partial<Busca>): string {
  const params = new URLSearchParams();
  const final = { ...atual, ...mudanca };
  if (final.busca) params.set("busca", final.busca);
  if (final.tipo) params.set("tipo", final.tipo);
  const query = params.toString();
  return query ? `/documentos?${query}` : "/documentos";
}

/** Busca por número, título do procedimento ou nome/documento de quem participa. */
function filtroDeBusca(termo: string): Prisma.DocumentoWhereInput {
  const digitos = apenasDigitos(termo);
  const condicoes: Prisma.DocumentoWhereInput[] = [
    { codigoVerificacao: { contains: termo, mode: "insensitive" } },
    { ato: { numero: { contains: termo, mode: "insensitive" } } },
    { ato: { titulo: { contains: termo, mode: "insensitive" } } },
    {
      ato: {
        partes: { some: { pessoa: { nome: { contains: termo, mode: "insensitive" } } } },
      },
    },
  ];

  // documento só entra com 3+ dígitos, senão "1" casaria com quase tudo
  if (digitos.length >= 3) {
    condicoes.push({
      ato: { partes: { some: { pessoa: { documento: { contains: digitos } } } } },
    });
  }

  return { OR: condicoes };
}

export default async function PaginaDeDocumentos({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  await exigirUsuario();
  const filtrosDaUrl = await searchParams;

  // o filtro de visibilidade decide quais procedimentos existem para este
  // usuário; os documentos vêm por consequência, nunca por consulta direta
  const visiveis = await filtroDeAtosVisiveis();

  const tipo =
    filtrosDaUrl.tipo && filtrosDaUrl.tipo in TipoDocumento
      ? (filtrosDaUrl.tipo as TipoDocumento)
      : undefined;

  const condicoes: Prisma.DocumentoWhereInput[] = [{ ato: visiveis }];
  if (filtrosDaUrl.busca?.trim()) condicoes.push(filtroDeBusca(filtrosDaUrl.busca.trim()));
  if (tipo) condicoes.push({ tipo });

  const documentos = await db.documento.findMany({
    where: { AND: condicoes },
    orderBy: { criadoEm: "desc" },
    take: 300,
    include: {
      ato: {
        select: {
          id: true,
          numero: true,
          titulo: true,
          partes: {
            select: { papel: true, pessoa: { select: { id: true, nome: true, documento: true } } },
          },
        },
      },
    },
  });

  // contagem por tipo, sobre o mesmo recorte de visibilidade e busca — sem o
  // filtro de tipo, senão o chip escolhido zeraria os outros
  const porTipo = await db.documento.groupBy({
    by: ["tipo"],
    where: { AND: condicoes.filter((c) => !("tipo" in c)) },
    _count: { _all: true },
  });

  /**
   * Agrupa por Interessado Solicitante — "a pasta vai ser pelo interessado",
   * pedido do cliente em 24/08. É agrupamento de tela: no armazenamento os
   * arquivos continuam sob o procedimento, que é o que o código de verificação
   * e o hash apontam.
   */
  const pastas = new Map<
    string,
    { nome: string; documento: string | null; total: number; atos: Map<string, typeof documentos> }
  >();

  for (const doc of documentos) {
    const solicitante = doc.ato.partes.find((p) => p.papel === PapelNoAto.SOLICITANTE)?.pessoa;
    const chave = solicitante?.id ?? "sem-interessado";

    const pasta = pastas.get(chave) ?? {
      nome: solicitante?.nome ?? "Sem Interessado Solicitante vinculado",
      documento: solicitante?.documento ?? null,
      total: 0,
      atos: new Map<string, typeof documentos>(),
    };

    pasta.total += 1;
    pasta.atos.set(doc.ato.id, [...(pasta.atos.get(doc.ato.id) ?? []), doc]);
    pastas.set(chave, pasta);
  }

  return (
    <>
      <CabecalhoDePagina
        titulo="Documentos"
        descricao="Repositório dos procedimentos a que você tem acesso"
      />

      <div className="flex-1 p-4 md:p-6">
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <input
            name="busca"
            defaultValue={filtrosDaUrl.busca ?? ""}
            placeholder="Interessado, procurador, número do procedimento ou código"
            aria-label="Buscar documento"
            className="min-w-0 flex-1 rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
          />
          <button className="rounded-md border border-carvao-100 bg-white px-4 py-2.5 text-sm font-medium text-grafite-700 hover:border-dourado-600">
            Buscar
          </button>
        </form>

        <div className="mb-5 flex flex-wrap gap-1.5">
          <Chip href={comFiltro(filtrosDaUrl, { tipo: undefined })} ativo={!tipo}>
            Todos
          </Chip>
          {porTipo
            .sort((a, b) => b._count._all - a._count._all)
            .map((linha) => (
              <Chip
                key={linha.tipo}
                href={comFiltro(filtrosDaUrl, { tipo: linha.tipo })}
                ativo={tipo === linha.tipo}
              >
                {ROTULO[linha.tipo]} · {linha._count._all}
              </Chip>
            ))}
        </div>

        {documentos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum documento encontrado"
            descricao={
              filtrosDaUrl.busca || tipo
                ? "Nenhum documento corresponde a este filtro."
                : "Os documentos ficam disponíveis após a realização da sessão."
            }
          />
        ) : (
          <div className="space-y-6">
            {[...pastas.values()]
              .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"))
              .map((pasta) => (
                <section key={pasta.nome}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b border-carvao-100 pb-1.5">
                    <h2 className="text-sm font-semibold text-preto-900">{pasta.nome}</h2>
                    {pasta.documento && (
                      <span className="tabular text-[11px] text-carvao-300">
                        {formatarDocumento(pasta.documento)}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-carvao-300">
                      {pasta.total} {pasta.total === 1 ? "documento" : "documentos"}
                    </span>
                  </div>

                  {[...pasta.atos.entries()].map(([atoId, docs]) => (
                    <div key={atoId} className="mb-3">
                      <Link
                        href={`/atos/${atoId}`}
                        className="mb-1.5 inline-block text-xs text-dourado-600 hover:underline"
                      >
                        {docs[0]!.ato.titulo
                          ? `${docs[0]!.ato.titulo} · ${docs[0]!.ato.numero}`
                          : `Procedimento ${docs[0]!.ato.numero}`}
                      </Link>

                      <ul className="space-y-2">
                        {docs.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-carvao-100 bg-white p-4"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-carvao-700">
                                {ROTULO[doc.tipo]}
                              </p>
                              {doc.codigoVerificacao && (
                                <p className="tabular mt-0.5 text-xs text-dourado-600">
                                  {doc.codigoVerificacao}
                                </p>
                              )}
                              <p className="mt-0.5 truncate text-[11px] text-carvao-300">
                                {formatarTamanho(doc.tamanhoBytes)} ·{" "}
                                {formatarDataHora(doc.criadoEm)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.emitidoPelaCamara && <Etiqueta tom="andamento">Emitido</Etiqueta>}
                              <a
                                href={`/api/documentos/${doc.id}/download`}
                                className="rounded-md border border-carvao-100 px-3 py-1.5 text-[11px] font-medium text-grafite-700 hover:border-dourado-600"
                              >
                                Baixar
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
          </div>
        )}
      </div>
    </>
  );
}

function Chip({
  href,
  ativo,
  children,
}: {
  href: string;
  ativo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] transition-colors",
        ativo
          ? "border-dourado-600 bg-dourado-100 font-medium text-dourado-600"
          : "border-carvao-100 bg-white text-carvao-500 hover:border-dourado-600"
      )}
    >
      {children}
    </Link>
  );
}
