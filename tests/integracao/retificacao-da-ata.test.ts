/**
 * Retificação da ata — decisão do cliente em 29/10: só ata que ninguém
 * assinou; sai ata nova com código novo; a anterior fica como "substituída".
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, TipoPessoa } from "@prisma/client";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);

let sessao: { id: string; papel: Papel; subPapelOperador: null } | null = null;

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/pdf", () => ({ gerarPdf: vi.fn(async () => Buffer.from("%PDF-teste")) }));
vi.mock("@/lib/storage", () => ({
  montarChave: vi.fn((atoId: string, pasta: string, nome: string) => `atos/${atoId}/${pasta}/${nome}`),
  enviarArquivo: vi.fn(async (p: { chave: string; conteudo: Buffer }) => ({
    chave: p.chave,
    hashSha256: "hash",
    tamanhoBytes: p.conteudo.length,
  })),
}));
const cancelarDocumento = vi.fn(async () => undefined);
vi.mock("@/lib/d4sign", async (original) => ({
  ...(await original<typeof import("@/lib/d4sign")>()),
  assinaturaDigitalAtiva: () => true,
  cancelarDocumento,
}));

const { db } = await import("@/lib/db");
const { gerarAta, retificarAta } = await import("@/acoes/fluxo");
const { verificarCodigo } = await import("@/lib/verificacao");

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };
let adminId: string;
const pessoas: Record<string, string> = {};
let contador = 0;

async function pessoa(nome: string, documento: string) {
  const p = await db.pessoa.create({ data: { tipo: TipoPessoa.FISICA, nome: `${nome} ${MARCA}`, documento } });
  criados.pessoas.push(p.id);
  return p.id;
}

function formulario(campos: Record<string, string | string[]>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) dados.append(chave, v);
  }
  return dados;
}

/** Procedimento com a sessão registrada e a ata já lavrada pelo caminho normal. */
async function comAtaLavrada() {
  contador++;
  const ato = await db.ato.create({
    data: {
      numero: `2095.${String(contador).padStart(4, "0")}`,
      criadoPorId: adminId,
      status: "SESSAO_REALIZADA",
      desfecho: "ENCERRAMENTO_SEM_COMPOSICAO",
      dataConfirmada: new Date("2026-10-27T17:00:00Z"),
      horaInicio: new Date("2026-10-27T17:00:00Z"),
      horaEncerramento: new Date("2026-10-27T18:00:00Z"),
      outrosPresentes: "Preposto Fulno",
      partes: {
        create: [
          { pessoaId: pessoas.solicitante!, papel: "SOLICITANTE", compareceu: true },
          { pessoaId: pessoas.convidado!, papel: "CONVIDADO", compareceu: false },
          { pessoaId: pessoas.conciliador!, papel: "CONCILIADOR", compareceu: true },
        ],
      },
    },
    include: { partes: true },
  });
  criados.atos.push(ato.id);
  await gerarAta(formulario({ atoId: ato.id }));
  const ata = await db.documento.findFirstOrThrow({ where: { atoId: ato.id, tipo: "ATA" } });
  return { ato, ata };
}

function pedidoDeRetificacao(atoId: string, presentes: string[], extra: Record<string, string> = {}) {
  return formulario({
    atoId,
    motivoRetificacao: "Nome do preposto digitado errado",
    horaInicio: "14:00",
    horaEncerramento: "15:10",
    outrosPresentes: "Preposto Fulano",
    presente: presentes,
    ...extra,
  });
}

beforeAll(async () => {
  const admin = await db.usuario.create({
    data: { nome: `Adm ${MARCA}`, email: `adm.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.ADMIN },
  });
  adminId = admin.id;
  criados.usuarios.push(admin.id);
  sessao = { id: adminId, papel: Papel.ADMIN, subPapelOperador: null };
  pessoas.solicitante = await pessoa("Solicitante", `${MARCA}01`);
  pessoas.convidado = await pessoa("Convidado", `${MARCA}02`);
  pessoas.conciliador = await pessoa("Conciliador", `${MARCA}03`);
});

beforeEach(() => cancelarDocumento.mockClear());

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.operacaoAssinatura.deleteMany({ where: { atoId: { in: criados.atos } } });
  await db.documento.updateMany({ where: { atoId: { in: criados.atos } }, data: { substituidoPorId: null } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("retificar a ata", () => {
  it("emite ata nova com código novo, guarda a anterior como substituída e grava os dados corrigidos", async () => {
    const { ato, ata } = await comAtaLavrada();
    const presentes = ato.partes.filter((p) => p.papel !== "CONVIDADO").map((p) => p.id);

    const resposta = await retificarAta({}, pedidoDeRetificacao(ato.id, presentes));
    expect(resposta.erro).toBeUndefined();

    const atas = await db.documento.findMany({ where: { atoId: ato.id, tipo: "ATA" }, orderBy: { criadoEm: "asc" } });
    expect(atas).toHaveLength(2);
    const [antiga, nova] = atas;
    expect(nova!.codigoVerificacao).not.toBe(antiga!.codigoVerificacao);
    expect(antiga!.id).toBe(ata.id);
    expect(antiga!.substituidoPorId).toBe(nova!.id);
    expect(antiga!.substituidoEm).not.toBeNull();
    expect(nova!.substituidoPorId).toBeNull();

    const depois = await db.ato.findUniqueOrThrow({ where: { id: ato.id } });
    expect(depois.outrosPresentes).toBe("Preposto Fulano");
    expect(depois.desfecho).toBe("ENCERRAMENTO_SEM_COMPOSICAO");
    // 15:10 em São Paulo = 18:10 UTC, no dia da sessão
    expect(depois.horaEncerramento!.toISOString()).toBe("2026-10-27T18:10:00.000Z");

    const evento = await db.eventoAto.findFirstOrThrow({
      where: { atoId: ato.id, descricao: { startsWith: "Ata retificada" } },
    });
    expect(evento.descricao).toContain("Nome do preposto digitado errado");
  });

  it("a verificação pública passa a dizer que o código antigo foi substituído", async () => {
    const { ato, ata } = await comAtaLavrada();
    await retificarAta({}, pedidoDeRetificacao(ato.id, []));

    const antiga = await verificarCodigo(ata.codigoVerificacao!, `teste-${MARCA}-1`);
    expect(antiga.situacao).toBe("autentico");
    expect(antiga.situacao === "autentico" && antiga.substituidoEm).toBeTruthy();

    const nova = await db.documento.findFirstOrThrow({ where: { atoId: ato.id, tipo: "ATA", substituidoPorId: null } });
    const vigente = await verificarCodigo(nova.codigoVerificacao!, `teste-${MARCA}-2`);
    expect(vigente.situacao === "autentico" && vigente.substituidoEm).toBeNull();
  });

  it("enviada à D4Sign e ninguém assinou: cancela o envio lá e marca como cancelado", async () => {
    const { ato, ata } = await comAtaLavrada();
    await db.operacaoAssinatura.create({
      data: { atoId: ato.id, documentoId: ata.id, identificadorExterno: `d4-${MARCA}-a`, totalSignatarios: 2 },
    });

    const resposta = await retificarAta({}, pedidoDeRetificacao(ato.id, []));
    expect(resposta.erro).toBeUndefined();
    expect(cancelarDocumento).toHaveBeenCalledWith(`d4-${MARCA}-a`, expect.stringContaining("retificada"));
    const operacao = await db.operacaoAssinatura.findUniqueOrThrow({ where: { documentoId: ata.id } });
    expect(operacao.status).toBe("CANCELADA");
  });

  it("alguém já assinou: recusa e não emite nada", async () => {
    const { ato, ata } = await comAtaLavrada();
    await db.operacaoAssinatura.create({
      data: {
        atoId: ato.id,
        documentoId: ata.id,
        identificadorExterno: `d4-${MARCA}-b`,
        status: "PARCIAL",
        totalSignatarios: 2,
        jaAssinaram: 1,
      },
    });

    const resposta = await retificarAta({}, pedidoDeRetificacao(ato.id, []));
    expect(resposta.erro).toMatch(/já recebeu assinatura/);
    expect(await db.documento.count({ where: { atoId: ato.id, tipo: "ATA" } })).toBe(1);
    expect(cancelarDocumento).not.toHaveBeenCalled();
  });

  it("pode retificar de novo: a segunda retificação substitui a ata vigente, não a original", async () => {
    const { ato } = await comAtaLavrada();
    await retificarAta({}, pedidoDeRetificacao(ato.id, []));
    await retificarAta({}, pedidoDeRetificacao(ato.id, [], { observacoesSessao: "Segunda correção" }));

    const atas = await db.documento.findMany({ where: { atoId: ato.id, tipo: "ATA" }, orderBy: { criadoEm: "asc" } });
    expect(atas).toHaveLength(3);
    expect(atas[0]!.substituidoPorId).toBe(atas[1]!.id);
    expect(atas[1]!.substituidoPorId).toBe(atas[2]!.id);
    expect(atas[2]!.substituidoPorId).toBeNull();
  });

  it("lavrar a ata de novo pelo caminho normal continua recusado", async () => {
    const { ato } = await comAtaLavrada();
    await expect(gerarAta(formulario({ atoId: ato.id }))).rejects.toThrow(/já foi lavrada/);
  });

  it("encerramento antes do início é recusado", async () => {
    const { ato } = await comAtaLavrada();
    const resposta = await retificarAta(
      {},
      pedidoDeRetificacao(ato.id, [], { horaInicio: "15:00", horaEncerramento: "14:00" })
    );
    expect(resposta.erro).toMatch(/encerramento/);
  });
});
