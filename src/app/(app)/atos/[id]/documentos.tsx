"use client";

import { useActionState } from "react";
import { CanalEnvio, TipoDocumento } from "@prisma/client";
import {
  anexarDocumento,
  registrarEnvio,
  type EstadoDeFormulario,
} from "@/acoes/documentos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Selecao } from "@/components/ui/selecao";
import { EXTENSOES_ACEITAS } from "@/lib/mime";

const TIPOS_DE_ANEXO = [
  { valor: TipoDocumento.DOCUMENTO_DA_PARTE, rotulo: "Documento do Interessado" },
  { valor: TipoDocumento.LAUDO_AR, rotulo: "Laudo de AR" },
  { valor: TipoDocumento.DOCUMENTO_ASSINADO, rotulo: "Documento assinado" },
  { valor: TipoDocumento.OUTRO, rotulo: "Outro" },
];

export function FormularioDeAnexo({ atoId }: { atoId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    anexarDocumento,
    {}
  );

  return (
    <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
      <input type="hidden" name="atoId" value={atoId} />

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-3 text-xs text-sucesso">{estado.aviso}</p>}

      <div className="grid gap-x-3 sm:grid-cols-2">
        <Selecao rotulo="Tipo" name="tipo" opcoes={TIPOS_DE_ANEXO} />
        <Campo rotulo="Descrição" name="descricao" placeholder="opcional" />
      </div>

      <div className="mb-4">
        <label htmlFor="arquivo" className="mb-1.5 block text-xs font-medium text-carvao-700">
          Arquivo
        </label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          required
          accept={EXTENSOES_ACEITAS}
          className="w-full rounded-md border border-carvao-100 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-carvao-100 file:px-3 file:py-1.5 file:text-xs"
        />
        <p className="mt-1 text-xs text-carvao-300">
          PDF, JPEG ou PNG, até 20 MB. O tipo é conferido pelo conteúdo do arquivo.
        </p>
      </div>

      <Botao type="submit" variante="secundario" carregando={pendente}>
        Anexar
      </Botao>
    </form>
  );
}

export function FormularioDeEnvio({
  atoId,
  documentos,
  destinatarios,
}: {
  atoId: string;
  documentos: { valor: string; rotulo: string }[];
  destinatarios: { valor: string; rotulo: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoDeFormulario, FormData>(
    registrarEnvio,
    {}
  );

  return (
    <form action={acao} className="rounded-lg border border-carvao-100 bg-white p-4">
      <input type="hidden" name="atoId" value={atoId} />

      {estado.erro && (
        <p role="alert" className="mb-3 rounded-md bg-erro-bg px-3 py-2 text-xs text-erro">
          {estado.erro}
        </p>
      )}
      {estado.aviso && <p className="mb-3 text-xs text-sucesso">{estado.aviso}</p>}

      <div className="grid gap-x-3 sm:grid-cols-3">
        <Selecao rotulo="Documento" name="documentoId" vazio="Selecione" opcoes={documentos} />
        <Selecao
          rotulo="Destinatário"
          name="destinatarioId"
          vazio="Selecione"
          opcoes={destinatarios}
        />
        <Selecao
          rotulo="Canal"
          name="canal"
          defaultValue={CanalEnvio.AR_DIGITAL}
          opcoes={[
            { valor: CanalEnvio.AR_DIGITAL, rotulo: "AR digital" },
            { valor: CanalEnvio.EMAIL, rotulo: "E-mail" },
            { valor: CanalEnvio.ENTREGA_MANUAL, rotulo: "Entrega manual" },
          ]}
        />
      </div>

      <Botao type="submit" variante="secundario" carregando={pendente}>
        Registrar envio
      </Botao>
    </form>
  );
}
