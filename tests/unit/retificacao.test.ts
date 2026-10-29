import { describe, expect, it } from "vitest";
import { ataJaAssinada, envioAindaAberto } from "@/lib/retificacao";

describe("quando a ata ainda pode ser retificada", () => {
  it("sem envio para assinatura, ou enviada e ninguém assinou: pode", () => {
    expect(ataJaAssinada(null)).toBe(false);
    expect(ataJaAssinada({ status: "AGUARDANDO", jaAssinaram: 0 })).toBe(false);
    expect(ataJaAssinada({ status: "CANCELADA", jaAssinaram: 0 })).toBe(false);
  });

  it("qualquer assinatura já dada: não pode", () => {
    expect(ataJaAssinada({ status: "AGUARDANDO", jaAssinaram: 1 })).toBe(true);
    expect(ataJaAssinada({ status: "PARCIAL", jaAssinaram: 1 })).toBe(true);
    expect(ataJaAssinada({ status: "CONCLUIDA", jaAssinaram: 2 })).toBe(true);
    expect(ataJaAssinada({ status: "ARQUIVADA", jaAssinaram: 2 })).toBe(true);
    expect(ataJaAssinada({ status: "FALHOU", jaAssinaram: 0 })).toBe(true);
  });

  it("só o envio que espera assinatura precisa ser cancelado na D4Sign", () => {
    expect(envioAindaAberto({ status: "AGUARDANDO" })).toBe(true);
    expect(envioAindaAberto({ status: "CANCELADA" })).toBe(false);
    expect(envioAindaAberto(null)).toBe(false);
  });
});
