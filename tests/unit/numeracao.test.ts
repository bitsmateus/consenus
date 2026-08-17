import { describe, expect, it } from "vitest";
import { analisarNumeroDoAto, montarNumeroDoAto } from "@/lib/numeracao";

describe("numeração do procedimento", () => {
  it("monta no formato ANO.SEQUENCIAL com 4 dígitos", () => {
    expect(montarNumeroDoAto(2026, 1)).toBe("2026.0001");
    expect(montarNumeroDoAto(2026, 42)).toBe("2026.0042");
    expect(montarNumeroDoAto(2026, 1234)).toBe("2026.1234");
  });

  it("não trunca quando passa de 9999", () => {
    expect(montarNumeroDoAto(2026, 10000)).toBe("2026.10000");
  });

  it("lê de volta o que montou", () => {
    const numero = montarNumeroDoAto(2026, 7);
    expect(analisarNumeroDoAto(numero)).toEqual({ ano: 2026, sequencial: 7 });
  });

  it("recusa formato fora do padrão", () => {
    expect(analisarNumeroDoAto("2026-0001")).toBeNull();
    expect(analisarNumeroDoAto("26.0001")).toBeNull();
    expect(analisarNumeroDoAto("2026.1")).toBeNull();
    expect(analisarNumeroDoAto("")).toBeNull();
  });

  it("ordena por texto na mesma ordem que por número, dentro do ano", () => {
    // proximoNumeroDoAto usa orderBy desc no texto do número; se o padding
    // falhasse, "2026.10" viria antes de "2026.9" e a sequência regrediria
    const numeros = [1, 2, 9, 10, 11, 99, 100].map((n) => montarNumeroDoAto(2026, n));
    const ordenado = [...numeros].sort();
    expect(ordenado).toEqual(numeros);
  });
});
