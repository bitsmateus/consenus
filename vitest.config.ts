import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Carrega o .env para dentro de process.env.
 *
 * O Vitest não lê .env por conta própria, e o Prisma 6 deixou de ler também.
 * Sem isto, `npm run test` numa máquina limpa morre em "Environment variable
 * not found: DATABASE_URL" mesmo com o .env que o README manda criar — só os
 * testes de integração, que são justamente os que tocam o banco.
 *
 * `??=` de propósito: no CI não existe .env e as variáveis já vêm do workflow.
 * O que já está definido no ambiente nunca é sobrescrito pelo arquivo.
 */
const doArquivo = loadEnv("test", process.cwd(), "");
for (const [chave, valor] of Object.entries(doArquivo)) {
  process.env[chave] ??= valor;
}

export default defineConfig({
  resolve: {
    // mesmo apelido de caminho do tsconfig.json ("@/*" -> "./src/*")
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // os testes ponta a ponta rodam pelo Playwright (npm run test:e2e)
    include: ["tests/unit/**/*.test.ts", "tests/integracao/**/*.test.ts"],
    // os de integração compartilham o mesmo banco: sem paralelismo entre arquivos
    fileParallelism: false,
  },
});
