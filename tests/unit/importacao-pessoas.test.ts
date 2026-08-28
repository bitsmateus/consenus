import { describe, expect, it } from "vitest";
import { TipoPessoa } from "@prisma/client";
import { inferirTipoPessoa, resolverNatureza } from "@/lib/importacao-pessoas";

describe("inferirTipoPessoa", () => {
  it("11 dígitos é pessoa física", () => {
    expect(inferirTipoPessoa("529.982.247-25")).toBe(TipoPessoa.FISICA);
  });

  it("14 dígitos é pessoa jurídica", () => {
    expect(inferirTipoPessoa("11.222.333/0001-81")).toBe(TipoPessoa.JURIDICA);
  });
});

describe("resolverNatureza", () => {
  it("texto vazio ou indefinido não é procurador", () => {
    expect(resolverNatureza(undefined)).toBe("");
    expect(resolverNatureza("  ")).toBe("");
  });

  it("reconhece o rótulo em português, sem diferenciar caixa", () => {
    expect(resolverNatureza("advogado")).toBe("ADVOGADO");
    expect(resolverNatureza("Escritório de Advocacia")).toBe("ESCRITORIO_ADVOCACIA");
    expect(resolverNatureza("REPRESENTANTE DA EMPRESA")).toBe("REPRESENTANTE_EMPRESA");
  });

  it("recusa valor não reconhecido", () => {
    expect(() => resolverNatureza("Sócio")).toThrow(/não reconhecida/);
  });
});
