import { MolduraDeAcesso } from "../moldura";
import { FormularioDePedido } from "./formulario";

export const metadata = { title: "Esqueci minha senha — Consensus One" };

export default function PaginaEsqueciSenha() {
  return (
    <MolduraDeAcesso
      titulo="Esqueci minha senha"
      descricao="Informe o e-mail da sua conta e enviaremos um link para escolher uma nova senha."
    >
      <FormularioDePedido />
    </MolduraDeAcesso>
  );
}
