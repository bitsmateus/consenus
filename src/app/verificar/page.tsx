/**
 * Página pública de verificação de autenticidade.
 *
 * ATENÇÃO: esta página NÃO expõe o documento, nem o nome das partes, nem o
 * número do procedimento, nem o resultado da sessão. Só confirma que o
 * documento foi emitido pela câmara (CLAUDE.md, regra 5; docs/03).
 */
import { headers } from "next/headers";
import { verificarCodigo, type Resultado } from "@/lib/verificacao";

export const metadata = {
  title: "Verificação de documento — Consensus One",
  robots: { index: false, follow: false },
};

/** Chave do consultante para o limite de taxa. */
async function chaveDoConsultante(): Promise<string> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || cabecalhos.get("x-real-ip") || "desconhecido";
}

export default async function PaginaDeVerificacao({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  const informado = (codigo ?? "").trim();

  const resultado: Resultado | null = informado
    ? await verificarCodigo(informado, await chaveDoConsultante())
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-8 border-l-4 border-dourado-600 pl-4">
        <h1 className="font-serif text-2xl text-preto-900">Consensus One</h1>
        <p className="text-sm text-carvao-500">
          Câmara Privada de Composição Estratégica Consensual
        </p>
      </div>

      <h2 className="mb-2 text-xl font-semibold text-carvao-700">Verificação de autenticidade</h2>
      <p className="mb-6 text-sm text-carvao-500">
        Informe o código impresso no cabeçalho do documento para confirmar que
        ele foi emitido por esta câmara.
      </p>

      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        <input
          name="codigo"
          defaultValue={informado}
          placeholder="CO-CC-2026-000001"
          aria-label="Código do documento"
          /* sem autocompletar nem sugerir: docs/03 proíbe enumeração assistida */
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={30}
          className="tabular flex-1 rounded-md border border-carvao-100 bg-superficie px-4 py-3 uppercase outline-none focus:border-grafite-500"
        />
        <button
          type="submit"
          className="rounded-md bg-grafite-700 px-6 py-3 font-medium text-white transition-colors hover:bg-grafite-500"
        >
          Verificar
        </button>
      </form>

      {resultado && <Resposta resultado={resultado} />}

      <p className="mt-10 text-xs leading-relaxed text-carvao-300">
        Esta consulta confirma apenas a autenticidade e a data de emissão do
        documento. O conteúdo do procedimento é sigiloso e não é divulgado por
        esta página.
      </p>
    </main>
  );
}

function Resposta({ resultado }: { resultado: Resultado }) {
  if (resultado.situacao === "limite") {
    return (
      <div role="status" className="mt-6 rounded-md bg-atencao-bg px-4 py-3 text-sm text-atencao">
        Muitas consultas em pouco tempo. Tente novamente em{" "}
        {resultado.esperarSegundos} segundos.
      </div>
    );
  }

  if (resultado.situacao === "desafio") {
    return (
      <div role="status" className="mt-6 rounded-md bg-atencao-bg px-4 py-3 text-sm text-atencao">
        Detectamos consultas seguidas sem resultado. Aguarde alguns minutos antes
        de tentar de novo.
      </div>
    );
  }

  if (resultado.situacao === "nao_encontrado") {
    return (
      <div role="status" className="mt-6 rounded-md bg-erro-bg px-4 py-3 text-sm text-erro">
        Documento não encontrado.
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-6 rounded-lg border border-sucesso/20 bg-sucesso-bg px-5 py-4"
    >
      <p className="mb-3 text-sm font-semibold text-sucesso">✓ Documento autêntico</p>
      <dl className="space-y-1.5 text-sm">
        <Linha rotulo="Tipo" valor={resultado.tipo} />
        <Linha rotulo="Código" valor={resultado.codigo} mono />
        <Linha rotulo="Emitido em" valor={resultado.emitidoEm} mono />
        <Linha rotulo="Situação" valor="Válido" />
      </dl>
    </div>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-carvao-500">{rotulo}</dt>
      <dd className={mono ? "tabular text-carvao-700" : "text-carvao-700"}>{valor}</dd>
    </div>
  );
}
