/**
 * A barra lateral fica presa no lugar.
 *
 * Antes ela era filho flex de um container `min-h-screen` e esticava até a
 * altura do conteúdo: em página longa, o menu e o botão Sair desciam junto com
 * a rolagem e sumiam da vista. Agora tem altura de viewport, e quem rola é só
 * a lista de itens.
 *
 * Vale um teste próprio porque é regressão fácil de reintroduzir — basta
 * alguém mexer nas classes do layout sem rolar a página para conferir.
 *
 * Entra como OPERADOR, e não como admin: o fluxo-completo zera o segundo fator
 * da conta admin no beforeAll dele, e os arquivos rodam em paralelo. Disputar
 * a mesma conta dá falha intermitente — o próprio apoio.ts alerta para isso.
 */
import { expect, test } from "@playwright/test";
import { CONTAS, abrirProcedimento, db, entrar } from "./apoio";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "a barra lateral só existe no desktop");
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("o menu e o Sair continuam à vista depois de rolar a página", async ({ page }) => {
  await entrar(page, CONTAS.operador);

  // procedimento do seed, com sessão realizada: é a página que mais cresce, e
  // nenhum outro arquivo de teste o apaga
  await abrirProcedimento(page, "2026.0003");

  const barra = page.locator("aside").first();
  const sair = barra.getByRole("button", { name: "Sair" });
  const painel = barra.getByRole("link", { name: "Painel" });

  await expect(sair).toBeInViewport();
  await expect(painel).toBeInViewport();

  const desceu = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY;
  });
  // se a página não rolou, o teste não provaria nada
  expect(desceu).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  await expect(sair).toBeInViewport();
  await expect(painel).toBeInViewport();
});
