/**
 * Desvincular pessoa/empresa do escritório a que estava indevidamente
 * associada — pedido do cliente em 15/09, mesma classe de bug documentada em
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
  it("remove o vínculo de uma única pessoa, sem tocar tipoProcurador nem OAB", async () => {
    const escritorio = await criarPessoa("Escritório E. Ferreira", `${MARCA}01`);
    const banco = await criarPessoa("Banco Agibank", `${MARCA}02`, {
      tipoProcurador: TipoProcurador.REPRESENTANTE_EMPRESA,
      oab: "SP123456",
      vinculadoAId: escritorio,
    });

    const entrada = new FormData();
    entrada.append("id", banco);
    await desvincularPessoas(entrada);

    const pessoa = await db.pessoa.findUniqueOrThrow({ where: { id: banco } });
    expect(pessoa.vinculadoAId).toBeNull();
    expect(pessoa.tipoProcurador).toBe(TipoProcurador.REPRESENTANTE_EMPRESA);
    expect(pessoa.oab).toBe("SP123456");
  });

  it("registra a auditoria com o nome de quem estava vinculada", async () => {
    const escritorio = await criarPessoa("Escritório Auditoria", `${MARCA}03`);
    const banco = await criarPessoa("Banco Alfa", `${MARCA}04`, { vinculadoAId: escritorio });

    const entrada = new FormData();
    entrada.append("id", banco);
    await desvincularPessoas(entrada);

    const log = await db.logAuditoria.findFirst({
      where: { entidade: "Pessoa", entidadeId: banco, acao: "ALTEROU_PESSOA" },
      orderBy: { criadoEm: "desc" },
    });
    expect(log).not.toBeNull();
    expect((log?.metadados as { desvinculadoDe?: string } | null)?.desvinculadoDe).toContain(
      "Escritório Auditoria"
    );
  });

  it("desvincula várias pessoas de uma vez", async () => {
    const escritorio = await criarPessoa("Escritório Lote", `${MARCA}05`);
    const a = await criarPessoa("Banco Bradesco", `${MARCA}06`, { vinculadoAId: escritorio });
    const b = await criarPessoa("Banco C6", `${MARCA}07`, { vinculadoAId: escritorio });

    const entrada = new FormData();
    entrada.append("id", a);
    entrada.append("id", b);
    await desvincularPessoas(entrada);

    const pessoas = await db.pessoa.findMany({ where: { id: { in: [a, b] } } });
    expect(pessoas.every((p) => p.vinculadoAId === null)).toBe(true);
  });

  it("ignora silenciosamente quem já não tinha vínculo", async () => {
    const semVinculo = await criarPessoa("Banco Sem Vínculo", `${MARCA}08`);

    const entrada = new FormData();
    entrada.append("id", semVinculo);
    await expect(desvincularPessoas(entrada)).resolves.toBeUndefined();
  });

  it("recusa quando nenhuma pessoa é informada", async () => {
    await expect(desvincularPessoas(new FormData())).rejects.toThrow("Nenhuma pessoa selecionada.");
  });
});
