/**
 * Código único de documento — padrão definido pela Consensus One.
 *
 * Formato oficial:  CO-CC-2026-000001
 *   CO      -> Consensus One
 *   CC      -> sigla do tipo de documento
 *   2026    -> ano de emissão
 *   000001  -> sequencial de 6 dígitos, por tipo e por ano
 *
 * Este código é, ao mesmo tempo: número do documento, identificador interno,
 * código do Autenticador de Documentos e chave de pesquisa no sistema.
 *
 * Ver docs/03-autenticacao-de-documentos.md e assets/modelos/.
 */

/**
 * Só estes três tipos são emitidos pela esteira. O cliente definiu ainda
 * CO-TE, CO-NT e CO-MEM, mas confirmou em 14/08/2026 que são administrativos e
 * ficam fora do sistema. O parser abaixo reconhece as seis siglas de propósito:
 * se alguém digitar um CO-TE na verificação, a resposta correta é "documento
 * não encontrado", não "código inválido".
 */
export const SIGLAS = {
  CARTA_CONVITE_SOLICITANTE: "CC",
  CARTA_CONVITE_CONVIDADO: "CC",
  ATA: "ATA",
  TERMO_ACORDO: "TA",
} as const;

export type TipoComCodigo = keyof typeof SIGLAS;

/**
 * DECISÃO DO CLIENTE, 14/08/2026: **sem dígito verificador**.
 * O código sai exatamente como ele especificou: CO-ATA-2026-000001.
 *
 * A função abaixo fica disponível, mas desligada por padrão. Como o sequencial
 * é previsível, a proteção contra varredura passa a depender inteiramente da
 * página de verificação: limite por IP, resposta em tempo constante e mínimo de
 * informação. Ver docs/03.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function calcularVerificador(base: string): string {
  // hash determinístico simples sobre a base + segredo do ambiente
  const segredo = process.env.CODIGO_SEGREDO ?? "";
  let h = 0;
  for (const caractere of base + segredo) {
    h = (h * 31 + caractere.charCodeAt(0)) >>> 0;
  }
  const primeiro = ALFABETO.charAt(h % ALFABETO.length);
  const segundo = ALFABETO.charAt((h >>> 5) % ALFABETO.length);
  return primeiro + segundo;
}

export function montarCodigo(
  tipo: TipoComCodigo,
  ano: number,
  sequencial: number,
  comVerificador = false
): string {
  const base = `CO-${SIGLAS[tipo]}-${ano}-${String(sequencial).padStart(6, "0")}`;
  return comVerificador ? `${base}-${calcularVerificador(base)}` : base;
}

const PADRAO = /^CO-(CC|ATA|TA|TE|NT|MEM)-(\d{4})-(\d{6})(?:-([A-Z2-9]{2}))?$/;

export function normalizarCodigo(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/\s+/g, "");
}

export function analisarCodigo(entrada: string) {
  const m = PADRAO.exec(normalizarCodigo(entrada));
  if (!m) return null;
  const [, sigla, ano, sequencial, verificador] = m;
  const base = `CO-${sigla}-${ano}-${sequencial}`;
  return {
    base,
    sigla: sigla!,
    ano: Number(ano),
    sequencial: Number(sequencial),
    verificador: verificador ?? null,
    verificadorConfere: verificador ? verificador === calcularVerificador(base) : null,
  };
}

export function codigoEhValido(entrada: string): boolean {
  return PADRAO.test(normalizarCodigo(entrada));
}
