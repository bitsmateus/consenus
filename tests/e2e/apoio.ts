/**
 * Apoio dos testes ponta a ponta.
 *
 * As contas internas exigem verificação em duas etapas, então o login delas
 * passa pelo cadastro do segundo fator na primeira vez. As externas não exigem.
 */
import { expect, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import { PrismaClient } from "@prisma/client";

export const SENHA = "Consensus@2026";

export const CONTAS = {
  admin: "admin@consensusone.com.br",
  operador: "operador@consensusone.com.br",
  /** Interessado no 2026.0003, com sessão realizada. */
  interessadoLiberado: "marcos@exemplo.com.br",
  /** Interessado no 2026.0001, ainda sem sessão. */
  interessadoBloqueado: "francisco@exemplo.com.br",
  /** Procuradora no 0001 (fechado) e no 0003 (liberado). */
  procuradora: "helena@exemplo.adv.br",
};

export const db = new PrismaClient();

/**
 * Zera o segundo fator de UMA conta, para o teste começar sempre do mesmo ponto.
 *
 * Por conta, e não global: os arquivos de teste rodam em paralelo e um reset
 * geral derrubaria o segundo fator no meio do login do outro arquivo.
 */
export async function zerarSegundoFator(email: string): Promise<void> {
  await db.usuario.updateMany({
    where: { email },
    data: { totpSecret: null, totpAtivo: false },
  });
}

export async function entrar(pag: Page, email: string): Promise<void> {
  // conta que já ativou o segundo fator passa a exigir o código no login
  const conta = await db.usuario.findUnique({
    where: { email },
    select: { totpAtivo: true, totpSecret: true },
  });

  await pag.goto("/entrar");
  await pag.getByLabel("E-mail").fill(email);
  await pag.getByLabel("Senha").fill(SENHA);
  if (conta?.totpAtivo && conta.totpSecret) {
    await pag.getByLabel("Código de verificação").fill(authenticator.generate(conta.totpSecret));
  }
  await pag.getByRole("button", { name: "Entrar" }).click();
  await pag.waitForURL(/\/(painel|seguranca)/, { timeout: 20_000 });

  // conta interna cai na tela de segurança até ativar o segundo fator
  if (pag.url().includes("/seguranca")) {
    await pag.getByRole("button", { name: "Configurar agora" }).click();
    // a tela de segurança costuma ser a primeira compilação do servidor de
    // desenvolvimento nesta rota, e o tempo padrão de 5s não cobre isso
    await expect(pag.getByLabel("Código de 6 dígitos")).toBeVisible({ timeout: 30_000 });

    const chave = (await pag.locator("p.tabular").first().innerText()).trim();
    await pag.getByLabel("Código de 6 dígitos").fill(authenticator.generate(chave));
    await pag.getByRole("button", { name: "Ativar" }).click();

    // NÃO usar getByText("Ativa"): o casamento é por substring e sem diferenciar
    // maiúscula, então "Ativa" casa com "Inativa" e o teste seguiria antes de a
    // ativação terminar. Este texto só aparece com o segundo fator já ativo.
    await expect(pag.getByText(/Não pode ser desativada em perfis internos/)).toBeVisible();
  }
}

/** Abre um procedimento pelo número, a partir da listagem. */
export async function abrirProcedimento(pag: Page, numero: string): Promise<void> {
  await pag.goto(`/atos?busca=${numero}`);
  await pag.getByRole("link", { name: new RegExp(numero.replace(".", "\.")) }).first().click();
  await expect(pag.getByRole("heading", { level: 1 })).toContainText(numero);
}

/** O alerta do formulário — o Next mantém um role="alert" próprio de rota. */
export function alerta(pag: Page) {
  return pag.locator("p[role=alert]");
}

/**
 * Documentos válidos para o teste, com dígito verificador calculado.
 * Escolher número na mão dá CPF inválido e o teste falha por motivo errado.
 */
export function cpfValido(base: string): string {
  const calcular = (parcial: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < parcial.length; i++) soma += Number(parcial[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcular(base, 10);
  return `${base}${d1}${calcular(base + d1, 11)}`;
}

export function cnpjValido(base: string): string {
  const calcular = (parcial: string, pesos: number[]): number => {
    const soma = parcial
      .split("")
      .reduce((acc, digito, i) => acc + Number(digito) * (pesos[i] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calcular(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${calcular(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`;
}
