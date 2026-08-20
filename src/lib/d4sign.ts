/**
 * Cliente da API de assinatura eletrônica da D4Sign — integração da Etapa 2.
 *
 * O que a integração resolve: hoje o operador baixa a Ata, sobe no painel da
 * D4Sign, cadastra os signatários, espera, baixa o assinado e anexa aqui de
 * volta. Com a integração isso vira um botão, e o documento assinado se
 * arquiva sozinho quando a D4Sign avisa que ficou pronto.
 *
 * Documentação: https://docapi.d4sign.com.br
 *   upload       POST /documents/{uuid-cofre}/upload      multipart, campo "file"
 *   signatários  POST /documents/{uuid}/createlist
 *   nome         POST /documents/{uuid}/addinfo           um por signatário
 *   webhook      POST /documents/{uuid}/webhooks
 *   enviar       POST /documents/{uuid}/sendtosigner
 *   baixar       POST /documents/{uuid}/download          devolve URL do PDF
 *   cancelar     POST /documents/{uuid}/cancel
 *
 * ⚠️ LIMITE DE REQUISIÇÕES. A conta padrão da D4Sign aceita 10 chamadas por
 * hora. Um envio consome 4 + uma por signatário; o arquivamento consome mais
 * duas. Na prática isso dá cerca de um procedimento por hora enquanto o limite
 * não for ampliado pelo comercial da D4Sign. Não adicione chamada aqui sem
 * contar quanto custa.
 *
 * A integração é OPCIONAL: sem token configurado o sistema segue inteiro, com
 * o envio manual de sempre. Nada aqui é caminho obrigatório de nenhum passo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { ErroDeNegocio } from "./erros";

const BASE = process.env.D4SIGN_BASE_URL || "https://secure.d4sign.com.br/api/v1";
const TEMPO_LIMITE_MS = 30_000;

export function assinaturaDigitalAtiva(): boolean {
  return Boolean(process.env.D4SIGN_TOKEN_API && process.env.D4SIGN_UUID_COFRE);
}

function credenciais(): { tokenAPI: string; cryptKey: string } {
  const tokenAPI = process.env.D4SIGN_TOKEN_API;
  if (!tokenAPI) {
    throw new ErroDeNegocio(
      "A integração de assinatura eletrônica não está configurada neste ambiente."
    );
  }
  return { tokenAPI, cryptKey: process.env.D4SIGN_CRYPT_KEY ?? "" };
}

function cofre(): string {
  const uuid = process.env.D4SIGN_UUID_COFRE;
  if (!uuid) {
    throw new ErroDeNegocio("O cofre da D4Sign não está configurado neste ambiente.");
  }
  return uuid;
}

/**
 * Erro técnico da API. Não vai para a tela: quem chama traduz para mensagem de
 * negócio. Guardamos status e corpo porque, sem eles, depurar integração é
 * adivinhação.
 */
export class ErroDaD4Sign extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
    mensagem = `D4Sign respondeu ${status}`
  ) {
    super(mensagem);
    this.name = "ErroDaD4Sign";
  }
}

/**
 * A autenticação da D4Sign vai na query string, não em cabeçalho.
 *
 * Consequência prática: a URL COMPLETA carrega o token. Ela não pode ser
 * registrada em log, nem em mensagem de erro, nem em auditoria — por isso o
 * corpo do erro guarda só a resposta, nunca a URL.
 */
function montarUrl(caminho: string): string {
  const { tokenAPI, cryptKey } = credenciais();
  const parametros = new URLSearchParams({ tokenAPI });
  if (cryptKey) parametros.set("cryptKey", cryptKey);
  return `${BASE}${caminho}?${parametros.toString()}`;
}

async function chamar(
  caminho: string,
  opcoes: { body?: BodyInit; json?: unknown; metodo?: string } = {}
): Promise<unknown> {
  const cabecalhos: Record<string, string> = { Accept: "application/json" };
  let corpo = opcoes.body;

  if (opcoes.json !== undefined) {
    cabecalhos["Content-Type"] = "application/json";
    corpo = JSON.stringify(opcoes.json);
  }

  const resposta = await fetch(montarUrl(caminho), {
    method: opcoes.metodo ?? "POST",
    headers: cabecalhos,
    body: corpo,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  const texto = await resposta.text();

  if (resposta.status === 429) {
    throw new ErroDaD4Sign(
      429,
      texto.slice(0, 300),
      "Limite de requisições da D4Sign atingido"
    );
  }
  if (!resposta.ok) {
    throw new ErroDaD4Sign(resposta.status, texto.slice(0, 500));
  }

  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroDaD4Sign(resposta.status, texto.slice(0, 500), "Resposta ilegível da D4Sign");
  }
}

function objeto(resposta: unknown): Record<string, unknown> {
  // vários endpoints devolvem [ { ... } ] em vez do objeto direto
  const alvo = Array.isArray(resposta) ? resposta[0] : resposta;
  if (!alvo || typeof alvo !== "object") {
    throw new ErroDaD4Sign(200, JSON.stringify(resposta).slice(0, 300), "Resposta sem corpo");
  }
  return alvo as Record<string, unknown>;
}

// ------------------------------------------------------------------ upload

/** Sobe o PDF no cofre e devolve o UUID do documento na D4Sign. */
export async function enviarPdf(conteudo: Buffer, nomeArquivo: string): Promise<string> {
  const formulario = new FormData();
  formulario.append("file", new Blob([new Uint8Array(conteudo)], { type: "application/pdf" }), nomeArquivo);

  // sem Content-Type manual: o fetch precisa gerar o boundary do multipart
  const dados = objeto(await chamar(`/documents/${cofre()}/upload`, { body: formulario }));
  const uuid = dados.uuid;
  if (typeof uuid !== "string" || !uuid) {
    throw new ErroDaD4Sign(200, JSON.stringify(dados).slice(0, 300), "Upload sem UUID de documento");
  }
  return uuid;
}

// --------------------------------------------------------------- signatários

export type SignatarioDaD4Sign = {
  nome: string;
  email: string;
  /** aparece na página de assinaturas: "Interessado Solicitante", "Conciliador"... */
  papel: string;
};

/**
 * Cadastra quem assina.
 *
 * `act: "1"` é "Assinar" — a ação simples. As demais da tabela da D4Sign
 * (aprovar, testemunhar, avalizar) não correspondem ao que a Ata e o Termo
 * pedem: quem está na lista assina, e ponto.
 *
 * `foreign: "0"` = signatário com CPF. `certificadoicpbr: "0"` = assinatura
 * padrão da D4Sign, sem exigir certificado ICP-Brasil — exigir certificado
 * inviabilizaria a assinatura de quem não tem, que é a maioria.
 */
export async function cadastrarSignatarios(
  uuidDocumento: string,
  signatarios: SignatarioDaD4Sign[]
): Promise<void> {
  if (signatarios.length === 0) throw new ErroDeNegocio("Nenhum signatário informado.");

  await chamar(`/documents/${uuidDocumento}/createlist`, {
    json: {
      signers: signatarios.map((s) => ({
        email: s.email,
        act: "1",
        foreign: "0",
        certificadoicpbr: "0",
        assinatura_presencial: "0",
      })),
    },
  });
}

/**
 * Grava o nome de cada signatário.
 *
 * Custa uma chamada por pessoa, o que pesa no limite de requisições — mas o
 * nome sai impresso na página de assinaturas do documento final. Deixar em
 * branco produziria uma Ata cuja folha de assinaturas identifica as partes só
 * por e-mail, o que não serve num documento com valor de título executivo.
 */
export async function cadastrarNomes(
  uuidDocumento: string,
  signatarios: SignatarioDaD4Sign[]
): Promise<void> {
  for (const s of signatarios) {
    await chamar(`/documents/${uuidDocumento}/addinfo`, {
      json: { email: s.email, display_name: s.nome },
    });
  }
}

// ---------------------------------------------------------------- webhook

/**
 * Registra onde a D4Sign deve avisar. O webhook é POR DOCUMENTO: não existe
 * cadastro global, então isso entra em todo envio.
 */
export async function registrarWebhook(uuidDocumento: string, url: string): Promise<void> {
  await chamar(`/documents/${uuidDocumento}/webhooks`, { json: { url } });
}

/** Endereço público do nosso webhook, com o token secreto no caminho. */
export function urlDoWebhook(): string | null {
  // AUTH_URL já é o endereço público da aplicação; não vale criar uma segunda
  // variável para a mesma coisa e arriscar que uma fique desatualizada
  const base = process.env.AUTH_URL;
  const token = process.env.D4SIGN_WEBHOOK_TOKEN;
  if (!base || !token) return null;
  return `${base.replace(/\/$/, "")}/api/webhooks/d4sign/${token}`;
}

// ----------------------------------------------------------------- envio

/** Dispara os convites por e-mail. A partir daqui, quem fala conosco é o webhook. */
export async function enviarParaAssinatura(uuidDocumento: string, mensagem: string): Promise<void> {
  await chamar(`/documents/${uuidDocumento}/sendtosigner`, {
    json: { skip_email: "0", workflow: "0", message: mensagem },
  });
}

/** Cancela o documento — usado quando o procedimento é cancelado aqui. */
export async function cancelarDocumento(uuidDocumento: string, motivo: string): Promise<void> {
  await chamar(`/documents/${uuidDocumento}/cancel`, { json: { comment: motivo } });
}

// --------------------------------------------------------------- download

const LIMITE_DOWNLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Baixa o PDF assinado.
 *
 * São dois passos: a API devolve uma URL temporária, e o arquivo vem dela.
 * `document: "true"` traz o PDF do documento, e não o pacote com anexos.
 */
export async function baixarAssinado(
  uuidDocumento: string
): Promise<{ conteudo: Buffer; nomeArquivo: string }> {
  const dados = objeto(
    await chamar(`/documents/${uuidDocumento}/download`, {
      json: { type: "PDF", language: "pt", document: "true" },
    })
  );

  const url = dados.url;
  if (typeof url !== "string" || !url) {
    throw new ErroDaD4Sign(200, JSON.stringify(dados).slice(0, 300), "Download sem URL");
  }

  const arquivo = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
  if (!arquivo.ok) {
    throw new ErroDaD4Sign(arquivo.status, "", "Falha ao buscar o PDF assinado");
  }

  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  if (conteudo.length === 0) throw new ErroDaD4Sign(200, "", "PDF assinado veio vazio");
  if (conteudo.length > LIMITE_DOWNLOAD_BYTES) {
    throw new ErroDaD4Sign(200, "", "PDF assinado maior que o limite aceito");
  }

  const nome = typeof dados.name === "string" && dados.name ? dados.name : "documento-assinado.pdf";
  return { conteudo, nomeArquivo: nome };
}

// ---------------------------------------------------------------- webhook

/** Avisos da D4Sign. Chegam como form-data, não como JSON. */
export const AVISO = {
  FINALIZADO: "1",
  EMAIL_NAO_ENVIADO: "2",
  CANCELADO: "3",
  ASSINADO: "4",
} as const;

/**
 * Confere o `Content-Hmac` do aviso.
 *
 * ⚠️ Este controle é mais fraco que o de outros fornecedores: a D4Sign assina
 * apenas o UUID do documento, não o corpo da requisição. Como o UUID não muda,
 * o hash é sempre o mesmo para o mesmo documento — quem capturar um aviso pode
 * repeti-lo. Por isso ele NÃO é a única defesa:
 *
 *   1. o endereço do webhook carrega um token secreto no caminho;
 *   2. o conteúdo nunca vem do aviso. Ele é só o gatilho: ao recebê-lo, o
 *      sistema busca o documento assinado na API da D4Sign, autenticado, pelo
 *      UUID que já estava gravado aqui. Aviso forjado não injeta arquivo.
 *
 * Sem segredo configurado, devolve `false`: recusar é o comportamento seguro.
 */
export function avisoAutentico(uuidDocumento: string, cabecalhoHmac: string | null): boolean {
  const segredo = process.env.D4SIGN_WEBHOOK_SEGREDO;
  if (!segredo || !cabecalhoHmac || !uuidDocumento) return false;

  const recebido = cabecalhoHmac.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-f]+$/i.test(recebido)) return false;

  const esperado = createHmac("sha256", segredo).update(uuidDocumento, "utf8").digest("hex");

  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recebido.toLowerCase(), "hex");
  // timingSafeEqual exige mesmo tamanho: compare antes, senão ele lança
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Compara o token do caminho com o configurado, sem vazar tempo. */
export function tokenDoWebhookConfere(recebido: string): boolean {
  const esperado = process.env.D4SIGN_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;

  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(recebido, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
