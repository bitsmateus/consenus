import Link from "next/link";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { configuracaoDoSistema } from "@/lib/configuracao";
import { listarPessoas } from "@/lib/consultas";
import { formatarDocumento } from "@/lib/documentos";
import { exigirEquipe } from "@/lib/sessao";
import { FormularioDeNovoAto } from "./formulario";

export const metadata = { title: "Novo procedimento — Consensus One" };

export default async function PaginaDeNovoAto() {
  await exigirEquipe();

  const [pessoas, config] = await Promise.all([listarPessoas(), configuracaoDoSistema()]);

  if (pessoas.length < 2) {
    return (
      <>
        <CabecalhoDePagina titulo="Novo procedimento" />
        <div className="flex-1 p-4 md:p-6">
          <EstadoVazio
            titulo="Cadastre os Interessados primeiro"
            descricao="Um procedimento precisa de um Interessado Solicitante e um Interessado Convidado. Cadastre as duas pessoas antes de abrir."
            acao={
              <Link
                href="/pessoas/nova"
                className="inline-block rounded-md bg-grafite-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-grafite-500"
              >
                Cadastrar pessoa
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <CabecalhoDePagina
        titulo="Novo procedimento"
        descricao="Passo 1 de 5 — cadastro das partes"
      />
      <div className="flex-1 p-4 md:p-6">
        <FormularioDeNovoAto
          diasAteSessao={config.diasAteSessao}
          prazoDocumentacaoDias={config.prazoDocumentacaoDias}
          pessoas={pessoas.map((p) => ({
            id: p.id,
            rotulo: `${p.nome} — ${formatarDocumento(p.documento)}`,
            email: p.email,
            telefone: p.telefone,
          }))}
        />
      </div>
    </>
  );
}
