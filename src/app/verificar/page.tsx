/**
 * Página pública de verificação de autenticidade.
 *
 * ATENÇÃO: esta página NÃO expõe o documento, nem o nome das partes, nem o
 * resultado da sessão. Só confirma que o documento foi emitido pela câmara.
 * Ver docs/03-autenticacao-de-documentos.md
 *
 * Sprint 2. Esqueleto abaixo.
 */
import { codigoEhValido, normalizarCodigo } from "@/lib/codigo-documento";

export const metadata = { title: "Verificação de documento — Consensus One" };

export default async function PaginaDeVerificacao({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  const codigoInformado = codigo ? normalizarCodigo(codigo) : "";
  const formatoValido = codigoInformado ? codigoEhValido(codigoInformado) : null;

  // TODO Sprint 2: consultar o documento e devolver apenas
  // { existe, tipo, dataEmissao } — nunca o arquivo, nunca o nome das partes.

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
          defaultValue={codigoInformado}
          placeholder="CO-CC-2026-000001"
          className="tabular flex-1 rounded-md border border-carvao-100 bg-superficie px-4 py-3 uppercase outline-none focus:border-grafite-500"
          aria-label="Código do documento"
        />
        <button
          type="submit"
          className="rounded-md bg-grafite-700 px-6 py-3 font-medium text-white transition-colors hover:bg-grafite-500"
        >
          Verificar
        </button>
      </form>

      {formatoValido === false && (
        <p className="mt-4 rounded-md bg-erro-bg px-3 py-2 text-sm text-erro">
          Código em formato inválido. Confira os caracteres informados.
        </p>
      )}
    </main>
  );
}
