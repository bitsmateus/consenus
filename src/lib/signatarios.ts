/**
 * Quem assina a Ata e o Termo de Acordo.
 *
 * Função pura, separada da ação, porque a regra é de negócio e precisa de
 * teste: mandar o documento para quem não participou da sessão, ou deixar de
 * mandar para quem participou, é defeito que só apareceria com o documento já
 * assinado — e assinatura não se desfaz.
 */
import type { PapelNoAto } from "@prisma/client";
import type { SignatarioDaD4Sign } from "./d4sign";

export type ParteParaAssinatura = {
  papel: PapelNoAto;
  /** registrado no passo 5, em "III – DO COMPARECIMENTO" */
  compareceu: boolean | null;
  /** papel da parte representada, quando este é procurador */
  representaPapel: PapelNoAto | null;
  pessoa: { nome: string; email: string | null };
};

const ROTULO: Record<PapelNoAto, string> = {
  SOLICITANTE: "Interessado Solicitante",
  CONVIDADO: "Interessado Convidado",
  PROCURADOR: "Procurador",
  CONCILIADOR: "Conciliador",
};

export type MontagemDeSignatarios = {
  signatarios: SignatarioDaD4Sign[];
  /** nomes de quem entraria na lista mas está sem e-mail cadastrado */
  semEmail: string[];
};

/**
 * Monta a lista de signatários a partir das partes do procedimento.
 *
 * Regras:
 *  1. O conciliador assina sempre — a Ata é obrigatória mesmo sem
 *     comparecimento e sem acordo (docs/02, regra 3). Numa sessão em que
 *     ninguém compareceu, ele é o único signatário, e está certo assim.
 *  2. Interessados e procuradores assinam apenas se compareceram. Quem não
 *     esteve na sessão não assina a ata do que não presenciou.
 *  3. Um mesmo e-mail entra uma vez só. A D4Sign identifica signatário pelo
 *     e-mail: repetir criaria dois convites para a mesma pessoa, e o documento
 *     ficaria eternamente incompleto esperando uma segunda assinatura que a
 *     plataforma não tem como coletar.
 */
export function montarSignatarios(partes: ParteParaAssinatura[]): MontagemDeSignatarios {
  const participantes = partes.filter((p) => p.papel === "CONCILIADOR" || p.compareceu === true);

  const emailsUsados = new Set<string>();
  const signatarios: SignatarioDaD4Sign[] = [];
  const semEmail: string[] = [];

  for (const parte of participantes) {
    const email = parte.pessoa.email?.trim().toLowerCase();
    if (!email) {
      semEmail.push(`${parte.pessoa.nome} (${ROTULO[parte.papel]})`);
      continue;
    }
    if (emailsUsados.has(email)) continue;
    emailsUsados.add(email);

    signatarios.push({
      nome: parte.pessoa.nome,
      email,
      papel: rotuloDoSignatario(parte),
    });
  }

  return { signatarios, semEmail };
}

/** Texto que identifica o signatário na folha de assinaturas do documento. */
function rotuloDoSignatario(parte: ParteParaAssinatura): string {
  if (parte.papel !== "PROCURADOR") return ROTULO[parte.papel];
  if (parte.representaPapel === "SOLICITANTE") return "Procurador do Interessado Solicitante";
  if (parte.representaPapel === "CONVIDADO") return "Procurador do Interessado Convidado";
  return "Procurador";
}
