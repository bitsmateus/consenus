import { describe, expect, it } from "vitest";
import { TipoProcurador } from "@prisma/client";
import { formatarRepresentantes } from "@/lib/formato";

describe("formatarRepresentantes", () => {
  it("devolve null quando não há procurador vinculado", () => {
    expect(formatarRepresentantes([])).toBeNull();
  });

  it("formata nome e natureza de um único procurador", () => {
    expect(
      formatarRepresentantes([{ nome: "Fulano de Tal", tipoProcurador: TipoProcurador.ADVOGADO }])
    ).toBe("Fulano de Tal (Advogado)");
  });

  it("junta mais de um procurador com ponto e vírgula", () => {
    expect(
      formatarRepresentantes([
        { nome: "Fulano", tipoProcurador: TipoProcurador.ADVOGADO },
        { nome: "Beltrana", tipoProcurador: TipoProcurador.REPRESENTANTE_EMPRESA },
      ])
    ).toBe("Fulano (Advogado); Beltrana (Representante da empresa)");
  });

  it("mostra só o nome quando a pessoa não tem natureza de procurador registrada", () => {
    expect(formatarRepresentantes([{ nome: "Fulano", tipoProcurador: null }])).toBe("Fulano");
  });
});
