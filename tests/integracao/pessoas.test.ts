/**
 * Limpa OAB e vínculo de pessoa que não é procuradora de ninguém, mas ficou
 * com esse resíduo de uma planilha antiga importada errado — pedido do
 * cliente em 15/09. Mesma classe de bug documentada em
 * scripts/atualizar-pessoas-por-planilha.cjs.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Papel, TipoPessoa, TipoProcurador } from "@prisma/client";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);

let operadorId: string;

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: operadorId, papel: Papel.OPERADOR },
  })),
}));

// fora de uma requisição Next real não há "static generation store" nem
// cabeçalhos de requisição: sem os mocks, toda chamada à Server Action quebra
// em revalidatePath/headers, não no que o teste quer verificar
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

const { desvincularPessoas } = await import("@/acoes/pessoas");
const { db } = await import("@/lib/db");

const criados = { pessoas: [] as string[], usuarios: [] as string[] };

async function criarPessoa(
  nome: string,
  documento: string,
  extra: { tipoProcurador?: TipoProcurador; oab?: string; vinculadoAId?: string } = {}
) {
  const pessoa = await db.pessoa.create({
    data: {
      tipo: TipoPessoa.JURIDICA,
      nome: `${nome} ${MARCA}`,
      documento,
      ...extra,
    },
  });
  criados.pessoas.push(pessoa.id);
  return pessoa.id;
}

beforeAll(async () => {
  const operador = await db.usuario.create({
    data: {
      nome: `Operador ${MARCA}`,
      email: `op.${MARCA}@exemplo.test`,
      senhaHash: "nao-usado",
      papel: Papel.OPERADOR,
    },
  });
  operadorId = operador.id;
  criados.usuarios.push(operador.id);
});

afterAll(async () => {
  await db.logAuditoria.deleteMany({ where: { usuarioId: operadorId } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("desvincularPessoas", () => {
  it("limpa a OAB órfã de quem não é procuradora de ninguém", async () => {
    const banco = await criarPessoa("Banco Agibank", `${MARCA}01`, {
      oab: "Escritório E. Ferreira Advogados",
    });

    const entrada = new FormData();
    entrada.append("id", banco);
    await desvincularPessoas(entrada);

    const pessoa = await db.pessoa.findUniqueOrThrow({ where: { id: banco } });
    expect(pessoa.oab).toBeNull();
  });

  it("limpa OAB e vínculo juntos, quando os dois sobraram na mesma pessoa", async () => {
    const escritorio = await criarPessoa("Escritório E. Ferreira", `${MARCA}02`);
    const banco = await criarPessoa("Banco Alfa", `${MARCA}03`, {
      oab: "Escritório E. Ferreira Advogados",
      vinculadoAId: escritorio,
    });

    const entrada = new FormData();
    entrada.append("id", banco);
    await desvincularPessoas(entrada);

    const pessoa = await db.pessoa.findUniqueOrThrow({ where: { id: banco } });
    expect(pessoa.oab).toBeNull();
    expect(pessoa.vinculadoAId).toBeNull();
  });

  it("nunca toca advogado ou representante que são procuradores de verdade", async () => {
    const escritorio = await criarPessoa("Escritório Representado", `${MARCA}04`);
    const advogado = await criarPessoa("Advogada Real", `${MARCA}05`, {
      tipoProcurador: TipoProcurador.ADVOGADO,
      oab: "SP123456",
    });
    const representante = await criarPessoa("Representante Real", `${MARCA}06`, {
      tipoProcurador: TipoProcurador.REPRESENTANTE_EMPRESA,
      vinculadoAId: escritorio,
    });

    const entrada = new FormData();
    entrada.append("id", advogado);
    entrada.append("id", representante);
    await desvincularPessoas(entrada);

    const pessoas = await db.pessoa.findMany({ where: { id: { in: [advogado, representante] } } });
    const a = pessoas.find((p) => p.id === advogado);
    const r = pessoas.find((p) => p.id === representante);
    expect(a?.oab).toBe("SP123456");
    expect(r?.vinculadoAId).toBe(escritorio);
  });

  it("registra a auditoria com a OAB removida e o nome de quem estava vinculada", async () => {
    const escritorio = await criarPessoa("Escritório Auditoria", `${MARCA}07`);
    const banco = await criarPessoa("Banco Bradesco", `${MARCA}08`, {
      oab: "Escritório Auditoria",
      vinculadoAId: escritorio,
    });

    const entrada = new FormData();
    entrada.append("id", banco);
    await desvincularPessoas(entrada);

    const log = await db.logAuditoria.findFirst({
      where: { entidade: "Pessoa", entidadeId: banco, acao: "ALTEROU_PESSOA" },
      orderBy: { criadoEm: "desc" },
    });
    const metadados = log?.metadados as { oabRemovida?: string; desvinculadoDe?: string } | null;
    expect(metadados?.oabRemovida).toBe("Escritório Auditoria");
    expect(metadados?.desvinculadoDe).toContain("Escritório Auditoria");
  });

  it("corrige várias pessoas de uma vez", async () => {
    const a = await criarPessoa("Banco C6", `${MARCA}09`, { oab: "Escritório Lote" });
    const b = await criarPessoa("Banco BMG", `${MARCA}10`, { oab: "Escritório Lote" });

    const entrada = new FormData();
    entrada.append("id", a);
    entrada.append("id", b);
    await desvincularPessoas(entrada);

    const pessoas = await db.pessoa.findMany({ where: { id: { in: [a, b] } } });
    expect(pessoas.every((p) => p.oab === null)).toBe(true);
  });

  it("ignora silenciosamente quem já não tem nada para corrigir", async () => {
    const semNada = await criarPessoa("Banco Sem Resíduo", `${MARCA}11`);

    const entrada = new FormData();
    entrada.append("id", semNada);
    await expect(desvincularPessoas(entrada)).resolves.toBeUndefined();
  });

  it("recusa quando nenhuma pessoa é informada", async () => {
    await expect(desvincularPessoas(new FormData())).rejects.toThrow("Nenhuma pessoa selecionada.");
  });
});
