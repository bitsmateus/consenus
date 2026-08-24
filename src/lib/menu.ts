/**
 * Itens do menu do sistema, por papel.
 *
 * Módulo puro, na mesma linha de `autorizacao.ts`: o layout é um Server
 * Component e não dá para exercitar num teste unitário, mas a decisão de quem
 * vê o que no menu dá — e precisa. Foi exatamente aqui que Equipe e Auditoria
 * ficaram aparecendo para o OPERADOR, que não pode abrir nenhuma das duas.
 *
 * Isto é cortesia de interface, não controle de acesso. Quem barra de verdade
 * é o servidor, em cada página, via `exigirAdmin()` e `exigirEquipe()`.
 * Esconder item de menu nunca é proteção — ver CLAUDE.md, regra 2.
 */
import { Papel } from "@prisma/client";

export type ItemDeMenu = { href: string; rotulo: string; somenteAdmin?: boolean };

export const MENU_EQUIPE: ItemDeMenu[] = [
  { href: "/painel", rotulo: "Painel" },
  { href: "/atos", rotulo: "Procedimentos" },
  { href: "/pessoas", rotulo: "Interessados" },
  { href: "/equipe", rotulo: "Equipe", somenteAdmin: true },
  { href: "/seguranca", rotulo: "Segurança" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/auditoria", rotulo: "Auditoria", somenteAdmin: true },
];

export const MENU_EXTERNO: ItemDeMenu[] = [
  { href: "/painel", rotulo: "Procedimentos" },
  { href: "/seguranca", rotulo: "Segurança" },
  { href: "/documentos", rotulo: "Documentos" },
  { href: "/meus-dados", rotulo: "Meus dados" },
];

export function ehDaEquipe(papel: Papel): boolean {
  return papel === Papel.ADMIN || papel === Papel.OPERADOR;
}

/** Menu que o papel deve enxergar. */
export function montarMenu(papel: Papel): ItemDeMenu[] {
  const base = ehDaEquipe(papel) ? MENU_EQUIPE : MENU_EXTERNO;
  return base.filter((item) => !item.somenteAdmin || papel === Papel.ADMIN);
}
