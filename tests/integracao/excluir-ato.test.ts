/**
 * Exclusão de procedimento pelo administrador — pedido do cliente em 24/09.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, PapelNoAto, StatusAto, TipoDocumento, TipoPessoa } from "@prisma/client";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);
const ANO = 2098;

let sessao: { id: string; papel: Papel } | null = null;
const arquivosRemovidos: string[] = [];

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
vi.mock("@/lib/storage", () => ({
  removerArquivo: vi.fn(async (chave: string) => {
    arquivosRemovidos.push(chave);
  }),
}));

const { db } = await import("@/lib/db");
const { excluirAto } = await import("@/acoes/atos");

const criados = { pessoas: [] as string[], usuarios: [] as string[], atos: [] as string[] };
let adminId: string;
let operadorId: string;
let contador = 0;

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.append(chave, valor);
  return dados;
}

async function criarAtoCompleto() {
  contador++;
  const pessoa = await db.pessoa.create({
    data: {
      tipo: TipoPessoa.JURIDICA,
      nome: `Parte ${contador} ${MARCA}`,
      documento: `${MARCA}${String(contador).padStart(2, "0")}`,
    },
  });
  criados.pessoas.push(pessoa.id);

  const ato = await db.ato.create({
    data: {
      numero: `${ANO}.${String(contador).padStart(4, "0")}`,
      status: StatusAto.CONVIDADO_CONVOCADO,
      criadoPorId: adminId,
      partes: { create: [{ pessoaId: pessoa.id, papel: PapelNoAto.SOLICITANTE }] },
    },
  });
  criados.atos.push(ato.id);

  const documento = await db.documento.create({
    data: {
      atoId: ato.id,
      tipo: TipoDocumento.CARTA_CONVITE_SOLICITANTE,
      codigoVerificacao: `CO-CC-${ANO}-${MARCA}${contador}`,
      emitidoPelaCamara: true,
      nomeArquivo: "carta.pdf",
      chaveStorage: `atos/${ato.id}/carta.pdf`,
      mimeType: "application/pdf",
      tamanhoBytes: 10,
      hashSha256: "x",
    },
  });
  // Envio aponta para Documento sem cascata: é o que travaria a exclusão
  await db.envio.create({
    data: { atoId: ato.id, documentoId: documento.id, destinatarioId: pessoa.id, canal: "EMAIL" },
  });

  return { ato, documento };
}

beforeAll(async () => {
  const admin = await db.usuario.create({
    data: { nome: `Admin ${MARCA}`, email: `adm.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.ADMIN },
  });
  const operador = await db.usuario.create({
    data: { nome: `Op ${MARCA}`, email: `op.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.OPERADOR },
  });
  adminId = admin.id;
  operadorId = operador.id;
  criados.usuarios.push(admin.id, operador.id);
});

beforeEach(() => {
  sessao = { id: adminId, papel: Papel.ADMIN };
  arquivosRemovidos.length = 0;
});

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.envio.deleteMany({ where: { atoId: { in: criados.atos } } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("excluirAto", () => {
  it("exclui o procedimento com tudo que depende dele, inclusive envios", async () => {
    const { ato, documento } = await criarAtoCompleto();

    await expect(
      excluirAto({}, formulario({ atoId: ato.id, confirmacao: ato.numero }))
    ).rejects.toThrow("REDIRECT:/atos");

    expect(await db.ato.findUnique({ where: { id: ato.id } })).toBeNull();
    expect(await db.documento.findUnique({ where: { id: documento.id } })).toBeNull();
    expect(await db.envio.count({ where: { atoId: ato.id } })).toBe(0);
    expect(await db.parteDoAto.count({ where: { atoId: ato.id } })).toBe(0);
    // a pessoa é cadastro próprio, não do procedimento
    expect(await db.pessoa.count({ where: { id: { in: criados.pessoas } } })).toBeGreaterThan(0);
  });

  it("remove os arquivos do storage", async () => {
    const { ato, documento } = await criarAtoCompleto();
    await expect(
      excluirAto({}, formulario({ atoId: ato.id, confirmacao: ato.numero }))
    ).rejects.toThrow("REDIRECT");

    expect(arquivosRemovidos).toEqual([documento.chaveStorage]);
  });

  it("registra na auditoria o que foi excluído", async () => {
    const { ato, documento } = await criarAtoCompleto();
    await expect(
      excluirAto({}, formulario({ atoId: ato.id, confirmacao: ato.numero }))
    ).rejects.toThrow("REDIRECT");

    const log = await db.logAuditoria.findFirst({
      where: { acao: "EXCLUIU_ATO", entidadeId: ato.id, usuarioId: adminId },
    });
    const metadados = log?.metadados as { numero?: string; codigosDeVerificacao?: string[] } | null;
    expect(metadados?.numero).toBe(ato.numero);
    expect(metadados?.codigosDeVerificacao).toEqual([documento.codigoVerificacao]);
  });

  it("não exclui quando o número digitado não confere", async () => {
    const { ato } = await criarAtoCompleto();

    const resposta = await excluirAto({}, formulario({ atoId: ato.id, confirmacao: "errado" }));

    expect(resposta.erro).toContain(ato.numero);
    expect(await db.ato.findUnique({ where: { id: ato.id } })).not.toBeNull();
    expect(arquivosRemovidos).toHaveLength(0);
  });

  it("recusa operador, e o procedimento continua lá", async () => {
    const { ato } = await criarAtoCompleto();
    sessao = { id: operadorId, papel: Papel.OPERADOR };

    await expect(
      excluirAto({}, formulario({ atoId: ato.id, confirmacao: ato.numero }))
    ).rejects.toThrow();

    expect(await db.ato.findUnique({ where: { id: ato.id } })).not.toBeNull();
  });

  it("recusa quem não está logado", async () => {
    const { ato } = await criarAtoCompleto();
    sessao = null;

    await expect(
      excluirAto({}, formulario({ atoId: ato.id, confirmacao: ato.numero }))
    ).rejects.toThrow();
    expect(await db.ato.findUnique({ where: { id: ato.id } })).not.toBeNull();
  });
});
