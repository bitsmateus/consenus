import { describe, expect, it } from "vitest";
import { montarSignatarios, type ParteParaAssinatura } from "@/lib/signatarios";

function parte(
  papel: ParteParaAssinatura["papel"],
  nome: string,
  extras: Partial<ParteParaAssinatura> = {}
): ParteParaAssinatura {
  return {
    papel,
    compareceu: true,
    representaPapel: null,
    pessoa: { nome, email: `${nome.toLowerCase().replace(/\s/g, ".")}@exemplo.com` },
    ...extras,
  };
}

describe("quem assina a Ata", () => {
  it("manda para o conciliador e para quem compareceu", () => {
    const { signatarios, semEmail } = montarSignatarios([
      parte("CONCILIADOR", "Sergio"),
      parte("SOLICITANTE", "Maria"),
      parte("CONVIDADO", "Joao"),
    ]);

    expect(semEmail).toEqual([]);
    expect(signatarios.map((s) => s.nome)).toEqual(["Sergio", "Maria", "Joao"]);
  });

  it("não manda para quem faltou à sessão", () => {
    const { signatarios } = montarSignatarios([
      parte("CONCILIADOR", "Sergio"),
      parte("SOLICITANTE", "Maria"),
      parte("CONVIDADO", "Joao", { compareceu: false }),
    ]);

    expect(signatarios.map((s) => s.nome)).toEqual(["Sergio", "Maria"]);
  });

  it("não manda para quem teve o comparecimento não registrado", () => {
    const { signatarios } = montarSignatarios([
      parte("CONCILIADOR", "Sergio"),
      parte("SOLICITANTE", "Maria", { compareceu: null }),
    ]);

    expect(signatarios.map((s) => s.nome)).toEqual(["Sergio"]);
  });

  it("o conciliador assina mesmo quando ninguém compareceu — a ata é obrigatória", () => {
    const { signatarios } = montarSignatarios([
      parte("CONCILIADOR", "Sergio"),
      parte("SOLICITANTE", "Maria", { compareceu: false }),
      parte("CONVIDADO", "Joao", { compareceu: false }),
    ]);

    expect(signatarios).toHaveLength(1);
    expect(signatarios[0]?.papel).toBe("Conciliador");
  });
});

describe("o mesmo e-mail entra uma vez só", () => {
  it("não cria dois convites para quem acumula papéis no procedimento", () => {
    // a D4Sign identifica signatário pelo e-mail: repetido, o documento
    // ficaria esperando para sempre uma assinatura impossível de coletar
    const mesmo = { nome: "Helena", email: "helena@exemplo.adv.br" };
    const { signatarios } = montarSignatarios([
      { papel: "PROCURADOR", compareceu: true, representaPapel: "SOLICITANTE", pessoa: mesmo },
      { papel: "PROCURADOR", compareceu: true, representaPapel: "CONVIDADO", pessoa: mesmo },
    ]);

    expect(signatarios).toHaveLength(1);
  });

  it("ignora diferença de maiúsculas e de espaço em volta do e-mail", () => {
    const { signatarios } = montarSignatarios([
      { papel: "SOLICITANTE", compareceu: true, representaPapel: null, pessoa: { nome: "Maria", email: "Maria@Exemplo.com" } },
      { papel: "CONVIDADO", compareceu: true, representaPapel: null, pessoa: { nome: "Maria", email: " maria@exemplo.com " } },
    ]);

    expect(signatarios).toHaveLength(1);
    expect(signatarios[0]?.email).toBe("maria@exemplo.com");
  });
});

describe("cadastro incompleto barra o envio", () => {
  it("lista quem está sem e-mail, com o papel, em vez de enviar pela metade", () => {
    const { signatarios, semEmail } = montarSignatarios([
      parte("CONCILIADOR", "Sergio"),
      parte("SOLICITANTE", "Maria", { pessoa: { nome: "Maria", email: null } }),
      parte("CONVIDADO", "Joao", { pessoa: { nome: "Joao", email: "   " } }),
    ]);

    expect(semEmail).toEqual([
      "Maria (Interessado Solicitante)",
      "Joao (Interessado Convidado)",
    ]);
    expect(signatarios.map((s) => s.nome)).toEqual(["Sergio"]);
  });

  it("o papel mostrado na folha de assinaturas diz de que lado o procurador é", () => {
    const { signatarios } = montarSignatarios([
      parte("PROCURADOR", "Ana", { representaPapel: "SOLICITANTE" }),
      parte("PROCURADOR", "Bruno", { representaPapel: "CONVIDADO" }),
      parte("PROCURADOR", "Carlos"),
    ]);

    expect(signatarios.map((s) => s.papel)).toEqual([
      "Procurador do Interessado Solicitante",
      "Procurador do Interessado Convidado",
      "Procurador",
    ]);
  });
});
