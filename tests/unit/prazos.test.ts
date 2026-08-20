import { describe, expect, it } from "vitest";
import {
  FUSO,
  calcularDataDaSessao,
  calcularPrazoDocumentacao,
  diasRestantes,
  interpretarDataDeCiencia,
  prazoEhProvisorio,
  situacaoDoPrazo,
} from "@/lib/prazos";

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

describe("data de ciência — o prazo conta do recebimento", () => {
  const agora = new Date("2026-08-20T12:00:00Z");

  it("interpreta a data no fuso de São Paulo, não em UTC", () => {
    const ciencia = interpretarDataDeCiencia("2026-03-01", agora);
    // meia-noite em São Paulo é 03:00 UTC do mesmo dia
    expect(ciencia.toISOString()).toBe("2026-03-01T03:00:00.000Z");
    // e continua sendo 1º de março para quem lê no fuso da câmara
    expect(ciencia.toLocaleDateString("pt-BR", { timeZone: FUSO })).toBe("01/03/2026");
  });

  it("recusa data de recebimento no futuro", () => {
    expect(() => interpretarDataDeCiencia("2026-08-21", agora)).toThrow(/futuro/);
  });

  it("aceita o próprio dia de hoje", () => {
    expect(() => interpretarDataDeCiencia("2026-08-20", agora)).not.toThrow();
  });

  it("exige a data e recusa formato inválido", () => {
    expect(() => interpretarDataDeCiencia("", agora)).toThrow(/laudo de AR/);
    expect(() => interpretarDataDeCiencia("20/08/2026", agora)).toThrow(/inválida/);
  });

  it("o prazo muda conforme o marco: emissão dá menos dias que recebimento", () => {
    const emissao = new Date("2026-08-01T14:00:00Z");
    const recebimento = new Date("2026-08-06T14:00:00Z"); // AR levou 5 dias

    const pelaEmissao = calcularPrazoDocumentacao(emissao, 15);
    const peloRecebimento = calcularPrazoDocumentacao(recebimento, 15);

    const diferenca =
      (peloRecebimento.getTime() - pelaEmissao.getTime()) / 86_400_000;
    expect(diferenca).toBe(5);
    // contar da emissão encurtaria em 5 dias o prazo de quem recebeu
    expect(peloRecebimento.getTime()).toBeGreaterThan(pelaEmissao.getTime());
  });

  it("prazo é provisório enquanto não há ciência registrada", () => {
    expect(prazoEhProvisorio(null)).toBe(true);
    expect(prazoEhProvisorio(undefined)).toBe(true);
    expect(prazoEhProvisorio(new Date("2026-08-06T03:00:00Z"))).toBe(false);
  });
});
