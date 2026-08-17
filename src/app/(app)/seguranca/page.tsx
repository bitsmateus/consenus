import QRCode from "qrcode";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import {
  exigeSegundoFator,
  montarUriDeProvisionamento,
  podeDesativarSegundoFator,
} from "@/lib/totp";
import { desativarSegundoFator, prepararSegundoFator } from "@/acoes/seguranca";
import { FormularioDeAtivacao } from "./formulario";

export const metadata = { title: "Segurança — Consensus One" };

export default async function PaginaDeSeguranca() {
  const usuario = await exigirUsuario();

  const registro = await db.usuario.findUnique({
    where: { id: usuario.id },
    select: { email: true, totpAtivo: true, totpSecret: true },
  });

  const obrigatorio = exigeSegundoFator(usuario.papel);
  const emConfiguracao = !registro?.totpAtivo && !!registro?.totpSecret;

  const qr = emConfiguracao
    ? await QRCode.toDataURL(montarUriDeProvisionamento(registro.email, registro.totpSecret!), {
        margin: 1,
        width: 220,
      })
    : null;

  return (
    <>
      <header className="border-b border-carvao-100 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-preto-900">Segurança</h1>
        <p className="text-xs text-carvao-500">Verificação em duas etapas da sua conta</p>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-xl rounded-lg border border-carvao-100 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-carvao-700">Verificação em duas etapas</p>
              <p className="mt-0.5 text-xs text-carvao-500">
                {obrigatorio
                  ? "Obrigatória para perfis internos da câmara."
                  : "Recomendada para proteger o acesso."}
              </p>
            </div>
            <span
              className={
                registro?.totpAtivo
                  ? "rounded-full bg-sucesso-bg px-2.5 py-1 text-[11px] font-medium text-sucesso"
                  : "rounded-full bg-atencao-bg px-2.5 py-1 text-[11px] font-medium text-atencao"
              }
            >
              {registro?.totpAtivo ? "Ativa" : "Inativa"}
            </span>
          </div>

          {registro?.totpAtivo && (
            <div>
              <p className="mb-3 text-xs text-carvao-500">
                Ao entrar, o sistema pede o código de 6 dígitos do seu aplicativo autenticador.
              </p>
              {podeDesativarSegundoFator(usuario.papel) ? (
                <form action={desativarSegundoFator}>
                  <button className="rounded-md border border-carvao-100 px-4 py-2 text-xs font-medium text-erro hover:bg-erro/5">
                    Desativar
                  </button>
                </form>
              ) : (
                <p className="rounded-md bg-atencao-bg px-3 py-2 text-xs text-atencao">
                  Não pode ser desativada em perfis internos da câmara.
                </p>
              )}
            </div>
          )}

          {emConfiguracao && qr && (
            <div>
              <ol className="mb-4 list-decimal space-y-1 pl-4 text-xs text-carvao-500">
                <li>Abra seu aplicativo autenticador.</li>
                <li>Leia o QR Code abaixo, ou digite a chave manualmente.</li>
                <li>Informe o código de 6 dígitos para confirmar.</li>
              </ol>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR Code de configuração do segundo fator"
                width={220}
                height={220}
                className="mb-3 rounded-md border border-carvao-100"
              />
              <p className="tabular mb-4 break-all text-xs text-carvao-500">
                {registro.totpSecret}
              </p>

              <FormularioDeAtivacao />
            </div>
          )}

          {!registro?.totpAtivo && !emConfiguracao && (
            <div>
              {obrigatorio && (
                <p className="mb-3 rounded-md bg-atencao-bg px-3 py-2 text-xs text-atencao">
                  Seu perfil exige verificação em duas etapas. O acesso ao restante do
                  sistema fica liberado depois da ativação.
                </p>
              )}
              <form action={prepararSegundoFator}>
                <button className="rounded-md bg-grafite-700 px-4 py-2 text-xs font-medium text-white hover:bg-grafite-500">
                  Configurar agora
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
