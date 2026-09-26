/**
 * Permissões dentro do perfil OPERADOR — pedido do cliente em 15/09.
 *
 * Um OPERADOR sem `subPapelOperador` continua com acesso ao fluxo inteiro,
 * como sempre (CLAUDE.md, item 3: só ADMIN/OPERADOR têm essa checagem, e ela
 * era binária). Quando um sub-perfil é atribuído de propósito na tela de
 * Equipe, a conta passa a só poder executar as ações listadas abaixo. ADMIN
 * nunca é afetado.
 */
import { Papel, SubPapelOperador } from "@prisma/client";
import { SemPermissao } from "./erros";
import { exigirEquipe } from "./sessao";

export type Acao =
  | "CADASTRAR_PARTE"
  | "CADASTRAR_DEMANDA"
  | "GERAR_CARTA_INTERESSADO"
  | "ENVIAR_CARTA_INTERESSADO"
  | "SUBIR_DOCUMENTO"
  | "CONFERIR_DOCUMENTO"
  | "CONFIRMAR_DATA"
  | "GERAR_CARTA_CONVIDADO"
  | "ENVIAR_CARTA_CONVIDADO";

type UsuarioComPapel = { papel: Papel; subPapelOperador: SubPapelOperador | null };

const PERMISSOES_POR_SUBPAPEL: Record<SubPapelOperador, ReadonlySet<Acao>> = {
  [SubPapelOperador.INTERESSADO]: new Set<Acao>([
    "CADASTRAR_PARTE",
    "CADASTRAR_DEMANDA",
    "GERAR_CARTA_INTERESSADO",
    "ENVIAR_CARTA_INTERESSADO",
    "SUBIR_DOCUMENTO",
  ]),
  [SubPapelOperador.CAMARA]: new Set<Acao>([
    "CONFERIR_DOCUMENTO",
    "CONFIRMAR_DATA",
    "GERAR_CARTA_CONVIDADO",
    "ENVIAR_CARTA_CONVIDADO",
  ]),
};

export function temPermissao(usuario: UsuarioComPapel, acao: Acao): boolean {
  if (usuario.papel === Papel.ADMIN) return true;
  if (!usuario.subPapelOperador) return true;
  return PERMISSOES_POR_SUBPAPEL[usuario.subPapelOperador].has(acao);
}

/**
 * Operador sem sub-perfil, ou administrador: pode tudo o que o fluxo tem, inclusive
 * o que nenhum sub-perfil lista (agenda, sessão, ata, termo, cancelamento).
 */
export function temAcessoCompleto(usuario: UsuarioComPapel): boolean {
  return usuario.papel === Papel.ADMIN || !usuario.subPapelOperador;
}

export function garantirPermissao(usuario: UsuarioComPapel, acao: Acao): void {
  if (!temPermissao(usuario, acao)) {
    throw new SemPermissao("Seu perfil de operador não tem permissão para esta ação.");
  }
}

/** `exigirEquipe()` + checagem de permissão, para a Server Action de uma ação única. */
export async function exigirPermissao(acao: Acao) {
  const usuario = await exigirEquipe();
  garantirPermissao(usuario, acao);
  return usuario;
}

/**
 * Para as ações que nenhum sub-perfil lista: agenda, sessão, ata, termo,
 * cancelamento, observação. Só administrador ou operador sem sub-perfil.
 */
export async function exigirAcessoCompleto() {
  const usuario = await exigirEquipe();
  if (!temAcessoCompleto(usuario)) {
    throw new SemPermissao("Seu perfil de operador não tem permissão para esta ação.");
  }
  return usuario;
}
