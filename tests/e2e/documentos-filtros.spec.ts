/**
 * Filtros da tela de Documentos: por procurador e por período de emissão.
 *
 * Pedido do cliente em 28/08 — a tela só tinha busca livre e tipo.
 *
 * Cria o próprio procedimento e os próprios documentos, direto no banco —
 * não dá para depender do que o seed ou outros arquivos deixam para trás: o
 * seed não gera Documento nenhum, só Ato e Pessoa, e o que existe vem de
 * fluxo-completo.spec.ts, que roda em paralelo e não garante ordem.
 */
import { expect, test } from "@playwright/test";
import { Papel, PapelNoAto, StatusAto, TipoPessoa, TipoProcurador } from "@prisma/client";
import { CONTAS, db, entrar } from "./apoio";

const NUMERO = "2026.9001";
const NOME_PROCURADOR = "Zé Delfim Advocacia Teste";

test.beforeAll(async ({}, info) => {
  if (info.project.name !== "desktop") return;

  const operador = await db.usuario.findFirstOrThrow({ where: { papel: Papel.OPERADOR } });

  const interessado = await db.pessoa.create({
    data: {
      tipo: TipoPessoa.FISICA,
      nome: "Interessado do teste de filtros",
      documento: "11122233396",
    },
  });
  const procurador = await db.pessoa.create({
    data: {
      tipo: TipoPessoa.FISICA,
      nome: NOME_PROCURADOR,
      documento: "22233344497",
      tipoProcurador: TipoProcurador.ADVOGADO,
      oab: "OAB/SC 999.999",
    },
  });

  const ato = await db.ato.create({
    data: {
      numero: NUMERO,
      status: StatusAto.COMPOSICAO_INTEGRAL,
      criadoPorId: operador.id,
      partes: {
        create: [
          { pessoaId: interessado.id, papel: PapelNoAto.SOLICITANTE },
          { pessoaId: procurador.id, papel: PapelNoAto.PROCURADOR },
        ],
      },
    },
  });

  await db.documento.createMany({
    data: [
      {
        atoId: ato.id,
        tipo: "CARTA_CONVITE_SOLICITANTE",
        emitidoPelaCamara: true,
        nomeArquivo: "carta-teste.pdf",
        chaveStorage: `teste/${ato.id}/carta.pdf`,
        mimeType: "application/pdf",
        tamanhoBytes: 1000,
        hashSha256: "0".repeat(64),
        criadoEm: new Date("2020-06-15T12:00:00Z"),
      },
      {
        atoId: ato.id,
        tipo: "ATA",
        emitidoPelaCamara: true,
        nomeArquivo: "ata-teste.pdf",
        chaveStorage: `teste/${ato.id}/ata.pdf`,
        mimeType: "application/pdf",
        tamanhoBytes: 1000,
        hashSha256: "1".repeat(64),
        criadoEm: new Date("2020-06-16T12:00:00Z"),
      },
    ],
  });
});

test.afterAll(async ({}, info) => {
  if (info.project.name !== "desktop") return;
  // onDelete: Cascade cuida dos Documento e ParteDoAto junto do Ato
  await db.ato.deleteMany({ where: { numero: NUMERO } });
  await db.pessoa.deleteMany({ where: { documento: { in: ["11122233396", "22233344497"] } } });
});

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "basta provar num tamanho de tela");
});

test("filtra por procurador e por período de emissão", async ({ page }) => {
  await entrar(page, CONTAS.operador);
  await page.goto("/documentos");
  await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();

  const chip = page.getByRole("link", { name: new RegExp(`${NOME_PROCURADOR} · \\d+`) });
  await expect(chip).toBeVisible();

  await chip.click();
  await expect(page).toHaveURL(/procurador=/);
  await expect(page.getByRole("heading", { name: "Interessado do teste de filtros" })).toBeVisible();
  // só os dois documentos deste procedimento, mesmo com outros na base
  await expect(page.locator("li", { hasText: "Baixar" })).toHaveCount(2);

  // período sem nenhum documento — bem depois dos dois criados em 2020
  await page.getByLabel("Emitido de").fill("2099-01-01");
  await page.getByRole("button", { name: "Filtrar por período" }).click();
  await expect(page.getByText("Nenhum documento encontrado")).toBeVisible();

  // volta a um período que cobre os dois
  await page.getByLabel("Emitido de").fill("2020-01-01");
  await page.getByLabel("Até").fill("2020-12-31");
  await page.getByRole("button", { name: "Filtrar por período" }).click();
  await expect(page.locator("li", { hasText: "Baixar" })).toHaveCount(2);

  await page.getByRole("link", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/\/documentos$/);
});
