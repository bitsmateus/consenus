/**
 * Agendamento da Sessão Privada de Conciliação no Zoom.
 *
 * O que resolve: os três campos da videoconferência (link, ID e senha) nunca
 * eram preenchidos por ninguém — só lidos pelas cartas, que saíam dizendo
 * "a ser informado". Agora a reunião nasce junto com o procedimento e a
 * Carta-Convite ao Interessado Solicitante já leva o link.
 *
 * O Zoom é a plataforma oficial da câmara, definida na reunião de 24/08.
 *
 * Autenticação Server-to-Server OAuth (não é OAuth de usuário, não há tela de
 * consentimento): as credenciais são de conta, e o token vale uma hora.
 *   token    POST https://zoom.us/oauth/token?grant_type=account_credentials
 *   criar    POST https://api.zoom.us/v2/users/me/meetings
 *   cancelar DELETE https://api.zoom.us/v2/meetings/{id}
 *
 * A integração é OPCIONAL, como a da D4Sign: sem credencial o sistema segue
 * inteiro e o operador informa os dados da reunião por fora. Nada aqui é
 * caminho obrigatório de nenhum passo do fluxo.
 */
import { ErroDeNegocio } from "./erros";
import { FUSO } from "./prazos";

const OAUTH = "https://zoom.us/oauth/token";
const API = "https://api.zoom.us/v2";
const TEMPO_LIMITE_MS = 20_000;

/** Reunião agendada, não recorrente nem instantânea. */
const TIPO_AGENDADA = 2;

export function videoconferenciaAtiva(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET
  );
}

function credenciais(): { contaId: string; clienteId: string; segredo: string } {
  const contaId = process.env.ZOOM_ACCOUNT_ID;
  const clienteId = process.env.ZOOM_CLIENT_ID;
  const segredo = process.env.ZOOM_CLIENT_SECRET;

  if (!contaId || !clienteId || !segredo) {
    throw new ErroDeNegocio(
      "A integração com o Zoom não está configurada neste ambiente."
    );
  }
  return { contaId, clienteId, segredo };
}

/** Erro técnico da API. Quem chama traduz para mensagem de negócio. */
export class ErroDoZoom extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
    mensagem?: string
  ) {
    super(mensagem ?? `Zoom respondeu ${status}: ${corpo.slice(0, 300)}`);
    this.name = "ErroDoZoom";
  }
}

export type ReuniaoDoZoom = {
  idReuniao: string;
  link: string;
  senha: string | null;
};

/**
 * Instante no formato que o Zoom espera, com o fuso declarado à parte.
 *
 * Mandar UTC com "Z" e declarar timezone junto faz o Zoom converter duas
 * vezes. O jeito certo é a hora de parede local, sem sufixo, e o campo
 * `timezone` dizendo qual é o fuso.
 */
export function instanteParaZoom(quando: Date, fuso = FUSO): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(quando);

  // o locale sueco já entrega "AAAA-MM-DD HH:MM:SS"; o Zoom quer "T" no meio
  return partes.replace(" ", "T");
}

/** Assunto da reunião. Sem nome de parte: o Zoom é serviço de terceiro. */
export function topicoDaReuniao(numeroDoAto: string): string {
  return `Sessão Privada de Conciliação — Procedimento ${numeroDoAto}`;
}

async function token(): Promise<string> {
  const { contaId, clienteId, segredo } = credenciais();
  const basica = Buffer.from(`${clienteId}:${segredo}`).toString("base64");

  const resposta = await fetch(
    `${OAUTH}?grant_type=account_credentials&account_id=${encodeURIComponent(contaId)}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${basica}` },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    }
  );

  const corpo = await resposta.text();
  if (!resposta.ok) throw new ErroDoZoom(resposta.status, corpo);

  const dados = JSON.parse(corpo) as { access_token?: string };
  if (!dados.access_token) throw new ErroDoZoom(resposta.status, corpo, "Zoom não devolveu token.");
  return dados.access_token;
}

async function chamar(
  caminho: string,
  metodo: "POST" | "DELETE",
  corpo?: unknown
): Promise<string> {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  const texto = await resposta.text();
  if (!resposta.ok) throw new ErroDoZoom(resposta.status, texto);
  return texto;
}

export async function criarReuniao(params: {
  numeroDoAto: string;
  quando: Date;
  duracaoMinutos: number;
}): Promise<ReuniaoDoZoom> {
  const texto = await chamar("/users/me/meetings", "POST", {
    topic: topicoDaReuniao(params.numeroDoAto),
    type: TIPO_AGENDADA,
    start_time: instanteParaZoom(params.quando),
    timezone: FUSO,
    duration: params.duracaoMinutos,
    settings: {
      // sala de espera ligada: sessão privada não recebe quem chega sem convite
      waiting_room: true,
      join_before_host: false,
      // a câmara conduz a sessão; gravação é decisão do conciliador, não padrão
      auto_recording: "none",
    },
  });

  const dados = JSON.parse(texto) as { id?: number; join_url?: string; password?: string };
  if (!dados.id || !dados.join_url) {
    throw new ErroDoZoom(200, texto, "Zoom criou a reunião sem id ou link.");
  }

  return {
    idReuniao: String(dados.id),
    link: dados.join_url,
    senha: dados.password || null,
  };
}

export async function cancelarReuniao(idReuniao: string): Promise<void> {
  await chamar(`/meetings/${idReuniao}`, "DELETE");
}
