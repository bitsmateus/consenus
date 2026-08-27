/**
 * Formatação para a interface. Datas sempre em America/Sao_Paulo
 * (CLAUDE.md, regra 12).
 */
import {
  DesfechoSessao,
  ModalidadeSessao,
  Papel,
  PapelNoAto,
  StatusAto,
  TipoProcurador,
} from "@prisma/client";
import { FUSO } from "./prazos";

export function formatarData(data: Date | null | undefined): string {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: FUSO }).format(data);
}

export function formatarDataHora(data: Date | null | undefined): string {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO,
  }).format(data);
}

/** Rótulos do cliente. Nunca "requerente" nem "demandado" (regra 10). */
export const ROTULO_PAPEL_NO_ATO: Record<PapelNoAto, string> = {
  SOLICITANTE: "Interessado Solicitante",
  CONVIDADO: "Interessado Convidado",
  PROCURADOR: "Procurador",
  CONCILIADOR: "Conciliador",
};

export const ROTULO_TIPO_PROCURADOR: Record<TipoProcurador, string> = {
  ADVOGADO: "Advogado",
  ESCRITORIO_ADVOCACIA: "Escritório de advocacia",
  EMPRESA_CONSULTORIA: "Empresa ou consultoria",
  REPRESENTANTE_EMPRESA: "Representante da empresa",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: "Administrador",
  OPERADOR: "Operador",
  PARTE: "Interessado",
  PROCURADOR: "Procurador",
};

export const ROTULO_STATUS: Record<StatusAto, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_DOCUMENTACAO: "Aguardando documentação",
  DOCUMENTACAO_EM_ANALISE: "Documentação em análise",
  DATA_CONFIRMADA: "Data confirmada",
  CONVIDADO_CONVOCADO: "Convidado convocado",
  SESSAO_REALIZADA: "Sessão realizada",
  COMPOSICAO_INTEGRAL: "Composição integral",
  COMPOSICAO_PARCIAL: "Composição parcial",
  REDESIGNADA: "Redesignada",
  ENCERRADO_SEM_COMPOSICAO: "Encerrado sem composição",
  SESSAO_PREJUDICADA: "Sessão prejudicada",
  CANCELADO: "Cancelado",
};

export const ROTULO_MODALIDADE: Record<ModalidadeSessao, string> = {
  VIDEOCONFERENCIA: "Videoconferência",
  PRESENCIAL: "Presencial",
  HIBRIDA: "Híbrida",
};

export const ROTULO_DESFECHO: Record<DesfechoSessao, string> = {
  COMPOSICAO_INTEGRAL: "Composição consensual integral",
  COMPOSICAO_PARCIAL: "Composição consensual parcial",
  REDESIGNACAO: "Redesignação da sessão",
  ENCERRAMENTO_SEM_COMPOSICAO: "Encerramento sem composição",
  SESSAO_PREJUDICADA: "Sessão prejudicada",
};

/** Cor da etiqueta de status, dentro da paleta oficial (docs/05). */
export type TomDeStatus = "neutro" | "andamento" | "atencao" | "sucesso" | "encerrado";

export const TOM_DO_STATUS: Record<StatusAto, TomDeStatus> = {
  RASCUNHO: "neutro",
  AGUARDANDO_DOCUMENTACAO: "atencao",
  DOCUMENTACAO_EM_ANALISE: "atencao",
  DATA_CONFIRMADA: "andamento",
  CONVIDADO_CONVOCADO: "andamento",
  SESSAO_REALIZADA: "andamento",
  COMPOSICAO_INTEGRAL: "sucesso",
  COMPOSICAO_PARCIAL: "sucesso",
  REDESIGNADA: "atencao",
  ENCERRADO_SEM_COMPOSICAO: "encerrado",
  SESSAO_PREJUDICADA: "encerrado",
  CANCELADO: "encerrado",
};

/**
 * Instante no formato que o input `datetime-local` espera, em hora de parede
 * de São Paulo.
 *
 * O input não tem fuso: ele mostra e devolve exatamente o texto que recebe.
 * Formatar em UTC faria a sessão das 14h aparecer como 17h para o operador.
 */
export function paraCampoDeDataHora(data: Date | null | undefined): string {
  if (!data) return "";
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(data);
  return partes.replace(" ", "T");
}
