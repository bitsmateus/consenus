import { beforeEach, describe, expect, it } from "vitest";
import {
  canaisPossiveis,
  montarCorpo,
  normalizarTelefone,
  statusIndicaEntrega,
} from "@/lib/ar-online";

const PESSOA = {
  nome: "Marcos Vinícius Tavares",
  email: "marcos@exemplo.com.br",
  telefone: "(11) 99999-8888",
};

beforeEach(() => {
  delete process.env.AR_ONLINE_TEMPLATE_WHATSAPP;
});

describe("telefone para a AR Online", () => {
  it("tira máscara e deixa só dígitos", () => {
    expect(normalizarTelefone("(11) 99999-8888")).toBe("11999998888");
    expect(normalizarTelefone("+55 11 99999-8888")).toBe("5511999998888");
  });

  it("recusa número curto demais para ser telefone", () => {
    expect(normalizarTelefone("99999")).toBeNull();
    expect(normalizarTelefone("")).toBeNull();
    expect(normalizarTelefone(null)).toBeNull();
  });
});

describe("escolha de canal", () => {
  it("sem template configurado, WhatsApp não é oferecido", () => {
    expect(canaisPossiveis(PESSOA)).toEqual(["email"]);
  });

  it("com template configurado, e-mail e WhatsApp saem juntos", () => {
    process.env.AR_ONLINE_TEMPLATE_WHATSAPP = "template-1";
    expect(canaisPossiveis(PESSOA)).toEqual(["email", "whatsapp"]);
  });

  it("sem e-mail e sem telefone válido, não há canal", () => {
    expect(canaisPossiveis({ nome: "Fulano", email: null, telefone: "123" })).toEqual([]);
  });
});

describe("corpo da requisição", () => {
  const base = {
    destinatario: PESSOA,
    assunto: "Carta-Convite — Procedimento 2026.0009",
    conteudoHtml: "<p>Segue a Carta-Convite.</p>",
    referencia: "envio-123",
  };

  it("manda o nosso id como customID, para correlacionar o aviso depois", () => {
    expect(montarCorpo(base).customID).toBe("envio-123");
  });

  it("o PDF vai como anexo em base64", () => {
    const corpo = montarCorpo({
      ...base,
      anexo: { nome: "carta.pdf", conteudo: Buffer.from("conteudo do pdf") },
    });
    expect(corpo.attachments).toEqual([
      { name: "carta.pdf", base64: Buffer.from("conteudo do pdf").toString("base64") },
    ]);
  });

  it("o bloco de WhatsApp só aparece com template, e leva o número sem máscara", () => {
    expect(montarCorpo(base).whatsapp).toBeUndefined();

    process.env.AR_ONLINE_TEMPLATE_WHATSAPP = "template-1";
    const corpo = montarCorpo({ ...base, variaveisDoTemplate: { N_PROCEDIMENTO: "2026.0009" } });
    expect(corpo.whatsapp).toEqual({
      number: "11999998888",
      variables: { template: "template-1", N_PROCEDIMENTO: "2026.0009" },
    });
  });

  it("recusa destinatário sem nenhum contato, em vez de mandar envio vazio", () => {
    expect(() =>
      montarCorpo({ ...base, destinatario: { nome: "Fulano", email: null, telefone: null } })
    ).toThrow(/e-mail nem telefone/);
  });
});

describe("leitura do status", () => {
  it("reconhece entrega nas grafias que a AR Online usa", () => {
    for (const status of ["Entregue", "entregue", "Visualizado", "Lido (acessou o link)"]) {
      expect(statusIndicaEntrega(status), status).toBe(true);
    }
  });

  it("não confunde falha nem trânsito com entrega", () => {
    for (const status of ["Processado", "Enviado", "Falha no Envio/Entrega", "Número inválido"]) {
      expect(statusIndicaEntrega(status), status).toBe(false);
    }
  });

  it("status ausente não é entrega", () => {
    expect(statusIndicaEntrega(null)).toBe(false);
    expect(statusIndicaEntrega("")).toBe(false);
  });
});
