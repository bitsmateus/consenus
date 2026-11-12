/**
 * Recebe os avisos da ZapSign sobre a assinatura eletrônica.
 *
 * Rota sem sessão — quem chama é o servidor da ZapSign. O aviso dela NÃO é
 * assinado (não há HMAC), então a porta se segura em duas camadas:
 *
 *   1. um token secreto no caminho da URL (ZAPSIGN_WEBHOOK_TOKEN), cadastrado
 *      no painel da ZapSign junto com o endereço;
 *   2. a principal: do corpo só se lê QUAL documento. O estado (quem assinou,
 *      se terminou, o PDF) vem da API da ZapSign, autenticada, pelo token que
 *      já estava gravado aqui. Ver src/lib/retorno-da-zapsign.ts.
 *
 * Responder 5xx em falha técnica é proposital: a ZapSign reenvia o que não
 * recebeu 200, e o documento acaba arquivado sozinho.
 */
import { NextResponse } from "next/server";
import { ProvedorAssinatura, StatusAssinatura, TipoEvento } from "@prisma/client";
import { db } from "@/lib/db";
import { sincronizarEnvioDaZapSign } from "@/lib/retorno-da-zapsign";
import { lerAviso, tokenDoWebhookConfere } from "@/lib/zapsign";

export async function POST(
  requisicao: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!tokenDoWebhookConfere(token)) {
    console.warn("[assinatura] webhook da ZapSign recusado: token do caminho não confere");
    return NextResponse.json({ erro: "não autorizado" }, { status: 404 });
  }

  let corpo: unknown;
  try {
    corpo = await requisicao.json();
  } catch {
    return NextResponse.json({ erro: "corpo ilegível" }, { status: 400 });
  }

  const aviso = lerAviso(corpo);
  if (!aviso) return NextResponse.json({ erro: "aviso sem documento" }, { status: 400 });

  const envio = await db.operacaoAssinatura.findUnique({
    where: { identificadorExterno: aviso.tokenDoDocumento },
    select: {
      id: true,
      atoId: true,
      identificadorExterno: true,
      status: true,
      totalSignatarios: true,
      provedor: true,
    },
  });

  // documento que não é nosso (a conta da ZapSign pode ter outros usos) ou
  // aviso de criação que chegou antes de o envio ser gravado: aceita e ignora
  if (!envio || envio.provedor !== ProvedorAssinatura.ZAPSIGN) {
    return NextResponse.json({ ok: true, desconhecido: true });
  }

  try {
    if (aviso.evento === "email_bounce") {
      await db.eventoAto.create({
        data: {
          atoId: envio.atoId,
          tipo: TipoEvento.OBSERVACAO,
          descricao:
            "Um convite de assinatura não pôde ser entregue por e-mail. Confira os e-mails no cadastro.",
        },
      });
    }

    const resultado = await sincronizarEnvioDaZapSign(envio);
    return NextResponse.json({ ok: true, resultado });
  } catch (erro) {
    console.error("[assinatura] falha ao processar aviso da ZapSign", envio.id, erro);
    await db.operacaoAssinatura.update({
      where: { id: envio.id },
      data: {
        // só marca falha onde ainda há o que fazer; não reabre o encerrado
        ...(envio.status === StatusAssinatura.ARQUIVADA || envio.status === StatusAssinatura.CANCELADA
          ? {}
          : { status: StatusAssinatura.FALHOU }),
        ultimoErro: erro instanceof Error ? erro.message.slice(0, 500) : "erro desconhecido",
      },
    });
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}
