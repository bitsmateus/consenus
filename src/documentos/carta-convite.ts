/**
 * Carta-Convite — modelos oficiais do cliente.
 *
 * Texto transcrito literalmente de `assets/modelos/Carta_Convite_Cliente.docx`
 * (ao Interessado Solicitante) e `assets/modelos/Carta_Convite.docx` (ao
 * Interessado Convidado). CLAUDE.md, regra 11: não se reescreve cláusula nem
 * se "melhora" redação jurídica — preenche-se variável.
 *
 * A diferença entre as duas é só de seções: a do Solicitante traz o cadastro e
 * a lista de documentos exigidos; a do Convidado, não. Ver docs/08.
 */
import { escapar, montarDocumento } from "./timbrado";

export type DadosDaCarta = {
  codigo: string;
  solicitante: string;
  convidado: string;
  objeto: string | null;
  dataDaSessao: string;
  horaDaSessao: string;
  modalidade: string;
  link: string | null;
  idReuniao: string | null;
  senhaReuniao: string | null;
  prazoDocumentacaoDias: number;
  horasAvisoModalidade: number;
};

const ABERTURA = `
<p>Prezado(a) Senhor(a),</p>

<p>A Consensus One – Câmara Privada de Composição Estratégica Consensual,
instituição privada especializada na administração de procedimentos de
composição consensual, comunica a instauração formal de procedimento privado de
negociação decorrente de solicitação apresentada pela parte interessada, visando
à busca de solução consensual para a controvérsia identificada neste documento.</p>

<p>O presente procedimento encontra fundamento na autonomia privada, na
liberdade de contratar, nos princípios da boa-fé objetiva, da cooperação e da
solução consensual dos conflitos, previstos na legislação brasileira,
especialmente no Código Civil, no Código de Processo Civil em especial os
artigos 3º, §§2º e 3º e na Lei nº 13.140/2015.</p>

<p>Nesse contexto, Vossa Senhoria é formalmente convidada a participar da sessão
de composição consensual abaixo designada, oportunidade em que poderão ser
discutidas alternativas de solução para a controvérsia antes da adoção de outras
medidas legalmente admitidas.</p>`;

/** Seções que existem apenas na carta ao Interessado Solicitante. */
function cadastroEDocumentos(prazoEmDias: number): string {
  return `
<h2>Cadastro e formação do procedimento</h2>

<p>A Consensus One – Câmara Privada de Composição Estratégica Consensual comunica
o recebimento e o cadastro da solicitação apresentada pelo Interessado
Solicitante, destinada à instauração de procedimento privado de composição
consensual relacionado à controvérsia identificada neste documento.</p>

<p>O presente cadastro corresponde à etapa inicial de formação do procedimento e
não representa, neste momento, a confirmação da sessão nem a expedição de
comunicação ao Interessado Convidado.</p>

<p>Para o regular prosseguimento, o Interessado Solicitante deverá encaminhar à
Consensus One, no prazo de até ${prazoEmDias} (${porExtenso(prazoEmDias)}) dias,
contados do recebimento desta comunicação, os seguintes documentos:</p>

<ol class="romanos" type="I">
  <li>contrato de prestação de serviços firmado com a Empresa de Consultoria e
      Assessoria Tecnica;</li>
  <li>procuração com poderes suficientes para representação no procedimento,
      quando aplicável;</li>
  <li>contrato de financiamento relacionado à controvérsia;</li>
  <li>prova técnica, laudo ou documento equivalente destinado à demonstração dos
      fatos apresentados;</li>
  <li>documentos pessoais do Interessado Solicitante e, quando houver, de seu
      representante.</li>
</ol>

<p>Os documentos deverão ser apresentados de forma integral, legível e
atualizada, sem prejuízo da solicitação de informações ou documentos
complementares necessários à adequada formação do procedimento.</p>

<h2>Confirmação da sessão e expedição da Carta-Convite</h2>

<p>Recebidos e validados os documentos obrigatórios, a Consensus One promoverá a
confirmação da sessão de composição consensual e expedirá a correspondente
Carta-Convite ao Interessado Convidado, contendo a identificação dos
interessados, o objeto do procedimento, a data, o horário e a modalidade de
realização da sessão.</p>

<p>A comunicação ao Interessado Convidado somente será expedida após a conclusão
da etapa documental e a confirmação formal da sessão pela Consensus One.</p>

<p>O não encaminhamento integral dos documentos no prazo estabelecido impedirá a
confirmação da sessão e a expedição da Carta-Convite ao Interessado Convidado,
podendo acarretar o encerramento administrativo do cadastro, sem prejuízo da
apresentação de nova solicitação.</p>`;
}

/** Números por extenso usados nas cartas. O modelo escreve "15 (quinze)". */
function porExtenso(numero: number): string {
  const nomes: Record<number, string> = {
    5: "cinco", 10: "dez", 15: "quinze", 20: "vinte", 30: "trinta",
    45: "quarenta e cinco", 48: "quarenta e oito", 60: "sessenta",
  };
  return nomes[numero] ?? String(numero);
}

const FECHAMENTO = `
<h2>Finalidade da sessão</h2>

<p>A presente sessão destina-se à tentativa formal de composição consensual da
controvérsia, proporcionando aos interessados oportunidade para apresentação de
esclarecimentos, documentos e propostas, antes da adoção de medidas judiciais ou
extrajudiciais.</p>

<p>O procedimento será conduzido pela Consensus One em estrita observância aos
princípios da boa-fé, cooperação, imparcialidade, confidencialidade, autonomia
da vontade e respeito entre os interessados.</p>

<p>A ausência de participação ou a inexistência de composição será registrada
nos autos do procedimento, sem prejuízo do exercício dos direitos e medidas
legalmente cabíveis pelos interessados.</p>

<h2>Das consequências do procedimento</h2>

<p>A participação no presente procedimento é facultativa. Contudo, a ausência de
comparecimento, a recusa em participar ou a impossibilidade de composição
consensual serão formalmente registradas em Ata de Sessão, com o consequente
encerramento do procedimento.</p>

<p>A presente Carta-Convite constitui o registro formal da oportunidade
conferida aos interessados para solução consensual da controvérsia, antes da
adoção das medidas legalmente cabíveis.</p>

<p>A Consensus One atua como instituição privada independente, assegurando a
condução imparcial, confidencial e organizada do procedimento, em estrita
observância à legislação aplicável e aos princípios que regem a composição
consensual de conflitos.</p>

<p>A Consensus One reafirma seu compromisso com a promoção de soluções
consensuais, colocando sua estrutura institucional à disposição dos interessados
para condução do presente procedimento com imparcialidade, confidencialidade e
observância da legislação aplicável.</p>

<p>A participação dos interessados representa oportunidade concreta para
construção de solução consensual, preservando-se, em qualquer hipótese, o
exercício dos direitos legalmente assegurados.</p>

<p style="margin-top:6mm;">Atenciosamente,</p>

<div class="assinatura">
  <div class="linha"></div>
  <div class="cargo">Consensus One</div>
  <div class="cargo">Câmara Privada de Composição Estratégica Consensual</div>
</div>`;

function identificacaoEObjeto(dados: DadosDaCarta): string {
  return `
<h2>Identificação dos interessados</h2>

<div class="parte">
  <div class="rotulo">Interessado Solicitante</div>
  <div class="nome">${escapar(dados.solicitante)}</div>
</div>

<div class="parte">
  <div class="rotulo">Interessado Convidado</div>
  <div class="nome">${escapar(dados.convidado)}</div>
</div>

<h2>Objeto do procedimento</h2>

${dados.objeto ? `<p>${escapar(dados.objeto)}</p>` : ""}

<p>O presente procedimento foi instaurado com a finalidade de oportunizar aos
interessados a construção de solução consensual para a controvérsia
identificada, mediante diálogo estruturado, em ambiente institucional, imparcial
e confidencial.</p>

<p>A instauração do presente procedimento decorre da manifestação formal de
interesse de uma das partes na busca de solução consensual da controvérsia, não
importando, por si só, reconhecimento de direito, responsabilidade ou renúncia a
quaisquer prerrogativas legais.</p>`;
}

function designacaoDaSessao(dados: DadosDaCarta): string {
  return `
<h2>Designação da sessão</h2>

<p>A Sessão de Composição Consensual encontra-se designada para o dia
<strong>${escapar(dados.dataDaSessao)}</strong>, às
<strong>${escapar(dados.horaDaSessao)}</strong> horas, e será realizada
${escapar(dados.modalidade)}.</p>

<div class="sessao">
  <dl>
    <dt>Link para acesso à sessão</dt>
    <dd>${escapar(dados.link) || "a ser informado"}</dd>
    <dt>ID da reunião</dt>
    <dd>${escapar(dados.idReuniao) || "a ser informado"}</dd>
    <dt>Senha</dt>
    <dd>${escapar(dados.senhaReuniao) || "a ser informada"}</dd>
  </dl>
</div>

<p>Caso haja interesse na realização da sessão de forma presencial ou híbrida,
solicitamos que essa opção seja comunicada previamente pelos canais oficiais da
Consensus One, com antecedência mínima de ${dados.horasAvisoModalidade}
(${porExtenso(dados.horasAvisoModalidade)}) horas, possibilitando a adequada
organização do procedimento.</p>`;
}

function cabecalhoDaCarta(codigo: string): string {
  return `
<h1>Carta-Convite</h1>
<div class="codigo">Código do Documento: ${escapar(codigo)}</div>
<div class="subtitulo">Procedimento Privado de Composição Consensual</div>`;
}

/**
 * Carta-Convite ao Interessado Solicitante — passo 2 do fluxo.
 * Comunica o cadastro, reserva a data e pede a documentação.
 */
export function cartaAoSolicitante(dados: DadosDaCarta): string {
  return montarDocumento(
    cabecalhoDaCarta(dados.codigo) +
      ABERTURA +
      cadastroEDocumentos(dados.prazoDocumentacaoDias) +
      identificacaoEObjeto(dados) +
      designacaoDaSessao(dados) +
      FECHAMENTO
  );
}

/**
 * Carta-Convite ao Interessado Convidado — passo 4 do fluxo.
 * Mesmo texto institucional, sem as seções de cadastro e de documentos: o
 * Convidado não tem obrigação de enviar documentação (docs/02).
 */
export function cartaAoConvidado(dados: DadosDaCarta): string {
  return montarDocumento(
    cabecalhoDaCarta(dados.codigo) +
      ABERTURA +
      identificacaoEObjeto(dados) +
      designacaoDaSessao(dados) +
      FECHAMENTO
  );
}
