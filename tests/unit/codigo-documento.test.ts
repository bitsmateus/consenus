import { beforeAll, describe, expect, it } from "vitest";
import {
  montarCodigo,
  codigoEhValido,
  analisarCodigo,
  normalizarCodigo,
  calcularVerificador,
  siglaDoTipo,
  tiposQueCompartilhamSequencia,
} from "@/lib/codigo-documento";

// o verificador é HMAC sobre a base + segredo do ambiente
beforeAll(() => {
  process.env.CODIGO_SEGREDO = "segredo-de-teste";
});

describe("código de documento — padrão Consensus One", () => {
  it("monta no formato CO-SIGLA-ANO-SEQUENCIAL", () => {
    expect(montarCodigo("ATA", 2026, 1)).toBe("CO-ATA-2026-000001");
    expect(montarCodigo("CARTA_CONVITE_CONVIDADO", 2026, 42)).toBe("CO-CC-2026-000042");
    expect(montarCodigo("TERMO_ACORDO", 2026, 7)).toBe("CO-TA-2026-000007");
  });

  it("aceita os exemplos oficiais do cliente", () => {
    for (const c of [
      "CO-CC-2026-000001",
      "CO-ATA-2026-000001",
      "CO-TA-2026-000001",
      "CO-TE-2026-000001",
      "CO-NT-2026-000001",
      "CO-MEM-2026-000001",
    ]) {
      expect(codigoEhValido(c)).toBe(true);
    }
  });

  it("rejeita sigla desconhecida e sequencial curto", () => {
    expect(codigoEhValido("CO-XX-2026-000001")).toBe(false);
    expect(codigoEhValido("CO-ATA-2026-0001")).toBe(false);
  });

  it("normaliza o que o usuário digita", () => {
    expect(normalizarCodigo(" co-ata-2026-000001 ")).toBe("CO-ATA-2026-000001");
  });

  it("por padrão NÃO acrescenta dígito verificador (decisão do cliente em 14/08)", () => {
    expect(montarCodigo("ATA", 2026, 1)).toBe("CO-ATA-2026-000001");
  });

  it("acrescenta e confere o dígito verificador quando solicitado", () => {
    const comDV = montarCodigo("ATA", 2026, 1, true);
    expect(comDV).toMatch(/^CO-ATA-2026-000001-[A-Z2-9]{2}$/);
    expect(analisarCodigo(comDV)?.verificadorConfere).toBe(true);
  });

  it("detecta verificador adulterado", () => {
    const base = "CO-ATA-2026-000001";
    const correto = calcularVerificador(base)!;
    // escolhe deterministicamente um par diferente do correto, para a asserção
    // sempre rodar — a versão anterior deste teste voltava antes de asserir
    const adulterado = correto === "AA" ? "AB" : "AA";

    expect(adulterado).not.toBe(correto);
    expect(analisarCodigo(`${base}-${adulterado}`)?.verificadorConfere).toBe(false);
    expect(analisarCodigo(`${base}-${correto}`)?.verificadorConfere).toBe(true);
  });

  it("sem CODIGO_SEGREDO não afirma nada sobre o verificador", () => {
    const anterior = process.env.CODIGO_SEGREDO;
    delete process.env.CODIGO_SEGREDO;
    try {
      expect(calcularVerificador("CO-ATA-2026-000001")).toBeNull();
      expect(analisarCodigo("CO-ATA-2026-000001-AA")?.verificadorConfere).toBeNull();
      expect(() => montarCodigo("ATA", 2026, 1, true)).toThrow();
    } finally {
      process.env.CODIGO_SEGREDO = anterior;
    }
  });

  it("as duas cartas convite dividem a sigla CC e a mesma sequência", () => {
    expect(siglaDoTipo("CARTA_CONVITE_SOLICITANTE")).toBe("CC");
    expect(siglaDoTipo("CARTA_CONVITE_CONVIDADO")).toBe("CC");

    // o contador da Sprint 2 precisa somar os dois tipos, senão a carta ao
    // Convidado repete o código da carta ao Solicitante e o banco rejeita
    expect(tiposQueCompartilhamSequencia("CARTA_CONVITE_SOLICITANTE")).toEqual(
      expect.arrayContaining(["CARTA_CONVITE_SOLICITANTE", "CARTA_CONVITE_CONVIDADO"])
    );
    expect(tiposQueCompartilhamSequencia("ATA")).toEqual(["ATA"]);

    // sequenciais distintos na mesma sigla geram códigos distintos
    expect(montarCodigo("CARTA_CONVITE_SOLICITANTE", 2026, 1)).toBe("CO-CC-2026-000001");
    expect(montarCodigo("CARTA_CONVITE_CONVIDADO", 2026, 2)).toBe("CO-CC-2026-000002");
  });

  it("expõe o código base para busca no sistema", () => {
    expect(analisarCodigo("CO-ATA-2026-000123-K7")?.base).toBe("CO-ATA-2026-000123");
    expect(analisarCodigo("CO-ATA-2026-000123-K7")?.sequencial).toBe(123);
  });
});
