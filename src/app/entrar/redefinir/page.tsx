import Link from "next/link";
import { MolduraDeAcesso } from "../moldura";
import { FormularioDeNovaSenha } from "./formulario";

export const metadata = {
  title: "Nova senha — Consensus One",
  // o token viaja na URL: nenhum link desta página pode entregá-lo como Referer
  referrer: "no-referrer",
};

export default async function PaginaRedefinir({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <MolduraDeAcesso titulo="Nova senha" descricao="Escolha a nova senha da sua conta.">
      {token ? (
        <FormularioDeNovaSenha token={token} />
      ) : (
        <p className="text-sm text-carvao-500">
          Link incompleto. Peça um novo em{" "}
          <Link href="/entrar/esqueci-senha" className="text-dourado-600 hover:underline">
            Esqueci minha senha
          </Link>
          .
        </p>
      )}
    </MolduraDeAcesso>
  );
}
