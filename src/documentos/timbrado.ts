/**
 * Papel timbrado oficial da Consensus One.
 *
 * Reproduz o modelo do cliente (`assets/modelos/Carta_Convite_Cliente.docx` e
 * `assets/marca/papel-timbrado-original.docx`), que docs/05 define como
 * referência obrigatória de todo PDF emitido. O timbrado do cliente é feito de
 * imagens, não de texto, e aqui elas são usadas como estão:
 *
 *   Cabeçalho — faixa preta com o logotipo e o filete dourado.
 *   Rodapé    — dados institucionais e o bloco "AUTENTICADOR DE DOCUMENTO";
 *               abaixo, faixa preta com o selo e o aviso de validade.
 *   Fundo     — marca d'água do selo, centralizada em cada página.
 *
 * O QR Code e o código do rodapé são o único trecho dinâmico: o sistema não
 * inventa nada, automatiza o que o timbrado já promete.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const PRETO = "#0A0A0A";
const DOURADO = "#946810";
const DOURADO_CLARO = "#C79A2E";

/** Escapa texto vindo do banco antes de entrar no HTML do documento. */
export function escapar(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Imagens do papel timbrado oficial, extraídas de
 * assets/marca/papel-timbrado-original.docx e da Carta_Convite_Cliente.docx.
 * Embutidas em base64: o Chromium do servidor não busca arquivo por URL, e o
 * HTML entra por setContent, sem origem.
 */
export type ImagensDoTimbrado = {
  cabecalho: string;
  rodape: string;
  marcaDagua: string;
  logo: string;
};

let imagensEmCache: ImagensDoTimbrado | null = null;

function embutir(arquivo: string): string {
  try {
    const caminho = path.join(process.cwd(), "public", "marca", arquivo);
    return "data:image/png;base64," + readFileSync(caminho).toString("base64");
  } catch {
    // documento sem uma das imagens ainda é válido; a ausência não trava a emissão
    return "";
  }
}

export function imagensDoTimbrado(): ImagensDoTimbrado {
  imagensEmCache ??= {
    cabecalho: embutir("timbrado-cabecalho.png"),
    rodape: embutir("timbrado-rodape.png"),
    marcaDagua: embutir("marca-dagua.png"),
    logo: embutir("carta-logo.png"),
  };
  return imagensEmCache;
}

/**
 * Geometria do timbrado, em milímetros. A folha é A4 (210 × 297) e as imagens
 * oficiais são desenhadas um pouco maiores que ela e cortadas nas bordas, como
 * o Word faz no modelo — é isso que dá a proporção do logotipo e dos dados do
 * rodapé no PDF de referência.
 *
 * O texto começa 62 mm abaixo do topo e termina 46 mm acima da base, como no
 * modelo: o espaço entre a faixa do timbrado e o texto faz parte do desenho.
 */
const FOLHA = 210;
const CABECALHO = { largura: 231, altura: 29.5 };
const RODAPE = { largura: 252, altura: 33.7 };
export const MARGENS_MM = { top: 62, bottom: 46, left: 30, right: 30 };

/**
 * Faixa do topo, presa à borda da folha e repetida em toda página.
 *
 * Fica no corpo do documento, e não no headerTemplate do Chromium: o template
 * só pinta dentro da margem, deixando 5 mm de folha branca acima e abaixo — o
 * modelo do cliente é sangrado, sem borda.
 */
export function cabecalho(): string {
  const { cabecalho: imagem } = imagensDoTimbrado();
  return `
<div class="faixa faixa-topo" style="height:${CABECALHO.altura}mm;">
  ${imagem ? `<img src="${imagem}" style="position:absolute;top:0;left:${(FOLHA - CABECALHO.largura) / 2}mm;width:${CABECALHO.largura}mm;" />` : ""}
</div>`;
}

/**
 * Rodapé preso à borda de baixo, repetido em toda página, com o autenticador.
 *
 * A imagem oficial traz um QR Code de exemplo, pintado nela. O sistema cobre
 * essa área com um bloco branco e desenha por cima o QR Code e o código
 * verdadeiros do documento, no mesmo lugar e com a mesma tipografia.
 */
export function rodape(params: {
  codigo: string;
  qrDataUri: string;
  urlVerificacao: string;
}): string {
  const { codigo, qrDataUri, urlVerificacao } = params;
  const { rodape: imagem } = imagensDoTimbrado();
  // 1 pixel da imagem exibida a 2000 px de largura, em mm
  const px = RODAPE.largura / 2000;
  const mm = (pixels: number) => (pixels * px).toFixed(2);
  const enderecoPublico = urlVerificacao.replace(/^https?:\/\//, "");

  return `
<div class="faixa faixa-base" style="height:${RODAPE.altura}mm;">
  <div style="position:absolute;bottom:0;left:${(FOLHA - RODAPE.largura) / 2}mm;width:${RODAPE.largura}mm;height:${RODAPE.altura}mm;">
    ${imagem ? `<img src="${imagem}" style="display:block;width:${RODAPE.largura}mm;" />` : ""}
    <div style="position:absolute;left:${mm(1222)}mm;top:0;width:${mm(490)}mm;height:${mm(120)}mm;background:#fff;">
      ${qrDataUri ? `<img src="${qrDataUri}" style="position:absolute;left:${mm(14)}mm;top:${mm(2)}mm;width:${mm(108)}mm;height:${mm(108)}mm;" />` : ""}
      <div style="position:absolute;left:${mm(138)}mm;top:${mm(14)}mm;line-height:1.35;color:${PRETO};">
        <div style="font-size:${mm(17)}mm;font-weight:bold;letter-spacing:.2pt;color:${DOURADO_CLARO};white-space:nowrap;">AUTENTICADOR DE DOCUMENTO</div>
        <div style="font-size:${mm(15)}mm;font-weight:600;white-space:nowrap;margin-top:${mm(9)}mm;">Escaneie o QR Code ou acesse:</div>
        <div style="font-size:${mm(15)}mm;font-weight:600;white-space:nowrap;">${escapar(enderecoPublico)}</div>
        <div style="font-size:${mm(13)}mm;font-weight:600;white-space:nowrap;color:${DOURADO};">${escapar(codigo)}</div>
      </div>
    </div>
  </div>
</div>`;
}

/**
 * Folha de estilo do corpo: a do modelo do cliente — Calibri 11, texto corrido
 * e justificado, títulos em negrito e caixa alta, sem filetes nem caixas.
 * Tudo que o modelo não desenha (bordas, títulos centralizados, serifa) ficou
 * de fora de propósito.
 */
export const ESTILO_DO_CORPO = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Faixas do timbrado: fixas, portanto repetidas em toda página impressa. */
  .faixa { position: fixed; left: 0; width: ${FOLHA}mm; overflow: hidden; z-index: 1; }
  .faixa-topo { top: 0; }
  .faixa-base { bottom: 0; font-family: Calibri, Carlito, Arial, sans-serif; }
  /* Espaçadores: o cabeçalho e o rodapé de uma tabela se repetem em cada página
     impressa, e é isso que reserva o espaço do timbrado no alto e embaixo do
     texto — @page não pode, porque as faixas invadem a margem. */
  table.folha { width: 100%; border-collapse: collapse; border-spacing: 0; }
  table.folha > thead > tr > td > div { height: ${MARGENS_MM.top}mm; }
  table.folha > tfoot > tr > td > div { height: ${MARGENS_MM.bottom}mm; }
  table.folha > tbody > tr > td { padding: 0 ${MARGENS_MM.right}mm 0 ${MARGENS_MM.left}mm; vertical-align: top; }
  body {
    margin: 0;
    font-family: Calibri, Carlito, 'Liberation Sans', Arial, sans-serif;
    font-size: 10.55pt;
    line-height: 1.33;
    color: #000;
    text-align: justify;
  }
  h1 {
    font-size: 16pt;
    font-weight: bold;
    text-transform: uppercase;
    text-align: left;
    margin: 0 0 1mm;
  }
  .codigo { margin: 0; text-align: left; }
  .subtitulo { font-weight: bold; margin: 0 0 8mm; text-align: left; }
  h2 {
    font-size: 10.55pt;
    font-weight: bold;
    text-transform: uppercase;
    text-align: left;
    margin: 6mm 0 3.5mm;
    break-after: avoid;
    page-break-after: avoid;
  }
  p { margin: 0 0 4.2mm; }
  .itens { margin: 0 0 4.2mm; text-align: left; break-inside: avoid; page-break-inside: avoid; }
  .clausula { margin-bottom: 1.5mm; text-align: left; break-after: avoid; page-break-after: avoid; }
  .antes-da-lista { break-after: avoid; page-break-after: avoid; }
  .itens p { margin: 0; }
  /* break-inside: um bloco curto não pode ser cortado ao meio pelo motor de
     PDF — já saiu a senha do Zoom sozinha no topo da página seguinte. */
  .parte { margin: 0 0 4.2mm; break-inside: avoid; page-break-inside: avoid; text-align: left; }
  .parte .rotulo { font-weight: bold; margin: 0 0 4.2mm; }
  .parte .procurador { margin-top: 1mm; }
  .sessao { text-align: left; break-inside: avoid; page-break-inside: avoid; }
  .logo-carta { display: block; width: 65mm; margin-top: 4mm; break-inside: avoid; page-break-inside: avoid; }
  .assinatura { margin-top: 14mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  /* Fora de .assinatura de propósito: na Ata e no Termo, as linhas das partes
     ficam dentro de uma <table>, sem esse ancestral. Enquanto o seletor era
     ".assinatura .linha", quatro das cinco linhas da Ata saíam sem linha. */
  .linha { border-top: .4pt solid #000; width: 70mm; margin: 0 auto 1.5mm; }
  .cargo { font-size: 9.5pt; text-align: center; }
  table tr { break-inside: avoid; page-break-inside: avoid; }
  /* Repetida em toda página impressa: é o que faz a marca d'água aparecer em
     cada folha, e não só na primeira. */
  .marca-dagua {
    position: fixed;
    left: 50%;
    top: 50%;
    width: 118mm;
    transform: translate(-50%, -50%);
    z-index: -1;
  }
`;

/** Título, código e subtítulo — iguais na Carta-Convite, na Ata e no Termo. */
export function cabecalhoDoDocumento(titulo: string, codigo: string): string {
  return `
<h1>${escapar(titulo)}</h1>
<div class="codigo"><strong>Código do Documento:</strong> ${escapar(codigo)}</div>
<div class="subtitulo">Procedimento Privado de Composição Consensual</div>`;
}

/**
 * Linha de assinatura do Conciliador — sempre a primeira, sozinha, tanto na
 * Ata quanto no Termo de Acordo.
 */
export function assinaturaDoConciliador(conciliador: string | null): string {
  return `
  <div class="assinatura">
    <div class="linha"></div>
    <div class="cargo">${escapar(conciliador) || "Nome:"}</div>
    <div class="cargo" style="font-weight:bold;">Conciliador</div>
  </div>`;
}

/**
 * As quatro linhas de assinatura de baixo — titular e procurador dos dois
 * lados —, em branco para preencher na hora. Mesmo layout do modelo oficial
 * na Ata e no Termo de Acordo: só o rótulo muda (Interessado/Parte).
 */
export function assinaturasDasPartes(rotulos: {
  ladoA: { titular: string; procurador: string };
  ladoB: { titular: string; procurador: string };
}): string {
  const bloco = (rotulo: string) => `
      <td style="width:50%;text-align:center;padding:0 4mm 8mm;">
        <div class="linha"></div>
        <div class="cargo">Nome:</div>
        <div class="cargo">Documento:</div>
        <div class="cargo" style="margin-top:1mm;font-weight:bold;">${rotulo}</div>
      </td>`;

  return `
  <table style="width:100%;margin-top:12mm;border-collapse:collapse;">
    <tr>${bloco(rotulos.ladoA.titular)}${bloco(rotulos.ladoA.procurador)}</tr>
    <tr>${bloco(rotulos.ladoB.titular)}${bloco(rotulos.ladoB.procurador)}</tr>
  </table>`;
}

/** Onde as faixas do timbrado entram: só o emissor conhece o código e o QR Code. */
const MARCADOR_DO_TIMBRADO = "<!--timbrado-->";

/** Monta o documento completo, pronto para receber o timbrado e ir ao motor de PDF. */
export function montarDocumento(corpo: string): string {
  const { marcaDagua } = imagensDoTimbrado();
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><style>${ESTILO_DO_CORPO}</style></head>
<body>${MARCADOR_DO_TIMBRADO}${marcaDagua ? `<img class="marca-dagua" src="${marcaDagua}" alt="" />` : ""}
<table class="folha">
  <thead><tr><td><div></div></td></tr></thead>
  <tfoot><tr><td><div></div></td></tr></tfoot>
  <tbody><tr><td>${corpo}</td></tr></tbody>
</table>
</body>
</html>`;
}

/** Aplica o cabeçalho e o rodapé oficiais, com o código e o QR Code deste documento. */
export function timbrar(
  html: string,
  autenticador: { codigo: string; qrDataUri: string; urlVerificacao: string }
): string {
  return html.replace(MARCADOR_DO_TIMBRADO, cabecalho() + rodape(autenticador));
}
