/**
 * Armazenamento de arquivos, compatível com a API S3.
 *
 * Produção: Magalu Cloud Object Storage — dados em território nacional.
 * Local:    MinIO via docker compose.
 * Backup:   Cloudflare R2, cópia criptografada fora do país.
 *
 * REGRA: o bucket é sempre privado. Download apenas por URL pré-assinada,
 * com expiração curta. Ver docs/04-seguranca-e-lgpd.md
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";

const EXPIRACAO_PADRAO_SEGUNDOS = 600; // 10 minutos

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "br-se1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

export function calcularHash(conteudo: Buffer): string {
  return createHash("sha256").update(conteudo).digest("hex");
}

/** Caminho no bucket. Um ato = uma pasta, conforme requisito do cliente. */
export function montarChave(atoId: string, tipo: string, nomeArquivo: string): string {
  const seguro = nomeArquivo.normalize("NFD").replace(/[^\w.\-]/g, "_");
  return `atos/${atoId}/${tipo}/${Date.now()}-${seguro}`;
}

export async function enviarArquivo(params: {
  chave: string;
  conteudo: Buffer;
  mimeType: string;
}): Promise<{ chave: string; hashSha256: string; tamanhoBytes: number }> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: params.chave,
      Body: params.conteudo,
      ContentType: params.mimeType,
      ServerSideEncryption: "AES256",
    })
  );

  return {
    chave: params.chave,
    hashSha256: calcularHash(params.conteudo),
    tamanhoBytes: params.conteudo.length,
  };
}

/** Nunca devolva a chave crua ao cliente. Sempre esta URL, sempre com expiração. */
export async function gerarUrlDeDownload(
  chave: string,
  nomeParaDownload: string,
  expiraEm = EXPIRACAO_PADRAO_SEGUNDOS
): Promise<string> {
  const comando = new GetObjectCommand({
    Bucket: BUCKET,
    Key: chave,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(nomeParaDownload)}"`,
  });
  return getSignedUrl(s3, comando, { expiresIn: expiraEm });
}

export async function removerArquivo(chave: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: chave }));
}
