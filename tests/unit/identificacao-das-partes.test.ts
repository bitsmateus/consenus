import { describe, expect, it } from "vitest";
import { identificarLados } from "@/lib/identificacao-das-partes";
import { assinaturasDasPartes } from "@/documentos/timbrado";
import { ataDaSessao } from "@/documentos/ata";

const partes = [
  { id: "s", papel: "SOLICITANTE", representaId: null, pessoa: { nome: "Maria Souza", documento: "12345678909" } },
  { id: "c", papel: "CONVIDADO", representaId: null, pessoa: { nome: "Banco Alfa S.A.", documento: "11222333000181" } },
  { id: "p1", papel: "PROCURADOR", representaId: "s", pessoa: { nome: "Dr. João", documento: "98765432100", oab: "SP 123.456" } },
  { id: "k", papel: "CONCILIADOR", representaId: null, pessoa: { nome: "Dra. Ana", documento: "55544433322" } },
] as const;

describe("identificação de quem assina", () => {
  it("titular pelo CPF/CNPJ formatado e procurador pela OAB, cada um no seu lado", () => {
    const lados = identificarLados([...partes]);
    expect(lados.ladoA.titular).toEqual({ nome: "Maria Souza", documento: "123.456.789-09" });
    expect(lados.ladoA.procurador).toEqual({ nome: "Dr. João", documento: "OAB SP 123.456" });
    expect(lados.ladoB.titular).toEqual({ nome: "Banco Alfa S.A.", documento: "11.222.333/0001-81" });
    expect(lados.ladoB.procurador).toBeNull();
  });

  it("sem procurador ou sem cadastro, a linha continua em branco para preencher", () => {
    const html = assinaturasDasPartes(
      {
        ladoA: { titular: "Interessado Solicitante", procurador: "Procurador do Solicitante" },
        ladoB: { titular: "Interessado Convidado", procurador: "Procurador do Convidado" },
      },
      identificarLados([...partes])
    );
    expect(html).toContain("Nome: Maria Souza");
    expect(html).toContain("Documento: 123.456.789-09");
    expect(html).toContain("Documento: OAB SP 123.456");
    // lado do Convidado sem procurador: em branco
    expect(html).toMatch(/Nome:<\/div>\s*<div class="cargo">Documento:<\/div>\s*<div[^>]*>Procurador do Convidado/);
  });

  it("a ata leva os nomes na página de assinaturas e o do Conciliador", () => {
    const html = ataDaSessao({
      codigo: "CO-AT-1",
      solicitante: "Maria Souza",
      convidado: "Banco Alfa S.A.",
      objeto: null,
      dia: "26",
      mes: "outubro",
      ano: "2026",
      horaInicio: "14:00",
      horaVerificacao: "14:00",
      horaEncerramento: "15:00",
      modalidade: "Videoconferência",
      presentes: [],
      ausentes: [],
      desfecho: "SESSAO_PREJUDICADA",
      motivoPrejudicada: "x",
      observacoes: null,
      conciliador: "Dra. Ana",
      identificacao: identificarLados([...partes]),
    });
    expect(html).toContain(">Dra. Ana</div>");
    expect(html).toContain("Documento: 11.222.333/0001-81");
  });

  it("escapa HTML do nome", () => {
    const html = assinaturasDasPartes(
      {
        ladoA: { titular: "A", procurador: "B" },
        ladoB: { titular: "C", procurador: "D" },
      },
      {
        ladoA: { titular: { nome: "<b>x</b>", documento: null }, procurador: null },
        ladoB: { titular: null, procurador: null },
      }
    );
    expect(html).not.toContain("<b>x</b>");
  });
});
