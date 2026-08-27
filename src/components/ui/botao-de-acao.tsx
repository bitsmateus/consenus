"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "./botao";
import { avisar } from "./avisos";

/**
 * Botão de formulário que mostra que está trabalhando e avisa quando termina.
 *
 * Emitir documento gera PDF, calcula hash e sobe para o storage: leva alguns
 * segundos, e até aqui a tela não dava sinal nenhum. Sem retorno, o operador
 * clica de novo — e o servidor tem que recusar a segunda emissão.
 *
 * Usa `useFormStatus`, que enxerga o formulário-pai sem exigir que a Server
 * Action devolva estado. As ações do fluxo devolvem void de propósito: quem
 * conta o que aconteceu é a linha do tempo do procedimento.
 */
export function BotaoDeAcao({
  children,
  carregandoTexto,
  sucesso,
  variante,
  desabilitado,
}: {
  children: React.ReactNode;
  /** Rótulo enquanto trabalha. O padrão serve para emissão de documento. */
  carregandoTexto?: string;
  /** Mensagem do aviso quando termina. Sem isto, não avisa. */
  sucesso?: string;
  variante?: "primario" | "secundario" | "perigo";
  desabilitado?: boolean;
}) {
  const { pending } = useFormStatus();
  const estavaPendente = useRef(false);

  useEffect(() => {
    // avisa na transição de "trabalhando" para "pronto", não a cada render
    if (estavaPendente.current && !pending && sucesso) avisar(sucesso);
    estavaPendente.current = pending;
  }, [pending, sucesso]);

  return (
    <Botao type="submit" variante={variante} disabled={pending || desabilitado}>
      {pending ? (carregandoTexto ?? "Emitindo...") : children}
    </Botao>
  );
}
