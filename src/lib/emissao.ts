/**
 * Emissão de documento pela esteira.
 *
 * Reúne num lugar só o que as quatro emissões têm em comum — carta ao
 * Solicitante, carta ao Convidado, ata e termo de acordo: reservar o código,
 * desenhar o QR Code, gerar o PDF com o timbrado, guardar no object storage e
 * registrar o documento.
 *
 * A ordem importa: o código é impresso dentro do PDF, então precisa existir
 * antes da geração. Se outro processo levar o mesmo código no meio do caminho,
 * o índice único do banco recusa e a emissão recomeça com o próximo — nunca
 * dois documentos com o mesmo número.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { Prisma, TipoDocumento } from "@prisma/client";
import { db } from "./db";
import { ErroDeNegocio } from "./erros";
import { gerarPdf } from "./pdf";
import { FUSO } from "./prazos";
import { proximoCodigoDeDocumento } from "./sequencial-documento";
import { enviarArquivo, montarChave } from "./storage";
import type { TipoComCodigo } from "./codigo-documento";
import { cabecalho, rodape } from "@/documentos/timbrado";

const TENTATIVAS = 5;

/** Logotipo embutido: o Chromium do servidor não busca arquivo por URL. */
async function logoEmBase64(): Promise<string> {
  try {
    const arquivo = path.join(process.cwd(), "public", "marca", "logo-consensus-one.png");
    return `data:image/png;base64,${(await readFile(arquivo)).toString("base64")}`;
  } catch {
    // documento sem logotipo ainda é válido; a ausência não trava a emissão
    return "";
  }
}

export async function urlDeVerificacao(): Promise<string> {
  const registro = await db.configuracaoSistema.findUnique({ where: { id: 1 } });
  return (
    registro?.urlVerificacao ??
    process.env.NEXT_PUBLIC_URL_VERIFICACAO ??
    "https://consensusone.com.br/verificar"
  );
}

export type ResultadoDaEmissao = { documentoId: string; codigo: string };

export async function emitirDocumento(params: {
  atoId: string;
  tipo: TipoComCodigo;
  pasta: string;
  usuarioId: string;
  /** Recebe o código já reservado e devolve o HTML do documento. */
  montarHtml: (codigo: string) => string;
  /** Roda dentro da mesma transação que cria o documento. */
  aoRegistrar?: (tx: Prisma.TransactionClient, codigo: string) => Promise<void>;
}): Promise<ResultadoDaEmissao> {
  const url = await urlDeVerificacao();
  const logo = await logoEmBase64();
  const ano = Number(
    new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: FUSO }).format(new Date())
  );

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const codigo = await db.$transaction((tx) =>
      proximoCodigoDeDocumento(tx, params.tipo, ano)
    );

    const qr = await QRCode.toDataURL(`${url}?codigo=${encodeURIComponent(codigo)}`, {
      margin: 0,
      width: 240,
    });

    const pdf = await gerarPdf({
      html: params.montarHtml(codigo),
      cabecalho: cabecalho(logo),
      rodape: rodape({ codigo, qrDataUri: qr, urlVerificacao: url }),
    });

    const nomeArquivo = `${codigo}.pdf`;
    const guardado = await enviarArquivo({
      chave: montarChave(params.atoId, params.pasta, nomeArquivo),
      conteudo: pdf,
      mimeType: "application/pdf",
    });

    try {
      const documento = await db.$transaction(async (tx) => {
        const criado = await tx.documento.create({
          data: {
            atoId: params.atoId,
            tipo: params.tipo as TipoDocumento,
            codigoVerificacao: codigo,
            emitidoPelaCamara: true,
            nomeArquivo,
            chaveStorage: guardado.chave,
            mimeType: "application/pdf",
            tamanhoBytes: guardado.tamanhoBytes,
            hashSha256: guardado.hashSha256,
            enviadoPorId: params.usuarioId,
          },
        });
        await params.aoRegistrar?.(tx, codigo);
        return criado;
      });

      return { documentoId: documento.id, codigo };
    } catch (erro) {
      const colisao =
        erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
      if (colisao && tentativa < TENTATIVAS) continue;
      throw erro;
    }
  }

  throw new ErroDeNegocio("Não foi possível gerar o código do documento. Tente novamente.");
}
