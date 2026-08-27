"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { itemAtivo, type ItemDeMenu } from "@/lib/menu";

/**
 * Itens do menu do computador.
 *
 * Client Component só por causa do destaque. O caminho PRECISA vir do
 * `usePathname`, e não de cabeçalho lido no layout: no App Router o layout não
 * é re-renderizado ao navegar entre páginas irmãs, então o item ativo ficava
 * congelado no primeiro carregamento — abrir Interessados continuava marcando
 * Procedimentos.
 */
export function MenuLateral({ itens }: { itens: ItemDeMenu[] }) {
  const ativo = itemAtivo(usePathname(), itens);

  return (
    <nav className="mt-4 flex flex-1 flex-col gap-px overflow-y-auto px-2">
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={ativo === item.href ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm transition-colors",
            ativo === item.href
              ? "bg-white/10 font-medium text-white"
              : "text-white/75 hover:bg-white/5 hover:text-white"
          )}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  );
}
