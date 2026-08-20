"use client";

import { useActionState } from "react";
import { StatusAssinatura } from "@prisma/client";
import { enviarParaAssinatura, type EstadoDeFormulario } from "@/acoes/assinaturas";
import { Botao } from "@/components/ui/botao";
import { Etiqueta } from "@/components/ui/etiqueta";
import type { TomDeStatus } from "@/lib/formato";

export type AssinaturaDoDocumento = {
  status: StatusAssinatura;
  totalSignatarios: number;
  jaAssinaram: number;
  temAssinado: boolean;
  ultimoErro: string | null;
};

const ROTULO: Record<StatusAssinatura, string> = {
  AGUARDANDO: "Aguardando assinaturas",
  PARCIAL: "Assinaturas em andamento",
  CONCLUIDA: "Assinado — recebendo o arquivo",
  ARQUIVADA: "Assinado e arquivado",
  CANCELADA: "Assinatura cancelada",
  FALHOU: "Falha ao receber o assinado",
};

const TOM: Record<StatusAssinatura, TomDeStatus> = {
  AGUARDANDO: "andamento",
  PARCIAL: "andamento",
  CONCLUIDA: "andamento",
  ARQUIVADA: "sucesso",
  CANCELADA: "atencao",
  FALHOU: "encerrado",
};

/**
 * Situação da assinatura eletrônica de um documento, e o botão de envio.
 *
 * Só aparece para a equipe e só quando a integração está ligada. Sem ela, o
 * operador segue coletando assinatura pelo caminho de sempre e anexando o
 * assinado à mão — nada aqui é passo obrigatório do fluxo.
 */
export function Assinatura({
  documentoId,
  assinatura,
}: {
  documentoId: string;
  assinatura: AssinaturaDoDocumento | null;
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    enviarParaAssinatura,
    {}
  );

  if (assinatura) {
    return (
      <div className="mt-3 border-t border-carvao-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tom={TOM[assinatura.status]}>{ROTULO[assinatura.status]}</Etiqueta>
          <span className="tabular text-[11px] text-carvao-300">
            {assinatura.jaAssinaram} de {assinatura.totalSignatarios} assinaram
          </span>
        </div>
        {assinatura.status === "FALHOU" && (
          <p className="mt-1.5 text-[11px] text-erro">
            O documento foi assinado, mas não conseguimos trazer o arquivo. A D4Sign tenta de
            novo sozinha; se não resolver, baixe pelo painel da D4Sign e anexe aqui.
          </p>
        )}
        {assinatura.status === "ARQUIVADA" && !assinatura.temAssinado && (
          <p className="mt-1.5 text-[11px] text-carvao-300">Arquivo assinado indisponível.</p>
        )}
      </div>
    );
  }

  return (
    <form action={acao} className="mt-3 border-t border-carvao-100 pt-3">
      <input type="hidden" name="documentoId" value={documentoId} />

      {estado.erro && (
        <p role="alert" className="mb-2 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-2 text-xs text-sucesso">{estado.aviso}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Botao type="submit" variante="secundario" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar para assinatura"}
        </Botao>
        <span className="text-[11px] text-carvao-300">
          Vai para quem compareceu à sessão, mais o conciliador.
        </span>
      </div>
    </form>
  );
}
