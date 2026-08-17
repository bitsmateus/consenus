/**
 * Código único de documento — padrão definido pela Consensus One.
 *
 * Formato oficial:  CO-CC-2026-000001
 *   CO      -> Consensus One
 *   CC      -> sigla do tipo de documento
 *   2026    -> ano de emissão
 *   000001  -> sequencial de 6 dígitos, por SIGLA e por ano
 *
 * Este código é, ao mesmo tempo: número do documento, identificador interno,
 * código do Autenticador de Documentos e chave de pesquisa no sistema.
 *
 * Ver docs/03-autenticacao-de-documentos.md e assets/modelos/.
 */
import { createHmac } from "node:crypto";
import { ErroDeNegocio } from "./erros";

/**
 * Só estes tipos são emitidos pela esteira. O cliente definiu ainda CO-TE,
 * CO-NT e CO-MEM, mas confirmou em 14/08/2026 que são administrativos e ficam
 * fora do sistema. O parser abaixo reconhece as seis siglas de propósito: se
 * alguém digitar um CO-TE na verificação, a resposta correta é "documento não
 * encontrado", não "código inválido".
 */
export const SIGLAS = {
  CARTA_CONVITE_SOLICITANTE: "CC",
  CARTA_CONVITE_CONVIDADO: "CC",
  ATA: "ATA",
  TERMO_ACORDO: "TA",
} as const;

export type TipoComCodigo = keyof typeof SIGLAS;
export type Sigla = (typeof SIGLAS)[TipoComCodigo];

export function siglaDoTipo(tipo: TipoComCodigo): Sigla {
  return SIGLAS[tipo];
}

/**
 * Tipos que dividem a mesma sigla — e, portanto, a mesma sequência.
 *
 * As duas cartas convite são o caso: para o cliente existe um documento só,
 * a "Carta-Convite" (CO-CC). O sistema separa em dois tipos porque o destino e
 * o momento do fluxo são diferentes, mas a numeração é uma só. Contar o
 * sequencial por TipoDocumento faria a carta ao Convidado repetir o código da
 * carta ao Solicitante, e `Documento.codigoVerificacao` é único no banco.
 */
export const TIPOS_DA_SIGLA: Record<Sigla, TipoComCodigo[]> = {
  CC: ["CARTA_CONVITE_SOLICITANTE", "CARTA_CONVITE_CONVIDADO"],
  ATA: ["ATA"],
  TA: ["TERMO_ACORDO"],
};

/** Tipos que o contador de sequencial precisa somar junto com o tipo informado. */
export function tiposQueCompartilhamSequencia(tipo: TipoComCodigo): TipoComCodigo[] {
  return TIPOS_DA_SIGLA[siglaDoTipo(tipo)];
}

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

/**
 * HMAC-SHA256 truncado sobre a base, com o segredo do ambiente.
 * Devolve `null` quando CODIGO_SEGREDO não está definido — sem segredo não
 * existe verificador, e fingir que existe seria pior do que não ter.
 */
export function calcularVerificador(base: string): string | null {
  const segredo = process.env.CODIGO_SEGREDO;
  if (!segredo) return null;

  const resumo = createHmac("sha256", segredo).update(base).digest();
  const primeiro = ALFABETO.charAt(resumo[0]! % ALFABETO.length);
  const segundo = ALFABETO.charAt(resumo[1]! % ALFABETO.length);
  return primeiro + segundo;
}

export function montarCodigo(
  tipo: TipoComCodigo,
  ano: number,
  sequencial: number,
  comVerificador = false
): string {
  const base = `CO-${siglaDoTipo(tipo)}-${ano}-${String(sequencial).padStart(6, "0")}`;
  if (!comVerificador) return base;

  const verificador = calcularVerificador(base);
  if (!verificador) {
    throw new ErroDeNegocio(
      "Não é possível emitir código com dígito verificador sem CODIGO_SEGREDO configurado."
    );
  }
  return `${base}-${verificador}`;
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
  const esperado = verificador ? calcularVerificador(base) : null;

  return {
    base,
    sigla: sigla!,
    ano: Number(ano),
    sequencial: Number(sequencial),
    verificador: verificador ?? null,
    // null = não dá para afirmar (código sem verificador, ou sem segredo configurado)
    verificadorConfere: verificador && esperado ? verificador === esperado : null,
  };
}

export function codigoEhValido(entrada: string): boolean {
  return PADRAO.test(normalizarCodigo(entrada));
}
