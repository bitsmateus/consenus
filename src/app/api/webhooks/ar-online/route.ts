/**
 * Recebe os avisos de status da AR Online sobre a Carta-Convite.
 *
 * Como o da D4Sign, é rota sem sessão de usuário — quem chama é o servidor
 * deles. E vale aqui o mesmo princípio, que é o que de fato segura a porta:
 * **nada do que chega no aviso vira conteúdo**. O aviso é só um gatilho. O
 * laudo é buscado na API da AR Online, autenticado, pelo protocolo que já
 * estava gravado aqui. Aviso forjado, na pior das hipóteses, faz o sistema
 * reconferir algo que já é dele.
 *
 * A autenticação é fraca por desenho da AR Online: um valor fixo no header
 * `Authorization`, combinado com o suporte deles. Não há assinatura do corpo,
 * então o valor não prova nada sobre a mensagem — só barra chamada aleatória.
 *
 * Responder 5xx em falha técnica é proposital: erro devolvido faz a AR Online
 * reenviar. Responder 2xx escondendo o problema perderia o aviso para sempre.
 * O timeout deles é de 15 segundos.
 */
import { NextResponse } from "next/server";
import { StatusEnvio, TipoDocumento, TipoEvento } from "@prisma/client";
import { avisoAutentico, baixarLaudo, statusIndicaEntrega } from "@/lib/ar-online";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { calcularHash, enviarArquivo, montarChave } from "@/lib/storage";

/** O aviso vem em duas versões; as duas trazem o id e uma descrição de status. */
type Aviso = {
  notificationID?: string;
  channel?: string;
  description?: string;
  status?: string;
  dateDelivery?: string;
};

export async function POST(requisicao: Request) {
  if (!avisoAutentico(requisicao.headers.get("authorization"))) {
    console.warn("[ar-online] webhook recusado: Authorization não confere");
    return NextResponse.json({ erro: "não autorizado" }, { status: 404 });
  }

  let aviso: Aviso;
  try {
    aviso = (await requisicao.json()) as Aviso;
  } catch {
    return NextResponse.json({ erro: "corpo ilegível" }, { status: 400 });
  }

  const protocolo = aviso.notificationID;
  if (!protocolo) return NextResponse.json({ erro: "sem notificationID" }, { status: 400 });

  const envio = await db.envio.findUnique({
    where: { protocoloExterno: protocolo },
    select: { id: true, atoId: true, entregueEm: true, comprovanteId: true },
  });

  // protocolo desconhecido não é erro nosso: a conta da AR Online pode ser
  // usada por outros sistemas do cliente. Aceitar evita reenvio eterno.
  if (!envio) {
    console.info("[ar-online] aviso de protocolo desconhecido:", protocolo);
    return NextResponse.json({ ok: true });
  }

  const descricao = aviso.status ?? aviso.description ?? null;
  const entregue = statusIndicaEntrega(descricao);

  await db.envio.update({
    where: { id: envio.id },
    data: {
      statusExterno: descricao,
      ...(entregue
        ? {
            status: StatusEnvio.ENTREGUE,
            entregueEm: envio.entregueEm ?? new Date(),
          }
        : {}),
    },
  });

  await db.eventoAto.create({
    data: {
      atoId: envio.atoId,
      tipo: TipoEvento.OBSERVACAO,
      descricao: `AR digital: ${descricao ?? "status atualizado"}${
        aviso.channel ? ` (${aviso.channel})` : ""
      }.`,
    },
  });

  // Entregue e ainda sem laudo arquivado: busca na API e guarda no procedimento.
  // É este arquivo que o docs/02 manda anexar ao ato.
  if (entregue && !envio.comprovanteId) {
    try {
      await arquivarLaudo(envio.id, envio.atoId, protocolo);
    } catch (erro) {
      console.error("[ar-online] falha ao arquivar o laudo", protocolo, erro);
      // 5xx: a AR Online reenvia e o laudo acaba arquivado sozinho
      return NextResponse.json({ erro: "falha ao arquivar o laudo" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}

async function arquivarLaudo(envioId: string, atoId: string, protocolo: string): Promise<void> {
  const pdf = await baixarLaudo(protocolo);

  const nomeArquivo = `laudo-ar-${protocolo}.pdf`;
  const chave = montarChave(atoId, TipoDocumento.LAUDO_AR, nomeArquivo);

  await enviarArquivo({ chave, conteudo: pdf, mimeType: "application/pdf" });

  const documento = await db.documento.create({
    data: {
      atoId,
      tipo: TipoDocumento.LAUDO_AR,
      nomeArquivo,
      chaveStorage: chave,
      mimeType: "application/pdf",
      tamanhoBytes: pdf.length,
      hashSha256: calcularHash(pdf),
      emitidoPelaCamara: false,
    },
  });

  await db.envio.update({
    where: { id: envioId },
    data: { comprovanteId: documento.id },
  });

  await db.eventoAto.create({
    data: {
      atoId,
      tipo: TipoEvento.DOCUMENTO_RECEBIDO,
      descricao: "Laudo de AR arquivado automaticamente pela AR Online.",
    },
  });

  await registrarAuditoria({
    usuarioId: null,
    acao: "ARQUIVOU_ASSINADO",
    entidade: "Documento",
    entidadeId: documento.id,
    metadados: { origem: "ar-online", protocolo },
    semIdentificacao: true,
  });
}
