/**
 * Regras de sequência do fluxo — docs/02.
 *
 * A conferência item a item é o que trava a confirmação da data, e a data
 * confirmada é o que libera a segunda carta. Se isso afrouxar, o rito
 * contratual deixa de ser garantido pelo sistema.
 */
import { describe, expect, it } from "vitest";
import { ItemDaDocumentacao } from "@prisma/client";
import { DesfechoSessao } from "@prisma/client";
import {
  DESFECHOS_COM_ACORDO,
  DESFECHOS_SEM_ACORDO,
  desfechosPara,
  houveAcordo,
} from "@/lib/desfechos";
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

describe("desfechos da sessão", () => {
  it("os cinco desfechos continuam existindo, repartidos pela pergunta do acordo", () => {
    const todos = [...DESFECHOS_COM_ACORDO, ...DESFECHOS_SEM_ACORDO];
    expect(todos).toHaveLength(Object.values(DesfechoSessao).length);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("só composição integral ou parcial autoriza Termo de Acordo", () => {
    expect(houveAcordo(DesfechoSessao.COMPOSICAO_INTEGRAL)).toBe(true);
    expect(houveAcordo(DesfechoSessao.COMPOSICAO_PARCIAL)).toBe(true);
    expect(houveAcordo(DesfechoSessao.ENCERRAMENTO_SEM_COMPOSICAO)).toBe(false);
    expect(houveAcordo(DesfechoSessao.REDESIGNACAO)).toBe(false);
    expect(houveAcordo(DesfechoSessao.SESSAO_PREJUDICADA)).toBe(false);
  });

  it("responder que houve acordo não oferece desfecho sem composição", () => {
    for (const desfecho of desfechosPara(true)) {
      expect(houveAcordo(desfecho)).toBe(true);
    }
    for (const desfecho of desfechosPara(false)) {
      expect(houveAcordo(desfecho)).toBe(false);
    }
  });
});
