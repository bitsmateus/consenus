/**
 * GET /api/ia/v1/sessoes?telefone=...  (ou ?documento=...)
 * Sessões agendadas da pessoa, com o link do Zoom. Passo 3 do fluxo.
 * `sessoes: []` com `encontrado: true` = cadastro sem sessão agendada.
 */
import { listarSessoes, obterCadastro } from "@/lib/api-ia";
import { tratarConsulta } from "@/lib/api-ia-rota";

export async function GET(requisicao: Request) {
  return tratarConsulta(requisicao, "sessoes", async (pessoaId) => ({
    cadastro: await obterCadastro(pessoaId),
    sessoes: await listarSessoes(pessoaId),
  }));
}
