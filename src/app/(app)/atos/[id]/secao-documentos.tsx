import { TipoDocumento } from "@prisma/client";
import { vincularLaudo } from "@/acoes/documentos";
import { Botao } from "@/components/ui/botao";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { formatarTamanho } from "@/lib/mime";
import { formatarDataHora } from "@/lib/formato";
import { FormularioDeAnexo, FormularioDeEnvio } from "./documentos";
import { Assinatura, type AssinaturaDoDocumento } from "./assinatura";

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
  /** null = ainda não foi para assinatura eletrônica */
  assinatura: AssinaturaDoDocumento | null;
};

/** Só a Ata e o Termo de Acordo são assinados. Anexo não se assina. */
const ASSINAVEIS: TipoDocumento[] = [TipoDocumento.ATA, TipoDocumento.TERMO_ACORDO];

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
  documentos,
  envios,
  interessados,
  equipe,
  assinaturaAtiva,
}: {
  atoId: string;
  documentos: Documento[];
  envios: Envio[];
  interessados: { id: string; nome: string }[];
  equipe: boolean;
  assinaturaAtiva: boolean;
}) {
  const emitidos = documentos.filter((d) => d.emitidoPelaCamara);
  const laudos = documentos.filter((d) => d.tipo === TipoDocumento.LAUDO_AR);
  const enviosSemLaudo = envios.filter((e) => !e.comprovante);

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-carvao-500">
        Repositório do procedimento
      </h2>

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

              {equipe && assinaturaAtiva && ASSINAVEIS.includes(doc.tipo) && (
                <Assinatura documentoId={doc.id} assinatura={doc.assinatura} />
              )}
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

              {/* A carta conta os 15 dias do RECEBIMENTO, não da emissão. Esta
                  data vem impressa no laudo e é o que torna o prazo definitivo. */}
              <Campo
                rotulo="Data de recebimento (consta no laudo)"
                name="dataCiencia"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                dica="No laudo da Carta-Convite ao Solicitante, esta data recalcula o prazo da documentação."
                required
              />
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
