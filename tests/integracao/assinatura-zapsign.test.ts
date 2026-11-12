/**
 * Assinatura eletrônica pela ZapSign (troca da D4Sign, 11/2026), contra o
 * banco de verdade. A API da ZapSign é simulada: todo documento criado lá é
 * cobrado e a câmara não tem conta de testes.
 *
 * O que se prova aqui:
 *  - o envio cria UM documento na ZapSign, com a âncora da linha de cada um,
 *    e grava a operação como ZAPSIGN;
 *  - o webhook nunca confia no corpo: o estado vem da consulta à API;
 *  - avisos repetidos (um por signatário, mais reenvios) não duplicam nada;
 *  - assinado por todos, o PDF é arquivado como DOCUMENTO_ASSINADO;
 *  - a retificação cancela o envio pendente na plataforma certa.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoPessoa } from "@prisma/client";

const MARCA = `z${process.pid}${Date.now()}`.slice(-12);

let sessao: { id: string; papel: Papel; subPapelOperador: null } | null = null;

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/pdf", () => ({ gerarPdf: vi.fn(async () => Buffer.from("%PDF-ata")) }));
vi.mock("@/lib/storage", () => ({
  montarChave: vi.fn((atoId: string, pasta: string, nome: string) => `atos/${atoId}/${pasta}/${nome}`),
  baixarArquivo: vi.fn(async () => Buffer.from("%PDF-ata")),
  enviarArquivo: vi.fn(async (p: { chave: string; conteudo: Buffer }) => ({
    chave: p.chave,
    hashSha256: "hash-assinado",
    tamanhoBytes: p.conteudo.length,
  })),
}));

const { db } = await import("@/lib/db");
const { gerarAta, retificarAta } = await import("@/acoes/fluxo");
const { enviarParaAssinatura } = await import("@/acoes/assinaturas");
const { POST: webhookZapSign } = await import("@/app/api/webhooks/zapsign/[token]/route");

// ------------------------------------------------------- ZapSign simulada

type Chamada = { url: string; metodo: string; corpo: unknown; autorizacao: string | null };
let chamadas: Chamada[] = [];
/** estado do documento "lá na ZapSign", por token */
const naZapSign = new Map<string, { status: string; signers: { name: string; email: string; status: string }[] }>();
let proximoToken = 0;

function respostaJson(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json" } });
}

const fetchSimulado = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
  const url = String(entrada);
  const metodo = init?.method ?? "GET";
  const cabecalhos = new Headers(init?.headers);
  const corpo = init?.body ? JSON.parse(String(init.body)) : null;
  chamadas.push({ url, metodo, corpo, autorizacao: cabecalhos.get("authorization") });

  if (url.startsWith("https://arquivos.zapsign.test/")) {
    return new Response(Buffer.from("%PDF-assinado"), { status: 200 });
  }
  const caminho = url.replace("https://api.zapsign.com.br/api/v1", "");

  if (caminho === "/docs/" && metodo === "POST") {
    const token = `zs-${MARCA}-${++proximoToken}`;
    const signers = (corpo.signers as { name: string; email: string }[]).map((s) => ({
      name: s.name,
      email: s.email,
      status: "new",
    }));
    naZapSign.set(token, { status: "pending", signers });
    return respostaJson({ token, status: "pending", signers });
  }
  const detalhe = caminho.match(/^\/docs\/([^/]+)\/$/);
  if (detalhe && metodo === "GET") {
    const doc = naZapSign.get(decodeURIComponent(detalhe[1]!));
    if (!doc) return respostaJson({ detail: "não encontrado" }, 404);
    return respostaJson({
      token: detalhe[1],
      status: doc.status,
      signers: doc.signers,
      signed_file: doc.status === "signed" ? "https://arquivos.zapsign.test/assinado.pdf" : null,
    });
  }
  if (caminho === "/refuse/" && metodo === "POST") {
    const doc = naZapSign.get(corpo.doc_token);
    if (doc) doc.status = "refused";
    return respostaJson({ message: "ok" });
  }
  return respostaJson({ detail: `rota inesperada ${metodo} ${caminho}` }, 500);
});

const AMBIENTE = {
  ASSINATURA_PROVEDOR: "zapsign",
  ZAPSIGN_API_TOKEN: "token-de-teste",
  ZAPSIGN_WEBHOOK_TOKEN: "segredo-do-webhook",
  AUTH_URL: "https://app.consensus.test",
};
const anterior: Record<string, string | undefined> = {};

// --------------------------------------------------------------- dados

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };
let adminId: string;
const pessoas: Record<string, string> = {};
let contador = 0;

async function pessoa(nome: string, documento: string, email: string) {
  const p = await db.pessoa.create({
    data: { tipo: TipoPessoa.FISICA, nome: `${nome} ${MARCA}`, documento, email },
  });
  criados.pessoas.push(p.id);
  return p.id;
}

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return dados;
}

async function comAtaLavrada() {
  contador++;
  const ato = await db.ato.create({
    data: {
      numero: `2094.${String(contador).padStart(4, "0")}`,
      criadoPorId: adminId,
      status: "SESSAO_REALIZADA",
      desfecho: "ENCERRAMENTO_SEM_COMPOSICAO",
      dataConfirmada: new Date("2026-11-10T12:00:00Z"),
      horaInicio: new Date("2026-11-10T12:00:00Z"),
      horaEncerramento: new Date("2026-11-10T12:30:00Z"),
      partes: {
        create: [
          { pessoaId: pessoas.solicitante!, papel: "SOLICITANTE", compareceu: true },
          { pessoaId: pessoas.convidado!, papel: "CONVIDADO", compareceu: false },
          { pessoaId: pessoas.conciliador!, papel: "CONCILIADOR", compareceu: true },
        ],
      },
    },
  });
  criados.atos.push(ato.id);
  await gerarAta(formulario({ atoId: ato.id }));
  const ata = await db.documento.findFirstOrThrow({ where: { atoId: ato.id, tipo: "ATA" } });
  return { ato, ata };
}

async function enviada() {
  const { ato, ata } = await comAtaLavrada();
  const resposta = await enviarParaAssinatura({}, formulario({ documentoId: ata.id }));
  expect(resposta.erro).toBeUndefined();
  const operacao = await db.operacaoAssinatura.findUniqueOrThrow({ where: { documentoId: ata.id } });
  return { ato, ata, operacao };
}

function aviso(token: string, corpo: unknown) {
  return webhookZapSign(
    new Request(`https://app.consensus.test/api/webhooks/zapsign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ token }) }
  );
}

function assinar(tokenDoDocumento: string, email: string) {
  const doc = naZapSign.get(tokenDoDocumento)!;
  for (const s of doc.signers) if (s.email === email) s.status = "signed";
  if (doc.signers.every((s) => s.status === "signed")) doc.status = "signed";
}

beforeAll(async () => {
  for (const [chave, valor] of Object.entries(AMBIENTE)) {
    anterior[chave] = process.env[chave];
    process.env[chave] = valor;
  }
  vi.stubGlobal("fetch", fetchSimulado);

  const admin = await db.usuario.create({
    data: { nome: `Adm ${MARCA}`, email: `adm.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.ADMIN },
  });
  adminId = admin.id;
  criados.usuarios.push(admin.id);
  sessao = { id: adminId, papel: Papel.ADMIN, subPapelOperador: null };
  pessoas.solicitante = await pessoa("Solicitante", `${MARCA}01`, `sol.${MARCA}@exemplo.test`);
  pessoas.convidado = await pessoa("Convidado", `${MARCA}02`, `conv.${MARCA}@exemplo.test`);
  pessoas.conciliador = await pessoa("Conciliador", `${MARCA}03`, `conc.${MARCA}@exemplo.test`);
});

beforeEach(() => {
  chamadas = [];
});

afterEach(() => fetchSimulado.mockClear());

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const [chave, valor] of Object.entries(anterior)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.operacaoAssinatura.deleteMany({ where: { atoId: { in: criados.atos } } });
  await db.documento.updateMany({ where: { atoId: { in: criados.atos } }, data: { substituidoPorId: null } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

// --------------------------------------------------------------- testes

describe("envio pela ZapSign", () => {
  it("cria um documento só, com a âncora da linha de cada signatário, e grava como ZAPSIGN", async () => {
    const { operacao } = await enviada();

    const criacoes = chamadas.filter((c) => c.url.endsWith("/docs/") && c.metodo === "POST");
    expect(criacoes).toHaveLength(1);
    expect(criacoes[0]!.autorizacao).toBe("Bearer token-de-teste");
    // o token nunca vai na URL
    expect(criacoes[0]!.url).not.toContain("token-de-teste");

    const signers = (criacoes[0]!.corpo as { signers: Record<string, unknown>[] }).signers;
    // quem compareceu (solicitante) e o conciliador; o convidado faltou
    expect(signers.map((s) => s.signature_placement).sort()).toEqual([
      "<<assina-conciliador>>",
      "<<assina-solicitante>>",
    ]);

    expect(operacao.provedor).toBe("ZAPSIGN");
    expect(operacao.status).toBe("AGUARDANDO");
    expect(operacao.totalSignatarios).toBe(2);
  });

  it("documento já enviado não vai de novo (cada criação é cobrada)", async () => {
    const { ata } = await enviada();
    chamadas = [];
    const resposta = await enviarParaAssinatura({}, formulario({ documentoId: ata.id }));
    expect(resposta.erro).toMatch(/já foi enviado/);
    expect(chamadas).toHaveLength(0);
  });
});

describe("retorno (webhook) da ZapSign", () => {
  it("token errado no caminho: 404, sem consultar nada", async () => {
    const resposta = await aviso("token-errado", { token: "qualquer", event_type: "doc_signed" });
    expect(resposta.status).toBe(404);
    expect(chamadas).toHaveLength(0);
  });

  it("não confia no corpo: aviso dizendo 'signed' sem ninguém ter assinado não arquiva nada", async () => {
    const { operacao } = await enviada();
    const resposta = await aviso("segredo-do-webhook", {
      token: operacao.identificadorExterno,
      event_type: "doc_signed",
      status: "signed",
      signed_file: "https://atacante.test/falso.pdf",
    });
    expect(resposta.status).toBe(200);
    const depois = await db.operacaoAssinatura.findUniqueOrThrow({ where: { id: operacao.id } });
    expect(depois.status).toBe("AGUARDANDO");
    expect(depois.assinadoId).toBeNull();
    expect(chamadas.some((c) => c.url.includes("atacante"))).toBe(false);
  });

  it("assinatura parcial, aviso repetido, depois todos: conta uma vez e arquiva uma vez", async () => {
    const { ato, operacao } = await enviada();
    const token = operacao.identificadorExterno;

    assinar(token, `conc.${MARCA}@exemplo.test`);
    await aviso("segredo-do-webhook", { token, event_type: "doc_signed" });
    await aviso("segredo-do-webhook", { token, event_type: "doc_signed" });

    let depois = await db.operacaoAssinatura.findUniqueOrThrow({ where: { id: operacao.id } });
    expect(depois.status).toBe("PARCIAL");
    expect(depois.jaAssinaram).toBe(1);
    expect(
      await db.eventoAto.count({ where: { atoId: ato.id, tipo: "ASSINATURA_REGISTRADA" } })
    ).toBe(1);

    assinar(token, `sol.${MARCA}@exemplo.test`);
    await aviso("segredo-do-webhook", { token, event_type: "doc_signed" });
    await aviso("segredo-do-webhook", { token, event_type: "doc_signed" });

    depois = await db.operacaoAssinatura.findUniqueOrThrow({ where: { id: operacao.id } });
    expect(depois.status).toBe("ARQUIVADA");
    expect(depois.jaAssinaram).toBe(2);
    expect(depois.assinadoId).not.toBeNull();
    expect(
      await db.documento.count({ where: { atoId: ato.id, tipo: "DOCUMENTO_ASSINADO" } })
    ).toBe(1);
    expect(
      await db.eventoAto.count({ where: { atoId: ato.id, tipo: "DOCUMENTO_ASSINADO_ANEXADO" } })
    ).toBe(1);
  });

  it("recusado na ZapSign: marca cancelado", async () => {
    const { operacao } = await enviada();
    naZapSign.get(operacao.identificadorExterno)!.status = "refused";
    await aviso("segredo-do-webhook", { token: operacao.identificadorExterno, event_type: "doc_refused" });
    const depois = await db.operacaoAssinatura.findUniqueOrThrow({ where: { id: operacao.id } });
    expect(depois.status).toBe("CANCELADA");
  });

  it("documento que não é nosso: 200, sem mexer em nada", async () => {
    const resposta = await aviso("segredo-do-webhook", { token: "de-outro-sistema", event_type: "doc_signed" });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ desconhecido: true });
  });

  it("falha técnica na consulta: 500 para a ZapSign reenviar, e marca a falha", async () => {
    const { operacao } = await enviada();
    naZapSign.delete(operacao.identificadorExterno); // consulta passa a dar 404
    const resposta = await aviso("segredo-do-webhook", {
      token: operacao.identificadorExterno,
      event_type: "doc_signed",
    });
    expect(resposta.status).toBe(500);
    const depois = await db.operacaoAssinatura.findUniqueOrThrow({ where: { id: operacao.id } });
    expect(depois.status).toBe("FALHOU");
    expect(depois.ultimoErro).toBeTruthy();
  });
});

describe("retificação com envio pendente na ZapSign", () => {
  it("cancela lá (recusa pela câmara) e marca como cancelado aqui", async () => {
    const { ato, operacao } = await enviada();
    const presentes = (await db.parteDoAto.findMany({ where: { atoId: ato.id, papel: { not: "CONVIDADO" } } })).map(
      (p) => p.id
    );
    const dados = new FormData();
    dados.append("atoId", ato.id);
    dados.append("motivoRetificacao", "Erro de digitação no horário");
    dados.append("horaInicio", "09:00");
    dados.append("horaEncerramento", "09:30");
    for (const id of presentes) dados.append("presente", id);

    const resposta = await retificarAta({}, dados);
    expect(resposta.erro).toBeUndefined();

    const recusa = chamadas.find((c) => c.url.endsWith("/refuse/"));
    expect(recusa?.corpo).toMatchObject({ doc_token: operacao.identificadorExterno });
    const depois = await db.operacaoAssinatura.findUniqueOrThrow({ where: { id: operacao.id } });
    expect(depois.status).toBe("CANCELADA");
  });
});
