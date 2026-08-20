/**
 * Cálculo dos prazos do ato.
 * Os valores padrão vêm de ConfiguracaoSistema — nunca fixe número aqui.
 * Fuso: America/Sao_Paulo, sempre.
 */
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { ErroDeNegocio } from "./erros";

export const FUSO = "America/Sao_Paulo";

export function agoraEmSaoPaulo(): Date {
  return toZonedTime(new Date(), FUSO);
}

/** Data provisória da sessão: D+N a partir da criação do ato */
export function calcularDataDaSessao(criadoEm: Date, diasAteSessao: number): Date {
  return fromZonedTime(startOfDay(addDays(toZonedTime(criadoEm, FUSO), diasAteSessao)), FUSO);
}

/**
 * Prazo final para o Interessado Solicitante enviar a documentação.
 *
 * ⚠️ O marco é o **recebimento** da carta, não a emissão. A Carta-Convite diz:
 * "no prazo de até 15 (quinze) dias, contados do recebimento desta
 * comunicação". Enquanto a ciência não estiver registrada, quem chama passa a
 * data de emissão e o resultado é PROVISÓRIO — ver prazoEhProvisorio().
 *
 * @param dataDeCiencia data do recebimento; na falta dela, a da emissão
 */
export function calcularPrazoDocumentacao(dataDeCiencia: Date, prazoEmDias: number): Date {
  return fromZonedTime(startOfDay(addDays(toZonedTime(dataDeCiencia, FUSO), prazoEmDias)), FUSO);
}

export type SituacaoDoPrazo = "no_prazo" | "vence_em_breve" | "vencido";

/** Usado para colorir o status na interface. "Em breve" = 3 dias ou menos. */
export function situacaoDoPrazo(prazoFinal: Date, referencia = new Date()): SituacaoDoPrazo {
  const dias = differenceInCalendarDays(toZonedTime(prazoFinal, FUSO), toZonedTime(referencia, FUSO));
  if (dias < 0) return "vencido";
  if (dias <= 3) return "vence_em_breve";
  return "no_prazo";
}

export function diasRestantes(prazoFinal: Date, referencia = new Date()): number {
  return differenceInCalendarDays(toZonedTime(prazoFinal, FUSO), toZonedTime(referencia, FUSO));
}

/**
 * Um prazo contado da emissão é provisório: o marco real é o recebimento, que
 * só se conhece quando o laudo de AR chega. Prazo provisório não pode
 * fundamentar o encerramento administrativo do cadastro (docs/08).
 */
export function prazoEhProvisorio(dataCienciaSolicitante: Date | null | undefined): boolean {
  return !dataCienciaSolicitante;
}

/**
 * Lê a data de recebimento que o operador copia do laudo de AR.
 *
 * Chega como "AAAA-MM-DD" de um <input type="date"> e é interpretada no fuso
 * de São Paulo — sem isso, um recebimento de 1º de março viraria 28 de
 * fevereiro para quem lê em UTC, e o prazo sairia um dia curto.
 */
export function interpretarDataDeCiencia(entrada: string, agora = new Date()): Date {
  const limpo = entrada.trim();
  if (!limpo) {
    throw new ErroDeNegocio("Informe a data de recebimento que consta no laudo de AR.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpo)) {
    throw new ErroDeNegocio("Data de recebimento inválida.");
  }

  const data = fromZonedTime(`${limpo}T00:00:00`, FUSO);
  if (Number.isNaN(data.getTime())) {
    throw new ErroDeNegocio("Data de recebimento inválida.");
  }

  // recebimento no futuro é erro de digitação, e adiaria o prazo indevidamente
  if (differenceInCalendarDays(toZonedTime(data, FUSO), toZonedTime(agora, FUSO)) > 0) {
    throw new ErroDeNegocio("A data de recebimento não pode estar no futuro.");
  }

  return data;
}
