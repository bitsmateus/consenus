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
 *
 * Vai direto na URL do procedimento em vez de clicar na listagem: a rota
 * /atos/[id] é pesada e, quando este arquivo roda antes dos outros, a primeira
 * compilação dela estoura o tempo padrão de asserção. O que se quer provar
 * aqui é a barra, não a navegação — essa já tem cobertura em outros arquivos.
 */
import { expect, test } from "@playwright/test";
import { CONTAS, db, entrar } from "./apoio";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "a barra lateral só existe no desktop");
});

test.afterAll(async () => {
  await db.$disconnect();
});

test("o menu e o Sair continuam à vista depois de rolar a página", async ({ page }) => {
  // procedimento do seed, com sessão realizada: é a página que mais cresce, e
  // nenhum outro arquivo de teste o apaga
  const ato = await db.ato.findUnique({ where: { numero: "2026.0003" }, select: { id: true } });
  expect(ato, "o seed precisa ter rodado").not.toBeNull();

  await entrar(page, CONTAS.operador);
  await page.goto(`/atos/${ato!.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("2026.0003", {
    timeout: 30_000,
  });

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
