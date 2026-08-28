/**
 * Consultas das telas, já amarradas à sessão do usuário.
 *
 * Cada função compõe `filtroDeAtosVisiveis()` com os filtros da tela antes de
 * chamar a consulta correspondente. **Use estas nas páginas** — nunca monte um
 * `where` de Ato sem passar por aqui (CLAUDE.md, regra 3).
 */
import type { Prisma } from "@prisma/client";
import {
  buscarAtoEm,
  comFiltros,
  contarConciliadoresEm,
  contarPorModalidadeEm,
  contarPorProcuracaoEm,
  contarPorStatusEm,
  contarInteressadosEm,
  contarProcuradoresEm,
  listarAtosEm,
  type FiltrosDeAtos,
} from "./consultas-de-atos";
import { filtroDeAtosVisiveis } from "./sessao";

export type { FiltrosDeAtos } from "./consultas-de-atos";
export { listarPessoas } from "./consultas-de-atos";

export async function montarWhereDeAtos(filtros: FiltrosDeAtos): Promise<Prisma.AtoWhereInput> {
  return comFiltros(await filtroDeAtosVisiveis(), filtros);
}

export async function listarAtos(filtros: FiltrosDeAtos) {
  return listarAtosEm(await montarWhereDeAtos(filtros));
}

/** Contagem por status, respeitando busca e filtro de procurador já aplicados. */
export async function contarPorStatus(filtros: FiltrosDeAtos) {
  return contarPorStatusEm(await montarWhereDeAtos({ ...filtros, status: undefined }));
}

export async function contarPorProcurador(filtros: FiltrosDeAtos) {
  return contarProcuradoresEm(await montarWhereDeAtos({ ...filtros, procuradorId: undefined }));
}

export async function contarPorInteressado(filtros: FiltrosDeAtos) {
  return contarInteressadosEm(await montarWhereDeAtos({ ...filtros, interessadoId: undefined }));
}

export async function contarPorConciliador(filtros: FiltrosDeAtos) {
  return contarConciliadoresEm(await montarWhereDeAtos({ ...filtros, conciliadorId: undefined }));
}

export async function contarPorModalidade(filtros: FiltrosDeAtos) {
  return contarPorModalidadeEm(await montarWhereDeAtos({ ...filtros, modalidade: undefined }));
}

export async function contarPorProcuracao(filtros: FiltrosDeAtos) {
  return contarPorProcuracaoEm(await montarWhereDeAtos({ ...filtros, comProcuracao: undefined }));
}

export async function buscarAto(id: string) {
  const filtro = await filtroDeAtosVisiveis();
  return buscarAtoEm({ AND: [{ id }, filtro] });
}
