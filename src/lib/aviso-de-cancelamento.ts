/**
 * Aviso de cancelamento da Sessão Privada de Conciliação.
 *
 * Pedido do cliente (10/11/2026): ao cancelar, quem foi convidado não recebia
 * nada, e continuava achando que a sessão estava de pé. Agora o encerramento
 * administrativo avisa cada pessoa que recebeu Carta-Convite do procedimento.
 *
 * Módulo puro (sem banco, sem rede) para testar o texto e a escolha de quem
 * recebe. O envio em si fica em `src/acoes/fluxo.ts`.
 *
 * Não é peça jurídica nem modelo oficial (regra 11): é aviso operacional. Por
 * isso não traz o motivo do encerramento, que é anotação interna da câmara,
 * nem o nome da outra parte.
 */
import { FUSO } from "./prazos";

export type PessoaAvisavel = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
};

/**
 * Quem deve ser avisado: cada pessoa que recebeu Carta-Convite deste
 * procedimento, uma vez só, mesmo que tenha recebido mais de um envio.
 *
 * Quem nunca recebeu carta não sabe da data, e um aviso de cancelamento de
 * sessão que ela desconhece só gera dúvida.
 */
export function destinatariosDoAviso(envios: { destinatario: PessoaAvisavel }[]): PessoaAvisavel[] {
  const vistos = new Map<string, PessoaAvisavel>();
  for (const { destinatario } of envios) {
    if (!vistos.has(destinatario.id)) vistos.set(destinatario.id, destinatario);
  }
  return [...vistos.values()];
}

function formatarData(data: Date | null): string {
  if (!data) return "data a designar";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: FUSO }).format(data);
}

function formatarHora(data: Date | null): string | null {
  if (!data) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO,
  }).format(data);
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MensagemDeCancelamento = {
  assunto: string;
  texto: string;
  html: string;
};

export function mensagemDeCancelamento(dados: {
  nomeDestinatario: string;
  numeroDoAto: string;
  nomeCamara: string;
  dataDaSessao: Date | null;
}): MensagemDeCancelamento {
  const data = formatarData(dados.dataDaSessao);
  const hora = formatarHora(dados.dataDaSessao);
  const quando = hora ? `${data}, às ${hora}` : data;

  const paragrafos = [
    `Prezado(a) ${dados.nomeDestinatario},`,
    `Informamos que a Sessão Privada de Conciliação do Procedimento Privado de ` +
      `Composição Consensual nº ${dados.numeroDoAto}, designada para ${quando}, ` +
      `foi cancelada pela ${dados.nomeCamara}.`,
    `Desconsidere a Carta-Convite e os avisos anteriores referentes a essa data. ` +
      `Não é necessário comparecer nem acessar a sala de videoconferência.`,
    `Em caso de dúvida, entre em contato com a ${dados.nomeCamara}.`,
  ];

  return {
    assunto: `Cancelamento da Sessão Privada de Conciliação — Procedimento ${dados.numeroDoAto}`,
    texto: paragrafos.join("\n\n"),
    html: paragrafos.map((p) => `<p>${escapar(p)}</p>`).join(""),
  };
}

/**
 * Variáveis do template de WhatsApp de cancelamento. Mesmos nomes do template
 * da carta-convite, para o cliente aprovar o novo na AR Online sem mudar nada
 * aqui: INSTITUICAO (as partes, "Solicitante x Convidado"), DATA e HORA.
 */
export function variaveisDoCancelamento(dados: {
  solicitante: string;
  convidado: string;
  dataDaSessao: Date | null;
}): Record<string, string> {
  return {
    INSTITUICAO: `${dados.solicitante} x ${dados.convidado}`,
    DATA: formatarData(dados.dataDaSessao),
    HORA: formatarHora(dados.dataDaSessao) ?? "—",
  };
}
