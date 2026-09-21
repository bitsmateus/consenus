/**
 * Token de "esqueci minha senha" e política de senha compartilhada.
 */
import { describe, expect, it } from "vitest";
import {
  MINUTOS_DE_VALIDADE,
  gerarToken,
  hashDoToken,
  montarLink,
  validoAte,
} from "@/lib/redefinicao-de-senha";
import { senhaForte } from "@/lib/senha";

describe("token de redefinição", () => {
  it("gera tokens diferentes a cada chamada, com 256 bits", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("o hash é estável e não revela o token", () => {
    const token = gerarToken();
    expect(hashDoToken(token)).toBe(hashDoToken(token));
    expect(hashDoToken(token)).not.toContain(token);
    expect(hashDoToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("vale pelo tempo configurado a partir do pedido", () => {
    const agora = new Date("2026-09-21T12:00:00Z");
    expect(validoAte(agora).getTime() - agora.getTime()).toBe(MINUTOS_DE_VALIDADE * 60_000);
  });

  it("monta o link sem barra dobrada e com o token escapado", () => {
    expect(montarLink("https://app.exemplo.com.br/", "a+b/c")).toBe(
      "https://app.exemplo.com.br/entrar/redefinir?token=a%2Bb%2Fc"
    );
  });
});

describe("política de senha", () => {
  it("aceita senha longa com maiúscula, minúscula e número", () => {
    expect(senhaForte.safeParse("SenhaLonga2026x").success).toBe(true);
  });

  it.each([
    ["curta demais", "Abc12345"],
    ["sem maiúscula", "senhalonga2026x"],
    ["sem minúscula", "SENHALONGA2026X"],
    ["sem número", "SenhaLongaSemNumero"],
  ])("recusa senha %s", (_motivo, senha) => {
    expect(senhaForte.safeParse(senha).success).toBe(false);
  });
});
