"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import argon2 from "argon2";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { emailAtivo, enviarEmail } from "@/lib/email";
import { ErroDeNegocio } from "@/lib/erros";
import { aguardarTempoConstante, registrarConsulta } from "@/lib/limite-de-taxa";
import {
  JANELA_DE_PEDIDOS_MINUTOS,
  MAXIMO_DE_PEDIDOS_NA_JANELA,
  MINUTOS_DE_VALIDADE,
  gerarToken,
  hashDoToken,
  montarLink,
  validoAte,
} from "@/lib/redefinicao-de-senha";
import { senhaForte } from "@/lib/senha";

export type EstadoDeRedefinicao = { erro?: string; aviso?: string; campo?: string };

const RESPOSTA_PADRAO =
  "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. " +
  `Ele vale por ${MINUTOS_DE_VALIDADE} minutos e só pode ser usado uma vez.`;

const pedido = z.object({ email: z.string().trim().email("Informe um e-mail válido.") });

/**
 * "Esqueci minha senha", passo 1: manda o link para o e-mail da conta.
 *
 * A resposta é a mesma exista ou não a conta, e leva o mesmo tempo mínimo: esta
 * tela é pública, e distinguir os dois casos entregaria a lista de e-mails que
 * têm acesso ao sistema. O segundo fator NÃO é tocado aqui nem no passo 2:
 * quem tem o e-mail mas não o autenticador continua sem conseguir entrar.
 */
export async function solicitarRedefinicao(
  _anterior: EstadoDeRedefinicao,
  entrada: FormData
): Promise<EstadoDeRedefinicao> {
  const inicio = Date.now();

  const analise = pedido.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    return { erro: analise.error.issues[0]?.message ?? "Dados inválidos.", campo: "email" };
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
  const veredito = registrarConsulta(`esqueci-senha:${ip}`);
  if (!veredito.permitido) {
    return { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  if (!emailAtivo()) {
    return {
      erro:
        "O envio de e-mail não está configurado neste ambiente. " +
        "Peça a um administrador para redefinir a sua senha pela tela de Equipe.",
    };
  }

  const email = analise.data.email.toLowerCase();
  const usuario = await db.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, email: true, ativo: true },
  });

  if (usuario?.ativo) {
    const agora = new Date();
    const recentes = await db.redefinicaoDeSenha.count({
      where: {
        usuarioId: usuario.id,
        criadoEm: { gt: new Date(agora.getTime() - JANELA_DE_PEDIDOS_MINUTOS * 60_000) },
      },
    });

    // acima do limite, cala: quem está lotando a caixa dos outros não ganha
    // sinal nenhum de que a conta existe
    if (recentes < MAXIMO_DE_PEDIDOS_NA_JANELA) {
      const token = gerarToken();

      await db.$transaction([
        // só o link mais recente vale
        db.redefinicaoDeSenha.updateMany({
          where: { usuarioId: usuario.id, usadoEm: null },
          data: { usadoEm: agora },
        }),
        db.redefinicaoDeSenha.create({
          data: { usuarioId: usuario.id, tokenHash: hashDoToken(token), expiraEm: validoAte(agora) },
        }),
      ]);

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "SOLICITOU_REDEFINICAO_SENHA",
        entidade: "Usuario",
        entidadeId: usuario.id,
      });

      const link = montarLink(process.env.AUTH_URL ?? "http://localhost:3000", token);
      try {
        await enviarEmail({
          para: usuario.email,
          assunto: "Redefinição de senha — Consensus One",
          texto:
            `Olá, ${usuario.nome}.\n\n` +
            `Recebemos um pedido para redefinir a senha da sua conta no sistema da Consensus One. ` +
            `Para escolher uma nova senha, abra o link abaixo (vale por ${MINUTOS_DE_VALIDADE} minutos e só pode ser usado uma vez):\n\n` +
            `${link}\n\n` +
            `Se não foi você, ignore esta mensagem: a sua senha continua a mesma.`,
          html:
            `<p>Olá, ${escaparHtml(usuario.nome)}.</p>` +
            `<p>Recebemos um pedido para redefinir a senha da sua conta no sistema da Consensus One. ` +
            `Para escolher uma nova senha, use o link abaixo (vale por ${MINUTOS_DE_VALIDADE} minutos e só pode ser usado uma vez):</p>` +
            `<p><a href="${link}">Redefinir minha senha</a></p>` +
            `<p>Se não foi você, ignore esta mensagem: a sua senha continua a mesma.</p>`,
        });
      } catch (erro) {
        // não vaza para a tela: a resposta segue idêntica. O operador vê no
        // log do servidor que o SMTP falhou.
        console.error("[redefinicao-de-senha] falha ao enviar o e-mail", erro);
      }
    }
  }

  await aguardarTempoConstante(inicio, 800);
  return { aviso: RESPOSTA_PADRAO };
}

const redefinicao = z.object({
  token: z.string().min(1),
  novaSenha: senhaForte,
  confirmacao: z.string(),
});

/** "Esqueci minha senha", passo 2: troca a senha pelo link recebido. */
export async function redefinirSenha(
  _anterior: EstadoDeRedefinicao,
  entrada: FormData
): Promise<EstadoDeRedefinicao> {
  const analise = redefinicao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) {
    const primeiro = analise.error.issues[0];
    return { erro: primeiro?.message ?? "Dados inválidos.", campo: String(primeiro?.path[0] ?? "") };
  }
  const { token, novaSenha, confirmacao } = analise.data;

  if (novaSenha !== confirmacao) {
    return { erro: "As senhas não conferem.", campo: "confirmacao" };
  }

  const LINK_INVALIDO = "Este link é inválido ou expirou. Solicite um novo em \"Esqueci minha senha\".";
  let usuarioId: string;

  try {
    const registro = await db.redefinicaoDeSenha.findUnique({
      where: { tokenHash: hashDoToken(token) },
      select: { id: true, usuarioId: true, usadoEm: true, expiraEm: true, usuario: { select: { ativo: true } } },
    });
    if (!registro || registro.usadoEm || registro.expiraEm <= new Date() || !registro.usuario.ativo) {
      throw new ErroDeNegocio(LINK_INVALIDO);
    }
    usuarioId = registro.usuarioId;

    const senhaHash = await argon2.hash(novaSenha, { type: argon2.argon2id });

    await db.$transaction(async (tx) => {
      const agora = new Date();
      // marca como usado ANTES de trocar a senha, e só se ainda estiver livre:
      // dois envios simultâneos do mesmo link não passam os dois
      const consumido = await tx.redefinicaoDeSenha.updateMany({
        where: { id: registro.id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      });
      if (consumido.count !== 1) throw new ErroDeNegocio(LINK_INVALIDO);

      await tx.usuario.update({
        where: { id: registro.usuarioId },
        // trocar a senha desbloqueia a conta: quem esqueceu a senha costuma
        // ter errado demais antes. O segundo fator não é tocado.
        data: { senhaHash, tentativasFalhas: 0, bloqueadoAte: null },
      });
      await tx.redefinicaoDeSenha.updateMany({
        where: { usuarioId: registro.usuarioId, usadoEm: null },
        data: { usadoEm: agora },
      });
    });

    await registrarAuditoria({
      usuarioId,
      acao: "REDEFINIU_SENHA",
      entidade: "Usuario",
      entidadeId: usuarioId,
      metadados: { origem: "link-por-email" },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    throw erro;
  }

  // fora do try: redirect() sinaliza por exceção
  redirect("/entrar?redefinida=1");
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
