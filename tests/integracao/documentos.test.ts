/**
 * Sequencial do código de documento contra o banco.
 *
 * O ponto central: as duas cartas convite dividem a sigla CC e precisam dividir
 * a mesma sequência. Contar por TipoDocumento faria a carta ao Convidado repetir
 * o código da carta ao Solicitante — e o índice único rejeitaria na hora de
 * emitir, no meio do fluxo do operador.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Papel, PapelNoAto, StatusAto, TipoDocumento, TipoPessoa } from "@prisma/client";
import { db } from "@/lib/db";
import { proximoCodigoDeDocumento } from "@/lib/sequencial-documento";

const MARCA = `d${process.pid}${Date.now()}`.slice(-12);
const ANO = 2098;

const criados = { atos: [] as string[], pessoas: [] as string[], usuarios: [] as string[] };
let atoId: string;

async function criarDocumento(tipo: TipoDocumento, codigo: string | null) {
  return db.documento.create({
    data: {
      atoId,
      tipo,
      codigoVerificacao: codigo,
      emitidoPelaCamara: codigo !== null,
      nomeArquivo: `${codigo ?? "anexo"}.pdf`,
      chaveStorage: `atos/${atoId}/${codigo ?? MARCA}.pdf`,
      mimeType: "application/pdf",
      tamanhoBytes: 1024,
      hashSha256: "0".repeat(64),
    },
  });
}

beforeAll(async () => {
  const operador = await db.usuario.create({
    data: {
      nome: `Operador ${MARCA}`,
      email: `doc.${MARCA}@exemplo.test`,
      senhaHash: "nao-usado",
      papel: Papel.OPERADOR,
    },
  });
  criados.usuarios.push(operador.id);

  const pessoa = await db.pessoa.create({
    data: { tipo: TipoPessoa.FISICA, nome: `Interessado ${MARCA}`, documento: `${MARCA}9` },
  });
  criados.pessoas.push(pessoa.id);

  const ato = await db.ato.create({
    data: {
      numero: `${ANO}.9001`,
      status: StatusAto.RASCUNHO,
      criadoPorId: operador.id,
      partes: { create: [{ pessoaId: pessoa.id, papel: PapelNoAto.SOLICITANTE }] },
    },
  });
  atoId = ato.id;
  criados.atos.push(ato.id);
});

afterAll(async () => {
  await db.ato.deleteMany({ where: { id: { in: criados.atos } } });
  await db.pessoa.deleteMany({ where: { id: { in: criados.pessoas } } });
  await db.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
  await db.$disconnect();
});

describe("sequencial do código de documento", () => {
  it("começa em 000001 na sigla sem documento no ano", async () => {
    const codigo = await db.$transaction((tx) =>
      proximoCodigoDeDocumento(tx, "CARTA_CONVITE_SOLICITANTE", ANO)
    );
    expect(codigo).toBe(`CO-CC-${ANO}-000001`);
  });

  it("a carta ao Convidado continua a sequência da carta ao Solicitante", async () => {
    await criarDocumento(TipoDocumento.CARTA_CONVITE_SOLICITANTE, `CO-CC-${ANO}-000001`);

    const codigo = await db.$transaction((tx) =>
      proximoCodigoDeDocumento(tx, "CARTA_CONVITE_CONVIDADO", ANO)
    );

    // se contasse por tipo, voltaria 000001 e o banco rejeitaria na criação
    expect(codigo).toBe(`CO-CC-${ANO}-000002`);
  });

  it("o banco recusa código repetido", async () => {
    await expect(
      criarDocumento(TipoDocumento.CARTA_CONVITE_CONVIDADO, `CO-CC-${ANO}-000001`)
    ).rejects.toThrow();
  });

  it("cada sigla tem a própria sequência", async () => {
    await criarDocumento(TipoDocumento.CARTA_CONVITE_CONVIDADO, `CO-CC-${ANO}-000002`);

    const ata = await db.$transaction((tx) => proximoCodigoDeDocumento(tx, "ATA", ANO));
    const termo = await db.$transaction((tx) => proximoCodigoDeDocumento(tx, "TERMO_ACORDO", ANO));

    expect(ata).toBe(`CO-ATA-${ANO}-000001`);
    expect(termo).toBe(`CO-TA-${ANO}-000001`);
  });

  it("passa de 000009 para 000010 sem regredir", async () => {
    await criarDocumento(TipoDocumento.ATA, `CO-ATA-${ANO}-000009`);
    const codigo = await db.$transaction((tx) => proximoCodigoDeDocumento(tx, "ATA", ANO));
    expect(codigo).toBe(`CO-ATA-${ANO}-000010`);
  });

  it("anexo recebido não ocupa código e não interfere na sequência", async () => {
    await criarDocumento(TipoDocumento.DOCUMENTO_DA_PARTE, null);
    await criarDocumento(TipoDocumento.LAUDO_AR, null);

    const codigo = await db.$transaction((tx) =>
      proximoCodigoDeDocumento(tx, "CARTA_CONVITE_SOLICITANTE", ANO)
    );
    expect(codigo).toBe(`CO-CC-${ANO}-000003`);
  });

  it("mais de um anexo sem código convive no mesmo procedimento", async () => {
    // codigoVerificacao é único, mas nulo não conflita com nulo no Postgres
    const total = await db.documento.count({
      where: { atoId, codigoVerificacao: null },
    });
    expect(total).toBeGreaterThanOrEqual(2);
  });
});
