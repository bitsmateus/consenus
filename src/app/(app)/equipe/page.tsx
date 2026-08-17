import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { Etiqueta } from "@/components/ui/etiqueta";
import { db } from "@/lib/db";
import { formatarDocumento } from "@/lib/documentos";
import { ROTULO_PAPEL, formatarDataHora } from "@/lib/formato";
import { exigirAdmin } from "@/lib/sessao";
import { exigeSegundoFator } from "@/lib/totp";
import { FormularioDeNovoUsuario, FormularioDePermissao } from "./formularios";

export const metadata = { title: "Equipe — Consensus One" };

export default async function PaginaDeEquipe() {
  // só ADMIN administra contas e permissões
  await exigirAdmin();

  const [usuarios, pessoas] = await Promise.all([
    db.usuario.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { pessoa: { select: { nome: true } } },
    }),
    db.pessoa.findMany({
      where: { usuario: null },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, documento: true },
    }),
  ]);

  return (
    <>
      <CabecalhoDePagina
        titulo="Equipe e permissões"
        descricao="Contas de acesso ao sistema"
      />

      <div className="flex-1 space-y-8 p-4 md:p-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Contas ({usuarios.length})
          </h2>

          <ul className="space-y-2">
            {usuarios.map((usuario) => (
              <li key={usuario.id} className="rounded-lg border border-carvao-100 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-carvao-700">{usuario.nome}</p>
                    <p className="truncate text-xs text-carvao-500">{usuario.email}</p>
                    {usuario.pessoa && (
                      <p className="mt-0.5 text-[11px] text-carvao-300">
                        vinculada a {usuario.pessoa.nome}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Etiqueta tom={usuario.ativo ? "andamento" : "encerrado"}>
                      {usuario.ativo ? ROTULO_PAPEL[usuario.papel] : "Inativa"}
                    </Etiqueta>
                    {usuario.totpAtivo ? (
                      <Etiqueta tom="sucesso">2 etapas</Etiqueta>
                    ) : (
                      exigeSegundoFator(usuario.papel) && (
                        <Etiqueta tom="atencao">2 etapas pendente</Etiqueta>
                      )
                    )}
                  </div>
                </div>

                <p className="mb-3 text-[11px] text-carvao-300">
                  Último acesso: {formatarDataHora(usuario.ultimoLoginEm)}
                  {usuario.bloqueadoAte && usuario.bloqueadoAte > new Date() && " · bloqueada"}
                </p>

                <FormularioDePermissao
                  usuarioId={usuario.id}
                  papel={usuario.papel}
                  ativo={usuario.ativo}
                />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
            Nova conta
          </h2>
          <FormularioDeNovoUsuario
            pessoas={pessoas.map((p) => ({
              id: p.id,
              rotulo: `${p.nome} — ${formatarDocumento(p.documento)}`,
            }))}
          />
        </section>
      </div>
    </>
  );
}
