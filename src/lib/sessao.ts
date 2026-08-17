/**
 * Autorização. Toda consulta que devolve dados de ato passa por aqui.
 *
 * Regras (CLAUDE.md, item 3):
 *   ADMIN / OPERADOR -> todos os atos
 *   PARTE            -> só o próprio ato, e só depois de SESSAO_REALIZADA
 *   PROCURADOR       -> todos os atos em que representa alguém, mesma regra
 *                       de liberação de documentos
 */
import { Papel, Prisma, StatusAto } from "@prisma/client";
import { auth } from "@/auth";
import { SemPermissao } from "./erros";

export async function usuarioAtual() {
  const sessao = await auth();
  return sessao?.user ?? null;
}

export async function exigirUsuario() {
  const usuario = await usuarioAtual();
  if (!usuario) throw new SemPermissao("Sessão expirada. Entre novamente.");
  return usuario;
}

export async function exigirEquipe() {
  const usuario = await exigirUsuario();
  if (usuario.papel !== Papel.ADMIN && usuario.papel !== Papel.OPERADOR) {
    throw new SemPermissao();
  }
  return usuario;
}

export async function exigirAdmin() {
  const usuario = await exigirUsuario();
  if (usuario.papel !== Papel.ADMIN) throw new SemPermissao();
  return usuario;
}

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
 * Filtro que TODA listagem e consulta de ato deve aplicar.
 * Nunca monte uma query de ato sem passar por aqui.
 */
export async function filtroDeAtosVisiveis(): Promise<Prisma.AtoWhereInput> {
  const usuario = await exigirUsuario();

  if (usuario.papel === Papel.ADMIN || usuario.papel === Papel.OPERADOR) return {};

  if (!usuario.pessoaId) throw new SemPermissao();

  // PARTE e PROCURADOR: precisa de vínculo explícito neste ato.
  // A diferença é só a quantidade de vínculos que cada um costuma ter.
  return {
    status: { in: ESTADOS_LIBERADOS },
    partes: { some: { pessoaId: usuario.pessoaId } },
  };
}

export async function exigirAcessoAoAto(atoId: string, db: Prisma.TransactionClient | typeof import("./db").db) {
  const filtro = await filtroDeAtosVisiveis();
  const ato = await db.ato.findFirst({ where: { AND: [{ id: atoId }, filtro] } });
  if (!ato) throw new SemPermissao("Você não tem acesso a este procedimento.");
  return ato;
}
