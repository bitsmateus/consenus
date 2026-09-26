-- AlterTable
ALTER TABLE "ConfiguracaoSistema" ADD COLUMN     "agendaFim" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "agendaInicio" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "almocoFim" TEXT NOT NULL DEFAULT '13:00',
ADD COLUMN     "almocoInicio" TEXT NOT NULL DEFAULT '12:00',
ALTER COLUMN "duracaoSessaoMinutos" SET DEFAULT 20;

-- CreateTable
CREATE TABLE "DiaSemSessao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaSemSessao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaSemSessao_data_key" ON "DiaSemSessao"("data");

-- A sessão passa a ocupar 20 minutos na agenda (pedido do cliente em 25/09).
-- Só troca quem ainda está no padrão antigo de 90: valor ajustado à mão fica.
UPDATE "ConfiguracaoSistema" SET "duracaoSessaoMinutos" = 20 WHERE "duracaoSessaoMinutos" = 90;
