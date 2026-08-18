/**
 * Regras de sequência do fluxo — docs/02.
 *
 * A conferência item a item é o que trava a confirmação da data, e a data
 * confirmada é o que libera a segunda carta. Se isso afrouxar, o rito
 * contratual deixa de ser garantido pelo sistema.
 */
import { describe, expect, it } from "vitest";
import { ItemDaDocumentacao } from "@prisma/client";
import { ITENS_DA_DOCUMENTACAO, faltamItens } from "@/lib/documentacao";

const TODOS = ITENS_DA_DOCUMENTACAO.map((d) => d.item);

const conferidos = (itens: ItemDaDocumentacao[]) =>
  itens.map((item) => ({ item, conferido: true, naoAplicavel: false }));

describe("checklist da documentação", () => {
  it("cobre os cinco itens que a Carta-Convite exige", () => {
    expect(TODOS).toHaveLength(5);
    expect(TODOS).toContain(ItemDaDocumentacao.CONTRATO_PRESTACAO_SERVICOS);
    expect(TODOS).toContain(ItemDaDocumentacao.PROCURACAO);
    expect(TODOS).toContain(ItemDaDocumentacao.CONTRATO_FINANCIAMENTO);
    expect(TODOS).toContain(ItemDaDocumentacao.PROVA_TECNICA);
    expect(TODOS).toContain(ItemDaDocumentacao.DOCUMENTOS_PESSOAIS);
  });

  it("só a procuração é opcional — o modelo diz 'quando aplicável'", () => {
    const opcionais = ITENS_DA_DOCUMENTACAO.filter((d) => d.opcional).map((d) => d.item);
    expect(opcionais).toEqual([ItemDaDocumentacao.PROCURACAO]);
  });

  it("sem nenhuma conferência, faltam os cinco", () => {
    expect(faltamItens([])).toHaveLength(5);
  });

  it("item não conferido continua pendente", () => {
    const parcial = conferidos(TODOS.slice(0, 4));
    expect(faltamItens(parcial)).toEqual([TODOS[4]]);
  });

  it("nada falta quando os cinco estão conferidos", () => {
    expect(faltamItens(conferidos(TODOS))).toEqual([]);
  });

  it("marcar como não aplicável resolve o item", () => {
    const registros = [
      ...conferidos(TODOS.filter((i) => i !== ItemDaDocumentacao.PROCURACAO)),
      { item: ItemDaDocumentacao.PROCURACAO, conferido: false, naoAplicavel: true },
    ];
    expect(faltamItens(registros)).toEqual([]);
  });

  it("registro existente mas em branco não vale como resolvido", () => {
    const registros = TODOS.map((item) => ({ item, conferido: false, naoAplicavel: false }));
    expect(faltamItens(registros)).toHaveLength(5);
  });
});
