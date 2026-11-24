import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LIMITE_POR_MINUTO,
  chaveDeTelefone,
  dentroDoLimite,
  documentoValido,
  formatarDataHora,
  tokenAutentico,
  zerarLimite,
} from "@/lib/api-ia";

const TOKEN = "a".repeat(40);

afterEach(() => {
  vi.unstubAllEnvs();
  zerarLimite();
});

describe("tokenAutentico", () => {
  it("aceita o Bearer certo", () => {
    vi.stubEnv("IA_API_TOKEN", TOKEN);
    expect(tokenAutentico(`Bearer ${TOKEN}`)).toBe(true);
    expect(tokenAutentico(`bearer ${TOKEN}`)).toBe(true);
  });
  it("recusa token errado, de outro tamanho, sem esquema ou ausente", () => {
    vi.stubEnv("IA_API_TOKEN", TOKEN);
    expect(tokenAutentico(`Bearer ${"b".repeat(40)}`)).toBe(false);
    expect(tokenAutentico(`Bearer ${TOKEN}x`)).toBe(false);
    expect(tokenAutentico(TOKEN)).toBe(false);
    expect(tokenAutentico(null)).toBe(false);
  });
  it("API desligada quando o token não está configurado ou é curto", () => {
    vi.stubEnv("IA_API_TOKEN", "");
    expect(tokenAutentico("Bearer ")).toBe(false);
    vi.stubEnv("IA_API_TOKEN", "curto");
    expect(tokenAutentico("Bearer curto")).toBe(false);
  });
});

describe("chaveDeTelefone", () => {
  it("reconhece a mesma linha em formatos diferentes", () => {
    const esperado = chaveDeTelefone("5511987654321");
    expect(esperado).toBe("1187654321");
    expect(chaveDeTelefone("(11) 98765-4321")).toBe(esperado);
    expect(chaveDeTelefone("+55 11 98765-4321")).toBe(esperado);
    // mesma linha cadastrada sem o nono dígito
    expect(chaveDeTelefone("(11) 8765-4321")).toBe(esperado);
  });
  it("não junta DDDs diferentes nem linhas diferentes", () => {
    expect(chaveDeTelefone("21987654321")).not.toBe(chaveDeTelefone("11987654321"));
    expect(chaveDeTelefone("11987654322")).not.toBe(chaveDeTelefone("11987654321"));
  });
  it("sem DDD não identifica ninguém", () => {
    expect(chaveDeTelefone("987654321")).toBeNull();
    expect(chaveDeTelefone("")).toBeNull();
  });
});

describe("documentoValido", () => {
  it("aceita CPF e CNPJ com ou sem máscara", () => {
    expect(documentoValido("123.456.789-01")).toBe("12345678901");
    expect(documentoValido("68.052.966/0001-06")).toBe("68052966000106");
  });
  it("recusa tamanho errado", () => {
    expect(documentoValido("1234")).toBeNull();
  });
});

describe("limite de taxa", () => {
  it("bloqueia na chamada seguinte ao limite e libera depois da janela", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) expect(dentroDoLimite(t0)).toBe(true);
    expect(dentroDoLimite(t0 + 1)).toBe(false);
    expect(dentroDoLimite(t0 + 60_001)).toBe(true);
  });
});

describe("formatarDataHora", () => {
  it("escreve no fuso de Brasília", () => {
    // 17:30 UTC = 14:30 em Brasília
    expect(formatarDataHora(new Date("2026-11-25T17:30:00Z"))).toBe(
      "quarta-feira, 25/11/2026, às 14:30 (horário de Brasília)"
    );
  });
});
