-- Pedido em 28/08: a data da sessão passa de D+20 para D+30.
-- O campo já é configurável (nunca fixo no código, CLAUDE.md regra 12); esta
-- migração só atualiza o padrão da coluna e a linha única já gravada, sem
-- mexer em procedimentos que já têm data reservada ou confirmada.
ALTER TABLE "ConfiguracaoSistema" ALTER COLUMN "diasAteSessao" SET DEFAULT 30;

UPDATE "ConfiguracaoSistema" SET "diasAteSessao" = 30 WHERE "diasAteSessao" = 20;
