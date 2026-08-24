/**
 * Cliente da AR Online — o "AR digital" do fluxo (docs/02).
 *
 * O que resolve: hoje o operador envia a Carta-Convite por fora, volta aqui,
 * marca "enviado" na mão e, dias depois, anexa o laudo baixado do portal.
 * Com a integração o envio sai daqui, o status volta por webhook e o laudo é
 * arquivado sozinho no procedimento.
 *
 * Documentação: https://docs.ar-online.com.br
 *   enviar       POST /gw/email                     um endpoint para todos os canais
 *   status       GET  /gw/{canal}/{id}
 *   comprovante  GET  /gw/sending-proof/{id}        JSON com PDF em base64
 *   laudo        GET  /gw/email/laudo/{id}          PDF binário, NÃO é base64
 *
 * Três detalhes da API que custam tempo se ninguém avisar:
 *
 *   1. O token vai no header `Authorization` **sem o prefixo Bearer**.
 *   2. O endpoint é `/gw/email` para qualquer canal. WhatsApp, SMS, voz e carta
 *      registrada são blocos dentro do mesmo corpo, e podem ser combinados.
 *      O identificador devolvido chama-se `idEmail` mesmo quando não há e-mail.
 *   3. Comprovante e laudo são coisas diferentes e chegam diferente: o
 *      comprovante vem em JSON com o PDF em base64; o laudo vem binário. Tentar
 *      dar JSON.parse no laudo é o erro óbvio.
 *
 * A integração é OPCIONAL, como as da D4Sign e do Zoom: sem token o sistema
 * segue inteiro, com o envio manual de sempre.
 */
import { timingSafeEqual } from "node:crypto";
import { ErroDeNegocio } from "./erros";

const BASE = process.env.AR_ONLINE_BASE_URL || "https://api.ar-online.com.br";
const TEMPO_LIMITE_MS = 30_000;

export function envioAutomaticoAtivo(): boolean {
  return Boolean(process.env.AR_ONLINE_TOKEN);
}

function token(): string {
  const valor = process.env.AR_ONLINE_TOKEN;
  if (!valor) {
    throw new ErroDeNegocio("A integração de AR digital não está configurada neste ambiente.");
  }
  return valor;
}

/** Erro técnico da API. Quem chama traduz para mensagem de negócio. */
export class ErroDaArOnline extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string
  ) {
    super(`AR Online respondeu ${status}: ${corpo.slice(0, 300)}`);
    this.name = "ErroDaArOnline";
  }
}

/** Canais da AR Online. O nome do bloco no corpo é o mesmo do caminho de status. */
export type CanalArOnline = "email" | "whatsapp" | "sms" | "voz" | "carta";

export type Destinatario = {
  nome: string;
  email: string | null;
  telefone: string | null;
};

export type Anexo = { nome: string; conteudo: Buffer };

/**
 * Só dígitos, como a API exige ("sem máscaras").
 *
 * Devolve null quando não sobra número plausível: mandar telefone quebrado
 * gasta envio e devolve "número inválido" horas depois.
 */
export function normalizarTelefone(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return null;
  return digitos;
}

/**
 * Canais que dá para usar com os contatos que a pessoa tem cadastrada.
 *
 * WhatsApp só entra se houver template configurado: a AR Online exige um
 * template aprovado, e o identificador dele é da conta do cliente.
 */
export function canaisPossiveis(destinatario: Destinatario): CanalArOnline[] {
  const canais: CanalArOnline[] = [];
  if (destinatario.email) canais.push("email");
  if (normalizarTelefone(destinatario.telefone) && process.env.AR_ONLINE_TEMPLATE_WHATSAPP) {
    canais.push("whatsapp");
  }
  return canais;
}

export type PedidoDeEnvio = {
  destinatario: Destinatario;
  assunto: string;
  /** Corpo em HTML. Vai para o e-mail e para o texto de acompanhamento. */
  conteudoHtml: string;
  /** Nosso id do Envio, devolvido nos avisos para correlacionar. */
  referencia: string;
  anexo?: Anexo;
  /** Variáveis do template de WhatsApp, combinadas com o cliente. */
  variaveisDoTemplate?: Record<string, string>;
};

/**
 * Monta o corpo do envio. Separado da chamada de rede para poder ser testado
 * sem tocar na API — é aqui que mora a chance de errar campo.
 */
export function montarCorpo(pedido: PedidoDeEnvio): Record<string, unknown> {
  const canais = canaisPossiveis(pedido.destinatario);
  if (canais.length === 0) {
    throw new ErroDeNegocio(
      "O destinatário não tem e-mail nem telefone cadastrado para o envio por AR digital."
    );
  }

  const corpo: Record<string, unknown> = {
    nameTo: pedido.destinatario.nome,
    subject: pedido.assunto,
    content: pedido.conteudoHtml,
    customID: pedido.referencia,
  };

  if (canais.includes("email")) corpo.to = pedido.destinatario.email;

  if (pedido.anexo) {
    corpo.attachments = [
      { name: pedido.anexo.nome, base64: pedido.anexo.conteudo.toString("base64") },
    ];
  }

  if (canais.includes("whatsapp")) {
    corpo.whatsapp = {
      number: normalizarTelefone(pedido.destinatario.telefone),
      variables: {
        template: process.env.AR_ONLINE_TEMPLATE_WHATSAPP,
        ...(pedido.variaveisDoTemplate ?? {}),
      },
    };
  }

  return corpo;
}

async function chamar(caminho: string, metodo: "GET" | "POST", corpo?: unknown): Promise<Response> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      // sem "Bearer": é assim que a AR Online espera
      Authorization: token(),
      ...(corpo === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  if (!resposta.ok) throw new ErroDaArOnline(resposta.status, await resposta.text());
  return resposta;
}

/** Dispara a notificação e devolve o protocolo (o `idEmail` da AR Online). */
export async function enviarNotificacao(pedido: PedidoDeEnvio): Promise<{
  protocolo: string;
  canais: CanalArOnline[];
}> {
  const canais = canaisPossiveis(pedido.destinatario);
  const resposta = await chamar("/gw/email", "POST", montarCorpo(pedido));
  const texto = await resposta.text();

  const dados = JSON.parse(texto) as { idEmail?: string };
  if (!dados.idEmail) {
    throw new ErroDaArOnline(resposta.status, texto);
  }

  return { protocolo: dados.idEmail, canais };
}

/**
 * Laudo pericial do envio, em PDF.
 *
 * Vem BINÁRIO, ao contrário do comprovante. Não tente decodificar como base64.
 * É este arquivo que o fluxo arquiva no procedimento como Laudo de AR.
 */
export async function baixarLaudo(protocolo: string): Promise<Buffer> {
  const resposta = await chamar(`/gw/email/laudo/${encodeURIComponent(protocolo)}`, "GET");
  return Buffer.from(await resposta.arrayBuffer());
}

/** Situação atual do envio num canal. Usado quando o webhook não chegou. */
export async function consultarStatus(
  canal: CanalArOnline,
  protocolo: string
): Promise<Record<string, unknown>> {
  const resposta = await chamar(`/gw/${canal}/${encodeURIComponent(protocolo)}`, "GET");
  return JSON.parse(await resposta.text()) as Record<string, unknown>;
}

/**
 * Status que significam entrega concluída, em qualquer canal.
 *
 * A AR Online devolve texto livre em português, com variação entre canais
 * ("Entregue", "Visualizado", "Confirmou o recebimento"). Comparação sem
 * acento e sem caixa, porque a grafia oscila.
 */
const ENTREGUES = ["entregue", "visualizado", "lido", "confirmou o recebimento", "respondido"];

export function statusIndicaEntrega(status: string | null | undefined): boolean {
  if (!status) return false;
  const limpo = status
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // a AR Online oscila entre grafar com e sem acento
    .toLowerCase()
    .trim();
  return ENTREGUES.some((termo) => limpo.startsWith(termo));
}

/**
 * Confere o header fixo que a AR Online envia nos avisos.
 *
 * Comparação em tempo constante: igualdade com `===` vaza, pelo tempo de
 * resposta, quantos caracteres do começo o atacante já acertou.
 */
export function avisoAutentico(cabecalho: string | null): boolean {
  const esperado = process.env.AR_ONLINE_WEBHOOK_TOKEN;
  if (!esperado || !cabecalho) return false;

  const a = Buffer.from(cabecalho);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
