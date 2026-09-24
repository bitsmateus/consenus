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
  tipoDeModalidade: "VIDEOCONFERENCIA",
  localPresencial: null,
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

/**
 * Forma do modelo oficial (Carta_Convite_Cliente.docx): lista dos documentos
 * em parágrafos, dados da sessão em linhas simples, logotipo depois de
 * "Atenciosamente,".
 */
describe("carta-convite — forma do modelo do cliente", () => {
  it("os cinco documentos exigidos saem numerados de I a V, sem lista <ol>", () => {
    const html = cartaAoSolicitante(BASE);
    expect(html).not.toContain("<ol");
    for (const numeral of ["I", "II", "III", "IV", "V"]) {
      expect(html).toContain(`<p>${numeral} – `);
    }
  });

  it("a designação da sessão traz link, ID e senha em linhas simples, sem caixa", () => {
    const html = cartaAoConvidado(BASE);
    expect(html).toContain("<strong>Link para acesso à sessão:</strong> Plataforma Zoom Workplace");
    expect(html).toContain("Link: https://zoom.example/1");
    expect(html).toContain("ID da reunião: 123");
    expect(html).toContain("Senha: abc");
    expect(html).not.toContain('class="sessao">\n  <dl>');
  });

  it("data e hora da sessão aparecem em destaque, como no modelo", () => {
    const html = cartaAoSolicitante(BASE);
    expect(html).toContain("<strong><em>01/01/2026</em></strong>");
    expect(html).toContain("<strong>14:00 horas</strong>");
  });

  it("o logotipo vem depois de 'Atenciosamente,', no lugar da linha de assinatura", () => {
    const html = cartaAoSolicitante(BASE);
    expect(html.indexOf("Atenciosamente,")).toBeLessThan(html.indexOf('class="logo-carta"'));
    expect(html).not.toContain('class="linha"');
  });

  it("a carta ao Convidado não traz o cadastro nem a lista de documentos", () => {
    const html = cartaAoConvidado(BASE);
    expect(html).not.toContain("Cadastro e formação do procedimento");
    expect(html).not.toContain('class="itens"');
  });
});

/**
 * Como chegar à sessão depende da modalidade: a carta de sessão presencial
 * saía com o bloco do Zoom ("a ser informado") e sem o local.
 */
describe("carta-convite — dados de acesso por modalidade", () => {
  const LOCAL = "Rua Olegário Paiva, 180, sala 411, Mogi das Cruzes/SP";

  it("videoconferência traz o Zoom e não traz local", () => {
    for (const carta of [cartaAoSolicitante(BASE), cartaAoConvidado(BASE)]) {
      expect(carta).toContain("Link para acesso à sessão:");
      expect(carta).not.toContain("Local da sessão:");
    }
  });

  it("presencial traz o local e não traz o Zoom", () => {
    const dados = { ...BASE, tipoDeModalidade: "PRESENCIAL" as const, localPresencial: LOCAL };
    for (const carta of [cartaAoSolicitante(dados), cartaAoConvidado(dados)]) {
      expect(carta).toContain(`<strong>Local da sessão:</strong> ${LOCAL}`);
      expect(carta).not.toContain("Link para acesso à sessão:");
      expect(carta).not.toContain("ID da reunião");
    }
  });

  it("híbrida traz o Zoom e o local", () => {
    const carta = cartaAoSolicitante({ ...BASE, tipoDeModalidade: "HIBRIDA", localPresencial: LOCAL });
    expect(carta).toContain("Link para acesso à sessão:");
    expect(carta).toContain(`<strong>Local da sessão:</strong> ${LOCAL}`);
  });

  it("local ainda não informado aparece como 'a ser informado', nunca em branco", () => {
    const carta = cartaAoConvidado({ ...BASE, tipoDeModalidade: "PRESENCIAL", localPresencial: null });
    expect(carta).toContain("<strong>Local da sessão:</strong> a ser informado");
  });

  it("o local vindo do banco é escapado", () => {
    const carta = cartaAoSolicitante({
      ...BASE,
      tipoDeModalidade: "PRESENCIAL",
      localPresencial: "<script>alert(1)</script>",
    });
    expect(carta).not.toContain("<script>alert(1)");
  });
});
