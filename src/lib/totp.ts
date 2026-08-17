/**
 * Segundo fator (TOTP). Obrigatório para ADMIN e OPERADOR — docs/04.
 *
 * O segredo fica em Usuario.totpSecret e só passa a ser exigido depois que a
 * pessoa confirma a ativação com um código válido (Usuario.totpAtivo).
 */
import { authenticator } from "otplib";

/** Uma janela para trás e uma para frente, para tolerar relógio fora de sincronia. */
authenticator.options = { window: 1 };

export const EMISSOR = "Consensus One";

export function gerarSegredo(): string {
  return authenticator.generateSecret();
}

/** URI otpauth:// que vira QR Code no aplicativo autenticador. */
export function montarUriDeProvisionamento(email: string, segredo: string): string {
  return authenticator.keyuri(email, EMISSOR, segredo);
}

export function codigoConfere(codigo: string, segredo: string): boolean {
  const limpo = codigo.replace(/\D/g, "");
  if (limpo.length !== 6) return false;

  try {
    return authenticator.verify({ token: limpo, secret: segredo });
  } catch {
    // segredo malformado não derruba o login
    return false;
  }
}

/**
 * Perfis internos: o segundo fator é obrigatório por política de segurança.
 * docs/04 — "TOTP obrigatório para ADMIN e OPERADOR".
 */
export function exigeSegundoFator(papel: string): boolean {
  return papel === "ADMIN" || papel === "OPERADOR";
}

/**
 * Quem é obrigado a usar segundo fator não pode desligá-lo. Regra do servidor:
 * a interface esconde o botão, mas quem realmente decide é a Server Action.
 */
export function podeDesativarSegundoFator(papel: string): boolean {
  return !exigeSegundoFator(papel);
}

/**
 * Conta interna que ainda não ativou o segundo fator. Enquanto isso for
 * verdade, o acesso fica preso na tela de segurança — entrar só com senha não
 * pode dar acesso ao sistema.
 */
export function segundoFatorPendente(usuario: { papel: string; totpAtivo: boolean }): boolean {
  return exigeSegundoFator(usuario.papel) && !usuario.totpAtivo;
}
