/**
 * Papel timbrado oficial da Consensus One.
 *
 * Reproduz `assets/marca/papel-timbrado-original.docx`, que docs/05 define como
 * referência obrigatória do cabeçalho e do rodapé de todo PDF emitido:
 *
 *   Cabeçalho — faixa preta, logotipo centralizado, filete dourado embaixo.
 *   Rodapé    — faixa clara com os dados institucionais e o bloco
 *               "AUTENTICADOR DE DOCUMENTO" com o QR Code; abaixo, faixa preta
 *               com o selo e o aviso de validade.
 *
 * O QR Code já é parte da identidade visual do cliente: o sistema não está
 * inventando nada, está automatizando o que o timbrado já promete.
 */

/** Dados institucionais — docs/05. */
export const INSTITUCIONAL = {
  nome: "Consensus One",
  nomeCompleto: "Consensus One — Câmara Privada de Composição Estratégica Consensual",
  endereco: "Rua Olegário Paiva, nº 180, 4º andar, Sala 411",
  complemento: "Centro — Mogi das Cruzes/SP — CEP 08.780-040",
  telefone: "(11) 2668-8788",
  email: "contato@consensusone.com.br",
  site: "consensusone.com.br",
};

const PRETO = "#0A0A0A";
const DOURADO = "#946810";
const CARVAO = "#2B2B2B";

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
 * Cabeçalho impresso em toda página.
 * O Chromium exige estilo embutido nos templates de cabeçalho e rodapé.
 */
export function cabecalho(logoDataUri: string): string {
  return `
<div style="width:100%;margin:0;padding:0;font-family:Georgia,serif;">
  <div style="background:${PRETO};padding:6mm 0 4mm;text-align:center;">
    ${logoDataUri ? `<img src="${logoDataUri}" style="height:9mm;" />` : ""}
  </div>
  <div style="height:1.2mm;background:${DOURADO};"></div>
</div>`;
}

/**
 * Rodapé impresso em toda página, com o autenticador.
 * `codigo` e `qrDataUri` são gerados na emissão do documento.
 */
export function rodape(params: {
  codigo: string;
  qrDataUri: string;
  urlVerificacao: string;
}): string {
  const { codigo, qrDataUri, urlVerificacao } = params;

  return `
<div style="width:100%;margin:0;padding:0;font-family:Georgia,serif;font-size:6.5pt;color:${CARVAO};">
  <div style="display:flex;justify-content:space-between;align-items:center;padding:2mm 20mm 2mm;gap:6mm;">
    <div style="line-height:1.5;">
      <div>${INSTITUCIONAL.endereco}</div>
      <div>${INSTITUCIONAL.complemento}</div>
      <div>${INSTITUCIONAL.telefone} · ${INSTITUCIONAL.email} · ${INSTITUCIONAL.site}</div>
    </div>
    <div style="display:flex;align-items:center;gap:2mm;text-align:right;">
      <div style="line-height:1.4;">
        <div style="font-size:5.5pt;letter-spacing:.4pt;color:${DOURADO};font-weight:bold;">
          AUTENTICADOR DE DOCUMENTO
        </div>
        <div style="font-family:'Courier New',monospace;font-size:6.5pt;">${escapar(codigo)}</div>
        <div style="font-size:5pt;">Escaneie o QR Code ou acesse:</div>
        <div style="font-size:5pt;">${escapar(urlVerificacao)}</div>
      </div>
      ${qrDataUri ? `<img src="${qrDataUri}" style="width:13mm;height:13mm;" />` : ""}
    </div>
  </div>
  <div style="background:${PRETO};color:#D1D1D1;padding:2mm 20mm;font-size:5.5pt;line-height:1.4;">
    Documento emitido pela ${INSTITUCIONAL.nomeCompleto}. Este documento possui
    validade exclusivamente através de verificação do código e QR Code acima.
    <span style="float:right;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>
</div>`;
}

/** Folha de estilo do corpo dos documentos: serifada e formal, como o timbrado. */
export const ESTILO_DO_CORPO = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: ${CARVAO};
    text-align: justify;
  }
  h1 {
    font-size: 14pt;
    letter-spacing: 1pt;
    text-align: center;
    text-transform: uppercase;
    margin: 0 0 2mm;
    color: ${PRETO};
  }
  .subtitulo { text-align: center; font-size: 9pt; color: ${DOURADO}; margin: 0 0 8mm; }
  .codigo {
    text-align: center;
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    margin: 0 0 6mm;
  }
  h2 {
    font-size: 10pt;
    letter-spacing: .5pt;
    text-transform: uppercase;
    color: ${PRETO};
    border-bottom: .4pt solid ${DOURADO};
    padding-bottom: 1mm;
    margin: 7mm 0 3mm;
  }
  p { margin: 0 0 3mm; }
  ol.romanos { padding-left: 8mm; margin: 0 0 3mm; }
  ol.romanos li { margin-bottom: 1.5mm; }
  .parte { margin: 0 0 3mm; }
  .parte .rotulo { font-size: 8.5pt; color: ${DOURADO}; text-transform: uppercase; letter-spacing: .4pt; }
  .parte .nome { font-weight: bold; }
  .parte .procurador { font-size: 9pt; color: #4A4A4A; margin-top: .5mm; }
  .sessao { border: .4pt solid #E4E1DA; padding: 4mm; margin: 3mm 0; }
  .sessao dl { margin: 0; }
  .sessao dt { font-size: 8.5pt; color: ${DOURADO}; text-transform: uppercase; letter-spacing: .3pt; }
  .sessao dd { margin: 0 0 2mm; font-family: 'Courier New', monospace; font-size: 9.5pt; }
  .assinatura { margin-top: 14mm; text-align: center; }
  /* Fora de .assinatura de propósito: na Ata e no Termo, as linhas das partes
     ficam dentro de uma <table>, sem esse ancestral. Enquanto o seletor era
     ".assinatura .linha", quatro das cinco linhas da Ata saíam sem linha. */
  .linha { border-top: .4pt solid ${CARVAO}; width: 70mm; margin: 0 auto 1.5mm; }
  .cargo { font-size: 8.5pt; }
`;

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

/** Monta o documento completo, pronto para o motor de PDF. */
export function montarDocumento(corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><style>${ESTILO_DO_CORPO}</style></head>
<body>${corpo}</body>
</html>`;
}
