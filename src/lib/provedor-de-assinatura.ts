/**
 * Qual plataforma de assinatura eletrônica recebe os envios NOVOS.
 *
 * Troca da D4Sign pela ZapSign (11/2026). A escolha é por variável de
 * ambiente, ASSINATURA_PROVEDOR, para virar a chave sem nova versão e voltar
 * atrás se for preciso:
 *
 *   ASSINATURA_PROVEDOR=zapsign   envios novos vão pela ZapSign
 *   ASSINATURA_PROVEDOR=d4sign    envios novos vão pela D4Sign (padrão)
 *
 * Isto decide só o envio. O que já foi enviado termina onde começou: o
 * webhook, o download e o cancelamento olham `OperacaoAssinatura.provedor`.
 */
import { ProvedorAssinatura } from "@prisma/client";
import {
  assinaturaDigitalAtiva as d4signAtiva,
  cancelarDocumento as cancelarNaD4Sign,
} from "./d4sign";
import { cancelarDocumento as cancelarNaZapSign, zapsignAtiva } from "./zapsign";

export function provedorEscolhido(
  valor: string | undefined = process.env.ASSINATURA_PROVEDOR
): ProvedorAssinatura {
  return valor?.trim().toLowerCase() === "zapsign"
    ? ProvedorAssinatura.ZAPSIGN
    : ProvedorAssinatura.D4SIGN;
}

/** O provedor escolhido tem credencial? Sem ela, o botão de envio não aparece. */
export function provedorConfigurado(provedor: ProvedorAssinatura): boolean {
  return provedor === ProvedorAssinatura.ZAPSIGN ? zapsignAtiva() : d4signAtiva();
}

/** Para a tela: há como enviar documento novo para assinatura eletrônica? */
export function assinaturaEletronicaAtiva(): boolean {
  return provedorConfigurado(provedorEscolhido());
}

export const NOME_DO_PROVEDOR: Record<ProvedorAssinatura, string> = {
  D4SIGN: "D4Sign",
  ZAPSIGN: "ZapSign",
};

/**
 * Cancela um envio ainda aberto na plataforma que o recebeu. Sem credencial
 * daquela plataforma, não há o que fazer daqui: devolve false e quem chamou
 * registra o pedido de cancelar pelo painel.
 */
export async function cancelarNoProvedor(
  envio: { provedor: ProvedorAssinatura; identificadorExterno: string },
  motivo: string
): Promise<boolean> {
  if (!provedorConfigurado(envio.provedor)) return false;
  if (envio.provedor === ProvedorAssinatura.ZAPSIGN) {
    await cancelarNaZapSign(envio.identificadorExterno, motivo);
  } else {
    await cancelarNaD4Sign(envio.identificadorExterno, motivo);
  }
  return true;
}
