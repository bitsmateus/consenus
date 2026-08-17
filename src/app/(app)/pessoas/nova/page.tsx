import { TipoPessoa } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { db } from "@/lib/db";
import { exigirEquipe } from "@/lib/sessao";
import { FormularioDePessoa } from "../formulario";

export const metadata = { title: "Nova pessoa — Consensus One" };

export default async function PaginaDeNovaPessoa() {
  await exigirEquipe();

  const empresas = await db.pessoa.findMany({
    where: { tipo: TipoPessoa.JURIDICA },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <>
      <CabecalhoDePagina
        titulo="Nova pessoa"
        descricao="Interessado, procurador ou conciliador"
      />
      <div className="flex-1 p-4 md:p-6">
        <FormularioDePessoa
          empresas={empresas}
          valores={{
            tipo: TipoPessoa.FISICA,
            nome: "",
            documento: "",
            email: "",
            telefone: "",
            logradouro: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            uf: "",
            cep: "",
            tipoProcurador: "",
            oab: "",
            vinculadoAId: "",
          }}
        />
      </div>
    </>
  );
}
