/**
 * Teste ponta a ponta do critério de aceite contratual:
 * "executar de ponta a ponta um ato completo, compreendendo o cadastro das
 *  partes, a emissão e o envio das duas cartas convite, a validação
 *  documental, o registro da sessão, a geração da ata e o arquivamento."
 *
 * Implementar junto com a Sprint 3.
 *
 * Marcados com `test.fixme`: ficam listados como pendentes no relatório, em vez
 * de contarem como verdes. Nenhum deles carrega asserção de mentira.
 */
import { test } from "@playwright/test";

test.describe("fluxo completo de um procedimento", () => {
  test.fixme("operador conduz um procedimento do cadastro ao arquivamento", async () => {
    // 1. cadastro das partes
    // 2. primeira carta convite gerada, data reservada
    // 3. anexação e conferência da documentação, confirmação da data
    // 4. segunda carta convite ao Interessado Convidado
    // 5. registro da sessão, ata e termo de acordo
    // verificação final: repositório do ato com todos os arquivos
  });

  test.fixme("não permite gerar a segunda carta antes da confirmação da data", async () => {
    // regra do passo 3: sem o OK do operador, o processo não avança
  });

  test.fixme("não permite concluir o procedimento sem ata anexada", async () => {
    // toda sessão gera ata, independentemente do resultado
  });
});

test.describe("isolamento entre partes", () => {
  test.fixme("Interessado não acessa procedimento de outro Interessado", async () => {
    // requisito de segurança — ver docs/04-seguranca-e-lgpd.md
    // a regra já tem cobertura unitária em tests/unit/autorizacao.test.ts e
    // integrada em tests/integracao/autorizacao.test.ts
  });

  test.fixme("Interessado não acessa o procedimento antes da sessão realizada", async () => {
    // regra do Anexo I: acesso liberado somente após a realização do ato
  });
});
