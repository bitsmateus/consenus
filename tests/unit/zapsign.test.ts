import { afterEach, describe, expect, it } from "vitest";
import { ProvedorAssinatura } from "@prisma/client";
import { ANCORA, lugarDaAssinatura } from "@/lib/ancoras-de-assinatura";
import { provedorEscolhido } from "@/lib/provedor-de-assinatura";
import { montarSignatarios } from "@/lib/signatarios";
import {
  AUTENTICACAO_PADRAO,
  ErroDaZapSign,
  corpoDoDocumento,
  explicarFalhaDaZapSign,
  interpretarDocumento,
  lerAviso,
  modoDeAutenticacao,
  tokenDoWebhookConfere,
  urlDoWebhook,
} from "@/lib/zapsign";

const PDF = Buffer.from("%PDF-1.4 teste");

const PEDIDO = {
  nome: "Ata de Sessão Privada de Conciliação — Procedimento 2026.0145",
  pdf: PDF,
  idExterno: "doc-1",
  mensagem: "Ata do Procedimento 2026.0145 — Consensus One.",
  signatarios: [
    { nome: "Conciliadora", email: "c@x.com", papel: "Conciliador", ancora: ANCORA.conciliador },
    { nome: "Ana", email: "ana@x.com", papel: "Interessado Solicitante", ancora: ANCORA.solicitante },
  ],
};

afterEach(() => {
  delete process.env.ZAPSIGN_WEBHOOK_TOKEN;
  delete process.env.AUTH_URL;
});

describe("corpo do documento na ZapSign", () => {
  it("manda o PDF em base64 puro, sem prefixo data:", () => {
    const corpo = corpoDoDocumento(PEDIDO);
    expect(corpo.base64_pdf).toBe(PDF.toString("base64"));
    expect(corpo.lang).toBe("pt-br");
    expect(corpo.external_id).toBe("doc-1");
  });

  it("cada signatário vai com e-mail automático, nome travado e a âncora da sua linha", () => {
    const [conciliador] = corpoDoDocumento(PEDIDO).signers as Record<string, unknown>[];
    expect(conciliador).toMatchObject({
      name: "Conciliadora",
      email: "c@x.com",
      auth_mode: AUTENTICACAO_PADRAO,
      send_automatic_email: true,
      lock_name: true,
      lock_email: true,
      qualification: "Conciliador",
      signature_placement: "<<assina-conciliador>>",
    });
  });

  it("dois signatários na mesma linha: só o primeiro leva a âncora, para não sobrepor", () => {
    const corpo = corpoDoDocumento({
      ...PEDIDO,
      signatarios: [
        { nome: "Dr. A", email: "a@x.com", papel: "Procurador", ancora: ANCORA.procuradorSolicitante },
        { nome: "Dra. B", email: "b@x.com", papel: "Procurador", ancora: ANCORA.procuradorSolicitante },
      ],
    });
    const [a, b] = corpo.signers as Record<string, unknown>[];
    expect(a?.signature_placement).toBe("<<assina-procurador-solicitante>>");
    expect(b).not.toHaveProperty("signature_placement");
  });

  it("signatário sem linha não leva âncora", () => {
    const corpo = corpoDoDocumento({
      ...PEDIDO,
      signatarios: [{ nome: "X", email: "x@x.com", papel: "Procurador", ancora: null }],
    });
    expect((corpo.signers as Record<string, unknown>[])[0]).not.toHaveProperty("signature_placement");
  });
});

describe("forma de identificação do signatário", () => {
  it("padrão é assinatura na tela + código por e-mail", () => {
    expect(modoDeAutenticacao(undefined)).toBe("assinaturaTela-tokenEmail");
  });
  it("aceita um modo da lista", () => {
    expect(modoDeAutenticacao("tokenWhatsapp")).toBe("tokenWhatsapp");
  });
  it("valor desconhecido cai no padrão em vez de derrubar o envio", () => {
    expect(modoDeAutenticacao("selfie")).toBe(AUTENTICACAO_PADRAO);
  });
});

describe("leitura do documento da ZapSign", () => {
  const signers = [
    { name: "Conciliadora", email: "C@X.com", status: "signed" },
    { name: "Ana", email: "ana@x.com", status: "link-opened" },
  ];

  it("pendente: conta quem já assinou e não expõe arquivo", () => {
    const d = interpretarDocumento({ token: "t", status: "pending", signers, signed_file: "https://x" });
    expect(d.situacao).toBe("pendente");
    expect(d.totalSignatarios).toBe(2);
    expect(d.assinaram).toEqual([{ nome: "Conciliadora", email: "c@x.com" }]);
    expect(d.arquivoAssinado).toBeNull();
  });

  it("assinado: traz o link do arquivo", () => {
    const d = interpretarDocumento({ token: "t", status: "signed", signers, signed_file: "https://s3/x.pdf" });
    expect(d.situacao).toBe("assinado");
    expect(d.arquivoAssinado).toBe("https://s3/x.pdf");
  });

  it("recusado aparece como 'refused' ou 'recusado' — os dois são cancelamento", () => {
    expect(interpretarDocumento({ status: "refused" }).situacao).toBe("cancelado");
    expect(interpretarDocumento({ status: "recusado" }).situacao).toBe("cancelado");
  });

  it("documento excluído na ZapSign é cancelamento", () => {
    expect(interpretarDocumento({ status: "pending", deleted: true }).situacao).toBe("cancelado");
  });
});

describe("aviso (webhook) da ZapSign", () => {
  it("lê só o token do documento e o evento", () => {
    expect(lerAviso({ token: " abc ", event_type: "doc_signed", status: "signed" })).toEqual({
      tokenDoDocumento: "abc",
      evento: "doc_signed",
    });
  });
  it("sem token, não há aviso", () => {
    expect(lerAviso({ event_type: "doc_signed" })).toBeNull();
    expect(lerAviso(null)).toBeNull();
  });

  it("token do caminho: confere em tempo constante e recusa sem configuração", () => {
    expect(tokenDoWebhookConfere("abc")).toBe(false);
    process.env.ZAPSIGN_WEBHOOK_TOKEN = "segredo-123";
    expect(tokenDoWebhookConfere("segredo-123")).toBe(true);
    expect(tokenDoWebhookConfere("segredo-12")).toBe(false);
    expect(tokenDoWebhookConfere(undefined)).toBe(false);
  });

  it("endereço do webhook leva o token no caminho", () => {
    expect(urlDoWebhook()).toBeNull();
    process.env.AUTH_URL = "https://app.consensusone.com.br/";
    process.env.ZAPSIGN_WEBHOOK_TOKEN = "t0k";
    expect(urlDoWebhook()).toBe("https://app.consensusone.com.br/api/webhooks/zapsign/t0k");
  });
});

describe("explicação da falha para o operador", () => {
  it("402: plano sem API", () => {
    expect(explicarFalhaDaZapSign(new ErroDaZapSign(402, "{}", "criar"))).toMatch(/plano/);
  });
  it("401: chave recusada, citando a etapa e o que a ZapSign disse", () => {
    const msg = explicarFalhaDaZapSign(
      new ErroDaZapSign(401, JSON.stringify({ detail: "Token inválido" }), "criar")
    );
    expect(msg).toMatch(/chave.*na criação do documento/);
    expect(msg).toContain("Token inválido");
  });
  it("429 e 5xx", () => {
    expect(explicarFalhaDaZapSign(new ErroDaZapSign(429, "", "criar"))).toMatch(/um minuto/);
    expect(explicarFalhaDaZapSign(new ErroDaZapSign(503, "", "consultar"))).toMatch(/instável/);
  });
  it("tempo esgotado avisa para conferir antes de reenviar (pode ter sido criado)", () => {
    const erro = new Error("x");
    erro.name = "TimeoutError";
    expect(explicarFalhaDaZapSign(erro)).toMatch(/Confira/);
  });
});

describe("escolha da plataforma dos envios novos", () => {
  it("padrão continua D4Sign até a chave ser virada", () => {
    expect(provedorEscolhido(undefined)).toBe(ProvedorAssinatura.D4SIGN);
    expect(provedorEscolhido("")).toBe(ProvedorAssinatura.D4SIGN);
  });
  it("'zapsign', em qualquer caixa, escolhe a ZapSign", () => {
    expect(provedorEscolhido(" ZapSign ")).toBe(ProvedorAssinatura.ZAPSIGN);
  });
});

describe("em que linha cada pessoa assina", () => {
  it("titulares, conciliador e procuradores de cada lado", () => {
    expect(lugarDaAssinatura("CONCILIADOR", null)).toBe("conciliador");
    expect(lugarDaAssinatura("SOLICITANTE", null)).toBe("solicitante");
    expect(lugarDaAssinatura("CONVIDADO", null)).toBe("convidado");
    expect(lugarDaAssinatura("PROCURADOR", "SOLICITANTE")).toBe("procuradorSolicitante");
    expect(lugarDaAssinatura("PROCURADOR", "CONVIDADO")).toBe("procuradorConvidado");
    expect(lugarDaAssinatura("PROCURADOR", null)).toBeNull();
  });

  it("a montagem dos signatários já sai com o lugar", () => {
    const { signatarios } = montarSignatarios([
      { papel: "CONCILIADOR", compareceu: null, representaPapel: null, pessoa: { nome: "C", email: "c@x.com" } },
      { papel: "PROCURADOR", compareceu: true, representaPapel: "CONVIDADO", pessoa: { nome: "P", email: "p@x.com" } },
    ]);
    expect(signatarios.map((s) => s.lugar)).toEqual(["conciliador", "procuradorConvidado"]);
  });
});
