/**
 * O link da sala fica à mão na tela do procedimento.
 *
 * Antes ele só existia dentro do PDF da Carta-Convite: para reenviar por
 * WhatsApp o operador tinha de baixar o documento e caçar o link no meio do
 * texto. Agora está no painel da Agenda, clicável e com botão de copiar.
 *
 * Entra como OPERADOR pelo mesmo motivo do teste da barra lateral: o
 * fluxo-completo mexe no segundo fator da conta admin e os arquivos rodam em
 * paralelo.
 */
import { expect, test } from "@playwright/test";
import { CONTAS, db, entrar } from "./apoio";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "basta provar num tamanho de tela");
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("o operador vê e copia o link da videoconferência", async ({ page, context }) => {
  const ato = await db.ato.findUnique({
    where: { numero: "2026.0003" },
    select: { id: true, linkVideoconferencia: true },
  });
  expect(ato, "o seed precisa ter rodado").not.toBeNull();
  expect(ato!.linkVideoconferencia, "o ato do seed tem sala").not.toBeNull();

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await entrar(page, CONTAS.operador);
  await page.goto(`/atos/${ato!.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("2026.0003", {
    timeout: 30_000,
  });

  const link = page.getByRole("link", { name: ato!.linkVideoconferencia! });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", ato!.linkVideoconferencia!);

  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByText("Link copiado.")).toBeVisible();

  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toBe(ato!.linkVideoconferencia);

  // o convite completo leva também o ID e a senha, para colar no WhatsApp
  await page.getByRole("button", { name: "Copiar convite" }).click();
  const convite = await page.evaluate(() => navigator.clipboard.readText());
  expect(convite).toContain(ato!.linkVideoconferencia);
  expect(convite).toContain("000 0000 0000");
  expect(convite).toContain("consensus");
});
