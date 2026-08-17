-- AlterTable
ALTER TABLE "ConfiguracaoSistema" ALTER COLUMN "urlVerificacao" SET DEFAULT 'https://consensusone.com.br/verificar';

-- AlterTable
ALTER TABLE "Documento" ALTER COLUMN "codigoVerificacao" DROP NOT NULL;
