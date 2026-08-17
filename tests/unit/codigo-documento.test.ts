import { describe, expect, it } from "vitest";
import { montarCodigo, codigoEhValido, analisarCodigo, normalizarCodigo } from "@/lib/codigo-documento";

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
    const info = analisarCodigo("CO-ATA-2026-000001-AA");
    if (info?.verificador === "AA") return; // colisão improvável
    expect(info?.verificadorConfere).toBe(false);
  });

  it("expõe o código base para busca no sistema", () => {
    expect(analisarCodigo("CO-ATA-2026-000123-K7")?.base).toBe("CO-ATA-2026-000123");
    expect(analisarCodigo("CO-ATA-2026-000123-K7")?.sequencial).toBe(123);
  });
});
