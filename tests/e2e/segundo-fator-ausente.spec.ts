/**
 * Login sem o código, numa conta que já tem segundo fator ativo.
 *
 * Antes caía na mesma mensagem genérica de senha errada — quem digitou tudo
 * certo e só esqueceu de abrir o autenticador ficava sem saber o que
 * corrigir. Agora a tela pede o código especificamente, mas só depois que a
 * senha já conferiu: quem ainda não sabe a senha continua vendo a mensagem
 * genérica, sem aprender se a conta tem segundo fator.
 *
 * Usa um usuário próprio, criado e apagado aqui — não `operador` nem `admin`,
 * que outros arquivos usam em paralelo e cuja configuração de segundo fator
 * não pode ser mexida no meio da corrida (ver isolamento.spec.ts).
 */
import { expect, test } from "@playwright/test";
import argon2 from "argon2";
import { authenticator } from "otplib";
import { Papel } from "@prisma/client";
import { db, SENHA } from "./apoio";

const EMAIL = "teste-segundo-fator-ausente@consensusone.com.br";

// O arquivo roda em dois projetos (desktop e celular); o beforeEach abaixo
// pula todo teste fora do desktop, mas beforeAll/afterAll são POR PROJETO —
// sem essa guarda, o afterAll do celular (que termina na hora, pois todo
// teste dele foi pulado) apaga a conta enquanto o teste do desktop ainda está
// em andamento.
function apenasNoDesktop(info: { project: { name: string } }): boolean {
  return info.project.name === "desktop";
}

test.beforeAll(async ({}, info) => {
  if (!apenasNoDesktop(info)) return;

  const senhaHash = await argon2.hash(SENHA, { type: argon2.argon2id });
  await db.usuario.upsert({
    where: { email: EMAIL },
    update: {
      senhaHash,
      totpAtivo: true,
      totpSecret: authenticator.generateSecret(),
      tentativasFalhas: 0,
      bloqueadoAte: null,
      ativo: true,
    },
    create: {
      nome: "Conta de teste — segundo fator",
      email: EMAIL,
      senhaHash,
      papel: Papel.OPERADOR,
      totpAtivo: true,
      totpSecret: authenticator.generateSecret(),
    },
  });
});

test.afterAll(async ({}, info) => {
  if (!apenasNoDesktop(info)) return;
  await db.usuario.deleteMany({ where: { email: EMAIL } });
});

test.beforeEach(({}, info) => {
  test.skip(!apenasNoDesktop(info), "basta provar num tamanho de tela");
});

test("pede o código quando a senha está certa mas o campo veio vazio", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(SENHA);
  // código de verificação deliberadamente vazio
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator("p[role=alert]")).toContainText(
    /Informe o código de verificação/
  );
});

test("senha errada continua com a mensagem genérica, mesmo com segundo fator ativo", async ({
  page,
}) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator("p[role=alert]")).toContainText(/E-mail ou senha incorretos/);

  await db.usuario.updateMany({
    where: { email: EMAIL },
    data: { tentativasFalhas: 0, bloqueadoAte: null },
  });
});
