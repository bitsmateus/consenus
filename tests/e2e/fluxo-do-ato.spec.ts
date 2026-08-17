/**
 * Teste ponta a ponta do critério de aceite contratual:
 * "executar de ponta a ponta um ato completo, compreendendo o cadastro das
 *  partes, a emissão e o envio das duas cartas convite, a validação
 *  documental, o registro da sessão, a geração da ata e o arquivamento."
 *
 * Implementar junto com a Sprint 3.
 */
import { test, expect } from "@playwright/test";

test.describe("fluxo completo de um ato de conciliação", () => {
  test.skip("operador conduz um ato do cadastro ao arquivamento", async ({ page }) => {
    // 1. cadastro das partes
    // 2. primeira carta convite gerada, data reservada
    // 3. anexação e conferência da documentação, confirmação da data
    // 4. segunda carta convite ao demandado
    // 5. registro da sessão, ata e termo de acordo
    // verificação final: repositório do ato com todos os arquivos
    expect(true).toBe(true);
  });

  test.skip("não permite gerar a segunda carta antes da confirmação da data", async ({ page }) => {
    // regra do passo 3: sem o OK do operador, o processo não avança
  });

  test.skip("não permite concluir o ato sem ata anexada", async ({ page }) => {
    // toda sessão gera ata, independentemente do resultado
  });
});

test.describe("isolamento entre partes", () => {
  test.skip("parte não acessa ato de outra parte", async ({ page }) => {
    // requisito de segurança — ver docs/04-seguranca-e-lgpd.md
  });

  test.skip("parte não acessa o ato antes da sessão realizada", async ({ page }) => {
    // regra do Anexo I: acesso liberado somente após a realização do ato
  });
});
