/**
 * Regra de visibilidade de procedimentos — CLAUDE.md, regra 3.
 *
 * Módulo puro de propósito: não importa Auth.js, não importa Prisma Client de
 * runtime, não lê sessão. É a regra mais sensível do sistema e precisa ser
 * testável isoladamente. Quem amarra isso à sessão do usuário é `sessao.ts`.
 */
import { PapelNoAto, Papel, type Prisma, StatusAto } from "@prisma/client";
import { SemPermissao } from "./erros";

/** Estados em que o acesso externo aos documentos está liberado. */
export const ESTADOS_LIBERADOS: StatusAto[] = [
  StatusAto.SESSAO_REALIZADA,
  StatusAto.COMPOSICAO_INTEGRAL,
  StatusAto.COMPOSICAO_PARCIAL,
  StatusAto.REDESIGNADA,
  StatusAto.ENCERRADO_SEM_COMPOSICAO,
  StatusAto.SESSAO_PREJUDICADA,
];

/**
 * Estados em que o procedimento não avança mais.
 *
 * REDESIGNADA fica de fora de propósito: redesignar é remarcar a sessão, o
 * procedimento continua vivo. Ponto a confirmar com o cliente.
 */
export const ESTADOS_FINAIS: StatusAto[] = [
  StatusAto.CANCELADO,
  StatusAto.COMPOSICAO_INTEGRAL,
  StatusAto.COMPOSICAO_PARCIAL,
  StatusAto.ENCERRADO_SEM_COMPOSICAO,
  StatusAto.SESSAO_PREJUDICADA,
];

/**
 * Papéis no ato que dão acesso externo, por perfil de usuário.
 *
 * O vínculo tem que ser explícito e do papel certo: docs/10 diz que o
 * procurador vê o procedimento "se e somente se" existir ParteDoAto com
 * papel = PROCURADOR. Estar no ato como CONCILIADOR, por exemplo, não abre
 * acesso a nada.
 */
const PAPEIS_QUE_LIBERAM: Partial<Record<Papel, PapelNoAto[]>> = {
  [Papel.PARTE]: [PapelNoAto.SOLICITANTE, PapelNoAto.CONVIDADO],
  [Papel.PROCURADOR]: [PapelNoAto.PROCURADOR],
};

export type UsuarioAutorizavel = {
  papel: Papel;
  pessoaId: string | null;
};

/** Monta o `where` de ato para um usuário. */
export function montarFiltroDeAtos(usuario: UsuarioAutorizavel): Prisma.AtoWhereInput {
  if (usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR) return {};

  const papeisAceitos = PAPEIS_QUE_LIBERAM[usuario.papel];
  if (!papeisAceitos || !usuario.pessoaId) throw new SemPermissao();

  return {
    status: { in: ESTADOS_LIBERADOS },
    partes: {
      some: {
        pessoaId: usuario.pessoaId,
        papel: { in: papeisAceitos },
      },
    },
  };
}
