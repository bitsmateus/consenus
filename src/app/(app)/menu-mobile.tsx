"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/acoes/autenticacao";
import { cn } from "@/lib/cn";
import { itemAtivo, type ItemDeMenu } from "@/lib/menu";

/**
 * Navegação do celular.
 *
 * O menu lateral é `hidden md:flex`, então abaixo de 768px não sobrava nenhuma
 * navegação: a pessoa entrava numa página e só saía dela pela URL. Quem mais
 * sofre com isso é o Interessado, que segundo o CLAUDE.md consulta pelo
 * celular — o operador é que trabalha no computador.
 *
 * Client Component porque abre e fecha; é a única parte do shell que precisa
 * disso. Alvos de toque com 44px, conforme docs/05.
 */
export function MenuMobile({
  itens,
  nome,
  subtitulo,
}: {
  itens: ItemDeMenu[];
  nome: string;
  subtitulo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();
  const ativo = itemAtivo(caminho, itens);

  // Fecha ao navegar. Sem isto o painel fica aberto por cima da página nova,
  // porque a navegação do Next não desmonta o componente.
  useEffect(() => {
    setAberto(false);
  }, [caminho]);

  // Trava a rolagem do fundo enquanto o painel está aberto.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  // Fecha no Esc, para quem usa teclado externo no tablet.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <div className="md:hidden">
      {/* Fundo escuro: fechar tocando fora é o gesto que todo mundo tenta. */}
      {aberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-40 bg-black/50"
        />
      )}

      {/*
        Cabeçalho e painel no mesmo container grudado no topo. O painel é
        `absolute top-full`, isto é, logo abaixo do cabeçalho — assim ele não
        depende de eu acertar a altura dele na mão, e abrir o menu não empurra
        o conteúdo da página para baixo.
      */}
      <div className="sticky top-0 z-50">
        <header className="flex items-center justify-between border-b border-white/10 bg-preto-900 px-4 py-2">
          <Link href="/painel" className="flex items-center" aria-label="Ir para o início">
            <Image
              src="/marca/logo-consensus-one.png"
              alt="Consensus One"
              width={560}
              height={133}
              priority
              className="h-7 w-auto mix-blend-lighten"
            />
          </Link>

          <button
            type="button"
            onClick={() => setAberto((estava) => !estava)}
            aria-expanded={aberto}
            aria-controls="menu-do-celular"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/5 hover:text-white"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {aberto ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
        </header>

        {aberto && (
          <nav
            id="menu-do-celular"
            className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b border-white/10 bg-preto-900 pb-4 shadow-xl"
          >
            <div className="flex flex-col gap-px px-2 pt-2">
              {itens.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo === item.href ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center rounded-md px-3 text-sm transition-colors",
                    ativo === item.href
                      ? "bg-white/10 font-medium text-white"
                      : "text-white/75 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {item.rotulo}
                </Link>
              ))}
            </div>

            <div className="mt-3 border-t border-white/10 px-5 pt-4">
              <p className="text-xs font-medium text-white">{nome}</p>
              <p className="text-[11px] text-white/40">{subtitulo}</p>
              <form action={sair}>
                <button className="mt-2 flex min-h-[44px] items-center text-[11px] text-dourado-400 hover:underline">
                  Sair
                </button>
              </form>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
