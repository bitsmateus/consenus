import { describe, expect, it } from "vitest";
import { calcularDataDaSessao, calcularPrazoDocumentacao, situacaoDoPrazo, diasRestantes } from "@/lib/prazos";

const CRIACAO = new Date("2026-08-13T14:00:00-03:00");

describe("prazos do ato", () => {
  it("marca a sessão em D+20 por padrão", () => {
    const sessao = calcularDataDaSessao(CRIACAO, 20);
    expect(diasRestantes(sessao, CRIACAO)).toBe(20);
  });

  it("respeita configuração diferente de 20 dias", () => {
    const sessao = calcularDataDaSessao(CRIACAO, 30);
    expect(diasRestantes(sessao, CRIACAO)).toBe(30);
  });

  it("dá 15 dias para o Interessado Solicitante enviar documentação", () => {
    const prazo = calcularPrazoDocumentacao(CRIACAO, 15);
    expect(diasRestantes(prazo, CRIACAO)).toBe(15);
  });

  it("classifica prazo vencido", () => {
    const prazo = calcularPrazoDocumentacao(CRIACAO, 15); // vence em 28/08
    expect(situacaoDoPrazo(prazo, new Date("2026-08-30T10:00:00-03:00"))).toBe("vencido");
  });

  it("avisa quando faltam 3 dias ou menos", () => {
    const prazo = calcularPrazoDocumentacao(CRIACAO, 15); // vence em 28/08
    expect(situacaoDoPrazo(prazo, new Date("2026-08-26T10:00:00-03:00"))).toBe("vence_em_breve");
  });

  it("considera no prazo quando falta bastante", () => {
    const prazo = calcularPrazoDocumentacao(CRIACAO, 15);
    expect(situacaoDoPrazo(prazo, new Date("2026-08-14T10:00:00-03:00"))).toBe("no_prazo");
  });

  it("marca vencido no dia seguinte ao prazo", () => {
    const prazo = calcularPrazoDocumentacao(CRIACAO, 15);
    expect(situacaoDoPrazo(prazo, new Date("2026-08-29T09:00:00-03:00"))).toBe("vencido");
  });
});
