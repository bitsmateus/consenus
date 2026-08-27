"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const EVENTO = "consensus:aviso";
const DURACAO_MS = 4000;

export type Aviso = { id: number; texto: string; tom: "sucesso" | "erro" };

/**
 * Dispara um aviso passageiro.
 *
 * Barramento de evento do próprio navegador, sem contexto nem biblioteca: o
 * botão que emite documento é um Client Component solto dentro de árvore de
 * Server Components, e não há provider comum para atravessar.
 */
export function avisar(texto: string, tom: Aviso["tom"] = "sucesso"): void {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { texto, tom } }));
}

/** Fica no shell da aplicação e escuta. Um por página. */
export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    const aoReceber = (evento: Event) => {
      const { texto, tom } = (evento as CustomEvent<Omit<Aviso, "id">>).detail;
      const id = Date.now() + Math.random();

      setAvisos((atuais) => [...atuais, { id, texto, tom }]);
      // some sozinho: aviso de sucesso que exige clique vira estorvo
      setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), DURACAO_MS);
    };

    window.addEventListener(EVENTO, aoReceber);
    return () => window.removeEventListener(EVENTO, aoReceber);
  }, []);

  if (avisos.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={cn(
            "pointer-events-auto max-w-xs rounded-lg border px-4 py-3 text-sm shadow-lg",
            aviso.tom === "sucesso"
              ? "border-sucesso/20 bg-sucesso-bg text-sucesso"
              : "border-erro/20 bg-erro-bg text-erro"
          )}
        >
          {aviso.texto}
        </div>
      ))}
    </div>
  );
}
