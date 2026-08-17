# Roadmap de desenvolvimento — Etapa 1

Prazo contratual: 15 a 20 dias corridos da assinatura.

## Sprint 0 — Fundação (dias 1 a 2)

- [ ] Projeto Next.js, Prisma, Tailwind e shadcn/ui configurados
- [ ] Docker com Postgres e MinIO subindo local
- [ ] CI no GitHub Actions rodando lint, tipos e testes
- [ ] Design system aplicado: cores, tipografia, componentes base
- [ ] Migração inicial do banco
- [ ] Login com e-mail e senha, papéis e sessão
- [ ] Ambientes de homologação e produção provisionados

**Demonstrável:** tela de login com a marca da Consensus One

## Sprint 1 — Cadastros (dias 3 a 6)

- [ ] CRUD de pessoas com validação de CPF e CNPJ
- [ ] Criação do ato com numeração automática
- [ ] Vínculo de partes: solicitante, convidado e procuradores dos dois lados
- [ ] Naturezas de procurador: advogado, escritório, consultoria e representante
- [ ] Cálculo automático de D+20 e do prazo de 10 dias
- [ ] Painel com listagem, busca por CPF/CNPJ/OAB e filtros por status
- [ ] Filtro por procurador, com contagem por representante
- [ ] Gestão de usuários e permissões
- [ ] Linha do tempo do ato

**Demonstrável:** operador cadastra um ato completo

## Sprint 2 — Documentos e verificação (dias 7 a 10)

- [ ] Motor de geração de PDF a partir de template HTML
- [ ] Primeira carta convite com os dados do ato
- [ ] Geração do código único e do QR Code
- [ ] Página pública de verificação
- [ ] Upload de documentos com hash e validação de tipo
- [ ] Registro de envio e anexação do laudo de AR
- [ ] Download por URL pré-assinada

**➜ PRIMEIRA DEMONSTRAÇÃO AO CLIENTE — marco da 2ª parcela**

## Sprint 3 — Fluxo completo (dias 11 a 14)

- [ ] Conferência da documentação e confirmação da data pelo operador
- [ ] Segunda carta convite, bloqueada até a confirmação
- [ ] Registro da sessão
- [ ] Geração da ata (obrigatória) e do termo de acordo (opcional)
- [ ] Anexação dos documentos assinados
- [ ] Repositório do ato com todos os arquivos e comprovantes
- [ ] Portal da parte, liberado após a sessão
- [ ] Portal do procurador, com todos os representados e busca
- [ ] Log de auditoria completo

**Demonstrável:** um ato do cadastro ao arquivamento

## Sprint 4 — Homologação e entrega (dias 15 a 20)

- [ ] Testes ponta a ponta cobrindo o fluxo inteiro
- [ ] Testes de isolamento entre partes
- [ ] Dados de demonstração para o treinamento
- [ ] Ajustes da homologação
- [ ] Publicação em produção no domínio definitivo
- [ ] Backup automático configurado e restauração testada
- [ ] Treinamento da equipe
- [ ] Entrega de credenciais, código-fonte e documentação

**➜ ENTREGA DA ETAPA 1 — 3ª parcela e início da mensalidade**

## Etapa 2 — após a Etapa 1

Automação de envios, integrações via API com ForSign e AR Digital, e agente de
IA no WhatsApp e no site. Prazo definido depois de obter a documentação técnica
das APIs, conforme Cláusula 3ª, § 4º do contrato.
