/**
 * `listarPessoas()` sem termo de busca alimenta o cadastro inteiro para o
 * seletor de pessoa (combobox de "Novo procedimento", `<select>` de vincular
 * pessoa a um ato já aberto) — telas que filtram no próprio navegador, sem
 * fazer uma requisição nova a cada tecla.
 *
 * Bug relatado em 06/10: com a base passando de 200 cadastros, um limite
 * (`take: 200`) cortava a lista antes de chegar ao navegador — quem viesse
 * depois disso em ordem alfabética simplesmente não aparecia na busca, sem
 * erro nenhum. Este teste garante que a base cresce bem além de 200 sem
 * voltar a truncar silenciosamente.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TipoPessoa } from "@prisma/client";
import { listarPessoas } from "@/lib/consultas-de-atos";
import { db } from "@/lib/db";

const MARCA = `t${process.pid}${Date.now()}`.slice(-12);
const QUANTIDADE = 205; // acima do limite antigo de 200

const criados: string[] = [];

beforeAll(async () => {
  // nomes em ordem que garante gente depois da posição 200 em ordem alfabética
  const dados = Array.from({ length: QUANTIDADE }, (_, i) => ({
    tipo: TipoPessoa.FISICA,
    nome: `Zzzteste ${MARCA} ${String(i).padStart(4, "0")}`,
    documento: `${MARCA}${String(i).padStart(5, "0")}`,
  }));
  await db.pessoa.createMany({ data: dados });
  const todas = await db.pessoa.findMany({
    where: { documento: { startsWith: MARCA } },
    select: { id: true },
  });
  criados.push(...todas.map((p) => p.id));
});

afterAll(async () => {
  await db.pessoa.deleteMany({ where: { id: { in: criados } } });
  await db.$disconnect();
});

describe("listarPessoas sem termo de busca", () => {
  it("não trunca em 200: traz todo mundo, mesmo bem depois na ordem alfabética", async () => {
    const pessoas = await listarPessoas();
    const encontrados = pessoas.filter((p) => p.nome.includes(MARCA));
    expect(encontrados.length).toBe(QUANTIDADE);

    // a última pessoa criada (posição 204 na ordem alfabética deste lote)
    // precisa estar na lista — é exatamente quem o limite antigo cortava
    const ultimoNome = `Zzzteste ${MARCA} ${String(QUANTIDADE - 1).padStart(4, "0")}`;
    expect(pessoas.some((p) => p.nome === ultimoNome)).toBe(true);
  });

  it("com termo de busca, continua filtrando no servidor normalmente", async () => {
    const alvo = `Zzzteste ${MARCA} ${String(QUANTIDADE - 1).padStart(4, "0")}`;
    const pessoas = await listarPessoas(alvo);
    expect(pessoas).toHaveLength(1);
    expect(pessoas[0]?.nome).toBe(alvo);
  });
});
