"use client";

import { useActionState } from "react";
import { registrarObservacao, type EstadoDeFormulario } from "@/acoes/atos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

export function FormularioDeObservacao({ atoId }: { atoId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    registrarObservacao,
    {}
  );

  return (
    <form action={acao} className="mb-4 flex items-end gap-2">
      <input type="hidden" name="atoId" value={atoId} />
      <div className="flex-1">
        <Campo
          rotulo="Registrar observação"
          name="descricao"
          erro={estado.erro}
          placeholder="O que aconteceu neste procedimento"
        />
      </div>
      <Botao type="submit" variante="secundario" carregando={pendente} className="mb-4">
        Registrar
      </Botao>
    </form>
  );
}
