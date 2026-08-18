-- CreateEnum
CREATE TYPE "ItemDaDocumentacao" AS ENUM ('CONTRATO_PRESTACAO_SERVICOS', 'PROCURACAO', 'CONTRATO_FINANCIAMENTO', 'PROVA_TECNICA', 'DOCUMENTOS_PESSOAIS');

-- CreateTable
CREATE TABLE "ConferenciaDeDocumento" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "item" "ItemDaDocumentacao" NOT NULL,
    "conferido" BOOLEAN NOT NULL DEFAULT false,
    "naoAplicavel" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "conferidoPorId" TEXT,
    "conferidoEm" TIMESTAMP(3),

    CONSTRAINT "ConferenciaDeDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermoDeAcordo" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "objetoDoAcordo" TEXT NOT NULL,
    "obrigacoesPrimeiraParte" TEXT NOT NULL,
    "obrigacoesSegundaParte" TEXT NOT NULL,
    "condicoesEspecificas" TEXT,
    "prazosDeCumprimento" TEXT,
    "formaDeCumprimento" TEXT,
    "formaDePagamento" TEXT,
    "demaisCondicoes" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermoDeAcordo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConferenciaDeDocumento_atoId_idx" ON "ConferenciaDeDocumento"("atoId");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaDeDocumento_atoId_item_key" ON "ConferenciaDeDocumento"("atoId", "item");

-- CreateIndex
CREATE UNIQUE INDEX "TermoDeAcordo_atoId_key" ON "TermoDeAcordo"("atoId");

-- AddForeignKey
ALTER TABLE "ConferenciaDeDocumento" ADD CONSTRAINT "ConferenciaDeDocumento_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenciaDeDocumento" ADD CONSTRAINT "ConferenciaDeDocumento_conferidoPorId_fkey" FOREIGN KEY ("conferidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoDeAcordo" ADD CONSTRAINT "TermoDeAcordo_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoDeAcordo" ADD CONSTRAINT "TermoDeAcordo_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
