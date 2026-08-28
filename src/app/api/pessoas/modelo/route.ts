/**
 * Planilha modelo para importação de pessoas.
 *
 * Gerada na hora, não é um arquivo estático guardado no repositório: assim as
 * colunas nunca ficam desatualizadas em relação ao que o importador aceita.
 * Rota autenticada como qualquer outra sob /api — o middleware já exige
 * sessão (CLAUDE.md, regra 2).
 */
import { gerarPlanilhaModelo } from "@/lib/importacao-pessoas";

export async function GET() {
  const planilha = await gerarPlanilhaModelo();

  return new Response(new Uint8Array(planilha), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-pessoas.xlsx"',
    },
  });
}
