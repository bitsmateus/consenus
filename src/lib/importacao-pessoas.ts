/**
 * Importação de pessoas por planilha (.xlsx).
 *
 * Pedido do cliente em 28/08: a base de Interessados/procuradores pode ser
 * grande, e cadastrar um a um pela tela não escala. A planilha modelo tem as
 * mesmas colunas do formulário de cadastro — só que "Tipo" não é uma delas:
 * o sistema já reconhece pessoa física ou jurídica pela quantidade de
 * dígitos do CPF/CNPJ, então pedir essa coluna só criaria chance de erro.
 */
import ExcelJS from "exceljs";
import { TipoPessoa, TipoProcurador } from "@prisma/client";
import { apenasDigitos } from "@/lib/documentos";
import { ErroDeNegocio } from "@/lib/erros";
import { ROTULO_TIPO_PROCURADOR } from "@/lib/formato";

export const COLUNAS_MODELO = [
  { chave: "nome", rotulo: "Nome ou Razão Social" },
  { chave: "documento", rotulo: "CPF ou CNPJ" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "logradouro", rotulo: "Logradouro" },
  { chave: "numero", rotulo: "Número" },
  { chave: "complemento", rotulo: "Complemento" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "uf", rotulo: "UF" },
  { chave: "cep", rotulo: "CEP" },
  { chave: "natureza", rotulo: "Natureza (se for procurador)" },
  { chave: "oab", rotulo: "OAB (advogado ou escritório)" },
  { chave: "vinculadoA", rotulo: "CPF/CNPJ da empresa vinculada (se representante)" },
] as const;

const PRETO = "FF0A0A0A";
const BRANCO = "FFFFFFFF";

/** Gera a planilha modelo — cabeçalho pronto para preencher, e a aba de instruções. */
export async function gerarPlanilhaModelo(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Consensus One";
  workbook.created = new Date();

  const pessoas = workbook.addWorksheet("Pessoas");
  pessoas.columns = COLUNAS_MODELO.map((c) => ({ header: c.rotulo, key: c.chave, width: 30 }));
  pessoas.getRow(1).eachCell((celula) => {
    celula.font = { bold: true, color: { argb: BRANCO } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRETO } };
  });
  pessoas.views = [{ state: "frozen", ySplit: 1 }];

  const instrucoes = workbook.addWorksheet("Instruções");
  instrucoes.columns = [
    { header: "Coluna", key: "coluna", width: 45 },
    { header: "Como preencher", key: "como", width: 90 },
  ];
  instrucoes.getRow(1).eachCell((celula) => {
    celula.font = { bold: true, color: { argb: BRANCO } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRETO } };
  });
  instrucoes.addRows([
    {
      coluna: "Nome ou Razão Social",
      como: "Obrigatório. Nome completo (pessoa física) ou razão social (pessoa jurídica).",
    },
    {
      coluna: "CPF ou CNPJ",
      como:
        "Obrigatório. Com ou sem pontuação. O tipo da pessoa (física ou jurídica) é reconhecido " +
        "automaticamente pela quantidade de dígitos — não é preciso informar à parte.",
    },
    { coluna: "E-mail, Telefone", como: "Opcionais." },
    {
      coluna: "Logradouro, Número, Complemento, Bairro, Cidade, UF, CEP",
      como: "Opcionais. UF em duas letras (ex.: SP).",
    },
    {
      coluna: "Natureza (se for procurador)",
      como:
        "Deixe em branco se a pessoa não atua como procurador. Valores aceitos: " +
        Object.values(ROTULO_TIPO_PROCURADOR).join(", ") + ".",
    },
    {
      coluna: "OAB (advogado ou escritório)",
      como: 'Obrigatório quando a Natureza for "Advogado" ou "Escritório de advocacia".',
    },
    {
      coluna: "CPF/CNPJ da empresa vinculada (se representante)",
      como:
        'Só quando a Natureza for "Representante da empresa". Informe o CPF/CNPJ de uma empresa ou ' +
        "escritório já cadastrado no sistema, ou de uma linha anterior desta mesma planilha.",
    },
    {
      coluna: "—",
      como:
        "Pessoas com CPF/CNPJ já cadastrado no sistema não são importadas de novo — aparecem no " +
        "resumo como erro. Para corrigir um cadastro existente, use a tela, não a planilha.",
    },
  ]);
  instrucoes.getColumn("como").alignment = { wrapText: true, vertical: "top" };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type LinhaDaPlanilha = {
  numero: number;
  valores: Partial<Record<(typeof COLUNAS_MODELO)[number]["chave"], string>>;
};

function valorDaCelula(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    if ("richText" in valor && Array.isArray(valor.richText)) {
      return valor.richText.map((t) => t.text).join("").trim();
    }
    if ("text" in valor && typeof valor.text === "string") return valor.text.trim();
    if ("result" in valor) return valorDaCelula(valor.result as ExcelJS.CellValue);
  }
  return String(valor).trim();
}

/**
 * Lê a primeira aba da planilha enviada. Reconhece as colunas pelo texto do
 * cabeçalho (não pela posição), então funciona mesmo que o operador reordene
 * ou apague colunas que não vai usar — só o rótulo precisa bater com o modelo.
 */
export async function lerLinhasDaPlanilha(buffer: Buffer): Promise<LinhaDaPlanilha[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs carrega seu próprio @types/node internamente, com uma versão de
  // Buffer que o TypeScript trata como tipo distinto do Buffer do projeto —
  // mesmo objeto em tempo de execução, só o nome do tipo colide.
  await workbook.xlsx.load(buffer as never);
  const planilha = workbook.worksheets[0];
  if (!planilha) return [];

  const colunaPorIndice = new Map<number, (typeof COLUNAS_MODELO)[number]["chave"]>();
  planilha.getRow(1).eachCell({ includeEmpty: true }, (celula, indice) => {
    const rotulo = valorDaCelula(celula.value).toLowerCase();
    const item = COLUNAS_MODELO.find((c) => c.rotulo.toLowerCase() === rotulo);
    if (item) colunaPorIndice.set(indice, item.chave);
  });

  const linhas: LinhaDaPlanilha[] = [];
  planilha.eachRow({ includeEmpty: false }, (linha, numero) => {
    if (numero === 1) return;
    const valores: LinhaDaPlanilha["valores"] = {};
    let temAlgumValor = false;
    linha.eachCell({ includeEmpty: true }, (celula, indice) => {
      const chave = colunaPorIndice.get(indice);
      if (!chave) return;
      const valor = valorDaCelula(celula.value);
      if (valor) temAlgumValor = true;
      valores[chave] = valor;
    });
    if (temAlgumValor) linhas.push({ numero, valores });
  });

  return linhas;
}

const NATUREZA_POR_ROTULO = new Map<string, TipoProcurador>(
  Object.entries(ROTULO_TIPO_PROCURADOR).map(([chave, rotulo]) => [
    rotulo.toLowerCase(),
    chave as TipoProcurador,
  ])
);

/** Converte o texto da coluna "Natureza" no enum — aceita o rótulo em português, sem diferenciar caixa. */
export function resolverNatureza(valor: string | undefined): TipoProcurador | "" {
  const texto = (valor ?? "").trim();
  if (!texto) return "";
  const encontrada = NATUREZA_POR_ROTULO.get(texto.toLowerCase());
  if (!encontrada) {
    throw new ErroDeNegocio(
      `Natureza "${texto}" não reconhecida. Use um destes valores: ` +
        `${Object.values(ROTULO_TIPO_PROCURADOR).join(", ")}.`
    );
  }
  return encontrada;
}

/** Tipo da pessoa a partir da quantidade de dígitos do documento — 11 é CPF, o resto é tratado como CNPJ. */
export function inferirTipoPessoa(documento: string): TipoPessoa {
  return apenasDigitos(documento).length === 11 ? TipoPessoa.FISICA : TipoPessoa.JURIDICA;
}
