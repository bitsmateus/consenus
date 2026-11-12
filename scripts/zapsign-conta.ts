/**
 * Confere a integração com a ZapSign SEM criar documento — criar documento é
 * cobrado, e a câmara não tem conta de testes.
 *
 *   npm run zapsign:conta
 *
 * Lê só o plano (GET /info-plan/): se a chave vale, qual o plano e a situação
 * do pagamento. Mostra também o que falta configurar para o retorno das
 * assinaturas. Nunca imprime a chave nem o token do webhook.
 */
import { consultarPlano, explicarFalhaDaZapSign, modoDeAutenticacao, urlDoWebhook, zapsignAtiva } from "../src/lib/zapsign";

async function principal() {
  if (!zapsignAtiva()) {
    console.log("ZAPSIGN_API_TOKEN não está definido neste ambiente.");
    process.exitCode = 1;
    return;
  }

  console.log(`Endereço da API: ${process.env.ZAPSIGN_BASE_URL || "produção (padrão)"}`);
  console.log(`Provedor dos envios novos: ${process.env.ASSINATURA_PROVEDOR || "d4sign (padrão)"}`);
  console.log(`Identificação do signatário: ${modoDeAutenticacao()}`);
  console.log(
    urlDoWebhook()
      ? "Webhook: configurado (cadastre <AUTH_URL>/api/webhooks/zapsign/<token> no painel da ZapSign)."
      : "Webhook: FALTA definir AUTH_URL e ZAPSIGN_WEBHOOK_TOKEN — sem eles o envio é recusado."
  );

  try {
    const plano = await consultarPlano();
    console.log(`Chave aceita. Plano: ${plano.nome || "(sem nome)"} · situação: ${plano.situacao || "?"}`);
    if (plano.creditos !== null) console.log(`Documentos do plano: ${plano.creditos}`);
  } catch (erro) {
    console.log(explicarFalhaDaZapSign(erro));
    process.exitCode = 1;
  }
}

void principal();
