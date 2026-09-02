/**
 * O bloco de assinaturas da Ata e do Termo de Acordo precisa seguir o modelo
 * oficial: linha do Conciliador, e quatro linhas em branco (Nome/Documento)
 * para o titular e o procurador dos dois lados. Faltavam as colunas de
 * procurador no Termo, e ele mostrava o nome já preenchido em vez de deixar
 * em branco para assinar — corrigido em 02/09 reaproveitando o mesmo helper
 * usado pela Ata (`src/documentos/timbrado.ts`).
 */
import { describe, expect, it } from "vitest";
import { ataDaSessao, type DadosDaAta } from "@/documentos/ata";
import { termoDeAcordo, type DadosDoTermo } from "@/documentos/termo-acordo";

const BASE_ATA: DadosDaAta = {
  codigo: "CO-ATA-2026-000001",
  solicitante: "Fulano de Tal",
  convidado: "Beltrana da Silva",
  objeto: null,
  dia: "01",
  mes: "janeiro",
  ano: "2026",
  horaInicio: "14:00",
  horaVerificacao: "14:00",
  horaEncerramento: "15:00",
  modalidade: "Videoconferência",
  presentes: [],
  ausentes: [],
  desfecho: "ENCERRAMENTO_SEM_COMPOSICAO",
  motivoPrejudicada: null,
  observacoes: null,
  conciliador: "Conciliador Teste",
};

const BASE_TERMO: DadosDoTermo = {
  codigo: "CO-TA-2026-000001",
  primeiraParte: "Fulano de Tal",
  segundaParte: "Beltrana da Silva",
  cidade: "Mogi das Cruzes",
  dia: "01",
  mes: "janeiro",
  ano: "2026",
  conciliador: "Conciliador Teste",
  objetoDoAcordo: "Objeto de teste.",
  obrigacoesPrimeiraParte: "Obrigação de teste.",
  obrigacoesSegundaParte: "Obrigação de teste.",
  condicoesEspecificas: null,
  prazosDeCumprimento: null,
  formaDeCumprimento: null,
  formaDePagamento: null,
  demaisCondicoes: null,
};

describe("bloco de assinaturas — Ata e Termo seguem o mesmo modelo", () => {
  it("a Ata tem as quatro linhas em branco, titular e procurador dos dois lados", () => {
    const html = ataDaSessao(BASE_ATA);
    expect(html).toContain("Procurador do Solicitante");
    expect(html).toContain("Procurador do Convidado");
    // titular também fica em branco para assinar, não com o nome já preenchido
    expect((html.match(/Nome:/g) ?? []).length).toBe(4);
    // "Documento:" aparece 4 vezes nas linhas de assinatura, mais 1 no
    // cabeçalho ("Código do Documento: ...")
    expect((html.match(/Documento:/g) ?? []).length).toBe(5);
  });

  it("o Termo tem as mesmas quatro linhas em branco, agora com Parte 1/2", () => {
    const html = termoDeAcordo(BASE_TERMO);
    expect(html).toContain("Procurador da Parte 1");
    expect(html).toContain("Procurador da Parte 2");
    expect((html.match(/Nome:/g) ?? []).length).toBe(4);
    expect((html.match(/Documento:/g) ?? []).length).toBe(5);
  });

  it("o conciliador aparece preenchido nos dois documentos, fora das linhas em branco", () => {
    expect(ataDaSessao(BASE_ATA)).toContain("Conciliador Teste");
    expect(termoDeAcordo(BASE_TERMO)).toContain("Conciliador Teste");
  });
});
