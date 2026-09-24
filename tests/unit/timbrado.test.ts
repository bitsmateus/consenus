/**
 * Um link de Zoom comprido já fez a caixa "Designação da sessão" quebrar ao
 * meio no PDF: o link e o ID da reunião ficaram numa página, com a caixa
 * fechada, e a senha saiu sozinha, sem borda, no topo da página seguinte.
 * `break-inside: avoid` no CSS impede o motor de PDF de cortar blocos assim.
 */
import { describe, expect, it } from "vitest";
import {
  ESTILO_DO_CORPO,
  cabecalhoDoDocumento,
  montarDocumento,
  timbrar,
} from "@/documentos/timbrado";

describe("ESTILO_DO_CORPO — blocos não quebram entre páginas", () => {
  it("a caixa de designação da sessão não é cortada", () => {
    expect(ESTILO_DO_CORPO).toMatch(/\.sessao\s*\{[^}]*break-inside:\s*avoid/);
  });

  it("a identificação das partes não é cortada", () => {
    expect(ESTILO_DO_CORPO).toMatch(/\.parte\s*\{[^}]*break-inside:\s*avoid/);
  });

  it("o bloco de assinatura do conciliador não é cortado", () => {
    expect(ESTILO_DO_CORPO).toMatch(/\.assinatura\s*\{[^}]*break-inside:\s*avoid/);
  });

  it("as linhas da tabela de assinatura (Ata e Termo) não são cortadas", () => {
    expect(ESTILO_DO_CORPO).toMatch(/table tr\s*\{[^}]*break-inside:\s*avoid/);
  });
});

/**
 * O timbrado é o do modelo do cliente (Carta_Convite_Cliente.docx): imagens
 * sangradas até a borda da folha, texto corrido sem caixas nem filetes. Já
 * saiu desconfigurado — faixas com 5 mm de folha branca, fonte serifada,
 * caixa de bordas no link do Zoom.
 */
describe("montarDocumento e timbrar", () => {
  const autenticador = {
    codigo: "CO-CC-2026-000123",
    qrDataUri: "data:image/png;base64,QR",
    urlVerificacao: "https://consensusone.com.br/verificar",
  };

  it("reserva o espaço do timbrado com espaçadores que se repetem em cada página", () => {
    const html = montarDocumento("<p>corpo</p>");
    expect(html).toContain('<table class="folha">');
    expect(html).toMatch(/<thead>[\s\S]*<\/thead>/);
    expect(html).toMatch(/<tfoot>[\s\S]*<\/tfoot>/);
    expect(html).toContain("<p>corpo</p>");
  });

  it("a folha não tem margem de página: as faixas encostam na borda", () => {
    expect(ESTILO_DO_CORPO).toMatch(/@page\s*\{[^}]*margin:\s*0/);
  });

  it("cabeçalho e rodapé são fixos, e o rodapé leva o código e o QR Code do documento", () => {
    const html = timbrar(montarDocumento("<p>corpo</p>"), autenticador);
    expect(html).not.toContain("<!--timbrado-->");
    expect(html).toContain("faixa-topo");
    expect(html).toContain("faixa-base");
    expect(html).toContain("CO-CC-2026-000123");
    expect(html).toContain('src="data:image/png;base64,QR"');
    // o endereço público aparece sem o protocolo, como no modelo
    expect(html).toContain("consensusone.com.br/verificar");
  });

  it("usa a fonte do modelo (Calibri) e não desenha bordas nos títulos nem no bloco da sessão", () => {
    expect(ESTILO_DO_CORPO).toMatch(/font-family:\s*Calibri/);
    expect(ESTILO_DO_CORPO).not.toMatch(/h2\s*\{[^}]*border/);
    expect(ESTILO_DO_CORPO).not.toMatch(/\.sessao\s*\{[^}]*border/);
  });

  it("título, código e subtítulo saem na forma do modelo, com o código escapado", () => {
    const html = cabecalhoDoDocumento("Carta-Convite", "CO-CC-2026-000001");
    expect(html).toContain("<h1>Carta-Convite</h1>");
    expect(html).toContain("<strong>Código do Documento:</strong> CO-CC-2026-000001");
    expect(html).toContain("Procedimento Privado de Composição Consensual");
    expect(cabecalhoDoDocumento("X", "<script>")).not.toContain("<script>");
  });
});
