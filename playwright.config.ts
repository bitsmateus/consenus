import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * Carrega o .env antes de tudo.
 *
 * Os testes de isolamento falam com o banco direto, pelo Prisma, para preparar
 * conta e zerar segundo fator — não é só o servidor de desenvolvimento que
 * precisa das variáveis. O Playwright não lê .env sozinho, e o Prisma 6 deixou
 * de ler também, então numa máquina limpa isto morria em "Environment variable
 * not found: DATABASE_URL".
 *
 * Só carrega se o arquivo existir: no CI não há .env e as variáveis já vêm do
 * workflow. E `loadEnvFile` segue a regra do `--env-file`, que não sobrescreve
 * variável já definida no ambiente.
 */
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.URL_BASE ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
