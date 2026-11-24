/**
 * Reenvio pela ZapSign de um envio que ficou pendente na D4Sign.
 *
 * Decisão do escritório (24/11/2026): "vamos reenviar tudo pela ZapSign" —
 * mas "só vamos cancelar quando tiver 100% pronto". Por isso a regra exige a
 * ZapSign LIGADA (ASSINATURA_PROVEDOR=zapsign, chave e webhook configurados):
 * antes disso o botão nem aparece, e nada na D4Sign é tocado. Depois disso, o
 * cancelamento continua sendo um clique da equipe, documento por documento.
 *
 * Módulo puro, para testar sem servidor.
 */
import { ProvedorAssinatura, StatusAssinatura } from "@prisma/client";

/**
 * Pendente = ninguém terminou. PARCIAL entra: quem já assinou na D4Sign assina
 * de novo na ZapSign ("tudo"). FALHOU fica de fora: ali todos já assinaram e
 * só o arquivo não voltou — reenviar pediria assinatura de novo à toa.
 */
const PENDENTES: StatusAssinatura[] = [StatusAssinatura.AGUARDANDO, StatusAssinatura.PARCIAL];

export function podeReenviarPelaZapSign(
  envio: { provedor: ProvedorAssinatura; status: StatusAssinatura } | null | undefined,
  zapsignLigada: boolean
): boolean {
  if (!zapsignLigada || !envio) return false;
  return envio.provedor === ProvedorAssinatura.D4SIGN && PENDENTES.includes(envio.status);
}
