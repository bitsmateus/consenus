"use client";

import { useEffect, useRef } from "react";

/**
 * Cartão de uma sessão: o resumo fica sempre à vista e o restante abre por
 * clique. Também abre sozinho quando o endereço termina em `#<id>`, que é como
 * o quadro do mês aponta para a sessão.
 */
export function DetalhesDoCompromisso({
  id,
  resumo,
  children,
}: {
  id: string;
  resumo: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const abrirSeForOAlvo = () => {
      if (window.location.hash === `#${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "center" });
      }
    };
    abrirSeForOAlvo();
    window.addEventListener("hashchange", abrirSeForOAlvo);
    return () => window.removeEventListener("hashchange", abrirSeForOAlvo);
  }, [id]);

  return (
    <details
      ref={ref}
      id={id}
      className="scroll-mt-4 rounded-lg border border-carvao-100 bg-white open:border-dourado-600"
    >
      <summary className="cursor-pointer list-none p-4">{resumo}</summary>
      <div className="border-t border-carvao-100 p-4">{children}</div>
    </details>
  );
}
