import { FormularioDeLogin } from "./formulario";
import { MolduraDeAcesso } from "./moldura";

export const metadata = { title: "Entrar — Consensus One" };

export default async function PaginaDeLogin({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; redefinida?: string }>;
}) {
  const { de, redefinida } = await searchParams;

  return (
    <MolduraDeAcesso
      titulo="Acesso ao sistema"
      descricao="Entre com suas credenciais institucionais."
    >
      {redefinida === "1" && (
        <p
          role="status"
          className="mb-4 rounded-md border border-sucesso/20 bg-sucesso-bg px-3 py-2 text-xs text-sucesso"
        >
          Senha redefinida. Entre com a nova senha.
        </p>
      )}

      <FormularioDeLogin de={de} />
    </MolduraDeAcesso>
  );
}
