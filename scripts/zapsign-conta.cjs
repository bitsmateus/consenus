/**
 * Confere a integração com a ZapSign SEM criar documento — criar documento é
 * cobrado, e a câmara não tem conta de testes. Lê só o plano (GET /info-plan/).
 *
 * Uso (no console do container, no EasyPanel — lá não há npm nem tsx, por
 * isso o script é JavaScript puro, como o criar-admin.cjs):
 *
 *   node scripts/zapsign-conta.cjs
 *
 * Nunca imprime a chave nem o token do webhook.
 */
const MODOS = [
  "assinaturaTela", "tokenEmail", "assinaturaTela-tokenEmail", "tokenSms",
  "assinaturaTela-tokenSms", "tokenWhatsapp", "assinaturaTela-tokenWhatsapp", "certificadoDigital",
];

async function principal() {
  const token = process.env.ZAPSIGN_API_TOKEN;
  if (!token) {
    console.log("ZAPSIGN_API_TOKEN não está definido neste ambiente.");
    process.exitCode = 1;
    return;
  }

  const base = (process.env.ZAPSIGN_BASE_URL || "https://api.zapsign.com.br/api/v1").replace(/\/+$/, "");
  const modo = MODOS.includes((process.env.ZAPSIGN_AUTENTICACAO || "").trim())
    ? process.env.ZAPSIGN_AUTENTICACAO.trim()
    : "assinaturaTela-tokenEmail";
  const selfie = /^(1|sim|true|on)$/i.test((process.env.ZAPSIGN_SELFIE || "").trim());

  console.log(`Endereço da API: ${process.env.ZAPSIGN_BASE_URL ? base : "produção (padrão)"}`);
  console.log(`Provedor dos envios novos: ${process.env.ASSINATURA_PROVEDOR || "d4sign (padrão)"}`);
  console.log(`Identificação do signatário: ${modo}${selfie ? " + selfie (foto do rosto)" : ""}`);
  console.log(
    process.env.AUTH_URL && process.env.ZAPSIGN_WEBHOOK_TOKEN
      ? `Webhook: configurado — cadastre no painel da ZapSign ${process.env.AUTH_URL.replace(/\/$/, "")}/api/webhooks/zapsign/<ZAPSIGN_WEBHOOK_TOKEN>`
      : "Webhook: FALTA definir AUTH_URL e ZAPSIGN_WEBHOOK_TOKEN — sem eles o envio é recusado."
  );

  let resposta;
  try {
    resposta = await fetch(`${base}/info-plan/`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "ConsensusOne/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    console.log("Não foi possível falar com a ZapSign (rede ou tempo esgotado).");
    process.exitCode = 1;
    return;
  }

  if (resposta.status === 401 || resposta.status === 403) {
    console.log("A ZapSign RECUSOU a chave. Confira ZAPSIGN_API_TOKEN (produção e sandbox têm chaves diferentes).");
    process.exitCode = 1;
    return;
  }
  if (resposta.status === 402) {
    console.log("A chave vale, mas o plano não inclui a API ou está com pagamento pendente.");
    process.exitCode = 1;
    return;
  }
  if (!resposta.ok) {
    console.log(`A ZapSign respondeu ${resposta.status}.`);
    process.exitCode = 1;
    return;
  }

  const plano = await resposta.json().catch(() => ({}));
  console.log(`Chave aceita. Plano: ${plano.name || "(sem nome)"} · situação: ${plano.status || "?"}`);
  if (typeof plano.number_of_credits === "number") console.log(`Documentos do plano: ${plano.number_of_credits}`);
}

principal();
