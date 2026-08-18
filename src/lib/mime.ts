/**
 * Validação de arquivo enviado.
 *
 * docs/04 exige validar o tipo MIME **real**, não a extensão nem o cabeçalho
 * que o navegador declara — os dois são escolhidos por quem envia. Aqui o tipo
 * sai da assinatura binária do próprio arquivo.
 */
import { ErroDeNegocio } from "./erros";

/** 20 MB por arquivo. Documento de conciliação é texto e digitalização, não vídeo. */
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;

export type TipoPermitido = "application/pdf" | "image/jpeg" | "image/png";

type Assinatura = { tipo: TipoPermitido; rotulo: string; bytes: number[]; deslocamento?: number };

/** Números mágicos dos formatos aceitos. */
const ASSINATURAS: Assinatura[] = [
  { tipo: "application/pdf", rotulo: "PDF", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { tipo: "image/jpeg", rotulo: "JPEG", bytes: [0xff, 0xd8, 0xff] },
  { tipo: "image/png", rotulo: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export const EXTENSOES_ACEITAS = ".pdf,.jpg,.jpeg,.png";

/** Devolve o tipo real do conteúdo, ou null quando não é um formato aceito. */
export function detectarTipo(conteudo: Buffer): TipoPermitido | null {
  for (const assinatura of ASSINATURAS) {
    const inicio = assinatura.deslocamento ?? 0;
    const trecho = conteudo.subarray(inicio, inicio + assinatura.bytes.length);
    if (trecho.length !== assinatura.bytes.length) continue;
    if (assinatura.bytes.every((byte, i) => trecho[i] === byte)) return assinatura.tipo;
  }
  return null;
}

export function extensaoDoTipo(tipo: TipoPermitido): string {
  if (tipo === "application/pdf") return "pdf";
  if (tipo === "image/png") return "png";
  return "jpg";
}

/**
 * Confere tamanho e tipo real. Erro de negócio, com mensagem que o operador
 * entende — nunca erro técnico na tela (CLAUDE.md, padrões de código).
 */
export function validarArquivo(conteudo: Buffer, nomeArquivo: string): TipoPermitido {
  if (conteudo.length === 0) {
    throw new ErroDeNegocio(`O arquivo "${nomeArquivo}" está vazio.`);
  }
  if (conteudo.length > TAMANHO_MAXIMO_BYTES) {
    const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
    throw new ErroDeNegocio(`O arquivo "${nomeArquivo}" passa de ${limite} MB.`);
  }

  const tipo = detectarTipo(conteudo);
  if (!tipo) {
    throw new ErroDeNegocio(
      `O arquivo "${nomeArquivo}" não é um PDF, JPEG ou PNG. Renomear a extensão não muda o conteúdo.`
    );
  }
  return tipo;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
