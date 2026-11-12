/**
 * Cliente da API de assinatura eletrônica da ZapSign.
 *
 * A câmara trocou a D4Sign pela ZapSign em 11/2026: o pacote da D4Sign
 * esgotou, o limite de 10 chamadas por hora travava o envio e as assinaturas
 * saíam fora do lugar. Os envios antigos continuam terminando na D4Sign
 * (`src/lib/d4sign.ts`); a coluna `OperacaoAssinatura.provedor` diz quem é
 * quem.
 *
 * Documentação: https://docs.zapsign.com.br
 *   criar      POST /docs/                  PDF em base64, signatários junto
 *   detalhar   GET  /docs/{token}/          status, signatários, signed_file
 *   cancelar   POST /refuse/                exige o cabeçalho User-Agent
 *   plano      GET  /info-plan/             só leitura, não gasta documento
 *
 * Diferenças da D4Sign que mudam o desenho, e que custam caro se esquecidas:
 *
 *   1. CRIAR JÁ ENVIA. Não há passo "subiu mas não saiu": o documento nasce
 *      com os signatários e os convites partem na mesma chamada. Uma chamada
 *      só, então não existe envio pela metade para retomar.
 *   2. TODO DOCUMENTO CRIADO É COBRADO, mesmo cancelado ou nunca assinado.
 *      Por isso as recusas (sem e-mail, já enviado…) acontecem ANTES daqui.
 *   3. O AVISO (webhook) NÃO É ASSINADO pela ZapSign. A defesa é um token
 *      secreto no caminho e, sobretudo, nunca agir sobre o corpo do aviso:
 *      ele só diz "olhe o documento X", e o estado vem de `consultarDocumento`.
 *   4. O LINK DO PDF ASSINADO EXPIRA EM 60 MINUTOS. Baixa-se na hora, com link
 *      novo de cada consulta. Nunca se grava o link.
 *   5. "doc_signed" chega UMA VEZ POR SIGNATÁRIO. Só se arquiva quando o
 *      status do DOCUMENTO for "signed".
 *
 * O token vai no cabeçalho Authorization (Bearer), nunca na URL: não entra em
 * log de acesso nem em mensagem de erro (CLAUDE.md, regra 8).
 *
 * A integração é OPCIONAL, como as demais: sem ZAPSIGN_API_TOKEN nada aqui é
 * chamado e o sistema segue com o envio manual.
 */
import { timingSafeEqual } from "node:crypto";
import { ErroDeNegocio } from "./erros";

const BASE_PADRAO = "https://api.zapsign.com.br/api/v1";
const TEMPO_LIMITE_MS = 30_000;
/** Ata e Termo têm poucas páginas; acima disso algo está errado. */
const TAMANHO_MAXIMO_DO_ASSINADO = 20 * 1024 * 1024;
/** A ZapSign recusa o cancelamento sem User-Agent. */
const AGENTE = "ConsensusOne/1.0";

function base(): string {
  return (process.env.ZAPSIGN_BASE_URL || BASE_PADRAO).replace(/\/+$/, "");
}

export function zapsignAtiva(): boolean {
  return Boolean(process.env.ZAPSIGN_API_TOKEN);
}

function token(): string {
  const valor = process.env.ZAPSIGN_API_TOKEN;
  if (!valor) {
    throw new ErroDeNegocio(
      "A integração de assinatura eletrônica não está configurada neste ambiente."
    );
  }
  return valor;
}

/** Erro técnico da API. Não vai para a tela: `explicarFalhaDaZapSign` traduz. */
export class ErroDaZapSign extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
    readonly etapa: Etapa,
    mensagem?: string
  ) {
    super(mensagem ?? `ZapSign respondeu ${status} (${etapa}): ${corpo.slice(0, 300)}`);
    this.name = "ErroDaZapSign";
  }
}

type Etapa = "criar" | "consultar" | "baixar" | "cancelar" | "plano";

const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  criar: "na criação do documento",
  consultar: "na consulta do documento",
  baixar: "no download do assinado",
  cancelar: "no cancelamento",
  plano: "na consulta do plano",
};

async function chamar(
  caminho: string,
  etapa: Etapa,
  opcoes: { metodo?: "GET" | "POST"; json?: unknown } = {}
): Promise<unknown> {
  const resposta = await fetch(`${base()}${caminho}`, {
    method: opcoes.metodo ?? (opcoes.json === undefined ? "GET" : "POST"),
    headers: {
      Authorization: `Bearer ${token()}`,
      "User-Agent": AGENTE,
      Accept: "application/json",
      ...(opcoes.json === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: opcoes.json === undefined ? undefined : JSON.stringify(opcoes.json),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  const texto = await resposta.text();
  if (!resposta.ok) throw new ErroDaZapSign(resposta.status, texto, etapa);

  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErroDaZapSign(resposta.status, texto, etapa, "ZapSign respondeu algo que não é JSON.");
  }
}

// --------------------------------------------------------------- signatários

/**
 * Formas de identificação que a ZapSign aceita. A escolha é do cliente
 * (custo por assinatura varia): vem de ZAPSIGN_AUTENTICACAO, e um valor fora
 * da lista cai no padrão em vez de derrubar o envio.
 */
export const MODOS_DE_AUTENTICACAO = [
  "assinaturaTela",
  "tokenEmail",
  "assinaturaTela-tokenEmail",
  "tokenSms",
  "assinaturaTela-tokenSms",
  "tokenWhatsapp",
  "assinaturaTela-tokenWhatsapp",
  "certificadoDigital",
] as const;

export type ModoDeAutenticacao = (typeof MODOS_DE_AUTENTICACAO)[number];

/** Assinatura desenhada na tela + código por e-mail: sem custo extra por assinatura. */
export const AUTENTICACAO_PADRAO: ModoDeAutenticacao = "assinaturaTela-tokenEmail";

export function modoDeAutenticacao(
  valor: string | undefined = process.env.ZAPSIGN_AUTENTICACAO
): ModoDeAutenticacao {
  const limpo = valor?.trim();
  return (MODOS_DE_AUTENTICACAO as readonly string[]).includes(limpo ?? "")
    ? (limpo as ModoDeAutenticacao)
    : AUTENTICACAO_PADRAO;
}

export type SignatarioParaZapSign = {
  nome: string;
  email: string;
  /** "Conciliador", "Interessado Solicitante"… — vai no relatório de assinaturas */
  papel: string;
  /** texto invisível no PDF onde a assinatura deve ser desenhada; null = sem posição */
  ancora: string | null;
};

export type PedidoDeDocumento = {
  nome: string;
  pdf: Buffer;
  /** nosso id do Documento, para achar o envio pelo painel da ZapSign */
  idExterno: string;
  mensagem: string;
  signatarios: SignatarioParaZapSign[];
};

/**
 * Corpo do POST /docs/. Separado da chamada de rede porque é aqui que mora a
 * chance de errar campo — e cada erro aqui é um documento cobrado.
 *
 * Âncora: a ZapSign procura o texto no PDF e desenha a assinatura em TODAS as
 * ocorrências. Duas pessoas com a mesma âncora (dois procuradores do mesmo
 * lado, que dividem a mesma linha) teriam as assinaturas uma por cima da
 * outra; por isso só a primeira de cada âncora a recebe, e as demais assinam
 * sem posição — a assinatura delas fica no relatório de assinaturas.
 */
export function corpoDoDocumento(
  pedido: PedidoDeDocumento,
  autenticacao: ModoDeAutenticacao = modoDeAutenticacao()
): Record<string, unknown> {
  const ancorasUsadas = new Set<string>();

  return {
    name: pedido.nome.slice(0, 255),
    base64_pdf: pedido.pdf.toString("base64"),
    lang: "pt-br",
    external_id: pedido.idExterno,
    folder_path: "/Consensus One",
    disable_signer_emails: false,
    signers: pedido.signatarios.map((s) => {
      const ancora = s.ancora && !ancorasUsadas.has(s.ancora) ? s.ancora : null;
      if (ancora) ancorasUsadas.add(ancora);
      return {
        name: s.nome,
        email: s.email,
        auth_mode: autenticacao,
        send_automatic_email: true,
        send_automatic_whatsapp: false,
        // o nome e o e-mail vêm do cadastro da câmara; o signatário não troca
        lock_name: true,
        lock_email: true,
        qualification: s.papel,
        custom_message: pedido.mensagem,
        ...(ancora ? { signature_placement: ancora } : {}),
      };
    }),
  };
}

/** Cria o documento e dispara os convites. Devolve o token do documento. */
export async function criarDocumento(pedido: PedidoDeDocumento): Promise<{ token: string }> {
  const dados = (await chamar("/docs/", "criar", { json: corpoDoDocumento(pedido) })) as {
    token?: unknown;
  };
  if (typeof dados.token !== "string" || !dados.token) {
    throw new ErroDaZapSign(200, JSON.stringify(dados).slice(0, 300), "criar", "ZapSign não devolveu o token do documento.");
  }
  return { token: dados.token };
}

// ------------------------------------------------------------------ consulta

export type SituacaoNaZapSign = "pendente" | "assinado" | "cancelado";

export type DocumentoNaZapSign = {
  token: string;
  situacao: SituacaoNaZapSign;
  /** status como a ZapSign escreve, para o registro */
  statusBruto: string;
  totalSignatarios: number;
  assinaram: { nome: string; email: string }[];
  /** link temporário (60 min) do PDF assinado; só existe quando assinado */
  arquivoAssinado: string | null;
};

/**
 * Lê a resposta do GET /docs/{token}/. Função pura, para testar o que a
 * documentação não deixa claro: o recusado aparece como "refused" na API e
 * "recusado" no exemplo do webhook, então os dois valem.
 */
export function interpretarDocumento(dados: unknown): DocumentoNaZapSign {
  const d = (dados ?? {}) as Record<string, unknown>;
  const statusBruto = String(d.status ?? "");
  const signers = Array.isArray(d.signers) ? (d.signers as Record<string, unknown>[]) : [];

  let situacao: SituacaoNaZapSign = "pendente";
  if (d.deleted === true || /^(refused|recusado|rejected)$/i.test(statusBruto)) situacao = "cancelado";
  else if (/^signed$/i.test(statusBruto)) situacao = "assinado";

  return {
    token: String(d.token ?? ""),
    situacao,
    statusBruto,
    totalSignatarios: signers.length,
    assinaram: signers
      .filter((s) => /^signed$/i.test(String(s.status ?? "")))
      .map((s) => ({ nome: String(s.name ?? ""), email: String(s.email ?? "").toLowerCase() })),
    arquivoAssinado:
      situacao === "assinado" && typeof d.signed_file === "string" && d.signed_file
        ? d.signed_file
        : null,
  };
}

export async function consultarDocumento(tokenDoDocumento: string): Promise<DocumentoNaZapSign> {
  return interpretarDocumento(
    await chamar(`/docs/${encodeURIComponent(tokenDoDocumento)}/`, "consultar")
  );
}

/**
 * Baixa o PDF assinado. Consulta de novo para ter um link fresco: o que veio
 * em qualquer aviso pode já ter expirado, e não confiamos em link de aviso.
 */
export async function baixarAssinado(tokenDoDocumento: string): Promise<{ conteudo: Buffer }> {
  const documento = await consultarDocumento(tokenDoDocumento);
  if (documento.situacao !== "assinado" || !documento.arquivoAssinado) {
    throw new ErroDaZapSign(
      200,
      documento.statusBruto,
      "baixar",
      `O documento ainda não está assinado na ZapSign (status "${documento.statusBruto}").`
    );
  }

  const resposta = await fetch(documento.arquivoAssinado, {
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!resposta.ok) {
    throw new ErroDaZapSign(resposta.status, "", "baixar", `Download do assinado respondeu ${resposta.status}.`);
  }
  const conteudo = Buffer.from(await resposta.arrayBuffer());
  if (conteudo.length === 0) {
    throw new ErroDaZapSign(200, "", "baixar", "A ZapSign entregou o PDF assinado vazio.");
  }
  if (conteudo.length > TAMANHO_MAXIMO_DO_ASSINADO) {
    throw new ErroDaZapSign(200, "", "baixar", "O PDF assinado passou do tamanho máximo esperado.");
  }
  return { conteudo };
}

/** Cancela (recusa pela câmara) um documento ainda em andamento. */
export async function cancelarDocumento(tokenDoDocumento: string, motivo: string): Promise<void> {
  await chamar("/refuse/", "cancelar", {
    json: { doc_token: tokenDoDocumento, rejected_reason: motivo.slice(0, 500), notify_signer: true },
  });
}

export type PlanoDaZapSign = { nome: string; creditos: number | null; situacao: string };

/** Só leitura: confere o token e o plano sem criar documento (não gasta nada). */
export async function consultarPlano(): Promise<PlanoDaZapSign> {
  const dados = (await chamar("/info-plan/", "plano")) as Record<string, unknown>;
  return {
    nome: String(dados.name ?? ""),
    creditos: typeof dados.number_of_credits === "number" ? dados.number_of_credits : null,
    situacao: String(dados.status ?? ""),
  };
}

// ------------------------------------------------------------------- webhook

/**
 * Endereço público do nosso webhook, com o token secreto no caminho. É o que
 * se cadastra no painel da ZapSign (Configurações › Integrações › Webhooks).
 */
export function urlDoWebhook(): string | null {
  const base = process.env.AUTH_URL;
  const segredo = process.env.ZAPSIGN_WEBHOOK_TOKEN;
  if (!base || !segredo) return null;
  return `${base.replace(/\/$/, "")}/api/webhooks/zapsign/${segredo}`;
}

/** Compara o token do caminho em tempo constante. Sem token configurado, recusa tudo. */
export function tokenDoWebhookConfere(recebido: string | null | undefined): boolean {
  const esperado = process.env.ZAPSIGN_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AvisoDaZapSign = { tokenDoDocumento: string; evento: string };

/**
 * Do corpo do aviso, só interessa QUAL documento e QUE evento. Todo o resto
 * (status, signatários, link do arquivo) é ignorado de propósito: o aviso não
 * é assinado, e o estado verdadeiro vem da consulta autenticada.
 */
export function lerAviso(corpo: unknown): AvisoDaZapSign | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  const tokenDoDocumento = typeof c.token === "string" ? c.token.trim() : "";
  if (!tokenDoDocumento) return null;
  return { tokenDoDocumento, evento: typeof c.event_type === "string" ? c.event_type : "" };
}

// ---------------------------------------------------------- mensagem de erro

function motivoNoCorpo(corpo: string): string | null {
  try {
    const dados = JSON.parse(corpo) as Record<string, unknown>;
    for (const campo of ["message", "detail", "error", "erro"]) {
      const valor = dados[campo];
      if (typeof valor === "string" && valor.trim()) return valor.trim().slice(0, 200);
    }
  } catch {
    // corpo não-JSON (página de erro em HTML): não vale mostrar
  }
  return null;
}

/** Traduz a falha técnica em frase para o operador, sem token nem URL. */
export function explicarFalhaDaZapSign(erro: unknown): string {
  if (erro instanceof ErroDaZapSign) {
    const naEtapa = ` ${ROTULO_DA_ETAPA[erro.etapa]}`;
    const motivo = motivoNoCorpo(erro.corpo);
    const eDisse = motivo ? ` A ZapSign respondeu: "${motivo}".` : "";

    if (erro.status === 401 || erro.status === 403) {
      return `A ZapSign recusou a chave de acesso da câmara${naEtapa}. Confira a chave configurada (produção e sandbox têm chaves diferentes).${eDisse}`;
    }
    if (erro.status === 402) {
      return `A ZapSign recusou${naEtapa}: o plano da conta não inclui a API ou está com pagamento pendente.${eDisse}`;
    }
    if (erro.status === 429) {
      return `A ZapSign limitou as requisições${naEtapa}. Aguarde um minuto e tente de novo.`;
    }
    if (erro.status >= 500) {
      return `A ZapSign está instável${naEtapa}. Tente de novo em alguns minutos.`;
    }
    if (erro.status >= 400) {
      return `A ZapSign recusou o pedido${naEtapa}.${eDisse || " Avise o suporte."}`;
    }
    return `${erro.message} Avise o suporte.`;
  }
  if (erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError")) {
    return "A ZapSign demorou demais para responder. Confira na linha do tempo se o envio saiu antes de tentar de novo.";
  }
  return "Não foi possível falar com a ZapSign. Tente de novo em alguns minutos.";
}
