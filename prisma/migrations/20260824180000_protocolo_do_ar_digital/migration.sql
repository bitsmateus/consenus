-- Protocolo da AR Online no envio, para correlacionar o aviso de status e
-- buscar o laudo pela API. Único porque um protocolo pertence a um envio só.

-- AlterTable
ALTER TABLE "Envio" ADD COLUMN     "protocoloExterno" TEXT,
ADD COLUMN     "statusExterno" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Envio_protocoloExterno_key" ON "Envio"("protocoloExterno");
