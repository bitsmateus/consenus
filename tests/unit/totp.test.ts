import { describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import {
  codigoConfere,
  exigeSegundoFator,
  gerarSegredo,
  montarUriDeProvisionamento,
  podeDesativarSegundoFator,
  segundoFatorPendente,
} from "@/lib/totp";

const INTERNOS = ["ADMIN", "OPERADOR"] as const;
const EXTERNOS = ["PARTE", "PROCURADOR"] as const;

describe("segundo fator", () => {
  it("aceita o código corrente do segredo", () => {
    const segredo = gerarSegredo();
    expect(codigoConfere(authenticator.generate(segredo), segredo)).toBe(true);
  });

  it("recusa código de outro segredo", () => {
    const segredo = gerarSegredo();
    const outro = gerarSegredo();
    expect(codigoConfere(authenticator.generate(outro), segredo)).toBe(false);
  });

  it("recusa código com tamanho errado ou vazio", () => {
    const segredo = gerarSegredo();
    expect(codigoConfere("", segredo)).toBe(false);
    expect(codigoConfere("12345", segredo)).toBe(false);
    expect(codigoConfere("1234567", segredo)).toBe(false);
  });

  it("ignora espaço e traço que o usuário digita", () => {
    const segredo = gerarSegredo();
    const codigo = authenticator.generate(segredo);
    const digitado = `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
    expect(codigoConfere(digitado, segredo)).toBe(true);
  });

  it("não derruba o login quando o segredo está corrompido", () => {
    expect(codigoConfere("123456", "não-é-base32!!")).toBe(false);
  });

  it("é obrigatório para perfis internos", () => {
    for (const papel of INTERNOS) expect(exigeSegundoFator(papel)).toBe(true);
    for (const papel of EXTERNOS) expect(exigeSegundoFator(papel)).toBe(false);
  });
});

describe("política de obrigatoriedade do segundo fator", () => {
  it("perfil interno não pode desativar", () => {
    for (const papel of INTERNOS) expect(podeDesativarSegundoFator(papel)).toBe(false);
  });

  it("perfil externo pode desativar", () => {
    for (const papel of EXTERNOS) expect(podeDesativarSegundoFator(papel)).toBe(true);
  });

  it("interno sem TOTP ativo fica pendente — senha sozinha não libera o sistema", () => {
    for (const papel of INTERNOS) {
      expect(segundoFatorPendente({ papel, totpAtivo: false })).toBe(true);
    }
  });

  it("interno com TOTP ativo deixa de estar pendente", () => {
    for (const papel of INTERNOS) {
      expect(segundoFatorPendente({ papel, totpAtivo: true })).toBe(false);
    }
  });

  it("perfil externo nunca fica pendente", () => {
    for (const papel of EXTERNOS) {
      expect(segundoFatorPendente({ papel, totpAtivo: false })).toBe(false);
      expect(segundoFatorPendente({ papel, totpAtivo: true })).toBe(false);
    }
  });

  it("monta URI de provisionamento com o emissor da câmara", () => {
    const uri = montarUriDeProvisionamento("pessoa@consensusone.com.br", gerarSegredo());
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("Consensus%20One");
  });
});
