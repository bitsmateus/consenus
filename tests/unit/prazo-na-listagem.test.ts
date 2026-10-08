import { describe, expect, it } from "vitest";
import { Prisma, StatusAto } from "@prisma/client";
import { comFiltros, ordemDaListagem } from "@/lib/consultas-de-atos";
import { rotuloDoPrazo } from "@/lib/formato";

const AGORA = new Date("2026-10-08T10:00:00-03:00");
const prazo = (dia: string) => new Date(`${dia}T00:00:00-03:00`);

describe("ordem da listagem de procedimentos", () => {
  it("em 'Aguardando documentação' ordena pelo prazo, do mais próximo ao mais distante", () => {
    expect(ordemDaListagem({ status: StatusAto.AGUARDANDO_DOCUMENTACAO })).toEqual([
      { prazoDocumentacaoAte: { sort: "asc", nulls: "last" } },
      { criadoEm: "desc" },
    ]);
  });

  it("com filtro de prazo também ordena pelo prazo", () => {
    expect(ordemDaListagem({ prazoDe: "2026-10-08" })[0]).toEqual({
      prazoDocumentacaoAte: { sort: "asc", nulls: "last" },
    });
  });

  it("nas demais abas segue do mais recente para o mais antigo", () => {
    expect(ordemDaListagem({})).toEqual([{ criadoEm: "desc" }]);
    expect(ordemDaListagem({ status: StatusAto.DATA_CONFIRMADA })).toEqual([{ criadoEm: "desc" }]);
  });
});

describe("filtro por prazo da documentação", () => {
  const visivel: Prisma.AtoWhereInput = { id: "qualquer" };
  const condicoes = (w: Prisma.AtoWhereInput) => w.AND as Prisma.AtoWhereInput[];

  it("'vence hoje' cobre o dia inteiro, no fuso de São Paulo", () => {
    const where = comFiltros(visivel, { prazoDe: "2026-10-08", prazoAte: "2026-10-08" });
    const filtro = condicoes(where).find((c) => c.prazoDocumentacaoAte);
    expect(filtro?.prazoDocumentacaoAte).toEqual({
      gte: prazo("2026-10-08"),
      lt: prazo("2026-10-09"),
    });
  });

  it("ignora procedimento encerrado", () => {
    const where = comFiltros(visivel, { prazoDe: "2026-10-08" });
    const filtro = condicoes(where).find((c) => c.prazoDocumentacaoAte);
    expect(filtro?.status).toEqual({ notIn: expect.arrayContaining([StatusAto.CANCELADO]) });
  });

  it("data inválida é ignorada e a visibilidade continua aplicada", () => {
    const where = comFiltros(visivel, { prazoDe: "ontem", prazoAte: "" });
    expect(condicoes(where)).toEqual([visivel]);
  });
});

describe("rótulo do prazo na listagem", () => {
  it("diz 'Vence hoje' e 'Vence amanhã'", () => {
    expect(rotuloDoPrazo(prazo("2026-10-08"), AGORA)).toEqual({ texto: "Vence hoje", tom: "atencao" });
    expect(rotuloDoPrazo(prazo("2026-10-09"), AGORA)).toEqual({ texto: "Vence amanhã", tom: "atencao" });
  });

  it("conta os dias que faltam e os de atraso", () => {
    expect(rotuloDoPrazo(prazo("2026-10-13"), AGORA)).toEqual({ texto: "Faltam 5 dias", tom: "sucesso" });
    expect(rotuloDoPrazo(prazo("2026-10-07"), AGORA)).toEqual({ texto: "Vencido há 1 dia", tom: "encerrado" });
    expect(rotuloDoPrazo(prazo("2026-10-03"), AGORA)).toEqual({ texto: "Vencido há 5 dias", tom: "encerrado" });
  });
});
