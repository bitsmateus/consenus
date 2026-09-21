-- CreateTable
CREATE TABLE "RedefinicaoDeSenha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadoEm" TIMESTAMPTZ(3),
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedefinicaoDeSenha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedefinicaoDeSenha_tokenHash_key" ON "RedefinicaoDeSenha"("tokenHash");

-- CreateIndex
CREATE INDEX "RedefinicaoDeSenha_usuarioId_criadoEm_idx" ON "RedefinicaoDeSenha"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "RedefinicaoDeSenha" ADD CONSTRAINT "RedefinicaoDeSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
