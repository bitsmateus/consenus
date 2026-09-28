/**
 * Anexar documento ao procedimento — corrige o caso relatado em 29/09: uma
 * falha técnica no envio ao storage (MinIO fora do ar, rede) derrubava a tela
 * inteira do procedimento com "Não foi possível abrir esta tela", em vez de
 * mostrar um aviso na própria tela e deixar tentar de novo.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, PapelNoAto, TipoPessoa } from "@prisma/client";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);

let sessao: { id: string; papel: Papel } | null = null;
let falharNoProximoEnvio = false;

vi.mock("@/auth", () => ({ auth: vi.fn(async () => (sessao ? { user: sessao } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

vi.mock("@/lib/storage", () => ({
  montarChave: vi.fn((atoId: string, tipo: string, nome: string) => `atos/${atoId}/${tipo}/${nome}`),
  enviarArquivo: vi.fn(async (params: { chave: string; conteudo: Buffer }) => {
    if (falharNoProximoEnvio) throw new Error("falha simulada de rede com o MinIO");
    return { chave: params.chave, hashSha256: "hash-de-teste", tamanhoBytes: params.conteudo.length };
  }),
}));

const { db } = await import("@/lib/db");
const { anexarDocumento } = await import("@/acoes/documentos");

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };
let operadorId: string;
let atoId: string;

const PDF_MINIMO = Buffer.from("%PDF-1.4\n%%EOF");

function formularioDeAnexo(arquivo: File | null, extra: Record<string, string> = {}) {
  const dados = new FormData();
  dados.set("atoId", atoId);
  dados.set("tipo", "DOCUMENTO_DA_PARTE");
  for (const [chave, valor] of Object.entries(extra)) dados.set(chave, valor);
  if (arquivo) dados.set("arquivo", arquivo);
  return dados;
}

beforeAll(async () => {
  const operador = await db.usuario.create({
    data: { nome: `Op ${MARCA}`, email: `op.${MARCA}@exemplo.test`, senhaHash: "x", papel: Papel.OPERADOR },
  });
  operadorId = operador.id;
  criados.usuarios.push(operador.id);

  const solicitante = await db.pessoa.create({
    data: { tipo: TipoPessoa.FISICA, nome: `Solicitante ${MARCA}`, documento: `${MARCA}01` },
  });
  criados.pessoas.push(solicitante.id);

  const ato = await db.ato.create({
    data: {
      numero: `2094.0001${MARCA.slice(-2)}`,
      criadoPorId: operadorId,
      partes: { create: [{ pessoaId: solicitante.id, papel: PapelNoAto.SOLICITANTE }] },
    },
  });
  atoId = ato.id;
  criados.atos.push(ato.id);
});

beforeEach(() => {
  sessao = { id: operadorId, papel: Papel.OPERADOR };
  falharNoProximoEnvio = false;
});

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { usuarioId: { in: criados.usuarios } } });
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("anexarDocumento", () => {
  it("anexa um PDF válido", async () => {
    const arquivo = new File([PDF_MINIMO], "documento.pdf", { type: "application/pdf" });
    const resposta = await anexarDocumento({}, formularioDeAnexo(arquivo));

    expect(resposta.erro).toBeUndefined();
    expect(resposta.aviso).toBe("Documento anexado.");
    expect(await db.documento.count({ where: { atoId, nomeArquivo: "documento.pdf" } })).toBe(1);
  });

  it("falha técnica no storage vira aviso na tela, sem lançar exceção — não trava a página", async () => {
    falharNoProximoEnvio = true;
    const arquivo = new File([PDF_MINIMO], "outro.pdf", { type: "application/pdf" });

    const resposta = await anexarDocumento({}, formularioDeAnexo(arquivo));

    expect(resposta.erro).toBe(
      "Não foi possível anexar o arquivo agora. Tente novamente; se continuar, avise o suporte."
    );
    // nenhum registro órfão: sem arquivo gravado, não existe Documento
    expect(await db.documento.count({ where: { atoId, nomeArquivo: "outro.pdf" } })).toBe(0);
  });

  it("depois da falha, tentar de novo funciona normalmente", async () => {
    falharNoProximoEnvio = true;
    const primeiraTentativa = new File([PDF_MINIMO], "retry.pdf", { type: "application/pdf" });
    await anexarDocumento({}, formularioDeAnexo(primeiraTentativa));

    falharNoProximoEnvio = false;
    const segundaTentativa = new File([PDF_MINIMO], "retry.pdf", { type: "application/pdf" });
    const resposta = await anexarDocumento({}, formularioDeAnexo(segundaTentativa));

    expect(resposta.aviso).toBe("Documento anexado.");
    expect(await db.documento.count({ where: { atoId, nomeArquivo: "retry.pdf" } })).toBe(1);
  });

  it("continua recusando arquivo que não é PDF/JPEG/PNG, como erro de negócio (não de storage)", async () => {
    const arquivo = new File([Buffer.from("isto nao e um pdf")], "documento.pdf", {
      type: "application/pdf",
    });
    const resposta = await anexarDocumento({}, formularioDeAnexo(arquivo));

    expect(resposta.erro).toMatch(/não é um PDF, JPEG ou PNG/);
  });

  it("exige arquivo selecionado", async () => {
    const resposta = await anexarDocumento({}, formularioDeAnexo(null));
    expect(resposta.erro).toBe("Selecione um arquivo.");
  });

  it("recusa quem não está logado", async () => {
    sessao = null;
    const arquivo = new File([PDF_MINIMO], "x.pdf", { type: "application/pdf" });
    await expect(anexarDocumento({}, formularioDeAnexo(arquivo))).rejects.toThrow();
  });
});
