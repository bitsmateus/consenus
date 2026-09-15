import Link from "next/link";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { listarPessoas } from "@/lib/consultas";
import { exigirEquipe } from "@/lib/sessao";
import { ListaDePessoas } from "./lista-de-pessoas";

export const metadata = { title: "Interessados — Consensus One" };

export default async function PaginaDePessoas({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  await exigirEquipe();
  const { busca } = await searchParams;
  const pessoas = await listarPessoas(busca);

  return (
    <>
      <CabecalhoDePagina
        titulo="Interessados e procuradores"
        descricao="Cadastro único por CPF ou CNPJ"
        acao={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pessoas/importar"
              className="rounded-md border border-carvao-100 bg-white px-4 py-2.5 text-sm font-medium text-grafite-700 hover:border-dourado-600"
            >
              Importar planilha
            </Link>
            <Link
              href="/pessoas/nova"
              className="rounded-md bg-grafite-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-grafite-500"
            >
              Nova pessoa
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-4 md:p-6">
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Nome, CPF, CNPJ ou OAB"
            aria-label="Buscar pessoa"
            className="min-w-0 flex-1 rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-grafite-500"
          />
          <button className="rounded-md border border-carvao-100 bg-white px-4 py-2.5 text-sm font-medium text-grafite-700 hover:border-dourado-600">
            Buscar
          </button>
        </form>

        {pessoas.length === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
            descricao={
              busca
                ? "Confira a grafia ou tente pelo documento."
                : "Cadastre os Interessados antes de abrir o procedimento."
            }
          />
        ) : (
          <ListaDePessoas pessoas={pessoas} />
        )}
      </div>
    </>
  );
}
