-- Correção de dado: o default anterior gravava "consensone.com.br", faltando o
-- "us" do domínio do cliente (consensusone.com.br). Esse valor vai impresso no
-- rodapé e dentro do QR Code de todo documento emitido, então qualquer linha
-- criada com o default errado precisa ser corrigida junto com o default.
UPDATE "ConfiguracaoSistema"
SET "urlVerificacao" = 'https://consensusone.com.br/verificar'
WHERE "urlVerificacao" = 'https://consensone.com.br/verificar';
