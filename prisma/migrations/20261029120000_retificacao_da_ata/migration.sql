-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "substituidoEm" TIMESTAMPTZ(3),
ADD COLUMN     "substituidoPorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Documento_substituidoPorId_key" ON "Documento"("substituidoPorId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_substituidoPorId_fkey" FOREIGN KEY ("substituidoPorId") REFERENCES "Documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
