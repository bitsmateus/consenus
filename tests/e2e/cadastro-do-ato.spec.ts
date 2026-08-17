/**
 * Entregável da Sprint 1: "operador cadastra um ato completo".
 *
 * Percorre o caminho real no navegador — cadastro das duas pessoas, abertura
 * do procedimento, vínculo do procurador e conferência da linha do tempo.
 * É o teste que prova que as Server Actions funcionam de ponta a ponta; os
 * unitários cobrem as regras isoladas.
 */
import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EMAIL = "admin@consensusone.com.br";
const SENHA = "Consensus@2026";

/** Documentos válidos, gerados fora do intervalo usado pelo seed. */
const MARCA = String(Date.now()).slice(-6);
const CPF_SOLICITANTE = "52998224725";
const CNPJ_CONVIDADO = "59935008000192";
const CPF_PROCURADORA = "71428793860";

const NOME_SOLICITANTE = `Joana Ribeiro ${MARCA}`;
const NOME_CONVIDADO = `Vértice Consultoria ${MARCA}`;
const NOME_PROCURADORA = `Helena Vasconcelos ${MARCA}`;

let segredoTotp: string | null = null;

test.beforeAll(async () => {
  // limpa resíduo de execução anterior, para o teste poder repetir
  const documentos = [CPF_SOLICITANTE, CNPJ_CONVIDADO, CPF_PROCURADORA];
  const pessoas = await db.pessoa.findMany({
    where: { documento: { in: documentos } },
    select: { id: true },
  });
  const ids = pessoas.map((p) => p.id);
  if (ids.length > 0) {
    await db.ato.deleteMany({ where: { partes: { some: { pessoaId: { in: ids } } } } });
    await db.pessoa.deleteMany({ where: { id: { in: ids } } });
  }

  const usuario = await db.usuario.findUnique({
    where: { email: EMAIL },
    select: { totpAtivo: true, totpSecret: true },
  });
  segredoTotp = usuario?.totpAtivo ? usuario.totpSecret : null;
});

test.afterAll(async () => {
  await db.$disconnect();
});

async function entrar(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(SENHA);
  if (segredoTotp) {
    await page.getByLabel("Código de verificação").fill(authenticator.generate(segredoTotp));
  }
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(painel|seguranca)/);
}

/**
 * Escolhe a opção pelo texto parcial. `selectOption({ label })` não aceita
 * expressão regular, e os rótulos trazem nome + documento.
 */
async function escolher(page: Page, rotulo: string, textoParcial: string) {
  const campo = page.getByLabel(rotulo, { exact: true });
  const valor = await campo
    .locator("option", { hasText: textoParcial })
    .first()
    .getAttribute("value");
  await campo.selectOption(valor!);
}

/** O alerta do formulário — o Next mantém um role="alert" próprio de rota. */
function alertaDoFormulario(page: Page) {
  return page.locator("p[role=alert]");
}

async function cadastrarPessoa(
  page: Page,
  dados: { tipo: "Pessoa física" | "Pessoa jurídica"; nome: string; documento: string; natureza?: string; oab?: string }
) {
  await page.goto("/pessoas/nova");
  await page.getByLabel("Tipo").selectOption({ label: dados.tipo });
  await page.getByLabel(dados.tipo === "Pessoa física" ? "Nome completo" : "Razão social").fill(dados.nome);
  await page.getByLabel(dados.tipo === "Pessoa física" ? "CPF" : "CNPJ").fill(dados.documento);

  if (dados.natureza) {
    await page.getByLabel("Natureza").selectOption({ label: dados.natureza });
    if (dados.oab) await page.getByLabel("OAB").fill(dados.oab);
  }

  await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
  // "nova" também casaria com um padrão solto de id; exclui a rota de criação
  await page.waitForURL((url) => /^\/pessoas\/[a-z0-9]{10,}$/.test(url.pathname));
}

// em série: os cenários seguintes dependem das pessoas criadas no primeiro
test.describe.configure({ mode: "serial" });

// Este é um teste de fluxo, não de layout, e escreve no banco. Rodar o mesmo
// fluxo nos dois projetos ao mesmo tempo faria os dois disputarem os mesmos
// registros. A conferência em 375px fica com os testes de layout.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "fluxo roda só no desktop");
});

test.describe("operador cadastra um procedimento completo", () => {
  test("do cadastro das partes à linha do tempo", async ({ page }) => {
    await entrar(page);

    // ---------------------------------------------- 1. cadastro das partes
    await cadastrarPessoa(page, {
      tipo: "Pessoa física",
      nome: NOME_SOLICITANTE,
      documento: CPF_SOLICITANTE,
    });
    await expect(page.getByRole("heading", { name: NOME_SOLICITANTE })).toBeVisible();

    await cadastrarPessoa(page, {
      tipo: "Pessoa jurídica",
      nome: NOME_CONVIDADO,
      documento: CNPJ_CONVIDADO,
      natureza: "Empresa ou consultoria",
    });

    await cadastrarPessoa(page, {
      tipo: "Pessoa física",
      nome: NOME_PROCURADORA,
      documento: CPF_PROCURADORA,
      natureza: "Advogado",
      oab: `OAB/SP ${MARCA}`,
    });

    // ---------------------------------------------- 2. abertura do procedimento
    await page.goto("/atos/novo");
    await escolher(page, "Interessado Solicitante", NOME_SOLICITANTE);
    await escolher(page, "Interessado Convidado", NOME_CONVIDADO);
    await page.getByLabel("Objeto do procedimento").fill("Controvérsia contratual");
    await page.getByRole("button", { name: "Abrir procedimento" }).click();

    await page.waitForURL((url) => /^\/atos\/[a-z0-9]{10,}$/.test(url.pathname));

    // numeração automática no formato ANO.SEQUENCIAL
    const titulo = await page.getByRole("heading", { level: 1 }).innerText();
    expect(titulo).toMatch(/^Procedimento \d{4}\.\d{4}$/);

    // a data nasce reservada, nunca confirmada (docs/02, regra 1)
    await expect(page.getByText("Data reservada")).toBeVisible();
    await expect(page.getByText(/Data provisória/)).toBeVisible();
    await expect(page.getByText("Rascunho")).toBeVisible();

    // as duas partes aparecem com a terminologia do cliente (regra 10);
    // .first() porque o rótulo se repete na etiqueta, na linha do tempo e no
    // seletor de vínculo — a presença é o que importa aqui
    await expect(page.getByText("Interessado Solicitante").first()).toBeVisible();
    await expect(page.getByText("Interessado Convidado").first()).toBeVisible();
    await expect(page.getByText(NOME_SOLICITANTE).first()).toBeVisible();

    // e os termos proibidos não aparecem em lugar nenhum da tela
    const corpo = await page.locator("body").innerText();
    expect(corpo).not.toMatch(/requerente|demandado/i);

    // ---------------------------------------------- 3. vínculo do procurador
    await escolher(page, "Pessoa", NOME_PROCURADORA);
    await page.getByLabel("Papel").selectOption({ label: "Procurador" });
    await escolher(page, "Representa", NOME_SOLICITANTE);
    await page.getByRole("button", { name: "Vincular" }).click();

    await expect(
      page.getByText(new RegExp(`representa ${NOME_SOLICITANTE}`)).first()
    ).toBeVisible();

    // ---------------------------------------------- 4. linha do tempo
    await expect(page.getByText(/Procedimento \d{4}\.\d{4} aberto\./)).toBeVisible();
    await expect(
      page.getByText("Interessado Solicitante e Interessado Convidado vinculados.")
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(`${NOME_PROCURADORA} vinculado como procurador`))
    ).toBeVisible();

    // ---------------------------------------------- 5. busca no painel
    await page.goto(`/atos?busca=${CPF_SOLICITANTE}`);
    await expect(page.getByText(NOME_SOLICITANTE).first()).toBeVisible();

    // busca pelo nome do procurador alcança o procedimento (docs/10)
    await page.goto(`/atos?busca=${encodeURIComponent(NOME_PROCURADORA)}`);
    await expect(page.getByText(NOME_SOLICITANTE).first()).toBeVisible();

    // e o chip de contagem por procurador aparece
    await expect(page.getByText(new RegExp(`${NOME_PROCURADORA} · \\d+`))).toBeVisible();
  });

  test("recusa CPF inválido com mensagem em português", async ({ page }) => {
    await entrar(page);
    await page.goto("/pessoas/nova");

    await page.getByLabel("Nome completo").fill("Teste Documento Inválido");
    await page.getByLabel("CPF").fill("111.111.111-11");
    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();

    await expect(alertaDoFormulario(page)).toContainText(/CPF ou CNPJ inválido/);
    await expect(page).toHaveURL(/\/pessoas\/nova/);
  });

  test("recusa o mesmo Interessado dos dois lados", async ({ page }) => {
    await entrar(page);
    await page.goto("/atos/novo");

    await escolher(page, "Interessado Solicitante", NOME_SOLICITANTE);
    await escolher(page, "Interessado Convidado", NOME_SOLICITANTE);
    await page.getByRole("button", { name: "Abrir procedimento" }).click();

    await expect(alertaDoFormulario(page)).toContainText(/precisam ser pessoas diferentes/);
  });
});
