-- AlterTable
ALTER TABLE "ConfiguracaoSistema" ADD COLUMN     "duracaoSessaoMinutos" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "horaDaSessao" TEXT NOT NULL DEFAULT '14:00';
