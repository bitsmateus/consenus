"use server";

import { revalidatePath } from "next/cache";
import argon2 from "argon2";
import { Papel, Prisma, SubPapelOperador } from "@prisma/client";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ErroDeNegocio } from "@/lib/erros";
import { senhaForte } from "@/lib/senha";
import { exigirAdmin } from "@/lib/sessao";

export type EstadoDeFormulario = { erro?: string; aviso?: string; campo?: string };

const criacao = z.object({
  nome: z.string().trim().min(3, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  papel: z.nativeEnum(Papel),
  subPapelOperador: z.union([z.nativeEnum(SubPapelOperador), z.literal("")]).optional(),
  senha: senhaForte,
  pessoaId: z.string().trim().optional(),
});

/** Sub-perfil só faz sentido para OPERADOR — nulo em qualquer outro papel. */
function subPapelParaSalvar(
  papel: Papel,
  subPapelOperador: SubPapelOperador | "" | undefined
): SubPapelOperador | null {
  return papel === Papel.OPERADOR && subPapelOperador ? subPapelOperador : null;
}

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

  const { nome, email, papel, subPapelOperador, senha, pessoaId } = analise.data;

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
        subPapelOperador: subPapelParaSalvar(papel, subPapelOperador),
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
  subPapelOperador: z.union([z.nativeEnum(SubPapelOperador), z.literal("")]).optional(),
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

  const { usuarioId, papel, subPapelOperador, ativo } = analise.data;

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

    const novoSubPapel = subPapelParaSalvar(papel, subPapelOperador);

    await db.usuario.update({
      where: { id: usuarioId },
      data: { papel, subPapelOperador: novoSubPapel, ativo: ativo === "sim" },
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "ALTEROU_PERMISSAO",
      entidade: "Usuario",
      entidadeId: usuarioId,
      metadados: { de: alvo.papel, para: papel, subPapelOperador: novoSubPapel, ativo: ativo === "sim" },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }

  revalidatePath("/equipe");
  return { aviso: "Permissões atualizadas." };
}

const edicao = z.object({
  usuarioId: z.string().min(1),
  nome: z.string().trim().min(3, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  pessoaId: z.string().trim().optional(),
});

export async function editarUsuario(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const admin = await exigirAdmin();

  const analise = edicao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }

  const { usuarioId, nome, email, pessoaId } = analise.data;

  try {
    const alvo = await db.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, papel: true, email: true },
    });
    if (!alvo) throw new ErroDeNegocio("Conta não encontrada.");

    if (exigePessoaVinculada(alvo.papel) && !pessoaId) {
      throw new ErroDeNegocio(
        "Perfil de Interessado ou Procurador precisa estar vinculado a uma pessoa cadastrada."
      );
    }

    await db.usuario.update({
      where: { id: usuarioId },
      data: {
        nome,
        email: email.toLowerCase(),
        pessoaId: pessoaId || null,
      },
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "EDITOU_USUARIO",
      entidade: "Usuario",
      entidadeId: usuarioId,
      metadados: { de: alvo.email, para: email.toLowerCase() },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: "Já existe conta com este e-mail ou pessoa vinculada.", campo: "email" };
    }
    throw erro;
  }

  revalidatePath("/equipe");
  return { aviso: "Conta atualizada." };
}

const exclusao = z.object({ usuarioId: z.string().min(1) });

export async function excluirUsuario(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const admin = await exigirAdmin();

  const analise = exclusao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) return { erro: "Dados inválidos." };
  const { usuarioId } = analise.data;

  try {
    if (usuarioId === admin.id) {
      throw new ErroDeNegocio("Você não pode excluir a própria conta.");
    }

    const alvo = await db.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        papel: true,
        ativo: true,
        _count: {
          select: {
            atosCriados: true,
            eventos: true,
            auditoria: true,
            documentos: true,
            conferencias: true,
            termos: true,
            assinaturas: true,
          },
        },
      },
    });
    if (!alvo) throw new ErroDeNegocio("Conta não encontrada.");

    // Mesma trava de alterarPermissao: o sistema não pode ficar sem administrador.
    if (alvo.papel === Papel.ADMIN && alvo.ativo) {
      const outrosAdmins = await db.usuario.count({
        where: { papel: Papel.ADMIN, ativo: true, id: { not: usuarioId } },
      });
      if (outrosAdmins === 0) {
        throw new ErroDeNegocio("O sistema precisa de ao menos um administrador ativo.");
      }
    }

    // A maioria dos vínculos da conta (auditoria, documentos, eventos,
    // conferências, termos, assinaturas) é gravada com ON DELETE SET NULL: o
    // banco deixaria excluir mesmo assim, só que apagando quem fez o quê de
    // registro que é prova do procedimento. Só o Ato bloqueia sozinho
    // (ON DELETE RESTRICT); os demais são conferidos aqui, à mão.
    const temAtividade = Object.values(alvo._count).some((quantidade) => quantidade > 0);
    if (temAtividade) {
      throw new ErroDeNegocio(
        "Esta conta já tem histórico no sistema (atos, documentos ou auditoria) e não pode ser excluída — use Inativa."
      );
    }

    await db.usuario.delete({ where: { id: usuarioId } });

    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "EXCLUIU_USUARIO",
      entidade: "Usuario",
      entidadeId: usuarioId,
      metadados: { email: alvo.email, papel: alvo.papel },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003") {
      return {
        erro:
          "Esta conta já tem histórico no sistema (atos, documentos ou auditoria) e não pode ser excluída — use Inativa.",
      };
    }
    throw erro;
  }

  revalidatePath("/equipe");
  return { aviso: "Conta excluída." };
}

const novaSenhaDoUsuario = z.object({
  usuarioId: z.string().min(1),
  novaSenha: senhaForte,
});

/**
 * Troca a senha de outra conta pela tela de Equipe — pedido do cliente em
 * 21/09, para o administrador destravar quem perdeu a senha sem precisar do
 * console. Não mexe no segundo fator (redefinir 2FA é ação separada e
 * explícita) e desbloqueia a conta, que é o caso típico de quem errou a senha
 * demais.
 *
 * Recusa a própria conta: trocar a própria senha sem informar a atual seria um
 * caminho lateral para quem deixou a sessão aberta. Para isso existe o
 * "esqueci minha senha", que passa pelo e-mail da conta.
 */
export async function redefinirSenhaDeUsuario(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const admin = await exigirAdmin();

  const analise = novaSenhaDoUsuario.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }
  const { usuarioId, novaSenha } = analise.data;

  try {
    if (usuarioId === admin.id) {
      throw new ErroDeNegocio(
        "Para trocar a sua própria senha, use \"Esqueci minha senha\" na tela de login."
      );
    }

    const alvo = await db.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, email: true },
    });
    if (!alvo) throw new ErroDeNegocio("Conta não encontrada.");

    const senhaHash = await argon2.hash(novaSenha, { type: argon2.argon2id });

    await db.$transaction([
      db.usuario.update({
        where: { id: usuarioId },
        data: { senhaHash, tentativasFalhas: 0, bloqueadoAte: null },
      }),
      // link de "esqueci minha senha" ainda em aberto deixaria de valer: a
      // senha que o administrador definiu é a vigente
      db.redefinicaoDeSenha.updateMany({
        where: { usuarioId, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
    ]);

    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "REDEFINIU_SENHA",
      entidade: "Usuario",
      entidadeId: usuarioId,
      metadados: { email: alvo.email, origem: "administrador" },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }

  revalidatePath("/equipe");
  return { aviso: "Senha alterada. Informe a nova senha à pessoa por um canal seguro." };
}

const redefinicao2FA = z.object({ usuarioId: z.string().min(1) });

/**
 * Zera o segundo fator de outra conta pela tela, para quando o autenticador se
 * perdeu (celular trocado, app desinstalado). Antes disso só existia pelo
 * console (`scripts/recuperar-admin.cjs`) — decisão revista a pedido do
 * cliente, com o mesmo efeito: limpa o segredo e desliga a exigência até a
 * pessoa configurar de novo no próximo acesso.
 */
export async function redefinirSegundoFator(
  _anterior: EstadoDeFormulario,
  entrada: FormData
): Promise<EstadoDeFormulario> {
  const admin = await exigirAdmin();

  const analise = redefinicao2FA.safeParse(Object.fromEntries(entrada));
  if (!analise.success) return { erro: "Dados inválidos." };
  const { usuarioId } = analise.data;

  const alvo = await db.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, email: true },
  });
  if (!alvo) return { erro: "Conta não encontrada." };

  await db.usuario.update({
    where: { id: usuarioId },
    data: { totpSecret: null, totpAtivo: false },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    acao: "REDEFINIU_SEGUNDO_FATOR",
    entidade: "Usuario",
    entidadeId: usuarioId,
    metadados: { email: alvo.email },
  });

  revalidatePath("/equipe");
  return { aviso: "Segundo fator redefinido. A pessoa vai configurar de novo no próximo acesso." };
}
