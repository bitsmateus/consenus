import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assinaturaDigitalAtiva, avisoAutentico, tokenDoWebhookConfere, urlDoWebhook } from "@/lib/d4sign";

const SEGREDO = "segredo-de-teste-da-d4sign";
const UUID = "9f08bf18-bf4b-410f-9701-c286e5b1cad1";

function hmacDe(uuid: string, segredo = SEGREDO): string {
  return createHmac("sha256", segredo).update(uuid, "utf8").digest("hex");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Content-Hmac dos avisos da D4Sign", () => {
  it("aceita o aviso cujo hash bate com o UUID", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    expect(avisoAutentico(UUID, `sha256=${hmacDe(UUID)}`)).toBe(true);
  });

  it("aceita com ou sem o prefixo sha256=", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    expect(avisoAutentico(UUID, hmacDe(UUID))).toBe(true);
  });

  it("recusa hash calculado com outro segredo", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    expect(avisoAutentico(UUID, `sha256=${hmacDe(UUID, "outro-segredo")}`)).toBe(false);
  });

  it("recusa o hash de um documento diferente", () => {
    // é o caso que importa: sem isso, quem capturasse UM aviso conseguiria
    // disparar o arquivamento de QUALQUER documento
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    const deOutro = hmacDe("00000000-0000-0000-0000-000000000000");
    expect(avisoAutentico(UUID, `sha256=${deOutro}`)).toBe(false);
  });

  it("recusa quando o segredo não está configurado — recusar é o seguro", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", "");
    expect(avisoAutentico(UUID, `sha256=${hmacDe(UUID)}`)).toBe(false);
  });

  it("recusa cabeçalho ausente, vazio ou que não é hexadecimal", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    expect(avisoAutentico(UUID, null)).toBe(false);
    expect(avisoAutentico(UUID, "")).toBe(false);
    expect(avisoAutentico(UUID, "sha256=nao-e-hexadecimal")).toBe(false);
  });

  it("recusa hash do tamanho errado sem estourar", () => {
    // Buffer.compare de tamanhos diferentes lança; a verificação precisa
    // devolver false, e não derrubar a rota
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    expect(avisoAutentico(UUID, "sha256=abcd")).toBe(false);
  });

  it("recusa aviso sem UUID", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_SEGREDO", SEGREDO);
    expect(avisoAutentico("", `sha256=${hmacDe("")}`)).toBe(false);
  });
});

describe("token secreto no caminho do webhook", () => {
  it("aceita só o token exato", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_TOKEN", "abc123");
    expect(tokenDoWebhookConfere("abc123")).toBe(true);
    expect(tokenDoWebhookConfere("abc124")).toBe(false);
    expect(tokenDoWebhookConfere("abc1234")).toBe(false);
    expect(tokenDoWebhookConfere("")).toBe(false);
  });

  it("recusa quando não há token configurado", () => {
    vi.stubEnv("D4SIGN_WEBHOOK_TOKEN", "");
    expect(tokenDoWebhookConfere("qualquer")).toBe(false);
  });
});

describe("endereço do webhook", () => {
  it("monta a URL com o token no caminho, sem barra dobrada", () => {
    vi.stubEnv("AUTH_URL", "https://app.consensusone.com.br/");
    vi.stubEnv("D4SIGN_WEBHOOK_TOKEN", "abc123");
    expect(urlDoWebhook()).toBe("https://app.consensusone.com.br/api/webhooks/d4sign/abc123");
  });

  it("devolve nulo sem configuração — quem chama recusa o envio em vez de assinar às cegas", () => {
    vi.stubEnv("AUTH_URL", "https://app.consensusone.com.br");
    vi.stubEnv("D4SIGN_WEBHOOK_TOKEN", "");
    expect(urlDoWebhook()).toBeNull();
  });
});

describe("integração desligada", () => {
  it("só se considera ativa com token e cofre configurados", () => {
    vi.stubEnv("D4SIGN_TOKEN_API", "");
    vi.stubEnv("D4SIGN_UUID_COFRE", "");
    expect(assinaturaDigitalAtiva()).toBe(false);

    vi.stubEnv("D4SIGN_TOKEN_API", "live_qualquer");
    expect(assinaturaDigitalAtiva()).toBe(false);

    vi.stubEnv("D4SIGN_UUID_COFRE", "uuid-do-cofre");
    expect(assinaturaDigitalAtiva()).toBe(true);
  });
});
