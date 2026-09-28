"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type OpcaoDoFiltro = {
  id: string;
  rotulo: string;
  total: number;
  href: string;
  titulo?: string;
};

/**
 * Dropdown com busca, para filtro com muitas opções (procurador, interessado,
 * conciliador) — pedido do cliente em 28/09: a fileira de chips virava uma
 * parede de botões conforme a base de cadastro crescia. Cada opção continua
 * sendo um `<Link>` comum, navegando por query string como antes; só a lista
 * fica escondida atrás de um botão até o operador abrir.
 */
export function FiltroEmLista({
  rotulo,
  opcoes,
  hrefTodos,
  ativoId,
}: {
  rotulo: string;
  opcoes: OpcaoDoFiltro[];
  hrefTodos: string;
  ativoId?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null);

  const selecionada = opcoes.find((o) => o.id === ativoId);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(termo));
  }, [opcoes, busca]);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclarEsc(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclarEsc);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclarEsc);
    };
  }, [aberto]);

  // fecha sozinho depois que um clique num <Link> troca a página
  useEffect(() => {
    setAberto(false);
    setBusca("");
  }, [ativoId]);

  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-carvao-300">
        {rotulo}
      </p>
      <div ref={raiz} className="relative inline-block">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-haspopup="listbox"
          className={
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium " +
            (selecionada
              ? "bg-grafite-700 text-white"
              : "border border-carvao-100 bg-white text-carvao-500 hover:border-dourado-600")
          }
        >
          <span className="max-w-52 truncate">
            {selecionada ? `${selecionada.rotulo} · ${selecionada.total}` : `Todos (${opcoes.length})`}
          </span>
          <span aria-hidden className="text-[9px]">
            ▾
          </span>
        </button>

        {aberto && (
          <div className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[85vw] overflow-hidden rounded-md border border-carvao-100 bg-white shadow-lg">
            <input
              autoFocus
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por nome..."
              aria-label={`Buscar em ${rotulo.toLowerCase()}`}
              className="w-full border-b border-carvao-100 px-3 py-2 text-xs outline-none focus:border-grafite-500"
            />
            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
              <li role="option" aria-selected={!ativoId}>
                <Link
                  href={hrefTodos}
                  className={
                    "block px-3 py-1.5 text-xs hover:bg-carvao-100/40 " +
                    (!ativoId ? "font-semibold text-grafite-700" : "text-carvao-700")
                  }
                >
                  Todos
                </Link>
              </li>
              {filtradas.map((opcao) => (
                <li key={opcao.id} role="option" aria-selected={opcao.id === ativoId}>
                  <Link
                    href={opcao.href}
                    title={opcao.titulo}
                    className={
                      "block truncate px-3 py-1.5 text-xs hover:bg-carvao-100/40 " +
                      (opcao.id === ativoId ? "font-semibold text-grafite-700" : "text-carvao-700")
                    }
                  >
                    {opcao.rotulo} · {opcao.total}
                  </Link>
                </li>
              ))}
              {filtradas.length === 0 && (
                <li className="px-3 py-2 text-xs text-carvao-300">Nada encontrado.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
