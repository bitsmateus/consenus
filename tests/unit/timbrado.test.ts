/**
 * Um link de Zoom comprido já fez a caixa "Designação da sessão" quebrar ao
 * meio no PDF: o link e o ID da reunião ficaram numa página, com a caixa
 * fechada, e a senha saiu sozinha, sem borda, no topo da página seguinte.
 * `break-inside: avoid` no CSS impede o motor de PDF de cortar blocos assim.
 */
import { describe, expect, it } from "vitest";
import { ESTILO_DO_CORPO } from "@/documentos/timbrado";

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
