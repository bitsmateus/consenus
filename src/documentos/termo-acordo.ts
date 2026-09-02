/**
 * Termo de Acordo Extrajudicial.
 *
 * Texto transcrito de `assets/modelos/Termo_de_Acordo_Extrajudicial.docx`.
 *
 * Treze seções. Apenas as cláusulas primeira a quarta e os quatro parágrafos da
 * seção V são campos livres — todo o resto é FIXO. As cláusulas de
 * inadimplemento (multa de 10%, juros de 1% ao mês, IPCA), confidencialidade,
 * força executiva e quitação não são editáveis na interface: alterá-las é
 * decisão jurídica do cliente, não do operador que lavra o termo no fim de uma
 * sessão. Ver docs/09, item 9.
 */
import { assinaturaDoConciliador, assinaturasDasPartes, escapar, montarDocumento } from "./timbrado";

export type DadosDoTermo = {
  codigo: string;
  primeiraParte: string;
  segundaParte: string;
  cidade: string;
  dia: string;
  mes: string;
  ano: string;
  conciliador: string | null;

  // ---- campos livres, preenchidos pelo conciliador ----
  objetoDoAcordo: string;
  obrigacoesPrimeiraParte: string;
  obrigacoesSegundaParte: string;
  condicoesEspecificas: string | null;
  prazosDeCumprimento: string | null;
  formaDeCumprimento: string | null;
  formaDePagamento: string | null;
  demaisCondicoes: string | null;
};

/** Quebra de linha do formulário vira parágrafo no documento. */
function paragrafos(texto: string | null): string {
  if (!texto?.trim()) return "<p>—</p>";
  return texto
    .split(/\n+/)
    .map((linha) => `<p>${escapar(linha.trim())}</p>`)
    .join("");
}

/** Seções VI a XIII: texto fixo, sem nenhum campo variável. */
const CLAUSULAS_FIXAS = `
<h2>VI – Do inadimplemento e dos efeitos da mora</h2>
<p>O inadimplemento de qualquer obrigação assumida neste Termo, inclusive o atraso superior a
05 (cinco) dias no cumprimento de obrigação pecuniária ou o descumprimento injustificado de
obrigação de fazer, não fazer ou entregar coisa, constituirá a Parte inadimplente em mora de
pleno direito, independentemente de notificação ou interpelação judicial ou extrajudicial.</p>

<p>Verificado o inadimplemento, considerar-se-ão automaticamente vencidas todas as obrigações
vincendas decorrentes do presente acordo, tornando-se imediatamente exigível o saldo
remanescente.</p>

<p>Sobre os valores inadimplidos incidirão:</p>
<ol class="romanos" type="a">
  <li>multa moratória de 10% (dez por cento) sobre o débito atualizado;</li>
  <li>juros de mora de 1% (um por cento) ao mês, calculados pro rata die;</li>
  <li>atualização monetária pelo IPCA/IBGE, ou outro índice oficial que venha a
      substituí-lo.</li>
</ol>

<p>O inadimplemento autorizará a Parte prejudicada a promover a execução deste Termo de Acordo,
quando preenchidos os requisitos legais aplicáveis, bem como a adotar as demais medidas
judiciais ou extrajudiciais cabíveis para obtenção do integral cumprimento das obrigações
assumidas.</p>

<h2>VII – Da confidencialidade</h2>
<p>Os interessados reconhecem que o procedimento administrado pela Consensus One possui natureza
privada e confidencial, comprometendo-se a preservar o sigilo das informações compartilhadas
durante a conciliação, ressalvadas as hipóteses autorizadas pelos próprios interessados ou
previstas em lei.</p>

<h2>VIII – Das declarações dos interessados</h2>
<p>Os interessados declaram que participaram voluntariamente do procedimento privado de
conciliação administrado pela Consensus One, tendo-lhes sido assegurada plena oportunidade para
exposição de suas posições, apresentação de documentos, esclarecimentos e formulação de
propostas.</p>

<p>Declaram, ainda, que o presente Termo de Acordo representa a livre manifestação de suas
vontades, tendo sido celebrado de forma consciente, sem qualquer vício de consentimento, após
integral compreensão de seu conteúdo, de seus efeitos jurídicos e das obrigações ora assumidas,
comprometendo-se ao seu fiel e integral cumprimento.</p>

<h2>IX – Da força executiva do acordo</h2>
<p>Os interessados reconhecem que o presente Termo de Acordo constitui instrumento formal de
composição consensual e obrigam-se ao fiel cumprimento das obrigações nele assumidas.</p>

<p>Quando preenchidos os requisitos previstos na legislação aplicável, o presente instrumento
produzirá os efeitos de título executivo extrajudicial, podendo o interessado prejudicado
promover sua execução em caso de inadimplemento, sem prejuízo das demais medidas judiciais ou
extrajudiciais cabíveis.</p>

<h2>X – Da tolerância</h2>
<p>A eventual tolerância quanto ao atraso ou descumprimento de qualquer obrigação assumida neste
Termo não importará novação, renúncia de direitos ou alteração das condições ora pactuadas,
permanecendo íntegra a exigibilidade das obrigações assumidas.</p>

<h2>XI – Da quitação</h2>
<p>Observado o integral e pontual cumprimento de todas as obrigações assumidas no presente Termo
de Acordo, as Partes conferirão entre si plena, geral, irrevogável e irretratável quitação
relativamente ao objeto da controvérsia ora composta, declarando nada mais terem a reclamar uma
da outra, a qualquer título, em relação às matérias expressamente abrangidas por este
instrumento.</p>

<p>A presente quitação produzirá efeitos exclusivamente após o adimplemento integral das
obrigações pactuadas, permanecendo suspensa enquanto houver obrigação pendente de
cumprimento.</p>

<p>O descumprimento de qualquer obrigação assumida neste Termo afastará os efeitos da quitação
ora ajustada, facultando à Parte prejudicada exigir o cumprimento integral do acordo, bem como
adotar as medidas judiciais ou extrajudiciais cabíveis.</p>

<h2>XII – Das disposições finais</h2>
<p>O presente Termo representa a conclusão consensual do procedimento privado de conciliação
administrado pela Consensus One, passando a integrar a documentação oficial do procedimento.</p>

<p>A Consensus One limita sua atuação à administração imparcial do procedimento conciliatório,
não respondendo pelo conteúdo das obrigações livremente assumidas pelos interessados, nem pela
fiscalização de seu cumprimento, salvo contratação específica para essa finalidade.</p>

<p>Os interessados poderão, de comum acordo, requerer a homologação judicial do presente
instrumento, quando entenderem conveniente ou quando exigida por disposição legal.</p>

<h2>XIII – Das disposições finais e do encerramento</h2>
<p>As Partes declaram que o presente Termo de Acordo representa a integral composição da
controvérsia descrita neste instrumento, obrigando-se ao fiel cumprimento de todas as obrigações
assumidas, na forma livremente convencionada.</p>

<p>As Partes reconhecem que o presente instrumento foi celebrado por livre manifestação de
vontade, após regular procedimento privado de conciliação, declarando-se plenamente satisfeitas
quanto ao seu conteúdo, nada tendo a reclamar entre si relativamente às matérias expressamente
disciplinadas neste Termo, ressalvado o direito de exigir o seu integral cumprimento em caso de
inadimplemento.</p>

<p>As Partes concordam que o presente instrumento poderá ser firmado por meio de assinatura
eletrônica ou digital, produzindo todos os efeitos jurídicos e legais, nos termos da legislação
aplicável, dispensando-se a assinatura de testemunhas quando admitida pelo ordenamento jurídico
e pela forma de assinatura adotada.</p>

<p>Celebrado o presente acordo, consideram-se encerradas as tratativas conciliatórias objeto do
procedimento administrado pela Consensus One, permanecendo o presente instrumento como expressão
definitiva da vontade das Partes.</p>

<p>Por estarem justas e acordadas, firmam o presente Termo de Acordo para que produza todos os
seus efeitos jurídicos e legais.</p>`;

export function termoDeAcordo(dados: DadosDoTermo): string {
  const corpo = `
<h1>Termo de Acordo</h1>
<div class="codigo">Código do Documento: ${escapar(dados.codigo)}</div>
<div class="subtitulo">Procedimento Privado de Composição Consensual</div>

<h2>I – Das partes</h2>
<div class="parte">
  <div class="rotulo">Parte 1</div>
  <div class="nome">${escapar(dados.primeiraParte)}</div>
</div>
<div class="parte">
  <div class="rotulo">Parte 2</div>
  <div class="nome">${escapar(dados.segundaParte)}</div>
</div>

<h2>II – Das considerações preliminares</h2>
<p>Os interessados acima identificados, após participarem de Sessão Privada de Conciliação
regularmente administrada pela Consensus One – Câmara Privada de Composição Estratégica
Consensual, resolvem celebrar o presente Termo de Acordo, de forma livre, consciente e
voluntária, mediante concessões recíprocas, observando os princípios da autonomia privada,
boa-fé objetiva, cooperação e respeito à livre manifestação de vontade.</p>

<p>A Consensus One atuou exclusivamente na administração imparcial do procedimento
conciliatório, não integrando a relação jurídica objeto da presente composição nem assumindo
qualquer obrigação decorrente do acordo ora celebrado.</p>

<h2>III – Do objeto do acordo</h2>
<p>O presente Termo tem por objeto a composição consensual da controvérsia identificada neste
procedimento, mediante as condições livremente pactuadas entre os interessados.</p>

<h2>IV – Das cláusulas e condições do acordo</h2>
<p>As Partes, por livre manifestação de vontade, estabelecem as seguintes cláusulas e condições,
que passam a integrar o presente instrumento para todos os fins de direito.</p>

<p style="margin-bottom:1mm;"><strong>Cláusula Primeira – Do objeto</strong></p>
${paragrafos(dados.objetoDoAcordo)}

<p style="margin-bottom:1mm;"><strong>Cláusula Segunda – Das obrigações da primeira parte</strong></p>
${paragrafos(dados.obrigacoesPrimeiraParte)}

<p style="margin-bottom:1mm;"><strong>Cláusula Terceira – Das obrigações da segunda parte</strong></p>
${paragrafos(dados.obrigacoesSegundaParte)}

<p style="margin-bottom:1mm;"><strong>Cláusula Quarta – Das condições específicas</strong></p>
${paragrafos(dados.condicoesEspecificas)}

<h2>V – Do cumprimento do acordo</h2>
<p>As Partes obrigam-se ao fiel cumprimento das obrigações assumidas neste instrumento,
observando os prazos, condições e demais disposições livremente convencionadas.</p>

<p style="margin-bottom:1mm;"><strong>§ 1º O cumprimento das obrigações observará os seguintes
prazos:</strong></p>
${paragrafos(dados.prazosDeCumprimento)}

<p style="margin-bottom:1mm;"><strong>§ 2º O cumprimento ocorrerá da seguinte forma:</strong></p>
${paragrafos(dados.formaDeCumprimento)}

<p style="margin-bottom:1mm;"><strong>§ 3º O pagamento, quando houver, será realizado por meio
de:</strong></p>
${paragrafos(dados.formaDePagamento)}

<p style="margin-bottom:1mm;"><strong>§ 4º As demais condições específicas são as
seguintes:</strong></p>
${paragrafos(dados.demaisCondicoes)}

${CLAUSULAS_FIXAS}

<p style="margin-top:6mm;">${escapar(dados.cidade)}, ${escapar(dados.dia)} de
${escapar(dados.mes)} de ${escapar(dados.ano)}.</p>

<div style="margin-top:14mm;">
  ${assinaturaDoConciliador(dados.conciliador)}
  ${assinaturasDasPartes({
    ladoA: { titular: "Parte 1", procurador: "Procurador da Parte 1" },
    ladoB: { titular: "Parte 2", procurador: "Procurador da Parte 2" },
  })}
</div>`;

  return montarDocumento(corpo);
}
