import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { exigirEquipe } from "@/lib/sessao";
import { FormularioDeImportacao } from "./formulario";

export const metadata = { title: "Importar pessoas — Consensus One" };

export default async function PaginaDeImportacaoDePessoas() {
  await exigirEquipe();

  return (
    <>
      <CabecalhoDePagina
        titulo="Importar pessoas"
        descricao="Cadastro em lote por planilha"
      />
      <div className="flex-1 p-4 md:p-6">
        <FormularioDeImportacao />
      </div>
    </>
  );
}
