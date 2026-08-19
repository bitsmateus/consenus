/**
 * Isolamento entre partes — requisito de segurança de docs/04 e docs/10.
 *
 * Os testes unitários e de integração já provam a regra no `where`. Aqui a
 * prova é pela porta da frente: entrando de verdade com cada perfil e
 * confirmando o que aparece e o que não aparece na tela.
 *
 * Roda só no desktop: é teste de regra, não de layout, e as duas execuções
 * disputariam a mesma sessão.
 */
import { expect, test } from "@playwright/test";
import { CONTAS, db, entrar } from "./apoio";

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "regra de acesso roda só no desktop");
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("acesso do Interessado", () => {
  test("vê o próprio procedimento depois da sessão realizada", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);

    await expect(page.getByRole("heading", { name: "Meus procedimentos" })).toBeVisible();
    await expect(page.getByText("2026.0003")).toBeVisible();
  });

  test("não enxerga procedimento de outro Interessado", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);
    const corpo = await page.locator("body").innerText();

    // 0001 e 0002 são de outras pessoas
    expect(corpo).not.toContain("2026.0001");
    expect(corpo).not.toContain("2026.0002");
  });

  test("não acessa o procedimento antes da sessão realizada", async ({ page }) => {
    await entrar(page, CONTAS.interessadoBloqueado);

    // Francisco é Interessado no 2026.0001, que ainda aguarda documentação
    const corpo = await page.locator("body").innerText();
    expect(corpo).not.toContain("2026.0001");
    await expect(page.getByText(/aparecem aqui após a realização da sessão/)).toBeVisible();
  });

  test("URL direta de procedimento alheio devolve 404", async ({ page }) => {
    const alheio = await db.ato.findUnique({ where: { numero: "2026.0002" } });
    await entrar(page, CONTAS.interessadoLiberado);

    const resposta = await page.goto(`/atos/${alheio!.id}`);
    expect(resposta?.status()).toBe(404);
  });

  test("não vê as telas internas da câmara", async ({ page }) => {
    await entrar(page, CONTAS.interessadoLiberado);
    const menu = await page.locator("nav").innerText();

    expect(menu).not.toContain("Interessados");
    expect(menu).not.toContain("Equipe");
    expect(menu).not.toContain("Auditoria");
  });
});

test.describe("acesso do Procurador", () => {
  test("tem portal próprio, com contadores e busca", async ({ page }) => {
    await entrar(page, CONTAS.procuradora);

    await expect(
      page.getByRole("heading", { name: "Procedimentos que represento" })
    ).toBeVisible();
    await expect(page.getByLabel("Buscar representado")).toBeVisible();
  });

  test("representar não antecipa acesso: só vê o que já teve sessão", async ({ page }) => {
    await entrar(page, CONTAS.procuradora);
    const corpo = await page.locator("body").innerText();

    // Helena representa no 0001 e no 0003; só o 0003 teve sessão
    await expect(page.getByText("2026.0003")).toBeVisible();
    expect(corpo).not.toContain("2026.0001");
  });

  test("mostra quem representa em cada procedimento", async ({ page }) => {
    await entrar(page, CONTAS.procuradora);

    await expect(page.getByText("Represento:")).toBeVisible();
    await expect(page.getByText("Marcos Vinícius Tavares")).toBeVisible();
  });

  test("busca por representado filtra a lista", async ({ page }) => {
    await entrar(page, CONTAS.procuradora);

    await page.getByLabel("Buscar representado").fill("nome que não existe");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Nenhum representado encontrado")).toBeVisible();
  });
});

test.describe("acesso sem sessão", () => {
  test("rota interna redireciona para o login", async ({ page }) => {
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("rota de API responde 401 em JSON, não HTML", async ({ request }) => {
    const resposta = await request.get("/api/documentos/qualquer/download");
    expect(resposta.status()).toBe(401);
    expect(await resposta.json()).toHaveProperty("erro");
  });

  test("senha errada não entra e mostra mensagem em português", async ({ page }) => {
    // não mexe no segundo fator: a senha errada é recusada antes dele
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(CONTAS.operador);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.locator("p[role=alert]")).toContainText(/E-mail ou senha incorretos/);
  });

  test("a página de verificação é pública", async ({ page }) => {
    const resposta = await page.goto("/verificar");
    expect(resposta?.status()).toBe(200);
    await expect(page.getByLabel("Código do documento")).toBeVisible();
  });
});
