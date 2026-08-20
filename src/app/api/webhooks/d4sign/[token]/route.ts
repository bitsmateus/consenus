/**
 * Recebe os avisos da D4Sign sobre a assinatura eletrônica.
 *
 * É a ÚNICA rota do sistema que aceita requisição sem sessão de usuário — quem
 * chama é o servidor da D4Sign. Três camadas seguram a porta:
 *
 *   1. um token secreto no caminho da URL, que só nós e a D4Sign conhecemos;
 *   2. o `Content-Hmac`, que a D4Sign calcula sobre o UUID do documento;
 *   3. o mais importante: NADA do que chega no aviso vira conteúdo. O aviso é
 *      só um gatilho. O documento assinado é buscado na API da D4Sign, com
 *      autenticação, pelo UUID que já estava gravado aqui. Aviso forjado, na
 *      pior das hipóteses, faz o sistema reconferir algo que já é dele.
 *
 * A camada 2 é fraca por desenho da D4Sign: como o hash é do UUID e não do
 * corpo, ele não muda, e um aviso capturado pode ser repetido. É por isso que
 * a camada 3 existe, e é nela que a segurança de fato se apoia.
 *
 * O aviso é aceito tanto em form-data quanto em JSON: a D4Sign tem um botão no
 * painel que alterna entre os dois, e não vale deixar o retorno das assinaturas
 * na dependência de ninguém clicar nele.
 *
 * Responder 5xx é proposital em falha técnica: a D4Sign reenvia (até 7 vezes,
 * ao longo de ~27 horas) e o documento acaba arquivado sozinho. Responder 200
 * escondendo o erro perderia o aviso para sempre.
 */
import { NextResponse } from "next/server";
import { StatusAssinatura, TipoDocumento, TipoEvento } from "@prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { AVISO, avisoAutentico, baixarAssinado, tokenDoWebhookConfere } from "@/lib/d4sign";
import { enviarArquivo, montarChave } from "@/lib/storage";

export async function POST(
  requisicao: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!tokenDoWebhookConfere(token)) {
    console.warn("[assinatura] webhook recusado: token do caminho não confere");
    return NextResponse.json({ erro: "não autorizado" }, { status: 404 });
  }

  const campos = await lerCampos(requisicao);
  if (!campos) return NextResponse.json({ erro: "corpo ilegível" }, { status: 400 });

  const uuid = campos.uuid;
  const tipoDoAviso = campos.type_post;
  const emailDoSignatario = campos.email || null;

  if (!uuid || !tipoDoAviso) {
    return NextResponse.json({ erro: "aviso sem documento" }, { status: 400 });
  }
  if (!avisoAutentico(uuid, requisicao.headers.get("content-hmac"))) {
    console.warn("[assinatura] webhook recusado: Content-Hmac inválido");
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  // o signatário entra na chave porque o aviso de assinatura dispara uma vez
  // por pessoa, todos com o mesmo UUID de documento
  const chave = `${uuid}:${tipoDoAviso}:${emailDoSignatario ?? "-"}`;
  if (await db.webhookAssinatura.findUnique({ where: { chave } })) {
    return NextResponse.json({ ok: true, repetido: true });
  }

  const operacao = await db.operacaoAssinatura.findUnique({
    where: { identificadorExterno: uuid },
  });

  // documento que não é nosso: aceita e ignora, para a D4Sign parar de reenviar
  if (!operacao) {
    await registrarAviso(chave, uuid, tipoDoAviso);
    return NextResponse.json({ ok: true, desconhecido: true });
  }

  try {
    if (tipoDoAviso === AVISO.ASSINADO) {
      await registrarUmaAssinatura(operacao.id, operacao.atoId, operacao.jaAssinaram, emailDoSignatario);
    } else if (tipoDoAviso === AVISO.FINALIZADO) {
      await arquivarAssinado(operacao.id);
    } else if (tipoDoAviso === AVISO.CANCELADO) {
      await registrarCancelamento(operacao.id, operacao.atoId);
    } else if (tipoDoAviso === AVISO.EMAIL_NAO_ENVIADO) {
      await registrarEmailNaoEntregue(operacao.atoId, emailDoSignatario);
    }
  } catch (erro) {
    console.error("[assinatura] falha ao processar aviso", chave, erro);
    await db.operacaoAssinatura.update({
      where: { id: operacao.id },
      data: {
        status: StatusAssinatura.FALHOU,
        ultimoErro: erro instanceof Error ? erro.message.slice(0, 500) : "erro desconhecido",
      },
    });
    // 5xx de propósito: a D4Sign reenvia e a próxima tentativa pode dar certo
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }

  // registrado só DEPOIS do sucesso: se marcássemos antes, uma falha aqui
  // faria o reenvio ser descartado como repetido e o documento nunca chegaria
  await registrarAviso(chave, uuid, tipoDoAviso);
  return NextResponse.json({ ok: true });
}

/**
 * Lê os campos do aviso, venha ele como form-data ou como JSON.
 *
 * A D4Sign manda form-data por padrão, mas o painel tem um botão "Alterar para
 * json" ao lado dessa configuração. Aceitar os dois custa dez linhas e evita
 * que um clique de alguém no painel derrube o retorno das assinaturas sem
 * ninguém entender por quê.
 */
async function lerCampos(
  requisicao: Request
): Promise<{ uuid: string; type_post: string; email: string } | null> {
  const tipo = requisicao.headers.get("content-type") ?? "";

  try {
    if (tipo.includes("application/json")) {
      const corpo = (await requisicao.json()) as Record<string, unknown>;
      return {
        uuid: String(corpo.uuid ?? ""),
        type_post: String(corpo.type_post ?? ""),
        email: String(corpo.email ?? ""),
      };
    }

    const formulario = await requisicao.formData();
    return {
      uuid: String(formulario.get("uuid") ?? ""),
      type_post: String(formulario.get("type_post") ?? ""),
      email: String(formulario.get("email") ?? ""),
    };
  } catch {
    return null;
  }
}

async function registrarAviso(chave: string, identificadorExterno: string, tipoDoAviso: string) {
  await db.webhookAssinatura
    .create({ data: { chave, identificadorExterno, tipoDoAviso } })
    // corrida entre dois reenvios simultâneos: o segundo perde e tudo bem
    .catch(() => undefined);
}

async function registrarUmaAssinatura(
  operacaoId: string,
  atoId: string,
  jaAssinaram: number,
  email: string | null
) {
  await db.$transaction(async (tx) => {
    const atualizada = await tx.operacaoAssinatura.update({
      where: { id: operacaoId },
      data: { jaAssinaram: jaAssinaram + 1, status: StatusAssinatura.PARCIAL },
    });
    await tx.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.ASSINATURA_REGISTRADA,
        descricao: email
          ? `Assinatura eletrônica registrada: ${email} (${atualizada.jaAssinaram} de ${atualizada.totalSignatarios}).`
          : `Assinatura eletrônica registrada (${atualizada.jaAssinaram} de ${atualizada.totalSignatarios}).`,
      },
    });
  });
}

async function registrarCancelamento(operacaoId: string, atoId: string) {
  await db.$transaction(async (tx) => {
    await tx.operacaoAssinatura.update({
      where: { id: operacaoId },
      data: { status: StatusAssinatura.CANCELADA },
    });
    await tx.eventoAto.create({
      data: {
        atoId,
        tipo: TipoEvento.ASSINATURA_CANCELADA,
        descricao: "A assinatura eletrônica do documento foi cancelada.",
      },
    });
  });
}

/**
 * E-mail que não chegou ao signatário.
 *
 * Não é falha nossa nem da D4Sign: quase sempre é endereço errado no cadastro.
 * Vale um evento na linha do tempo porque, sem ele, o procedimento ficaria
 * parado esperando uma assinatura que nunca foi convidada.
 */
async function registrarEmailNaoEntregue(atoId: string, email: string | null) {
  await db.eventoAto.create({
    data: {
      atoId,
      tipo: TipoEvento.OBSERVACAO,
      descricao: email
        ? `O convite de assinatura não chegou a ${email}. Confira o endereço no cadastro.`
        : "Um convite de assinatura não pôde ser entregue. Confira os e-mails no cadastro.",
    },
  });
}

/**
 * Baixa o PDF assinado e o guarda no nosso repositório.
 *
 * Enquanto isso não acontece, o documento assinado só existe na D4Sign — e o
 * acervo da câmara não pode depender de terceiro. O assinado entra como
 * documento novo, do tipo DOCUMENTO_ASSINADO: o original emitido continua
 * intacto, com seu código de verificação.
 */
async function arquivarAssinado(operacaoId: string) {
  const operacao = await db.operacaoAssinatura.findUniqueOrThrow({
    where: { id: operacaoId },
    include: { documento: { select: { tipo: true, nomeArquivo: true } } },
  });

  // já arquivado: reenvio da D4Sign não duplica documento
  if (operacao.assinadoId) return;

  const { conteudo } = await baixarAssinado(operacao.identificadorExterno);

  const nomeArquivo = operacao.documento.nomeArquivo.replace(/\.pdf$/i, "") + "-assinado.pdf";
  const chaveStorage = montarChave(
    operacao.atoId,
    TipoDocumento.DOCUMENTO_ASSINADO.toLowerCase(),
    nomeArquivo
  );
  const guardado = await enviarArquivo({ chave: chaveStorage, conteudo, mimeType: "application/pdf" });

  const frase =
    operacao.documento.tipo === TipoDocumento.ATA
      ? "Ata assinada eletronicamente"
      : "Termo de Acordo assinado eletronicamente";

  const assinado = await db.$transaction(async (tx) => {
    const criado = await tx.documento.create({
      data: {
        atoId: operacao.atoId,
        tipo: TipoDocumento.DOCUMENTO_ASSINADO,
        // anexo não recebe código: o código é do documento emitido pela esteira
        codigoVerificacao: null,
        emitidoPelaCamara: false,
        nomeArquivo,
        chaveStorage: guardado.chave,
        mimeType: "application/pdf",
        tamanhoBytes: guardado.tamanhoBytes,
        hashSha256: guardado.hashSha256,
      },
    });
    await tx.operacaoAssinatura.update({
      where: { id: operacao.id },
      data: {
        status: StatusAssinatura.ARQUIVADA,
        assinadoId: criado.id,
        concluidaEm: new Date(),
        ultimoErro: null,
      },
    });
    await tx.eventoAto.create({
      data: {
        atoId: operacao.atoId,
        tipo: TipoEvento.DOCUMENTO_ASSINADO_ANEXADO,
        descricao: `${frase} e arquivado automaticamente no repositório da câmara.`,
        metadados: { hash: guardado.hashSha256 },
      },
    });
    return criado;
  });

  await registrarAuditoria({
    usuarioId: null,
    acao: "ARQUIVOU_ASSINADO",
    entidade: "Documento",
    entidadeId: assinado.id,
    metadados: {
      atoId: operacao.atoId,
      origem: "webhook D4Sign",
      hash: guardado.hashSha256,
    },
  });
}
