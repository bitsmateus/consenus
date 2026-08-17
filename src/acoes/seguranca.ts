"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ErroDeNegocio, SemPermissao } from "@/lib/erros";
import { exigirUsuario } from "@/lib/sessao";
import { codigoConfere, gerarSegredo, podeDesativarSegundoFator } from "@/lib/totp";

export type EstadoSegundoFator = { erro?: string; aviso?: string };

/**
 * Gera um segredo novo e o grava sem ativar. O segundo fator só passa a valer
 * depois que a pessoa confirma com um código válido — assim ninguém se tranca
 * fora da conta por ter configurado o aplicativo errado.
 *
 * Recusa quando já existe segundo fator ativo: trocar o segredo derrubaria a
 * proteção vigente, e para perfil interno isso seria um caminho lateral para
 * burlar a obrigatoriedade.
 */
export async function prepararSegundoFator(): Promise<void> {
  const usuario = await exigirUsuario();

  const registro = await db.usuario.findUnique({
    where: { id: usuario.id },
    select: { totpAtivo: true },
  });

  if (registro?.totpAtivo) {
    throw new ErroDeNegocio(
      "O segundo fator já está ativo. Desative antes de configurar um novo aplicativo."
    );
  }

  await db.usuario.update({
    where: { id: usuario.id },
    data: { totpSecret: gerarSegredo(), totpAtivo: false },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "PREPAROU_SEGUNDO_FATOR",
    entidade: "Usuario",
    entidadeId: usuario.id,
  });

  revalidatePath("/seguranca");
}

const confirmacao = z.object({
  codigo: z.string().min(6, "Informe o código de 6 dígitos."),
});

export async function ativarSegundoFator(
  _anterior: EstadoSegundoFator,
  dados: FormData
): Promise<EstadoSegundoFator> {
  const usuario = await exigirUsuario();

  const analise = confirmacao.safeParse(Object.fromEntries(dados));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const registro = await db.usuario.findUnique({
      where: { id: usuario.id },
      select: { totpSecret: true },
    });

    if (!registro?.totpSecret) {
      throw new ErroDeNegocio("Gere um novo código de configuração antes de ativar.");
    }
    if (!codigoConfere(analise.data.codigo, registro.totpSecret)) {
      throw new ErroDeNegocio("Código incorreto. Confira o aplicativo e tente de novo.");
    }

    await db.usuario.update({ where: { id: usuario.id }, data: { totpAtivo: true } });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "ATIVOU_SEGUNDO_FATOR",
      entidade: "Usuario",
      entidadeId: usuario.id,
    });

    revalidatePath("/seguranca");
    return { aviso: "Segundo fator ativado." };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }
}

/**
 * Desativação. ADMIN e OPERADOR não podem: para eles o segundo fator é
 * obrigatório por política (docs/04) e a checagem é aqui, no servidor —
 * esconder o botão na tela não é controle de acesso.
 */
export async function desativarSegundoFator(): Promise<void> {
  const usuario = await exigirUsuario();

  if (!podeDesativarSegundoFator(usuario.papel)) {
    throw new SemPermissao(
      "A verificação em duas etapas é obrigatória para perfis internos da câmara."
    );
  }

  await db.usuario.update({
    where: { id: usuario.id },
    data: { totpAtivo: false, totpSecret: null },
  });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "DESATIVOU_SEGUNDO_FATOR",
    entidade: "Usuario",
    entidadeId: usuario.id,
  });

  revalidatePath("/seguranca");
}
