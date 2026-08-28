/**
 * O procurador é opcional (docs/10) e, quando vinculado, precisa aparecer na
 * identificação das partes da Carta-Convite (pedido do cliente em 28/08) —
 * nas duas versões, ao Solicitante e ao Convidado.
 */
import { describe, expect, it } from "vitest";
import { cartaAoConvidado, cartaAoSolicitante, type DadosDaCarta } from "@/documentos/carta-convite";

const BASE: DadosDaCarta = {
  codigo: "CO-CC-2026-000001",
  solicitante: "Fulano de Tal",
  convidado: "Beltrana da Silva",
  objeto: "Objeto de teste",
  dataDaSessao: "01/01/2026",
  horaDaSessao: "14:00",
  modalidade: "por meio da plataforma oficial de videoconferência da Consensus One",
  link: "https://zoom.example/1",
  idReuniao: "123",
  senhaReuniao: "abc",
  prazoDocumentacaoDias: 15,
  horasAvisoModalidade: 48,
};

describe("carta-convite — procurador na identificação das partes", () => {
  it("não mostra procurador quando ninguém foi vinculado", () => {
    expect(cartaAoSolicitante(BASE)).not.toContain("Representado(a) por");
    expect(cartaAoConvidado(BASE)).not.toContain("Representado(a) por");
  });

  it("mostra o procurador do Solicitante quando informado", () => {
    const html = cartaAoSolicitante({ ...BASE, procuradorSolicitante: "Advogado Tal (Advogado)" });
    expect(html).toContain("Representado(a) por: Advogado Tal (Advogado)");
  });

  it("mostra o procurador do Convidado, inclusive na carta ao Convidado", () => {
    const html = cartaAoConvidado({
      ...BASE,
      procuradorConvidado: "Escritório X (Escritório de advocacia)",
    });
    expect(html).toContain("Representado(a) por: Escritório X (Escritório de advocacia)");
  });
});
