/**
 * Regras da Sprint 1 contra o banco: numeração automática e contagem por
 * procurador sem vazamento entre procuradores.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Papel, PapelNoAto, StatusAto, TipoPessoa, TipoProcurador } from "@prisma/client";
import { montarFiltroDeAtos } from "@/lib/autorizacao";
import { contarProcuradoresEm } from "@/lib/consultas-de-atos";
import { db } from "@/lib/db";
import { proximoNumeroDoAto } from "@/lib/numeracao";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);
const ANO = 2099; // ano fora de uso real, para não colidir com dado de demonstração

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };

let operadorId: string;
let solicitante: string;
let procuradorA: string;
let procuradorB: string;

async function criarPessoa(nome: string, documento: string, natureza?: TipoProcurador) {
  const pessoa = await db.pessoa.create({
    data: {
      tipo: natureza === TipoProcurador.EMPRESA_CONSULTORIA ? TipoPessoa.JURIDICA : TipoPessoa.FISICA,
      nome: `${nome} ${MARCA}`,
      documento,
      tipoProcurador: natureza ?? null,
    },
  });
  criados.pessoas.push(pessoa.id);
  return pessoa.id;
}

async function criarAto(
  numero: string,
  status: StatusAto,
  partes: { pessoaId: string; papel: PapelNoAto }[]
) {
  const ato = await db.ato.create({
    data: { numero, status, criadoPorId: operadorId, partes: { create: partes } },
  });
  criados.atos.push(ato.id);
  return ato;
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

  solicitante = await criarPessoa("Solicitante", `${MARCA}01`);
  procuradorA = await criarPessoa("Procuradora A", `${MARCA}02`, TipoProcurador.ADVOGADO);
  procuradorB = await criarPessoa("Procurador B", `${MARCA}03`, TipoProcurador.EMPRESA_CONSULTORIA);
});

afterAll(async () => {
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("numeração automática", () => {
  it("começa em 0001 num ano sem procedimento", async () => {
    const numero = await db.$transaction((tx) => proximoNumeroDoAto(tx, ANO));
    expect(numero).toBe(`${ANO}.0001`);
  });

  it("continua a partir do último do ano", async () => {
    await criarAto(`${ANO}.0001`, StatusAto.RASCUNHO, [
      { pessoaId: solicitante, papel: PapelNoAto.SOLICITANTE },
    ]);

    const numero = await db.$transaction((tx) => proximoNumeroDoAto(tx, ANO));
    expect(numero).toBe(`${ANO}.0002`);
  });

  it("passa de 0009 para 0010 sem regredir", async () => {
    await criarAto(`${ANO}.0009`, StatusAto.RASCUNHO, [
      { pessoaId: solicitante, papel: PapelNoAto.SOLICITANTE },
    ]);

    expect(await db.$transaction((tx) => proximoNumeroDoAto(tx, ANO))).toBe(`${ANO}.0010`);
  });

  it("cada ano tem a própria sequência", async () => {
    const outroAno = ANO - 1;
    const numero = await db.$transaction((tx) => proximoNumeroDoAto(tx, outroAno));
    expect(numero).toBe(`${outroAno}.0001`);
  });

  it("o banco recusa número repetido", async () => {
    await expect(
      criarAto(`${ANO}.0001`, StatusAto.RASCUNHO, [
        { pessoaId: solicitante, papel: PapelNoAto.SOLICITANTE },
      ])
    ).rejects.toThrow();
  });
});

describe("contagem por procurador", () => {
  beforeAll(async () => {
    // dois procedimentos com sessão realizada, um de cada procurador
    await criarAto(`${ANO}.0100`, StatusAto.SESSAO_REALIZADA, [
      { pessoaId: solicitante, papel: PapelNoAto.SOLICITANTE },
      { pessoaId: procuradorA, papel: PapelNoAto.PROCURADOR },
    ]);
    await criarAto(`${ANO}.0101`, StatusAto.SESSAO_REALIZADA, [
      { pessoaId: solicitante, papel: PapelNoAto.SOLICITANTE },
      { pessoaId: procuradorB, papel: PapelNoAto.PROCURADOR },
    ]);
    // e um ainda em andamento, do procurador A
    await criarAto(`${ANO}.0102`, StatusAto.AGUARDANDO_DOCUMENTACAO, [
      { pessoaId: solicitante, papel: PapelNoAto.SOLICITANTE },
      { pessoaId: procuradorA, papel: PapelNoAto.PROCURADOR },
    ]);
  });

  /** Restringe aos atos deste teste, para não somar dado de demonstração. */
  const soDesteTeste = { id: { in: [] as string[] } };

  it("operador vê a contagem dos dois procuradores", async () => {
    const filtro = montarFiltroDeAtos({ papel: Papel.OPERADOR, pessoaId: null });
    const contagem = await contarProcuradoresEm({
      AND: [filtro, { ...soDesteTeste, id: { in: criados.atos } }],
    });

    const a = contagem.find((c) => c.id === procuradorA);
    const b = contagem.find((c) => c.id === procuradorB);

    expect(a?.total).toBe(2); // inclui o que ainda está em andamento
    expect(b?.total).toBe(1);
  });

  it("procurador A não enxerga o procurador B na contagem", async () => {
    const filtro = montarFiltroDeAtos({ papel: Papel.PROCURADOR, pessoaId: procuradorA });
    const contagem = await contarProcuradoresEm({
      AND: [filtro, { id: { in: criados.atos } }],
    });

    expect(contagem.map((c) => c.id)).toContain(procuradorA);
    expect(contagem.map((c) => c.id)).not.toContain(procuradorB);
  });

  it("a contagem do procurador ignora procedimento antes da sessão", async () => {
    const filtro = montarFiltroDeAtos({ papel: Papel.PROCURADOR, pessoaId: procuradorA });
    const contagem = await contarProcuradoresEm({
      AND: [filtro, { id: { in: criados.atos } }],
    });

    // o operador vê 2; o próprio procurador vê só o que já teve sessão
    expect(contagem.find((c) => c.id === procuradorA)?.total).toBe(1);
  });

  it("ordena do maior para o menor", async () => {
    const filtro = montarFiltroDeAtos({ papel: Papel.OPERADOR, pessoaId: null });
    const contagem = await contarProcuradoresEm({
      AND: [filtro, { id: { in: criados.atos } }],
    });

    const totais = contagem.map((c) => c.total);
    expect(totais).toEqual([...totais].sort((x, y) => y - x));
  });
});
