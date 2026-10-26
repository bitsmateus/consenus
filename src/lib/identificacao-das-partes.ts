/**
 * Identificação de quem assina a Ata e o Termo de Acordo.
 *
 * As linhas de assinatura saíam com "Nome:" e "Documento:" em branco — o
 * cliente apontou em 26/10 que a ata "não está identificando ninguém". Aqui
 * saem do cadastro: titular de cada lado e, quando há, o procurador que o
 * representa. Módulo puro, para testar sem servidor.
 */
import { PapelNoAto } from "@prisma/client";
import { formatarDocumento } from "./documentos";

export type Identificacao = { nome: string; documento: string | null };

export type IdentificacaoDosLados = {
  ladoA: { titular: Identificacao | null; procurador: Identificacao | null };
  ladoB: { titular: Identificacao | null; procurador: Identificacao | null };
};

type ParteComPessoa = {
  id: string;
  papel: PapelNoAto;
  representaId: string | null;
  pessoa: { nome: string; documento: string; oab?: string | null };
};

/** O cadastro às vezes já traz o prefixo ("OAB/SP 69212"); não repetir. */
function numeroDaOab(oab: string): string {
  const limpa = oab.trim();
  return /^oab\b/i.test(limpa) ? limpa : `OAB ${limpa}`;
}

function identificar(partes: ParteComPessoa[], ehProcurador: boolean): Identificacao | null {
  if (partes.length === 0) return null;
  return {
    nome: partes.map((p) => p.pessoa.nome).join("; "),
    // advogado se identifica pela OAB; o titular, pelo CPF/CNPJ
    documento: partes
      .map((p) =>
        ehProcurador && p.pessoa.oab ? numeroDaOab(p.pessoa.oab) : formatarDocumento(p.pessoa.documento)
      )
      .join("; "),
  };
}

/** Lado A = Interessado Solicitante (ou Primeira Parte); lado B = Convidado (ou Segunda Parte). */
export function identificarLados(partes: ParteComPessoa[]): IdentificacaoDosLados {
  const solicitante = partes.find((p) => p.papel === PapelNoAto.SOLICITANTE);
  const convidado = partes.find((p) => p.papel === PapelNoAto.CONVIDADO);
  const procuradoresDe = (parte: ParteComPessoa | undefined) =>
    parte
      ? partes.filter((p) => p.papel === PapelNoAto.PROCURADOR && p.representaId === parte.id)
      : [];

  return {
    ladoA: {
      titular: identificar(solicitante ? [solicitante] : [], false),
      procurador: identificar(procuradoresDe(solicitante), true),
    },
    ladoB: {
      titular: identificar(convidado ? [convidado] : [], false),
      procurador: identificar(procuradoresDe(convidado), true),
    },
  };
}
