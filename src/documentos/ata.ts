/**
 * Ata de Sessão Privada de Conciliação.
 *
 * Texto transcrito de `assets/modelos/Ata_de_Sess_o_Privada_de_Concilia__o.docx`.
 * Seis seções, cinco desfechos possíveis e cinco linhas de assinatura.
 *
 * A ata é obrigatória em toda sessão, independentemente do resultado — inclusive
 * quando ninguém comparece (docs/02, regra 3).
 */
import { assinaturaDoConciliador, assinaturasDasPartes, escapar, montarDocumento } from "./timbrado";

export type Desfecho =
  | "COMPOSICAO_INTEGRAL"
  | "COMPOSICAO_PARCIAL"
  | "REDESIGNACAO"
  | "ENCERRAMENTO_SEM_COMPOSICAO"
  | "SESSAO_PREJUDICADA";

export type DadosDaAta = {
  codigo: string;
  solicitante: string;
  convidado: string;
  objeto: string | null;
  dia: string;
  mes: string;
  ano: string;
  horaInicio: string;
  horaVerificacao: string;
  horaEncerramento: string;
  modalidade: string;
  presentes: string[];
  ausentes: string[];
  desfecho: Desfecho;
  motivoPrejudicada: string | null;
  observacoes: string | null;
  conciliador: string | null;
};

/** Redação de cada desfecho, literal do modelo. */
const TEXTO_DO_DESFECHO: Record<Desfecho, { titulo: string; texto: string }> = {
  COMPOSICAO_INTEGRAL: {
    titulo: "Composição Consensual Integral",
    texto:
      "Foi alcançada composição consensual entre os interessados, cujos termos foram " +
      "formalizados em instrumento próprio, passando a integrar o presente procedimento.",
  },
  COMPOSICAO_PARCIAL: {
    titulo: "Composição Consensual Parcial",
    texto:
      "Os interessados alcançaram composição consensual parcial da controvérsia, " +
      "permanecendo os demais pontos sem consenso, preservado o direito de adoção das " +
      "medidas que entenderem cabíveis.",
  },
  REDESIGNACAO: {
    titulo: "Redesignação da Sessão",
    texto:
      "Os interessados manifestaram interesse na continuidade das tratativas " +
      "conciliatórias, ficando a sessão redesignada para data e horário a serem " +
      "oportunamente definidos e comunicados pela Consensus One.",
  },
  ENCERRAMENTO_SEM_COMPOSICAO: {
    titulo: "Encerramento sem Composição",
    texto:
      "Apesar das tratativas realizadas e das oportunidades concedidas para construção " +
      "de solução consensual, não foi possível alcançar composição entre os interessados, " +
      "encerrando-se regularmente o procedimento conciliatório, permanecendo integralmente " +
      "preservados os direitos dos interessados.",
  },
  SESSAO_PREJUDICADA: {
    titulo: "Sessão Prejudicada",
    texto: "A sessão restou prejudicada em razão de:",
  },
};

function lista(nomes: string[]): string {
  if (nomes.length === 0) return "<p>Nenhum.</p>";
  return `<ul style="margin:0 0 3mm;padding-left:6mm;">${nomes
    .map((n) => `<li>${escapar(n)}</li>`)
    .join("")}</ul>`;
}

/** Cinco linhas de assinatura, conforme o modelo: conciliador e os dois lados. */
function assinaturas(conciliador: string | null): string {
  return `
<div style="margin-top:16mm;">
  ${assinaturaDoConciliador(conciliador)}
  ${assinaturasDasPartes({
    ladoA: { titular: "Interessado Solicitante", procurador: "Procurador do Solicitante" },
    ladoB: { titular: "Interessado Convidado", procurador: "Procurador do Convidado" },
  })}
</div>`;
}

export function ataDaSessao(dados: DadosDaAta): string {
  const desfecho = TEXTO_DO_DESFECHO[dados.desfecho];

  const corpo = `
<h1>Ata de Sessão Privada de Conciliação</h1>
<div class="codigo">Código do Documento: ${escapar(dados.codigo)}</div>
<div class="subtitulo">Procedimento Privado de Composição Consensual</div>

<h2>I – Identificação do procedimento</h2>
<div class="parte">
  <div class="rotulo">Interessado Solicitante</div>
  <div class="nome">${escapar(dados.solicitante)}</div>
</div>
<div class="parte">
  <div class="rotulo">Interessado Convidado</div>
  <div class="nome">${escapar(dados.convidado)}</div>
</div>
<div class="parte">
  <div class="rotulo">Objeto do procedimento</div>
  <div>${escapar(dados.objeto) || "—"}</div>
</div>

<h2>II – Da realização da sessão</h2>
<p>Aos ${escapar(dados.dia)} dias do mês de ${escapar(dados.mes)} de ${escapar(dados.ano)},
às ${escapar(dados.horaInicio)} horas, realizou-se a Sessão Privada de Conciliação objeto do
presente procedimento, administrada pela Consensus One – Câmara Privada de Composição
Estratégica Consensual, na modalidade: ${escapar(dados.modalidade)}.</p>

<h2>III – Do comparecimento</h2>
<p>Às ${escapar(dados.horaVerificacao)} horas, procedeu-se à verificação do comparecimento dos
interessados regularmente convocados para a Sessão Privada de Conciliação, registrando-se a
seguinte composição:</p>

<p style="margin-bottom:1mm;"><strong>Presentes:</strong></p>
${lista(dados.presentes)}
<p style="margin-bottom:1mm;"><strong>Ausentes:</strong></p>
${lista(dados.ausentes)}

<h2>IV – Desenvolvimento da sessão</h2>
<p>Após a abertura dos trabalhos, o Conciliador apresentou aos interessados a natureza privada
do procedimento, seus objetivos, princípios e regras de funcionamento, esclarecendo que a
condução da sessão observaria os deveres de imparcialidade, confidencialidade, boa-fé,
autonomia da vontade e cooperação.</p>

<p>Na sequência, foi facultada aos interessados a apresentação de seus esclarecimentos,
documentos e propostas, sendo oportunizada ampla tentativa de construção de solução consensual
para a controvérsia submetida ao procedimento.</p>

<p>Durante a sessão foram oportunizadas manifestações, esclarecimentos e tratativas
conciliatórias entre os interessados, observando-se integralmente os princípios institucionais
da Consensus One.</p>

<h2>V – Conclusão do procedimento</h2>
<p>Ao término da Sessão Privada de Conciliação, registrou-se o seguinte desfecho do
procedimento:</p>

<p style="margin-bottom:1mm;"><strong>(X) ${escapar(desfecho.titulo)}</strong></p>
<p>${desfecho.texto}</p>
${
  dados.desfecho === "SESSAO_PREJUDICADA" && dados.motivoPrejudicada
    ? `<p>${escapar(dados.motivoPrejudicada)}</p>`
    : ""
}
${
  dados.observacoes
    ? `<p style="margin-top:3mm;"><strong>Observações:</strong> ${escapar(dados.observacoes)}</p>`
    : ""
}

<h2>VI – Encerramento</h2>
<p>Nada mais havendo a registrar, a sessão foi encerrada às ${escapar(dados.horaEncerramento)}
horas, sendo lavrada a presente Ata para documentar os atos praticados durante o procedimento
privado de conciliação administrado pela Consensus One, permanecendo preservados os direitos dos
interessados quanto à adoção das medidas que entenderem cabíveis.</p>

<p>Lida e aprovada, segue a presente Ata assinada eletronicamente pelos participantes ou
certificada pela Consensus One, conforme a modalidade de realização da sessão.</p>

${assinaturas(dados.conciliador)}`;

  return montarDocumento(corpo);
}
