/**
 * Checklist da documentação exigida do Interessado Solicitante.
 *
 * Módulo puro: sem sessão, sem Auth.js. A regra que trava a confirmação da data
 * é contratual (docs/08 e docs/09, item 7) e precisa ser testável isolada.
 */
import { ItemDaDocumentacao } from "@prisma/client";

/** Os cinco itens exigidos pela Carta-Convite, na ordem do modelo. */
export const ITENS_DA_DOCUMENTACAO: {
  item: ItemDaDocumentacao;
  rotulo: string;
  opcional?: boolean;
}[] = [
  {
    item: ItemDaDocumentacao.CONTRATO_PRESTACAO_SERVICOS,
    rotulo:
      "I — Contrato de prestação de serviços com a Empresa de Consultoria e Assessoria Técnica",
  },
  {
    item: ItemDaDocumentacao.PROCURACAO,
    rotulo: "II — Procuração com poderes de representação",
    // o modelo diz "quando aplicável": nem todo procedimento tem procurador
    opcional: true,
  },
  {
    item: ItemDaDocumentacao.CONTRATO_FINANCIAMENTO,
    rotulo: "III — Contrato de financiamento relacionado à controvérsia",
  },
  {
    item: ItemDaDocumentacao.PROVA_TECNICA,
    rotulo: "IV — Prova técnica, laudo ou documento equivalente",
  },
  {
    item: ItemDaDocumentacao.DOCUMENTOS_PESSOAIS,
    rotulo: "V — Documentos pessoais do Interessado Solicitante e do representante",
  },
];

/**
 * Itens que ainda impedem a confirmação da data.
 *
 * Um item resolve de dois jeitos: conferido, ou marcado como não aplicável.
 * Registro em branco não conta — existir a linha não significa ter conferido.
 */
export function faltamItens(
  conferencias: { item: ItemDaDocumentacao; conferido: boolean; naoAplicavel: boolean }[]
): ItemDaDocumentacao[] {
  return ITENS_DA_DOCUMENTACAO.filter((definicao) => {
    const registro = conferencias.find((c) => c.item === definicao.item);
    return !registro || (!registro.conferido && !registro.naoAplicavel);
  }).map((d) => d.item);
}
