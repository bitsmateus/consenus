/**
 * Forma dos modelos oficiais da Ata e do Termo de Acordo (assets/modelos):
 * rótulos com dois-pontos, títulos de cláusula em caixa alta e negrito, "§ 1º"
 * com só o número em negrito, valores e nomes destacados como no modelo.
 * O texto não muda — só a marcação.
 */
import { describe, expect, it } from "vitest";
import { ataDaSessao, type DadosDaAta } from "@/documentos/ata";
import { termoDeAcordo, type DadosDoTermo } from "@/documentos/termo-acordo";

const ATA: DadosDaAta = {
  codigo: "CO-ATA-2026-000001",
  solicitante: "Maria da Silva",
  convidado: "Banco Exemplo S.A.",
  objeto: "Objeto de teste",
  dia: "05",
  mes: "julho",
  ano: "2026",
  horaInicio: "14:15",
  horaVerificacao: "14:15",
  horaEncerramento: "15:00",
  modalidade: "Videoconferência",
  presentes: ["Maria da Silva"],
  ausentes: [],
  desfecho: "COMPOSICAO_INTEGRAL",
  motivoPrejudicada: null,
  observacoes: null,
  conciliador: "Fulano",
};

const TERMO: DadosDoTermo = {
  codigo: "CO-TA-2026-000001",
  primeiraParte: "Maria da Silva",
  segundaParte: "Banco Exemplo S.A.",
  cidade: "Mogi das Cruzes",
  dia: "05",
  mes: "julho",
  ano: "2026",
  conciliador: "Fulano",
  objetoDoAcordo: "Quitação do contrato.",
  obrigacoesPrimeiraParte: "Pagar.",
  obrigacoesSegundaParte: "Baixar restrições.",
  condicoesEspecificas: null,
  prazosDeCumprimento: "30 dias",
  formaDeCumprimento: null,
  formaDePagamento: "PIX",
  demaisCondicoes: null,
};

describe("Ata — forma do modelo", () => {
  it("os rótulos da identificação levam dois-pontos, como no modelo", () => {
    const html = ataDaSessao(ATA);
    expect(html).toContain('<div class="rotulo">Interessado Solicitante:</div>');
    expect(html).toContain('<div class="rotulo">Interessado Convidado:</div>');
    expect(html).toContain('<div class="rotulo">Objeto do Procedimento:</div>');
  });

  it("título, código e subtítulo vêm do cabeçalho padrão dos documentos", () => {
    const html = ataDaSessao(ATA);
    expect(html).toContain("<h1>Ata de Sessão Privada de Conciliação</h1>");
    expect(html).toContain("<strong>Código do Documento:</strong> CO-ATA-2026-000001");
  });
});

describe("Termo de Acordo — forma do modelo", () => {
  it("títulos de cláusula em caixa alta e negrito", () => {
    const html = termoDeAcordo(TERMO);
    for (const titulo of [
      "CLÁUSULA PRIMEIRA – DO OBJETO",
      "CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DA PRIMEIRA PARTE",
      "CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DA SEGUNDA PARTE",
      "CLÁUSULA QUARTA – DAS CONDIÇÕES ESPECÍFICAS",
    ]) {
      expect(html).toContain(`<strong>${titulo}</strong>`);
    }
  });

  it("§ tem só o número em negrito; o resto da frase é texto normal", () => {
    const html = termoDeAcordo(TERMO);
    expect(html).toContain("<strong>§ 1º</strong> O cumprimento das obrigações observará os seguintes prazos:");
    expect(html).toContain("<strong>§ 4º</strong> As demais condições específicas são as seguintes:");
  });

  it("destaca o que o modelo destaca: prazos, percentuais, índice e título executivo", () => {
    const html = termoDeAcordo(TERMO);
    for (const trecho of [
      "05 (cinco) dias",
      "10% (dez por cento)",
      "1% (um por cento) ao mês",
      "pro rata die",
      "IPCA/IBGE",
      "título executivo extrajudicial",
      "Sessão Privada de Conciliação",
    ]) {
      expect(html).toContain(`<strong>${trecho}</strong>`);
    }
  });

  it("os itens a), b) e c) saem como parágrafos, sem lista <ol>", () => {
    const html = termoDeAcordo(TERMO);
    expect(html).not.toContain("<ol");
    expect(html).toContain("<p><strong>a)</strong> multa moratória");
    expect(html).toContain("<p><strong>c)</strong> atualização monetária");
  });
});
