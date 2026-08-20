-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('AGUARDANDO', 'PARCIAL', 'CONCLUIDA', 'ARQUIVADA', 'CANCELADA', 'FALHOU');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoEvento" ADD VALUE 'ASSINATURA_SOLICITADA';
ALTER TYPE "TipoEvento" ADD VALUE 'ASSINATURA_REGISTRADA';
ALTER TYPE "TipoEvento" ADD VALUE 'ASSINATURA_CONCLUIDA';
ALTER TYPE "TipoEvento" ADD VALUE 'ASSINATURA_CANCELADA';

-- CreateTable
CREATE TABLE "OperacaoAssinatura" (
    "id" TEXT NOT NULL,
    "atoId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "identificadorExterno" TEXT NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'AGUARDANDO',
    "totalSignatarios" INTEGER NOT NULL DEFAULT 0,
    "jaAssinaram" INTEGER NOT NULL DEFAULT 0,
    "assinadoId" TEXT,
    "ultimoErro" TEXT,
    "solicitadaPorId" TEXT,
    "concluidaEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OperacaoAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookAssinatura" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "identificadorExterno" TEXT NOT NULL,
    "tipoDoAviso" TEXT NOT NULL,
    "recebidoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAssinatura_documentoId_key" ON "OperacaoAssinatura"("documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAssinatura_identificadorExterno_key" ON "OperacaoAssinatura"("identificadorExterno");

-- CreateIndex
CREATE UNIQUE INDEX "OperacaoAssinatura_assinadoId_key" ON "OperacaoAssinatura"("assinadoId");

-- CreateIndex
CREATE INDEX "OperacaoAssinatura_atoId_idx" ON "OperacaoAssinatura"("atoId");

-- CreateIndex
CREATE INDEX "OperacaoAssinatura_status_idx" ON "OperacaoAssinatura"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookAssinatura_chave_key" ON "WebhookAssinatura"("chave");

-- CreateIndex
CREATE INDEX "WebhookAssinatura_identificadorExterno_idx" ON "WebhookAssinatura"("identificadorExterno");

-- AddForeignKey
ALTER TABLE "OperacaoAssinatura" ADD CONSTRAINT "OperacaoAssinatura_atoId_fkey" FOREIGN KEY ("atoId") REFERENCES "Ato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAssinatura" ADD CONSTRAINT "OperacaoAssinatura_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAssinatura" ADD CONSTRAINT "OperacaoAssinatura_assinadoId_fkey" FOREIGN KEY ("assinadoId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacaoAssinatura" ADD CONSTRAINT "OperacaoAssinatura_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
