/**
 * Navegação no celular — o outro lado do docs/05.
 *
 * Existe porque o projeto "celular" do playwright.config.ts estava configurado
 * a 375×812 e não rodava teste nenhum: os dois arquivos existentes pulam tudo
 * que não é desktop. A barra lateral é `hidden md:flex`, então até aqui nada
 * cobria o que o usuário de telefone vê — que é justamente o Interessado.
 *
 * Entra com conta externa de propósito: não exige segundo fator, e é o perfil
 * que de fato consulta pelo celular.
 */
import { expect, test } from "@playwright/test";
import { CONTAS, db, entrar } from "./apoio";

const LARGURA_MINIMA_DE_TOQUE = 44;

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "celular", "navegação de celular roda só a 375px");
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("navegação no celular", () => {
  test("a barra lateral some e sobra o botão de menu", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);

    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
    // o item existe no HTML da barra lateral, mas não pode estar visível
    await expect(page.getByRole("link", { name: "Meus dados" })).toBeHidden();
    await expect(page.locator("#menu-do-celular")).toHaveCount(0);
  });

  test("o botão respeita o alvo de toque de 44px", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);

    const caixa = await page.getByRole("button", { name: "Abrir menu" }).boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.width).toBeGreaterThanOrEqual(LARGURA_MINIMA_DE_TOQUE);
    expect(caixa!.height).toBeGreaterThanOrEqual(LARGURA_MINIMA_DE_TOQUE);
  });

  test("abre com os itens do perfil e sem as telas internas da câmara", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);
    await page.getByRole("button", { name: "Abrir menu" }).click();

    const menu = page.locator("#menu-do-celular");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Procedimentos" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Meus dados" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Documentos" })).toBeVisible();

    // Interessado não pode receber atalho para o que não pode abrir
    await expect(menu.getByRole("link", { name: "Equipe" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Interessados" })).toHaveCount(0);
  });

  test("tocar num item navega e fecha o menu", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.locator("#menu-do-celular").getByRole("link", { name: "Meus dados" }).click();

    await page.waitForURL(/\/meus-dados/);
    // sem isto o painel ficaria aberto por cima da página nova
    await expect(page.locator("#menu-do-celular")).toHaveCount(0);
  });

  test("fecha no Esc e tocando fora", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);
    const botao = page.getByRole("button", { name: "Abrir menu" });
    const menu = page.locator("#menu-do-celular");

    await botao.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    await botao.click();
    await expect(menu).toBeVisible();
    await page.getByRole("button", { name: "Fechar menu" }).last().click();
    await expect(menu).toHaveCount(0);
  });

  test("não há rolagem horizontal a 375px", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);

    for (const rota of ["/painel", "/documentos", "/meus-dados"]) {
      await page.goto(rota);
      const medidas = await page.evaluate(() => ({
        conteudo: document.documentElement.scrollWidth,
        janela: document.documentElement.clientWidth,
      }));
      expect(medidas.conteudo, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(
        medidas.janela
      );
    }
  });
});
