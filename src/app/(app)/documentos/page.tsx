import Link from "next/link";
import { TipoDocumento } from "@prisma/client";
import { CabecalhoDePagina } from "@/components/ui/cabecalho-de-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Etiqueta } from "@/components/ui/etiqueta";
import { db } from "@/lib/db";
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

export default async function PaginaDeDocumentos() {
  await exigirUsuario();

  // o filtro de visibilidade decide quais procedimentos existem para este
  // usuário; os documentos vêm por consequência, nunca por consulta direta
  const filtro = await filtroDeAtosVisiveis();

  const documentos = await db.documento.findMany({
    where: { ato: filtro },
    orderBy: { criadoEm: "desc" },
    take: 200,
    include: { ato: { select: { id: true, numero: true } } },
  });

  return (
    <>
      <CabecalhoDePagina
        titulo="Documentos"
        descricao="Repositório dos procedimentos a que você tem acesso"
      />

      <div className="flex-1 p-4 md:p-6">
        {documentos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum documento disponível"
            descricao="Os documentos ficam disponíveis após a realização da sessão."
          />
        ) : (
          <ul className="space-y-2">
            {documentos.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-carvao-100 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-carvao-700">{ROTULO[doc.tipo]}</p>
                  {doc.codigoVerificacao && (
                    <p className="tabular mt-0.5 text-xs text-dourado-600">
                      {doc.codigoVerificacao}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-[11px] text-carvao-300">
                    <Link href={`/atos/${doc.ato.id}`} className="hover:text-dourado-600">
                      Procedimento {doc.ato.numero}
                    </Link>
                    {" · "}
                    {formatarTamanho(doc.tamanhoBytes)} · {formatarDataHora(doc.criadoEm)}
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
        )}
      </div>
    </>
  );
}
