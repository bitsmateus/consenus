/**
 * Critério de aceite contratual (docs/01):
 * "Executar de ponta a ponta um ato completo: cadastro das partes, emissão e
 *  envio das duas cartas, validação documental, registro da sessão, geração da
 *  ata e arquivamento no repositório."
 *
 * Percorre os cinco passos de docs/02 num procedimento criado pelo próprio
 * teste, e confere os bloqueios entre passos — que são a regra de negócio
 * central do sistema.
 */
import { expect, test } from "@playwright/test";
import {
  CONTAS,
  abrirProcedimento,
  alerta,
  cnpjValido,
  cpfValido,
  db,
  entrar,
  zerarSegundoFator,
} from "./apoio";

// em série: cada cenário depende do estado deixado pelo anterior
test.describe.configure({ mode: "serial" });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "fluxo roda só no desktop");
});

const MARCA = String(Date.now()).slice(-6);
const SOLICITANTE = `Adriana Prado ${MARCA}`;
const CONVIDADO = `Metalúrgica Aurora ${MARCA}`;
const PROCURADOR = `Tiago Bastos ${MARCA}`;

/** Dígito verificador calculado, para o teste não falhar por documento inválido. */
const CPF_SOLICITANTE = cpfValido("168995350");
const CNPJ_CONVIDADO = cnpjValido("042520110001");
const CPF_PROCURADOR = cpfValido("275051760");

let numero = "";

test.beforeAll(async () => {
  await zerarSegundoFator(CONTAS.admin);

  // limpa resíduo de execução anterior, para o teste poder repetir
  const documentos = [CPF_SOLICITANTE, CNPJ_CONVIDADO, CPF_PROCURADOR];
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

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("um procedimento do cadastro ao arquivamento", () => {
  test("passo 1 — cadastro das partes e abertura do procedimento", async ({ page }) => {
    await entrar(page, CONTAS.admin);

    const cadastrar = async (
      tipo: "Pessoa física" | "Pessoa jurídica",
      nome: string,
      documento: string,
      natureza?: string
    ) => {
      await page.goto("/pessoas/nova");
      await page.getByLabel("Tipo").selectOption({ label: tipo });
      await page
        .getByLabel(tipo === "Pessoa física" ? "Nome completo" : "Razão social")
        .fill(nome);
      await page.getByLabel(tipo === "Pessoa física" ? "CPF" : "CNPJ").fill(documento);
      if (natureza) {
        await page.getByLabel("Natureza").selectOption({ label: natureza });
        if (natureza === "Advogado") await page.getByLabel("OAB").fill(`OAB/SP ${MARCA}`);
      }
      await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
      await page.waitForURL((url) => /^\/pessoas\/[a-z0-9]{10,}$/.test(url.pathname));
    };

    await cadastrar("Pessoa física", SOLICITANTE, CPF_SOLICITANTE);
    await cadastrar("Pessoa jurídica", CONVIDADO, CNPJ_CONVIDADO);
    await cadastrar("Pessoa física", PROCURADOR, CPF_PROCURADOR, "Advogado");

    // abertura do procedimento
    await page.goto("/atos/novo");
    const escolher = async (rotulo: string, texto: string) => {
      // campo de busca de pessoa: digita e clica na opção filtrada
      await page.getByLabel(rotulo, { exact: true }).fill(texto);
      await page.getByRole("option", { name: texto }).first().click();
    };
    await escolher("Interessado Solicitante", SOLICITANTE);
    await escolher("Interessado Convidado", CONVIDADO);
    await page.getByLabel("Objeto do procedimento").fill("Controvérsia sobre fornecimento");
    await page.getByRole("button", { name: "Abrir procedimento" }).click();
    await page.waitForURL((url) => /^\/atos\/[a-z0-9]{10,}$/.test(url.pathname));

    const titulo = await page.getByRole("heading", { level: 1 }).innerText();
    numero = titulo.replace("Procedimento ", "").trim();
    expect(numero).toMatch(/^\d{4}\.\d{4}$/);

    // a data nasce reservada, nunca confirmada
    await expect(page.getByText("Data reservada")).toBeVisible();
    await expect(page.getByText(/Data provisória/)).toBeVisible();

    // vínculo do procurador
    const escolherVinculo = async (rotulo: string, texto: string) => {
      const campo = page.getByLabel(rotulo, { exact: true });
      const valor = await campo.locator("option", { hasText: texto }).first().getAttribute("value");
      await campo.selectOption(valor!);
    };
    await escolherVinculo("Pessoa", PROCURADOR);
    await page.getByLabel("Papel").selectOption({ label: "Procurador" });
    await escolherVinculo("Representa", SOLICITANTE);
    await page.getByRole("button", { name: "Vincular" }).click();
    await expect(page.getByText(new RegExp(`representa ${SOLICITANTE}`)).first()).toBeVisible();
  });

  test("passo 2 — Carta-Convite ao Solicitante, com código e QR Code", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    await page.getByRole("button", { name: "Emitir Carta-Convite" }).click();
    await expect(page.getByText(/CO-CC-\d{4}-\d{6}/).first()).toBeVisible({ timeout: 60_000 });

    await expect(page.getByText("Aguardando documentação").first()).toBeVisible();
    // hash de integridade gravado na subida
    await expect(page.getByText(/SHA-256 [0-9a-f]{16}/).first()).toBeVisible();
    await expect(page.getByText(/emitida sob o código/)).toBeVisible();
  });

  test("passo 4 fica bloqueado enquanto a documentação não é conferida", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    // regra do docs/02: a segunda carta não existe antes da confirmação
    await expect(
      page.getByRole("button", { name: "Emitir Carta-Convite ao Convidado" })
    ).toHaveCount(0);

    // e o botão de confirmar data nasce desabilitado, com os itens pendentes
    await expect(page.getByRole("button", { name: "Confirmar a data da sessão" })).toBeDisabled();
    await expect(page.getByText("Pendente").first()).toBeVisible();
  });

  test("passo 3 — conferência item a item libera a confirmação da data", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    // os cinco documentos que a Carta-Convite exige
    const total = await page.getByRole("button", { name: "Conferir" }).count();
    expect(total).toBe(5);

    // espera a contagem cair a cada clique: sem isso o teste clica mais rápido
    // do que a tela atualiza e acaba marcando o mesmo item várias vezes
    for (let restantes = total; restantes > 0; restantes--) {
      await page.getByRole("button", { name: "Conferir" }).first().click();
      await expect(page.getByRole("button", { name: "Conferir" })).toHaveCount(restantes - 1, {
        timeout: 15_000,
      });
    }

    await expect(page.getByText("Pendente")).toHaveCount(0);
    await page.getByRole("button", { name: "Confirmar a data da sessão" }).click();

    await expect(page.getByText("Data confirmada").first()).toBeVisible({ timeout: 20_000 });
  });

  test("passo 4 — Carta-Convite ao Convidado, na mesma sequência de código", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    await page.getByRole("button", { name: "Emitir Carta-Convite ao Convidado" }).click();

    // NÃO esperar pelo texto "Carta-Convite ao Convidado": ele já está na tela,
    // no próprio botão, e a asserção passaria antes da emissão terminar.
    // O formulário da sessão só aparece depois que a carta é expedida.
    await expect(page.getByRole("button", { name: "Registrar sessão" })).toBeVisible({
      timeout: 60_000,
    });

    // as duas cartas dividem a sigla CC e recebem números distintos
    const ato = await db.ato.findUnique({
      where: { numero },
      include: { documentos: { select: { codigoVerificacao: true } } },
    });
    const codigos = ato!.documentos.map((d) => d.codigoVerificacao).filter(Boolean);

    expect(codigos).toHaveLength(2);
    expect(new Set(codigos).size).toBe(2);
    expect(codigos.every((c) => c!.startsWith("CO-CC-"))).toBe(true);
  });

  test("passo 5 — sessão registrada e ata lavrada", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    await page.getByLabel("Hora de início").fill("14:00");
    await page.getByLabel("Hora de encerramento").fill("15:30");
    await page.getByLabel("Desfecho").selectOption({ label: "Composição consensual integral" });

    // A sessão é sempre D+30, então aqui ela ainda não chegou. Sem confirmar a
    // antecipação, o servidor recusa — registrar lavra ata e libera documento
    // ao Interessado, e não pode acontecer por descuido.
    await page.getByRole("button", { name: "Registrar sessão" }).click();
    await expect(alerta(page)).toContainText(/ainda não chegou/);
    await expect(page.getByRole("button", { name: "Lavrar a Ata" })).toHaveCount(0);

    await page.getByLabel(/Confirmo que a sessão foi realizada/).check();
    await page.getByRole("button", { name: "Registrar sessão" }).click();

    await expect(page.getByRole("button", { name: "Lavrar a Ata" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Lavrar a Ata" }).click();
    await expect(page.getByText(/CO-ATA-\d{4}-\d{6}/).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Composição integral").first()).toBeVisible();
  });

  test("Termo de Acordo, com as cláusulas fixas fora da interface", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    // o operador não edita inadimplemento, confidencialidade nem quitação
    const formulario = await page
      .locator("form")
      .filter({ hasText: "Cláusula Primeira" })
      .innerText();

    // o aviso de cadeado cita essas cláusulas pelo nome, então a verificação é
    // sobre o CONTEÚDO delas: se estivesse editável, o texto estaria na tela
    expect(formulario).not.toContain("10% (dez por cento)");
    expect(formulario).not.toContain("1% (um por cento)");
    expect(formulario).not.toContain("IPCA");
    expect(formulario).toContain("são texto fixo do modelo");

    // e existem exatamente os oito campos livres de docs/09, item 9
    const camposLivres = await page
      .locator("form")
      .filter({ hasText: "Cláusula Primeira" })
      .locator("input[type=text], input:not([type])")
      .count();
    expect(camposLivres).toBe(8);

    await page.getByLabel(/Cláusula Primeira/).fill("Composição integral da controvérsia.");
    await page.getByLabel(/Cláusula Segunda/).fill("Entregar o material em 30 dias.");
    await page.getByLabel(/Cláusula Terceira/).fill("Pagar o saldo em 3 parcelas.");
    await page.getByRole("button", { name: "Emitir Termo de Acordo" }).click();

    await expect(page.getByText(/CO-TA-\d{4}-\d{6}/).first()).toBeVisible({ timeout: 60_000 });
  });

  test("arquivamento — os quatro documentos no repositório, com download", async ({ page }) => {
    await entrar(page, CONTAS.admin);
    await abrirProcedimento(page, numero);

    for (const rotulo of [
      "Carta-Convite ao Solicitante",
      "Carta-Convite ao Convidado",
      "Ata de Sessão",
      "Termo de Acordo",
    ]) {
      await expect(page.getByText(rotulo).first()).toBeVisible();
    }

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("link", { name: "Baixar" }).first().click(),
    ]);
    expect(await download.suggestedFilename()).toMatch(/^CO-[A-Z]+-\d{4}-\d{6}\.pdf$/);
  });

  test("o código emitido é reconhecido na verificação pública, sem sessão", async ({ browser }) => {
    const ato = await db.ato.findUnique({
      where: { numero },
      include: { documentos: { where: { tipo: "ATA" }, select: { codigoVerificacao: true } } },
    });
    const codigo = ato!.documentos[0]!.codigoVerificacao!;

    // contexto novo, sem cookie de sessão: é assim que um terceiro consulta
    const anonimo = await browser.newContext();
    const pag = await anonimo.newPage();
    await pag.goto(`/verificar?codigo=${codigo}`);

    await expect(pag.getByText("Documento autêntico")).toBeVisible();
    await expect(pag.getByText("Ata de Sessão")).toBeVisible();

    // e não vaza nada do procedimento
    const corpo = await pag.locator("body").innerText();
    expect(corpo).not.toContain(SOLICITANTE);
    expect(corpo).not.toContain(CONVIDADO);
    expect(corpo).not.toContain(numero);

    await anonimo.close();
  });

  test("código inexistente e malformado devolvem a mesma resposta", async ({ browser }) => {
    const anonimo = await browser.newContext();
    const pag = await anonimo.newPage();

    await pag.goto("/verificar?codigo=CO-ATA-2026-999999");
    await expect(pag.getByText("Documento não encontrado")).toBeVisible();

    await pag.goto("/verificar?codigo=ISSO-NAO-E-CODIGO");
    await expect(pag.getByText("Documento não encontrado")).toBeVisible();

    await anonimo.close();
  });
});
