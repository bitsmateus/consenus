-- Separa a natureza de procurador "Empresa ou consultoria" em duas: EMPRESA
-- e CONSULTORIA. Pedido do cliente em 28/08 — diverge do texto original de
-- docs/10 ("empresa (consultoria)"), que tratava as duas como sinônimos.
--
-- Postgres não permite remover um valor de enum diretamente, então o tipo é
-- recriado. Cadastro existente com o valor antigo (EMPRESA_CONSULTORIA) vira
-- CONSULTORIA — é a leitura mais próxima do que já estava documentado
-- ("consultoria que encaminha o caso") e do único exemplo em uso
-- ("Vértice Consultoria Empresarial Ltda"). Confira depois do deploy se
-- algum cadastro deveria ter sido EMPRESA em vez disso.

CREATE TYPE "TipoProcurador_new" AS ENUM ('ADVOGADO', 'ESCRITORIO_ADVOCACIA', 'EMPRESA', 'CONSULTORIA', 'REPRESENTANTE_EMPRESA');

ALTER TABLE "Pessoa"
  ALTER COLUMN "tipoProcurador" TYPE "TipoProcurador_new"
  USING (
    CASE "tipoProcurador"::text
      WHEN 'EMPRESA_CONSULTORIA' THEN 'CONSULTORIA'
      ELSE "tipoProcurador"::text
    END
  )::"TipoProcurador_new";

DROP TYPE "TipoProcurador";
ALTER TYPE "TipoProcurador_new" RENAME TO "TipoProcurador";
