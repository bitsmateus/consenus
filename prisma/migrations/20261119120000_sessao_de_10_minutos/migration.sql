-- A sessão passa a ocupar 10 minutos na agenda (pedido do cliente em 19/11/2026;
-- antes, 20 minutos, desde 25/09). Vale também como duração da reunião do Zoom
-- das sessões marcadas ou remarcadas daqui em diante.
ALTER TABLE "ConfiguracaoSistema" ALTER COLUMN "duracaoSessaoMinutos" SET DEFAULT 10;

-- Só troca quem ainda está no padrão anterior de 20: valor ajustado à mão fica.
UPDATE "ConfiguracaoSistema" SET "duracaoSessaoMinutos" = 10 WHERE "duracaoSessaoMinutos" = 20;
