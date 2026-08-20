-- Datas passam a guardar o INSTANTE, e não a hora de parede.
--
-- Antes: TIMESTAMP(3) sem fuso. O valor gravado só fazia sentido junto com o
-- fuso do servidor que o escreveu — e esse fuso é configuração, não dado.
-- Restaurar um backup num servidor com fuso diferente deslocava todos os
-- carimbos em silêncio, com as contagens continuando a bater. Prazo é regra de
-- negócio contratual aqui (CLAUDE.md, regra 12): não pode depender disso.
--
-- O USING ... AT TIME ZONE 'UTC' é obrigatório e não é decorativo. Sem ele, o
-- Postgres interpretaria os valores antigos usando o fuso da SESSÃO que roda a
-- migração. Produção está em Etc/UTC e daria certo por sorte; com o USING
-- explícito, dá certo em qualquer lugar — não é preciso ajustar o fuso da
-- sessão antes de rodar.
--
-- Os valores atuais foram gravados em UTC (produção: Etc/UTC, verificado em
-- 19/08/2026), então é assim que devem ser lidos na conversão.

-- AlterTable
ALTER TABLE "Ato" ALTER COLUMN "dataReservada" SET DATA TYPE TIMESTAMPTZ(3) USING "dataReservada" AT TIME ZONE 'UTC',
ALTER COLUMN "dataConfirmada" SET DATA TYPE TIMESTAMPTZ(3) USING "dataConfirmada" AT TIME ZONE 'UTC',
ALTER COLUMN "horaInicio" SET DATA TYPE TIMESTAMPTZ(3) USING "horaInicio" AT TIME ZONE 'UTC',
ALTER COLUMN "horaEncerramento" SET DATA TYPE TIMESTAMPTZ(3) USING "horaEncerramento" AT TIME ZONE 'UTC',
ALTER COLUMN "prazoDocumentacaoAte" SET DATA TYPE TIMESTAMPTZ(3) USING "prazoDocumentacaoAte" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ConferenciaDeDocumento" ALTER COLUMN "conferidoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "conferidoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ConfiguracaoSistema" ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Documento" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Envio" ALTER COLUMN "enviadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "enviadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "entregueEm" SET DATA TYPE TIMESTAMPTZ(3) USING "entregueEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "EventoAto" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "LogAuditoria" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ParteDoAto" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Pessoa" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "TermoDeAcordo" ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "bloqueadoAte" SET DATA TYPE TIMESTAMPTZ(3) USING "bloqueadoAte" AT TIME ZONE 'UTC',
ALTER COLUMN "ultimoLoginEm" SET DATA TYPE TIMESTAMPTZ(3) USING "ultimoLoginEm" AT TIME ZONE 'UTC',
ALTER COLUMN "criadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "criadoEm" AT TIME ZONE 'UTC',
ALTER COLUMN "atualizadoEm" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizadoEm" AT TIME ZONE 'UTC';
