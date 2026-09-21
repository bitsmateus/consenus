import { z } from "zod";

/**
 * Política de senha do sistema: senha curta é o elo fraco de tudo. Compartilhada
 * pelo cadastro de conta, pela troca feita pelo administrador e pela
 * redefinição por e-mail — as três precisam exigir exatamente o mesmo.
 */
export const senhaForte = z
  .string()
  .min(12, "A senha precisa de ao menos 12 caracteres.")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v), "Use letras maiúsculas e minúsculas.")
  .refine((v) => /\d/.test(v), "Use ao menos um número.");
