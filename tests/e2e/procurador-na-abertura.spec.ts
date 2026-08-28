/**
 * Vincular o procurador já na abertura do procedimento.
 *
 * Pedido do cliente em 28/08: antes só dava para vincular procurador DEPOIS
 * de criar o procedimento, na tela dele ("Vincular", abaixo da lista de
 * partes). Agora a tela "Novo procedimento" tem uma seção opcional para isso,
 * logo após Solicitante e Convidado — com as duas variantes de sempre:
 * escolher alguém já cadastrado, ou cadastrar na hora.
 */
import { expect, test } from "@playwright/test";
import { CONTAS, cnpjValido, cpfValido, db, entrar } from "./apoio";

const MARCA = String(Date.now()).slice(-6);

// documentos fixos (o dígito verificador é calculado, mas a base não muda
// entre execuções) — precisam de limpeza no beforeAll, senão a segunda
// rodada local esbarra em "Já existe cadastro com este CPF ou CNPJ".
//
// ⚠️ Bases só nesta faixa (9xxxxxxxx / 9xxxxxxxx0001): as bases
// "111222330", "222333440001" etc. já são usadas pelo próprio seed
// (`prisma/seed.ts`, pessoas "horizonte"/"vertice"/"menezes") — usá-las aqui
// apagou o procedimento 2026.0002 de verdade, por colisão de CPF/CNPJ.
const CPF_SOLICITANTE_1 = cpfValido("987654321");
const CNPJ_CONVIDADO_1 = cnpjValido("987654320001");
const CPF_PROCURADOR_1 = cpfValido("976543210");
const CPF_SOLICITANTE_2 = cpfValido("965432109");
const CNPJ_CONVIDADO_2 = cnpjValido("954321090001");

test.beforeAll(async ({}, info) => {
  if (info.project.name !== "desktop") return;

  const documentos = [
    CPF_SOLICITANTE_1,
    CNPJ_CONVIDADO_1,
    CPF_PROCURADOR_1,
    CPF_SOLICITANTE_2,
    CNPJ_CONVIDADO_2,
  ];
  const pessoas = await db.pessoa.findMany({
    where: { documento: { in: documentos } },
    select: { id: true },
  });
  const ids = pessoas.map((p) => p.id);
  if (ids.length > 0) {
    await db.ato.deleteMany({ where: { partes: { some: { pessoaId: { in: ids } } } } });
    await db.pessoa.deleteMany({ where: { id: { in: ids } } });
  }
});

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "basta provar num tamanho de tela");
});

test.describe("procurador vinculado na abertura", () => {
  test("cadastrando o procurador na hora, junto com o procedimento", async ({ page }) => {
    const solicitante = `Solicitante Abertura ${MARCA}`;
    const convidado = `Convidado Abertura ${MARCA}`;
    const procurador = `Procurador Novo ${MARCA}`;
    const cpfSolicitante = CPF_SOLICITANTE_1;
    const cnpjConvidado = CNPJ_CONVIDADO_1;
    const cpfProcurador = CPF_PROCURADOR_1;

    await entrar(page, CONTAS.operador);

    const cadastrar = async (
      tipo: "Pessoa física" | "Pessoa jurídica",
      nome: string,
      documento: string
    ) => {
      await page.goto("/pessoas/nova");
      await page.getByLabel("Tipo").selectOption({ label: tipo });
      await page
        .getByLabel(tipo === "Pessoa física" ? "Nome completo" : "Razão social")
        .fill(nome);
      await page.getByLabel(tipo === "Pessoa física" ? "CPF" : "CNPJ").fill(documento);
      await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
      await page.waitForURL((url) => /^\/pessoas\/[a-z0-9]{10,}$/.test(url.pathname));
    };
    await cadastrar("Pessoa física", solicitante, cpfSolicitante);
    await cadastrar("Pessoa jurídica", convidado, cnpjConvidado);

    await page.goto("/atos/novo");
    const escolher = async (rotulo: string, texto: string) => {
      const campo = page.getByLabel(rotulo, { exact: true });
      const valor = await campo.locator("option", { hasText: texto }).first().getAttribute("value");
      await campo.selectOption(valor!);
    };
    await escolher("Interessado Solicitante", solicitante);
    await escolher("Interessado Convidado", convidado);

    await page.getByLabel("Representa").selectOption({ label: "Interessado Solicitante" });
    await page.getByRole("button", { name: "A pessoa não está cadastrada" }).click();
    await page.getByLabel("Nome ou razão social").fill(procurador);
    await page.getByLabel("CPF ou CNPJ").fill(cpfProcurador);
    await page.getByLabel("Natureza").selectOption({ label: "Advogado" });
    await page.getByLabel("OAB").fill(`OAB/SC ${MARCA}`);

    await page.getByRole("button", { name: "Abrir procedimento" }).click();
    await page.waitForURL((url) => /^\/atos\/[a-z0-9]{10,}$/.test(url.pathname));

    // o procurador já aparece vinculado, sem passar pela tela "Vincular" — o
    // nome aparece duas vezes (na lista de partes e na linha do tempo), então
    // basta confirmar que pelo menos uma ocorrência está visível
    await expect(page.getByText(procurador).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`representa ${solicitante}`))).toBeVisible();

    const pessoa = await db.pessoa.findUnique({ where: { documento: cpfProcurador } });
    expect(pessoa?.tipoProcurador).toBe("ADVOGADO");
  });

  test("recusa quando o procurador é a mesma pessoa que o Solicitante ou o Convidado", async ({
    page,
  }) => {
    const solicitante = `Solicitante Recusa ${MARCA}`;
    const convidado = `Convidado Recusa ${MARCA}`;
    const cpfSolicitante = CPF_SOLICITANTE_2;
    const cnpjConvidado = CNPJ_CONVIDADO_2;

    await entrar(page, CONTAS.operador);

    await page.goto("/pessoas/nova");
    await page.getByLabel("Tipo").selectOption({ label: "Pessoa física" });
    await page.getByLabel("Nome completo").fill(solicitante);
    await page.getByLabel("CPF").fill(cpfSolicitante);
    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
    await page.waitForURL((url) => /^\/pessoas\/[a-z0-9]{10,}$/.test(url.pathname));

    await page.goto("/pessoas/nova");
    await page.getByLabel("Tipo").selectOption({ label: "Pessoa jurídica" });
    await page.getByLabel("Razão social").fill(convidado);
    await page.getByLabel("CNPJ").fill(cnpjConvidado);
    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
    await page.waitForURL((url) => /^\/pessoas\/[a-z0-9]{10,}$/.test(url.pathname));

    await page.goto("/atos/novo");
    const escolher = async (rotulo: string, texto: string) => {
      const campo = page.getByLabel(rotulo, { exact: true });
      const valor = await campo.locator("option", { hasText: texto }).first().getAttribute("value");
      await campo.selectOption(valor!);
    };
    await escolher("Interessado Solicitante", solicitante);
    await escolher("Interessado Convidado", convidado);

    await page.getByLabel("Representa").selectOption({ label: "Interessado Solicitante" });
    // deixa no modo "já cadastrado" e escolhe o próprio Solicitante como procurador
    await escolher("Procurador", solicitante);

    await page.getByRole("button", { name: "Abrir procedimento" }).click();

    await expect(page.locator("p[role=alert]")).toContainText(
      /precisa ser uma pessoa diferente do Solicitante e do Convidado/
    );
    // e não criou o procedimento
    await expect(page).toHaveURL("/atos/novo");
  });
});
