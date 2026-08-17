export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-carvao-100 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-carvao-700">{titulo}</p>
      {descricao && <p className="mx-auto mt-1 max-w-sm text-xs text-carvao-500">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
