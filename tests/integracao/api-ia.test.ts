/**
 * API do agente de IA contra o banco real, chamando os handlers das rotas.
 * O que se prova aqui é a REGRA: quem pode receber o link, o que nunca sai
 * na resposta e o que acontece com telefone repetido.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Papel, PapelNoAto, StatusAto, TipoPessoa } from "@prisma/client";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

const MARCA = `${process.pid}${Date.now()}`.slice(-9);
const TOKEN = "t".repeat(48);
process.env.IA_API_TOKEN = TOKEN;

const { db } = await import("@/lib/db");
const { zerarLimite } = await import("@/lib/api-ia");
const sessoes = await import("@/app/api/ia/v1/sessoes/route");
const cadastro = await import("@/app/api/ia/v1/cadastro/route");
const saude = await import("@/app/api/ia/v1/saude/route");

const criados = { pessoas: [] as string[], atos: [] as string[], usuario: "" };
let seq = 0;

function chamar(handler: typeof sessoes.GET, consulta: string, token: string | null = TOKEN) {
  return handler(
    new Request(`http://x/api/ia/v1/y?${consulta}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  );
}

async function pessoa(nome: string, telefone: string | null, documento?: string) {
  const p = await db.pessoa.create({
    data: {
      tipo: TipoPessoa.FISICA,
      nome: `${nome} ${MARCA}`,
      documento: documento ?? `${MARCA}${String(++seq).padStart(2, "0")}`,
      telefone,
      email: "segredo@exemplo.test",
    },
  });
  criados.pessoas.push(p.id);
  return p;
}

async function ato(status: StatusAto, horasAFrente: number, extra = {}) {
  const a = await db.ato.create({
    data: {
      numero: `T${MARCA}.${++seq}`,
      status,
      objeto: "OBJETO SIGILOSO",
      dataConfirmada: new Date(Date.now() + horasAFrente * 3_600_000),
      linkVideoconferencia: "https://zoom.us/j/123",
      idReuniao: "123",
      senhaReuniao: "abc",
      criadoPorId: criados.usuario,
      ...extra,
    },
  });
  criados.atos.push(a.id);
  return a;
}

async function parte(atoId: string, pessoaId: string, papel: PapelNoAto, representaId?: string) {
  return db.parteDoAto.create({ data: { atoId, pessoaId, papel, representaId } });
}

beforeAll(async () => {
  const u = await db.usuario.create({
    data: { nome: `Op ${MARCA}`, email: `op.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.OPERADOR },
  });
  criados.usuario = u.id;
});

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { acao: "CONSULTOU_API_IA", entidadeId: { in: criados.pessoas } } });
  await db.logAuditoria.deleteMany({ where: { acao: "CONSULTOU_API_IA", entidadeId: null } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.delete({ where: { id: criados.usuario } });
  await db.$disconnect();
});

describe("autenticação", () => {
  it("recusa sem token e com token errado, e não toca no banco", async () => {
    expect((await chamar(sessoes.GET, "telefone=11987654321", null)).status).toBe(401);
    expect((await chamar(sessoes.GET, "telefone=11987654321", "x".repeat(48))).status).toBe(401);
    expect((await saude.GET(new Request("http://x"))).status).toBe(401);
  });
  it("saúde responde ok com o token certo", async () => {
    const r = await saude.GET(new Request("http://x", { headers: { authorization: `Bearer ${TOKEN}` } }));
    expect(await r.json()).toEqual({ ok: true, versao: "v1" });
  });
});

describe("identificação", () => {
  it("400 sem telefone nem documento, ou com telefone sem DDD", async () => {
    zerarLimite();
    expect((await chamar(cadastro.GET, "")).status).toBe(400);
    expect((await chamar(cadastro.GET, "telefone=987654321")).status).toBe(400);
    expect((await chamar(cadastro.GET, "documento=123")).status).toBe(400);
  });

  it("acha pela linha mesmo com máscara e sem o nono dígito, e só devolve o mínimo", async () => {
    zerarLimite();
    const p = await pessoa("Maria Souza", "(31) 8123-4567");
    const r = await chamar(cadastro.GET, "telefone=5531981234567");
    const corpo = await r.json();
    expect(corpo.encontrado).toBe(true);
    expect(corpo.cadastro.pessoaId).toBe(p.id);
    expect(corpo.cadastro.tratamento).toBe("Maria");
    const texto = JSON.stringify(corpo);
    expect(texto).not.toContain("segredo@exemplo.test");
    expect(texto).not.toContain(p.documento);
  });

  it("número que ninguém tem: encontrado false", async () => {
    zerarLimite();
    const corpo = await (await chamar(cadastro.GET, "telefone=11900000000")).json();
    expect(corpo).toEqual({ encontrado: false, motivo: "nao_encontrada" });
  });

  it("dois cadastros no mesmo número: não escolhe, pede documento; o documento desempata", async () => {
    zerarLimite();
    const a = await pessoa("Ana", "(41) 99888-7766");
    await pessoa("Bia", "41 99888-7766");
    const amb = await (await chamar(cadastro.GET, "telefone=41998887766")).json();
    expect(amb).toEqual({ encontrado: false, motivo: "ambigua", acao: "pedir_documento" });

    const ok = await (await chamar(cadastro.GET, `telefone=41998887766&documento=${a.documento}`)).json();
    expect(ok.cadastro.pessoaId).toBe(a.id);
  });
});

describe("sessões e link do Zoom", () => {
  it("Solicitante com data confirmada recebe o link", async () => {
    zerarLimite();
    const p = await pessoa("Carlos", "(51) 99111-2200");
    const a = await ato(StatusAto.DATA_CONFIRMADA, 48);
    await parte(a.id, p.id, PapelNoAto.SOLICITANTE);
    const corpo = await (await chamar(sessoes.GET, "telefone=51991112200")).json();
    expect(corpo.sessoes).toHaveLength(1);
    expect(corpo.sessoes[0]).toMatchObject({ link: "https://zoom.us/j/123", idReuniao: "123", senha: "abc", papel: "SOLICITANTE" });
    expect(JSON.stringify(corpo)).not.toContain("OBJETO SIGILOSO");
  });

  it("Convidado só recebe depois da 2ª carta (CONVIDADO_CONVOCADO)", async () => {
    zerarLimite();
    const p = await pessoa("Dora", "(61) 99333-4400");
    const antes = await ato(StatusAto.DATA_CONFIRMADA, 24);
    await parte(antes.id, p.id, PapelNoAto.CONVIDADO);
    expect((await (await chamar(sessoes.GET, "telefone=61993334400")).json()).sessoes).toEqual([]);

    await db.ato.update({ where: { id: antes.id }, data: { status: StatusAto.CONVIDADO_CONVOCADO } });
    const depois = await (await chamar(sessoes.GET, "telefone=61993334400")).json();
    expect(depois.sessoes).toHaveLength(1);
    expect(depois.sessoes[0].papel).toBe("CONVIDADO");
  });

  it("Procurador segue o lado de quem representa", async () => {
    zerarLimite();
    const cliente = await pessoa("Cliente Conv", null);
    const adv = await pessoa("Adv", "(71) 99555-6600");
    const a = await ato(StatusAto.DATA_CONFIRMADA, 24);
    const parteCliente = await parte(a.id, cliente.id, PapelNoAto.CONVIDADO);
    await parte(a.id, adv.id, PapelNoAto.PROCURADOR, parteCliente.id);
    // representa o Convidado e o ato ainda não convocou o Convidado: sem link
    expect((await (await chamar(sessoes.GET, "telefone=71995556600")).json()).sessoes).toEqual([]);
    await db.ato.update({ where: { id: a.id }, data: { status: StatusAto.CONVIDADO_CONVOCADO } });
    const corpo = await (await chamar(sessoes.GET, "telefone=71995556600")).json();
    expect(corpo.sessoes[0]).toMatchObject({ comoProcurador: true, papel: "CONVIDADO" });
  });

  it("não devolve sessão passada, sessão sem data confirmada nem ato de outra pessoa", async () => {
    zerarLimite();
    const p = await pessoa("Eva", "(81) 99777-8800");
    const outra = await pessoa("Outra", "(82) 99777-8800");
    const passada = await ato(StatusAto.CONVIDADO_CONVOCADO, -5);
    const rascunho = await ato(StatusAto.RASCUNHO, 24);
    const alheia = await ato(StatusAto.DATA_CONFIRMADA, 24);
    await parte(passada.id, p.id, PapelNoAto.SOLICITANTE);
    await parte(rascunho.id, p.id, PapelNoAto.SOLICITANTE);
    await parte(alheia.id, outra.id, PapelNoAto.SOLICITANTE);
    const corpo = await (await chamar(sessoes.GET, "telefone=81997778800")).json();
    expect(corpo.encontrado).toBe(true);
    expect(corpo.sessoes).toEqual([]);
  });

  it("tolera atraso: sessão que começou há 10 minutos ainda devolve o link", async () => {
    zerarLimite();
    const p = await pessoa("Fábio", "(91) 99999-0011");
    const a = await ato(StatusAto.DATA_CONFIRMADA, -10 / 60);
    await parte(a.id, p.id, PapelNoAto.SOLICITANTE);
    expect((await (await chamar(sessoes.GET, "telefone=91999990011")).json()).sessoes).toHaveLength(1);
  });

  it("sessão presencial não devolve link; híbrida devolve os dois", async () => {
    zerarLimite();
    const p = await pessoa("Gil", "(92) 99888-1122");
    const pres = await ato(StatusAto.DATA_CONFIRMADA, 24, { modalidade: "PRESENCIAL", localPresencial: "Sala 1" });
    const hib = await ato(StatusAto.DATA_CONFIRMADA, 48, { modalidade: "HIBRIDA", localPresencial: "Sala 2" });
    await parte(pres.id, p.id, PapelNoAto.SOLICITANTE);
    await parte(hib.id, p.id, PapelNoAto.SOLICITANTE);
    const [a, b] = (await (await chamar(sessoes.GET, "telefone=92998881122")).json()).sessoes;
    expect(a).toMatchObject({ link: null, senha: null, localPresencial: "Sala 1" });
    expect(b).toMatchObject({ link: "https://zoom.us/j/123", localPresencial: "Sala 2" });
  });
});

describe("auditoria", () => {
  it("registra a consulta sem guardar o telefone inteiro", async () => {
    zerarLimite();
    const p = await pessoa("Hugo", "(11) 97000-1234");
    await chamar(cadastro.GET, "telefone=11970001234");
    const log = await db.logAuditoria.findFirstOrThrow({
      where: { acao: "CONSULTOU_API_IA", entidadeId: p.id },
    });
    const meta = log.metadados as Record<string, unknown>;
    expect(meta.telefone).toBe("…1234");
    expect(JSON.stringify(meta)).not.toContain("97000");
  });
});
