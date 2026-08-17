import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    include: ["tests/unit/**/*.test.ts"],
  },
});
