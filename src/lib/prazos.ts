/**
 * Cálculo dos prazos do ato.
 * Os valores padrão vêm de ConfiguracaoSistema — nunca fixe número aqui.
 * Fuso: America/Sao_Paulo, sempre.
 */
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const FUSO = "America/Sao_Paulo";

export function agoraEmSaoPaulo(): Date {
  return toZonedTime(new Date(), FUSO);
}

/** Data provisória da sessão: D+N a partir da criação do ato */
export function calcularDataDaSessao(criadoEm: Date, diasAteSessao: number): Date {
  return fromZonedTime(startOfDay(addDays(toZonedTime(criadoEm, FUSO), diasAteSessao)), FUSO);
}

/** Prazo final para o requerente enviar a documentação */
export function calcularPrazoDocumentacao(dataDaCarta: Date, prazoEmDias: number): Date {
  return fromZonedTime(startOfDay(addDays(toZonedTime(dataDaCarta, FUSO), prazoEmDias)), FUSO);
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
