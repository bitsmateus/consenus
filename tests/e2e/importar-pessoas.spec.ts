/**
 * Importação de pessoas por planilha (.xlsx) — pedido do cliente em 28/08.
 *
 * Cobre o caminho feliz (linha que referencia, pelo CPF/CNPJ, uma empresa
 * cadastrada em linha anterior da MESMA planilha) e o caminho de erro (linha
 * com CPF já usado, que não pode ser importada de novo silenciosamente).
 * Também confere que a planilha modelo baixa como .xlsx de verdade.
 */
import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { CONTAS, cnpjValido, cpfValido, db, entrar } from "./apoio";

const MARCA = String(Date.now()).slice(-6);

// Faixa própria, sem colisão com o seed (prisma/seed.ts) nem com as bases já
// usadas em fluxo-completo.spec.ts e procurador-na-abertura.spec.ts.
const CNPJ_EMPRESA = cnpjValido("811100330001");
const CPF_REPRESENTANTE = cpfValido("822200440");

test.beforeAll(async ({}, info) => {
  if (info.project.name !== "desktop") return;

  const documentos = [CNPJ_EMPRESA, CPF_REPRESENTANTE];
  const pessoas = await db.pessoa.findMany({
    where: { documento: { in: documentos } },
    select: { id: true },
  });
  const ids = pessoas.map((p) => p.id);
  if (ids.length > 0) await db.pessoa.deleteMany({ where: { id: { in: ids } } });
});

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "basta provar num tamanho de tela");
});

async function montarPlanilha(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Pessoas");
  planilha.addRow([
    "Nome ou Razão Social",
    "CPF ou CNPJ",
    "E-mail",
    "Telefone",
    "Logradouro",
    "Número",
    "Complemento",
    "Bairro",
    "Cidade",
    "UF",
    "CEP",
    "Natureza (se for procurador)",
    "OAB (advogado ou escritório)",
    "CPF/CNPJ da empresa vinculada (se representante)",
  ]);
  const empresa = `Empresa Importada ${MARCA} Ltda`;
  const representante = `Representante Importado ${MARCA}`;
  planilha.addRow([
    empresa,
    CNPJ_EMPRESA,
    `contato.${MARCA}@exemplo.test`,
    "11977776666",
    "", "", "", "", "", "", "", "", "", "",
  ]);
  planilha.addRow([
    representante,
    CPF_REPRESENTANTE,
    "", "", "", "", "", "", "", "", "",
    "Representante da empresa",
    "",
    CNPJ_EMPRESA,
  ]);
  // linha 4: mesmo CPF da linha 3 — não pode ser importada de novo
  planilha.addRow([
    `Duplicado ${MARCA}`,
    CPF_REPRESENTANTE,
    "", "", "", "", "", "", "", "", "", "", "", "",
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

test("importar pessoas por planilha", async ({ page }) => {
  await entrar(page, CONTAS.operador);

  await page.goto("/pessoas/importar");

  // a planilha modelo baixa mesmo, como .xlsx
  const modelo = await page.request.get("/api/pessoas/modelo");
  expect(modelo.status()).toBe(200);
  expect(modelo.headers()["content-type"]).toContain("spreadsheetml");

  const planilha = await montarPlanilha();
  await page.locator('input[name="arquivo"]').setInputFiles({
    name: "pessoas.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: planilha,
  });
  await page.getByRole("button", { name: "Importar" }).click();

  await expect(page.getByText("2 de 3 pessoas importadas.")).toBeVisible();
  await expect(page.getByText(/1 linha não foi importada/)).toBeVisible();
  await expect(page.getByText(/Já existe cadastro com este CPF ou CNPJ/)).toBeVisible();

  const empresa = await db.pessoa.findUnique({ where: { documento: CNPJ_EMPRESA } });
  expect(empresa?.email).toBe(`contato.${MARCA}@exemplo.test`);
  expect(empresa?.telefone).toBe("11977776666");

  const representante = await db.pessoa.findUnique({ where: { documento: CPF_REPRESENTANTE } });
  expect(representante?.tipoProcurador).toBe("REPRESENTANTE_EMPRESA");
  expect(representante?.vinculadoAId).toBe(empresa?.id);

  // a linha duplicada não criou uma segunda pessoa com o mesmo documento
  expect(await db.pessoa.count({ where: { documento: CPF_REPRESENTANTE } })).toBe(1);
});
