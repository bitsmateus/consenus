import { afterEach, describe, expect, it } from "vitest";
import {
  destinatariosDoAviso,
  mensagemDeCancelamento,
  variaveisDoCancelamento,
} from "@/lib/aviso-de-cancelamento";
import { canaisPossiveis, montarCorpo } from "@/lib/ar-online";

const ANA = { id: "p1", nome: "Ana Souza", email: "ana@exemplo.com.br", telefone: "11999998888" };
const BANCO = { id: "p2", nome: "Banco Exemplo S.A", email: "juridico@banco.com.br", telefone: null };

// 10/11/2026 09:40 em São Paulo = 12:40 UTC
const SESSAO = new Date("2026-11-10T12:40:00Z");

describe("quem recebe o aviso de cancelamento", () => {
  it("avisa cada pessoa que recebeu carta, uma vez só", () => {
    const lista = destinatariosDoAviso([
      { destinatario: ANA },
      { destinatario: BANCO },
      { destinatario: ANA },
    ]);
    expect(lista.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("sem carta enviada, ninguém é avisado", () => {
    expect(destinatariosDoAviso([])).toEqual([]);
  });
});

describe("texto do aviso de cancelamento", () => {
  const mensagem = mensagemDeCancelamento({
    nomeDestinatario: "Ana Souza",
    numeroDoAto: "2026.0145",
    nomeCamara: "Consensus One",
    dataDaSessao: SESSAO,
  });

  it("traz número, data e hora no fuso de São Paulo", () => {
    expect(mensagem.assunto).toBe(
      "Cancelamento da Sessão Privada de Conciliação — Procedimento 2026.0145"
    );
    expect(mensagem.texto).toContain("nº 2026.0145");
    expect(mensagem.texto).toContain("10/11/2026, às 09:40");
    expect(mensagem.texto).toContain("foi cancelada pela Consensus One");
  });

  it("usa a terminologia do cliente", () => {
    expect(mensagem.texto).toContain("Sessão Privada de Conciliação");
    expect(mensagem.texto).toContain("Procedimento Privado de Composição Consensual");
    expect(mensagem.texto.toLowerCase()).not.toMatch(/audiência|requerente|réu/);
  });

  it("escapa HTML no nome", () => {
    const m = mensagemDeCancelamento({
      nomeDestinatario: "<b>X</b>",
      numeroDoAto: "1",
      nomeCamara: "C",
      dataDaSessao: null,
    });
    expect(m.html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(m.texto).toContain("data a designar");
  });

  it("variáveis do template de WhatsApp", () => {
    expect(
      variaveisDoCancelamento({ solicitante: "Ana", convidado: "Banco", dataDaSessao: SESSAO })
    ).toEqual({ INSTITUICAO: "Ana x Banco", DATA: "10/11/2026", HORA: "09:40" });
  });
});

describe("template de WhatsApp por envio", () => {
  afterEach(() => {
    delete process.env.AR_ONLINE_TEMPLATE_WHATSAPP;
  });

  it("aviso de cancelamento não usa o template da carta-convite", () => {
    process.env.AR_ONLINE_TEMPLATE_WHATSAPP = "carta";
    const corpo = montarCorpo({
      destinatario: ANA,
      assunto: "a",
      conteudoHtml: "<p>a</p>",
      referencia: "r",
      templateWhatsapp: "",
    });
    expect(corpo.whatsapp).toBeUndefined();
  });

  it("com template próprio, o WhatsApp sai com ele", () => {
    process.env.AR_ONLINE_TEMPLATE_WHATSAPP = "carta";
    const corpo = montarCorpo({
      destinatario: ANA,
      assunto: "a",
      conteudoHtml: "<p>a</p>",
      referencia: "r",
      templateWhatsapp: "cancelamento",
      variaveisDoTemplate: { DATA: "10/11/2026" },
    });
    expect(corpo.whatsapp).toEqual({
      number: "11999998888",
      variables: { template: "cancelamento", DATA: "10/11/2026" },
    });
  });

  it("sem template no pedido, continua o da carta-convite", () => {
    process.env.AR_ONLINE_TEMPLATE_WHATSAPP = "carta";
    expect(canaisPossiveis(ANA)).toEqual(["email", "whatsapp"]);
  });
});
