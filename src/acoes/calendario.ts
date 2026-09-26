"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { instanteDe, motivoDoDiaBloqueado } from "@/lib/agenda";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ErroDeNegocio } from "@/lib/erros";
import { exigirAdmin } from "@/lib/sessao";

export type EstadoDoCalendario = { erro?: string; aviso?: string };

const inclusao = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  descricao: z.string().trim().min(3, "Diga o motivo, para a equipe entender o bloqueio.").max(120),
});

/**
 * Bloqueia um dia da agenda além dos feriados e pontos facultativos nacionais:
 * feriado municipal, recesso, dia de manutenção. Só o administrador decide.
 *
 * Não cancela nem move sessão já marcada nesse dia — só avisa quantas há, para
 * a equipe remarcar pelo calendário. Mexer em sessão de terceiro sem avisar
 * seria pior que o dia bloqueado.
 */
export async function adicionarDiaSemSessao(
  _anterior: EstadoDoCalendario,
  entrada: FormData
): Promise<EstadoDoCalendario> {
  const admin = await exigirAdmin();

  const analise = inclusao.safeParse(Object.fromEntries(entrada));
  if (!analise.success) return { erro: analise.error.issues[0]?.message ?? "Dados inválidos." };
  const { data, descricao } = analise.data;

  try {
    if (Number.isNaN(new Date(`${data}T12:00:00Z`).getTime())) {
      throw new ErroDeNegocio("Data inválida.");
    }
    const jaBloqueado = motivoDoDiaBloqueado(data);
    if (jaBloqueado) {
      throw new ErroDeNegocio(`Este dia já não tem sessão: ${jaBloqueado}.`);
    }

    await db.diaSemSessao.create({ data: { data: new Date(`${data}T00:00:00Z`), descricao } });
    await registrarAuditoria({
      usuarioId: admin.id,
      acao: "ALTEROU_CALENDARIO",
      entidade: "DiaSemSessao",
      metadados: { evento: "BLOQUEOU", data, descricao },
    });

    const inicio = instanteDe(data, 0);
    const fim = new Date(inicio.getTime() + 24 * 60 * 60_000);
    const jaMarcadas = await db.ato.count({
      where: {
        status: { notIn: ["CANCELADO", "REDESIGNADA"] },
        OR: [
          { dataConfirmada: { gte: inicio, lt: fim } },
          { dataConfirmada: null, dataReservada: { gte: inicio, lt: fim } },
        ],
      },
    });

    revalidatePath("/calendario");
    return {
      aviso:
        jaMarcadas > 0
          ? `Dia bloqueado. Atenção: há ${jaMarcadas} sessão(ões) já marcada(s) nele — remarque pelo calendário.`
          : "Dia bloqueado.",
    };
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return { erro: erro.message };
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { erro: "Este dia já está bloqueado." };
    }
    throw erro;
  }
}

export async function removerDiaSemSessao(entrada: FormData): Promise<void> {
  const admin = await exigirAdmin();

  const id = String(entrada.get("id") ?? "");
  if (!id) throw new ErroDeNegocio("Dia não informado.");

  const dia = await db.diaSemSessao.findUnique({ where: { id } });
  if (!dia) return;

  await db.diaSemSessao.delete({ where: { id } });
  await registrarAuditoria({
    usuarioId: admin.id,
    acao: "ALTEROU_CALENDARIO",
    entidade: "DiaSemSessao",
    entidadeId: id,
    metadados: {
      evento: "LIBEROU",
      data: dia.data.toISOString().slice(0, 10),
      descricao: dia.descricao,
    },
  });

  revalidatePath("/calendario");
}
