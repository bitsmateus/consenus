import { StatusAto, TipoDocumento } from "@prisma/client";
import { emitirCartaAoSolicitante, vincularLaudo } from "@/acoes/documentos";
import { Botao } from "@/components/ui/botao";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Selecao } from "@/components/ui/selecao";
import { formatarTamanho } from "@/lib/mime";
import { formatarDataHora } from "@/lib/formato";
import { FormularioDeAnexo, FormularioDeEnvio } from "./documentos";

const ROTULO_TIPO: Record<TipoDocumento, string> = {
  CARTA_CONVITE_SOLICITANTE: "Carta-Convite ao Solicitante",
  CARTA_CONVITE_CONVIDADO: "Carta-Convite ao Convidado",
  ATA: "Ata de Sessão",
  TERMO_ACORDO: "Termo de Acordo",
  DOCUMENTO_DA_PARTE: "Documento do Interessado",
  LAUDO_AR: "Laudo de AR",
  DOCUMENTO_ASSINADO: "Documento assinado",
  OUTRO: "Outro",
};

const ROTULO_CANAL = { AR_DIGITAL: "AR digital", EMAIL: "E-mail", ENTREGA_MANUAL: "Entrega manual" };

type Documento = {
  id: string;
  tipo: TipoDocumento;
  codigoVerificacao: string | null;
  nomeArquivo: string;
  tamanhoBytes: number;
  hashSha256: string;
  emitidoPelaCamara: boolean;
  criadoEm: Date;
};

type Envio = {
  id: string;
  canal: keyof typeof ROTULO_CANAL;
  status: string;
  enviadoEm: Date | null;
  documento: { id: string; codigoVerificacao: string | null; nomeArquivo: string };
  destinatario: { nome: string };
  comprovante: { id: string; nomeArquivo: string } | null;
};

export function SecaoDeDocumentos({
  atoId,
  status,
  documentos,
  envios,
  interessados,
  equipe,
}: {
  atoId: string;
  status: StatusAto;
  documentos: Documento[];
  envios: Envio[];
  interessados: { id: string; nome: string }[];
  equipe: boolean;
}) {
  const emitidos = documentos.filter((d) => d.emitidoPelaCamara);
  const laudos = documentos.filter((d) => d.tipo === TipoDocumento.LAUDO_AR);
  const enviosSemLaudo = envios.filter((e) => !e.comprovante);

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
        Repositório do procedimento
      </h2>

      {equipe && status === StatusAto.RASCUNHO && (
        <form action={emitirCartaAoSolicitante} className="mb-3 rounded-lg bg-dourado-100 p-4">
          <input type="hidden" name="atoId" value={atoId} />
          <p className="mb-3 text-xs leading-relaxed text-dourado-600">
            Passo 2 — emitir a Carta-Convite ao Interessado Solicitante. O sistema
            gera o código, aplica o timbrado com QR Code e abre o prazo de
            documentação. A data da sessão continua apenas reservada.
          </p>
          <Botao type="submit">Emitir Carta-Convite</Botao>
        </form>
      )}

      {documentos.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-carvao-100 bg-white px-4 py-6 text-center text-xs text-carvao-500">
          Nenhum documento no procedimento.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {documentos.map((doc) => (
            <li key={doc.id} className="rounded-lg border border-carvao-100 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-carvao-700">
                    {ROTULO_TIPO[doc.tipo]}
                  </p>
                  {doc.codigoVerificacao && (
                    <p className="tabular mt-0.5 text-xs text-dourado-600">
                      {doc.codigoVerificacao}
                    </p>
                  )}
                  <p className="mt-0.5 truncate text-[11px] text-carvao-300">
                    {doc.nomeArquivo} · {formatarTamanho(doc.tamanhoBytes)} ·{" "}
                    {formatarDataHora(doc.criadoEm)}
                  </p>
                  <p className="tabular mt-0.5 truncate text-[10px] text-carvao-300">
                    SHA-256 {doc.hashSha256.slice(0, 16)}…
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
              </div>
            </li>
          ))}
        </ul>
      )}

      {envios.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-carvao-300">
            Envios
          </h3>
          <ul className="space-y-2">
            {envios.map((envio) => (
              <li
                key={envio.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-carvao-100 bg-white px-4 py-3 text-xs"
              >
                <span className="text-carvao-700">
                  {envio.documento.codigoVerificacao ?? envio.documento.nomeArquivo} →{" "}
                  {envio.destinatario.nome}
                </span>
                <span className="text-carvao-300">
                  {ROTULO_CANAL[envio.canal]} · {formatarDataHora(envio.enviadoEm)}
                </span>
                {envio.comprovante ? (
                  <Etiqueta tom="sucesso">Laudo anexado</Etiqueta>
                ) : (
                  <Etiqueta tom="atencao">Sem laudo</Etiqueta>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {equipe && (
        <div className="space-y-3">
          <FormularioDeAnexo atoId={atoId} />

          {emitidos.length > 0 && interessados.length > 0 && (
            <FormularioDeEnvio
              atoId={atoId}
              documentos={emitidos.map((d) => ({
                valor: d.id,
                rotulo: `${d.codigoVerificacao ?? d.nomeArquivo} — ${ROTULO_TIPO[d.tipo]}`,
              }))}
              destinatarios={interessados.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            />
          )}

          {enviosSemLaudo.length > 0 && laudos.length > 0 && (
            <form action={vincularLaudo} className="rounded-lg border border-carvao-100 bg-white p-4">
              <input type="hidden" name="atoId" value={atoId} />
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Selecao
                  rotulo="Envio"
                  name="envioId"
                  opcoes={enviosSemLaudo.map((e) => ({
                    valor: e.id,
                    rotulo: `${e.documento.codigoVerificacao ?? e.documento.nomeArquivo} → ${e.destinatario.nome}`,
                  }))}
                />
                <Selecao
                  rotulo="Laudo de AR"
                  name="laudoId"
                  opcoes={laudos.map((l) => ({ valor: l.id, rotulo: l.nomeArquivo }))}
                />
              </div>
              <Botao type="submit" variante="secundario">
                Vincular laudo ao envio
              </Botao>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
