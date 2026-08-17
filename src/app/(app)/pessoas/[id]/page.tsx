import Link from "next/link";
import { notFound } from "next/navigation";
import { TipoPessoa } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Etiqueta } from "@/components/ui/etiqueta";
import { db } from "@/lib/db";
import { formatarDocumento } from "@/lib/documentos";
import { ROTULO_PAPEL_NO_ATO, ROTULO_STATUS, TOM_DO_STATUS } from "@/lib/formato";
import { exigirEquipe } from "@/lib/sessao";
import { FormularioDePessoa } from "../formulario";

export const metadata = { title: "Pessoa — Consensus One" };

export default async function PaginaDePessoa({ params }: { params: Promise<{ id: string }> }) {
  await exigirEquipe();
  const { id } = await params;

  const pessoa = await db.pessoa.findUnique({
    where: { id },
    include: {
      vinculadoA: { select: { nome: true } },
      participacoes: {
        orderBy: { criadoEm: "desc" },
        include: { ato: { select: { id: true, numero: true, status: true } } },
      },
    },
  });
  if (!pessoa) notFound();

  const empresas = await db.pessoa.findMany({
    where: { tipo: TipoPessoa.JURIDICA, id: { not: pessoa.id } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <>
      <CabecalhoDePagina
        titulo={pessoa.nome}
        descricao={`${formatarDocumento(pessoa.documento)}${pessoa.oab ? ` · OAB ${pessoa.oab}` : ""}${
          pessoa.vinculadoA ? ` · vinculado a ${pessoa.vinculadoA.nome}` : ""
        }`}
      />

      <div className="flex-1 p-4 md:p-6">
        {pessoa.participacoes.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
              Procedimentos ({pessoa.participacoes.length})
            </h2>
            <ul className="space-y-2">
              {pessoa.participacoes.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/atos/${p.ato.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-carvao-100 bg-white px-4 py-3 hover:border-dourado-600"
                  >
                    <span className="tabular text-sm font-medium text-carvao-700">
                      {p.ato.numero}
                    </span>
                    <span className="text-xs text-carvao-500">{ROTULO_PAPEL_NO_ATO[p.papel]}</span>
                    <Etiqueta tom={TOM_DO_STATUS[p.ato.status]}>
                      {ROTULO_STATUS[p.ato.status]}
                    </Etiqueta>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
          Dados cadastrais
        </h2>
        <FormularioDePessoa
          empresas={empresas}
          valores={{
            id: pessoa.id,
            tipo: pessoa.tipo,
            nome: pessoa.nome,
            documento: formatarDocumento(pessoa.documento),
            email: pessoa.email ?? "",
            telefone: pessoa.telefone ?? "",
            logradouro: pessoa.logradouro ?? "",
            numero: pessoa.numero ?? "",
            complemento: pessoa.complemento ?? "",
            bairro: pessoa.bairro ?? "",
            cidade: pessoa.cidade ?? "",
            uf: pessoa.uf ?? "",
            cep: pessoa.cep ?? "",
            tipoProcurador: pessoa.tipoProcurador ?? "",
            oab: pessoa.oab ?? "",
            vinculadoAId: pessoa.vinculadoAId ?? "",
          }}
        />
      </div>
    </>
  );
}
