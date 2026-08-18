import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { db } from "@/lib/db";
import { formatarDocumento } from "@/lib/documentos";
import { ROTULO_PAPEL, ROTULO_TIPO_PROCURADOR } from "@/lib/formato";
import { exigirUsuario } from "@/lib/sessao";

export const metadata = { title: "Meus dados — Consensus One" };

/**
 * Dados cadastrais do usuário externo, apenas para leitura.
 *
 * Alteração de cadastro passa pela câmara: o dado das partes é usado nos
 * documentos oficiais e não pode mudar sem o operador saber.
 */
export default async function PaginaDeMeusDados() {
  const usuario = await exigirUsuario();

  const pessoa = usuario.pessoaId
    ? await db.pessoa.findUnique({
        where: { id: usuario.pessoaId },
        include: { vinculadoA: { select: { nome: true } } },
      })
    : null;

  return (
    <>
      <CabecalhoDePagina titulo="Meus dados" descricao="Cadastro na câmara" />

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-xl space-y-4">
          <div className="rounded-lg border border-carvao-100 bg-white p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
              Conta de acesso
            </h2>
            <dl className="space-y-2 text-sm">
              <Linha rotulo="Nome" valor={usuario.nome} />
              <Linha rotulo="E-mail" valor={usuario.email ?? "—"} />
              <Linha rotulo="Perfil" valor={ROTULO_PAPEL[usuario.papel]} />
            </dl>
          </div>

          {pessoa && (
            <div className="rounded-lg border border-carvao-100 bg-white p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
                Cadastro
              </h2>
              <dl className="space-y-2 text-sm">
                <Linha rotulo="Nome" valor={pessoa.nome} />
                <Linha rotulo="Documento" valor={formatarDocumento(pessoa.documento)} />
                {pessoa.oab && <Linha rotulo="OAB" valor={pessoa.oab} />}
                {pessoa.tipoProcurador && (
                  <Linha rotulo="Natureza" valor={ROTULO_TIPO_PROCURADOR[pessoa.tipoProcurador]} />
                )}
                {pessoa.vinculadoA && (
                  <Linha rotulo="Vinculado a" valor={pessoa.vinculadoA.nome} />
                )}
                {pessoa.email && <Linha rotulo="E-mail" valor={pessoa.email} />}
                {pessoa.telefone && <Linha rotulo="Telefone" valor={pessoa.telefone} />}
                {pessoa.cidade && (
                  <Linha rotulo="Cidade" valor={`${pessoa.cidade}${pessoa.uf ? `/${pessoa.uf}` : ""}`} />
                )}
              </dl>
            </div>
          )}

          <p className="text-xs leading-relaxed text-carvao-300">
            Para corrigir qualquer dado, fale com a Consensus One. Esses dados são
            usados nos documentos oficiais do procedimento e por isso só a câmara
            pode alterá-los.
          </p>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-carvao-500">{rotulo}</dt>
      <dd className="text-right text-carvao-700">{valor}</dd>
    </div>
  );
}
