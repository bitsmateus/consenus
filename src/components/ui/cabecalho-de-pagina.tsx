export function CabecalhoDePagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-carvao-100 bg-white px-4 py-4 md:px-6">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-preto-900">{titulo}</h1>
        {descricao && <p className="mt-0.5 text-xs text-carvao-500">{descricao}</p>}
      </div>
      {acao}
    </header>
  );
}
