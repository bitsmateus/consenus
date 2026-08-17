"use server";

import { revalidatePath } from "next/cache";
import argon2 from "argon2";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ErroDeNegocio } from "@/lib/erros";
import { exigirAdmin } from "@/lib/sessao";

export type EstadoDeFormulario = { erro?: string; aviso?: string; campo?: string };

/** Mesma política do cadastro inicial: senha curta é o elo fraco de tudo. */
const senhaForte = z
  .string()
  .min(12, "A senha precisa de ao menos 12 caracteres.")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v), "Use letras maiúsculas e minúsculas.")
  .refine((v) => /\d/.test(v), "Use ao menos um número.");

const criacao = z.object({
  nome: z.string().trim().min(3, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  papel: z.nativeEnum(Papel),
  senha: senhaForte,
  pessoaId: z.string().trim().optional(),
});

/**
 * Perfil externo (PARTE e PROCURADOR) só funciona ligado a uma Pessoa: é o
 * `pessoaId` que o filtro de autorização usa para decidir o que a conta
 * enxerga. Sem ele, a pessoa entra e não vê procedimento nenhum.
 */
function exigePessoaVinculada(papel: Papel): boolean {
  return papel === Papel.PARTE || papel === Papel.PROCURADOR;
}

export async function criarUsuario(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const admin = await exigirAdmin();

  const analise = criacao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  const { nome, email, papel, senha, pessoaId } = analise.data;

  try {
    if (exigePessoaVinculada(papel) && !pessoaId) {
      throw new ErroDeNegocio(
        "Perfil de Interessado ou Procurador precisa estar vinculado a uma pessoa cadastrada."
      );
    }

    const usuario = await db.usuario.create({
      data: {
        nome,
        email: email.toLowerCase(),
        papel,
        senhaHash: await argon2.hash(senha, { type: argon2.argon2id }),
        pessoaId: exigePessoaVinculada(papel) ? pessoaId || null : null,
      },
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "CRIOU_USUARIO",
      entidade: "Usuario",
      entidadeId: usuario.id,
      metadados: { email: usuario.email, papel },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: "Já existe conta com este e-mail ou pessoa vinculada.", campo: "email" };
    }
    throw erro;
  }

  revalidatePath("/equipe");
  return { aviso: "Conta criada." };
}

const alteracao = z.object({
  usuarioId: z.string().min(1),
  papel: z.nativeEnum(Papel),
  ativo: z.enum(["sim", "nao"]),
});

export async function alterarPermissao(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const admin = await exigirAdmin();

  const analise = alteracao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { usuarioId, papel, ativo } = analise.data;

  try {
    const alvo = await db.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, papel: true, pessoaId: true, email: true },
    });
    if (!alvo) throw new ErroDeNegocio("Conta não encontrada.");

    // Trava contra ficar sem administrador: quem está mexendo não pode
    // rebaixar ou desativar a si mesmo e trancar a administração do sistema.
    if (alvo.id === admin.id && (papel !== Papel.ADMIN || ativo === "nao")) {
      throw new ErroDeNegocio("Você não pode remover o próprio acesso de administrador.");
    }

    if (exigePessoaVinculada(papel) && !alvo.pessoaId) {
      throw new ErroDeNegocio(
        "Vincule a conta a uma pessoa cadastrada antes de dar perfil de Interessado ou Procurador."
      );
    }

    if (papel === Papel.ADMIN || ativo === "nao") {
      const admins = await db.usuario.count({
        where: { papel: Papel.ADMIN, ativo: true, id: { not: usuarioId } },
      });
      if (admins === 0 && alvo.papel === Papel.ADMIN && (papel !== Papel.ADMIN || ativo === "nao")) {
        throw new ErroDeNegocio("O sistema precisa de ao menos um administrador ativo.");
      }
    }

    await db.usuario.update({
      where: { id: usuarioId },
      data: { papel, ativo: ativo === "sim" },
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "ALTEROU_PERMISSAO",
      entidade: "Usuario",
      entidadeId: usuarioId,
      metadados: { de: alvo.papel, para: papel, ativo: ativo === "sim" },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }

  revalidatePath("/equipe");
  return { aviso: "Permissões atualizadas." };
}
