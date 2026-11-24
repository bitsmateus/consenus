/**
 * GET /api/ia/v1/cadastro?telefone=5511987654321  (ou ?documento=12345678901)
 * Responde: a pessoa tem cadastro? Passo 2 do fluxo do briefing.
 */
import { obterCadastro } from "@/lib/api-ia";
import { tratarConsulta } from "@/lib/api-ia-rota";

export async function GET(requisicao: Request) {
  return tratarConsulta(requisicao, "cadastro", async (pessoaId) => ({
    cadastro: await obterCadastro(pessoaId),
  }));
}
