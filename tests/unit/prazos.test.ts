import { describe, expect, it } from "vitest";
import {
  FUSO,
  calcularDataDaSessao,
  calcularPrazoDocumentacao,
  diasRestantes,
  interpretarDataDeCiencia,
  prazoEhProvisorio,
  sessaoAntesDaDataMarcada,
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

describe("sessão registrada antes da data marcada", () => {
  const emSaoPaulo = (iso: string) => new Date(iso);

  it("avisa quando a data ainda vai chegar", () => {
    const sessao = emSaoPaulo("2026-09-12T14:00:00-03:00");
    const hoje = emSaoPaulo("2026-08-24T10:00:00-03:00");
    expect(sessaoAntesDaDataMarcada(sessao, hoje)).toBe(true);
  });

  it("não avisa no próprio dia da sessão, mesmo antes do horário", () => {
    const sessao = emSaoPaulo("2026-09-12T14:00:00-03:00");
    const manha = emSaoPaulo("2026-09-12T08:00:00-03:00");
    expect(sessaoAntesDaDataMarcada(sessao, manha)).toBe(false);
  });

  it("não avisa depois da data — registro atrasado é o caso comum", () => {
    const sessao = emSaoPaulo("2026-09-12T14:00:00-03:00");
    const depois = emSaoPaulo("2026-09-15T09:00:00-03:00");
    expect(sessaoAntesDaDataMarcada(sessao, depois)).toBe(false);
  });

  it("sem data marcada não há o que avisar", () => {
    expect(sessaoAntesDaDataMarcada(null)).toBe(false);
    expect(sessaoAntesDaDataMarcada(undefined)).toBe(false);
  });

  it("usa o fuso da câmara, não o do servidor", () => {
    // 12/09 às 00h30 em São Paulo ainda é 11/09 às 21h30 em UTC-6, por exemplo.
    // A virada do dia que vale é a de São Paulo.
    const sessao = emSaoPaulo("2026-09-12T09:00:00-03:00");
    const madrugadaDoMesmoDia = emSaoPaulo("2026-09-12T00:30:00-03:00");
    expect(sessaoAntesDaDataMarcada(sessao, madrugadaDoMesmoDia)).toBe(false);
  });
});
