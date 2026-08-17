/**
 * Isolamento entre partes e procuradores, provado contra o banco de verdade.
 *
 * Os testes unitários em tests/unit/sessao.test.ts conferem o formato do filtro;
 * aqui o filtro é aplicado em consultas reais, que é o que de fato protege o
 * dado. Cobre a lista obrigatória de docs/10 e o checklist de docs/04.
 *
 * Precisa de DATABASE_URL — o docker compose local e o CI já fornecem.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Papel, PapelNoAto, StatusAto, TipoPessoa } from "@prisma/client";
import { db } from "@/lib/db";
import { montarFiltroDeAtos } from "@/lib/autorizacao";

const MARCA = `teste-${process.pid}-${Date.now()}`;

/** Ids criados, para limpar no fim sem tocar em nada mais do banco. */
const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };

async function criarPessoa(nome: string, documento: string) {
  const pessoa = await db.pessoa.create({
    data: { tipo: TipoPessoa.FISICA, nome: `${nome} ${MARCA}`, documento },
  });
  criados.pessoas.push(pessoa.id);
  return pessoa;
}

async function criarAto(
  numero: string,
  status: StatusAto,
  criadoPorId: string,
  partes: { pessoaId: string; papel: PapelNoAto }[]
) {
  const ato = await db.ato.create({
    data: { numero, status, criadoPorId, partes: { create: partes } },
  });
  criados.atos.push(ato.id);
  return ato;
}

/** Consulta que qualquer tela do sistema faria, com o filtro obrigatório aplicado. */
async function atosVisiveisPara(papel: Papel, pessoaId: string | null) {
  const registros = await db.ato.findMany({
    where: { AND: [montarFiltroDeAtos({ papel, pessoaId }), { id: { in: criados.atos } }] },
    select: { numero: true },
  });
  return registros.map((r) => r.numero).sort();
}

// personagens
let solicitanteA: string;
let solicitanteB: string;
let convidadoB: string;
let procuradorA: string;
let procuradorB: string;

// procedimentos
const N = {
  aRealizado: `${MARCA}-1`,
  bRealizado: `${MARCA}-2`,
  aAntesDaSessao: `${MARCA}-3`,
  comConciliador: `${MARCA}-4`,
  outroLado: `${MARCA}-5`,
};

beforeAll(async () => {
  const operador = await db.usuario.create({
    data: {
      nome: `Operador ${MARCA}`,
      email: `operador.${MARCA}@exemplo.test`,
      senhaHash: "nao-usado",
      papel: Papel.OPERADOR,
    },
  });
  criados.usuarios.push(operador.id);

  solicitanteA = (await criarPessoa("Solicitante A", `${Date.now()}1`)).id;
  solicitanteB = (await criarPessoa("Solicitante B", `${Date.now()}2`)).id;
  convidadoB = (await criarPessoa("Convidado B", `${Date.now()}3`)).id;
  procuradorA = (await criarPessoa("Procuradora A", `${Date.now()}4`)).id;
  procuradorB = (await criarPessoa("Procurador B", `${Date.now()}5`)).id;

  await criarAto(N.aRealizado, StatusAto.SESSAO_REALIZADA, operador.id, [
    { pessoaId: solicitanteA, papel: PapelNoAto.SOLICITANTE },
    { pessoaId: procuradorA, papel: PapelNoAto.PROCURADOR },
  ]);

  await criarAto(N.bRealizado, StatusAto.SESSAO_REALIZADA, operador.id, [
    { pessoaId: solicitanteB, papel: PapelNoAto.SOLICITANTE },
    { pessoaId: procuradorB, papel: PapelNoAto.PROCURADOR },
  ]);

  await criarAto(N.aAntesDaSessao, StatusAto.AGUARDANDO_DOCUMENTACAO, operador.id, [
    { pessoaId: solicitanteA, papel: PapelNoAto.SOLICITANTE },
    { pessoaId: procuradorA, papel: PapelNoAto.PROCURADOR },
  ]);

  // procuradora A aparece aqui como CONCILIADORA — vínculo que não libera nada
  await criarAto(N.comConciliador, StatusAto.SESSAO_REALIZADA, operador.id, [
    { pessoaId: solicitanteB, papel: PapelNoAto.SOLICITANTE },
    { pessoaId: procuradorA, papel: PapelNoAto.CONCILIADOR },
  ]);

  // no outro lado do balcão: aqui A representa o Interessado Convidado
  await criarAto(N.outroLado, StatusAto.SESSAO_REALIZADA, operador.id, [
    { pessoaId: convidadoB, papel: PapelNoAto.CONVIDADO },
    { pessoaId: procuradorA, papel: PapelNoAto.PROCURADOR },
  ]);
});

afterAll(async () => {
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("isolamento entre procuradores", () => {
  it("procurador A não enxerga procedimento representado pelo procurador B", async () => {
    const visiveis = await atosVisiveisPara(Papel.PROCURADOR, procuradorA);

    expect(visiveis).toContain(N.aRealizado);
    expect(visiveis).not.toContain(N.bRealizado);
  });

  it("procurador vê os dois lados: solicitante em um ato, convidado em outro", async () => {
    const visiveis = await atosVisiveisPara(Papel.PROCURADOR, procuradorA);

    expect(visiveis).toContain(N.aRealizado);
    expect(visiveis).toContain(N.outroLado);
  });

  it("procurador não acessa procedimento antes de SESSAO_REALIZADA", async () => {
    const visiveis = await atosVisiveisPara(Papel.PROCURADOR, procuradorA);

    expect(visiveis).not.toContain(N.aAntesDaSessao);
  });

  it("vínculo como CONCILIADOR não dá acesso de procurador", async () => {
    const visiveis = await atosVisiveisPara(Papel.PROCURADOR, procuradorA);

    expect(visiveis).not.toContain(N.comConciliador);
  });
});

describe("isolamento entre Interessados", () => {
  it("Interessado não acessa procedimento de outro Interessado", async () => {
    const visiveis = await atosVisiveisPara(Papel.PARTE, solicitanteA);

    expect(visiveis).toContain(N.aRealizado);
    expect(visiveis).not.toContain(N.bRealizado);
  });

  it("Interessado não acessa o procedimento antes da sessão realizada", async () => {
    const visiveis = await atosVisiveisPara(Papel.PARTE, solicitanteA);

    expect(visiveis).not.toContain(N.aAntesDaSessao);
  });

  it("procurador não vira Interessado: perfil PARTE ignora vínculo de representação", async () => {
    const visiveis = await atosVisiveisPara(Papel.PARTE, procuradorA);

    expect(visiveis).toEqual([]);
  });
});

describe("equipe da câmara", () => {
  it("OPERADOR enxerga todos os procedimentos, inclusive antes da sessão", async () => {
    const visiveis = await atosVisiveisPara(Papel.OPERADOR, null);

    expect(visiveis).toHaveLength(criados.atos.length);
    expect(visiveis).toContain(N.aAntesDaSessao);
  });
});
