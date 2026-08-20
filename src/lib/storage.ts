/**
 * Armazenamento de arquivos, compatível com a API S3.
 *
 * Produção: MinIO no próprio VPS, servido em arquivos.consensusone.com.br.
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

/**
 * Criptografia em repouso, exigida por docs/04.
 *
 * O MinIO só aceita SSE-S3 com KES/KMS configurado, e não é o caso nem aqui
 * nem em produção — a variável fica vazia nos dois, e o risco residual está
 * aceito e documentado em docs/04. O padrão continua LIGADO: esquecer de
 * definir mantém a proteção, não a remove.
 */
const CRIPTOGRAFIA_NO_SERVIDOR =
  process.env.S3_CRIPTOGRAFIA === undefined ? "AES256" : process.env.S3_CRIPTOGRAFIA || undefined;

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
      ServerSideEncryption: CRIPTOGRAFIA_NO_SERVIDOR as "AES256" | undefined,
    })
  );

  return {
    chave: params.chave,
    hashSha256: calcularHash(params.conteudo),
    tamanhoBytes: params.conteudo.length,
  };
}

/**
 * Lê o arquivo de volta, para uso do próprio servidor.
 *
 * Não é caminho de download do usuário — para isso existe a URL pré-assinada
 * abaixo, que é a única forma de um arquivo chegar ao navegador. Este aqui
 * serve a quem precisa do conteúdo em memória, como o envio para assinatura
 * eletrônica.
 */
export async function baixarArquivo(chave: string): Promise<Buffer> {
  const resposta = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: chave }));
  if (!resposta.Body) {
    throw new Error(`Arquivo não encontrado no repositório: ${chave}`);
  }
  return Buffer.from(await resposta.Body.transformToByteArray());
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
