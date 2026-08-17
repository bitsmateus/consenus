/**
 * Sessão do usuário e aplicação da regra de autorização.
 *
 * A regra em si mora em `autorizacao.ts`, sem dependência de Auth.js.
 * Aqui ela é amarrada ao usuário autenticado.
 *
 * Regras (CLAUDE.md, item 3):
 *   ADMIN / OPERADOR -> todos os atos
 *   PARTE            -> só os atos em que é Interessado, e só após a sessão
 *   PROCURADOR       -> todos os atos em que representa alguém, mesma regra
 *                       de liberação de documentos
 */
import { Papel, type Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { montarFiltroDeAtos } from "./autorizacao";
import { SemPermissao } from "./erros";

export {
  ESTADOS_LIBERADOS,
  ESTADOS_FINAIS,
  montarFiltroDeAtos,
  type UsuarioAutorizavel,
} from "./autorizacao";

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

/**
 * Filtro que TODA listagem e consulta de ato deve aplicar.
 * Nunca monte uma query de ato sem passar por aqui.
 */
export async function filtroDeAtosVisiveis(): Promise<Prisma.AtoWhereInput> {
  return montarFiltroDeAtos(await exigirUsuario());
}

export async function exigirAcessoAoAto(atoId: string, db: Prisma.TransactionClient | typeof import("./db").db) {
  const filtro = await filtroDeAtosVisiveis();
  const ato = await db.ato.findFirst({ where: { AND: [{ id: atoId }, filtro] } });
  if (!ato) throw new SemPermissao("Você não tem acesso a este procedimento.");
  return ato;
}
