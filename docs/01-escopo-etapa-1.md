# Escopo da Etapa 1 — vinculante

Transcrição do Anexo I do contrato assinado em 13/08/2026. Não implemente nada
fora desta lista sem orçamento aprovado (Cláusula 12ª).

## 1. Infraestrutura e segurança
- Servidor dedicado, banco de dados próprio
- Credenciais exclusivas da Consensus One
- Acessos com perfis diferenciados
- TLS e backup automático

## 2. Painel administrativo e perfis
- Cadastro de partes, inserção de documentos, condução do fluxo
- Acesso individual por e-mail e senha
- Perfil operador (interno): executa todos os passos
- Perfil parte (externo): só o próprio caso, **liberado após a realização do ato**
- Organização dos registros por CPF ou CNPJ

## 3. Fluxo operacional
Os cinco passos, detalhados em `02-fluxo-cinco-passos.md`.

## 4. Autenticação por QR Code
Detalhado em `03-autenticacao-de-documentos.md`.

## 5. Histórico e repositório por ato
- Pasta única por ato com as duas cartas, documentos das partes, ata, termo de
  acordo e assinados
- Comprovantes de envio e laudos de AR
- Consulta e download pelo painel
- Disponibilização à parte após a realização do ato

## 6. Entregas complementares
- Publicação em produção no domínio da Consensus One
- Treinamento da equipe
- Entrega de credenciais, código-fonte e documentação técnica

## Critério de aceite
Executar de ponta a ponta um ato completo: cadastro das partes, emissão e envio
das duas cartas, validação documental, registro da sessão, geração da ata e
arquivamento no repositório.

## FORA do escopo da Etapa 1
- Automação de envio (é Etapa 2)
- Integração via API com ForSign e AR Digital (é Etapa 2)
- Agente de IA (é Etapa 2)
- Módulo do escritório de advocacia (é Fase 3, contrato à parte)
- Migração dos documentos do Dropbox
- Aplicativo nativo — o sistema é web responsivo
