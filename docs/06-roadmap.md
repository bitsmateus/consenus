# Roadmap de desenvolvimento — Etapa 1

Prazo contratual: 15 a 20 dias corridos da assinatura.

## Sprint 0 — Fundação (dias 1 a 2) — CONCLUÍDA

- [x] Projeto Next.js, Prisma, Tailwind e shadcn/ui configurados
- [x] Docker com Postgres e MinIO subindo local
- [x] CI no GitHub Actions rodando lint, tipos e testes
- [x] Design system aplicado: cores, tipografia, componentes base
- [x] Migração inicial do banco
- [x] Login com e-mail e senha, papéis e sessão, com segundo fator obrigatório
      para ADMIN e OPERADOR
- [ ] Ambientes de homologação e produção provisionados — artefatos prontos em
      `infra/`, execução depende do acesso ao VPS

**Demonstrável:** tela de login com a marca da Consensus One

## Sprint 1 — Cadastros (dias 3 a 6) — CONCLUÍDA

- [x] CRUD de pessoas com validação de CPF e CNPJ
- [x] Criação do ato com numeração automática
- [x] Vínculo de partes: solicitante, convidado e procuradores dos dois lados
- [x] Naturezas de procurador: advogado, escritório, consultoria e representante
- [x] Cálculo automático de D+20 e do prazo de 15 dias (ver docs/09, item 1)
- [x] Painel com listagem, busca por CPF/CNPJ/OAB e filtros por status
- [x] Filtro por procurador, com contagem por representante
- [x] Gestão de usuários e permissões
- [x] Linha do tempo do ato

**Demonstrável:** operador cadastra um ato completo — coberto de ponta a ponta
em `tests/e2e/cadastro-do-ato.spec.ts`, no navegador.

Fora do que foi entregue, de propósito:

- **Exclusão de pessoa não existe.** Pessoa vinculada a procedimento não pode
  sumir sem quebrar o histórico, e o sistema é de natureza probatória. Se o
  cliente precisar, o caminho é inativação, não exclusão — decisão dele.
- **O prazo da documentação é contado da criação do procedimento.** O docs/02
  diz "15 dias corridos da 1ª carta", e a carta é da Sprint 2; como ela é
  gerada ao concluir o cadastro, as datas coincidem hoje. Na emissão da carta,
  o prazo passa a ser recontado a partir do envio.

## Sprint 2 — Documentos e verificação (dias 7 a 10) — CONCLUÍDA

- [x] Motor de geração de PDF a partir de template HTML
- [x] Primeira carta convite com os dados do ato
- [x] Geração do código único e do QR Code
- [x] Página pública de verificação
- [x] Upload de documentos com hash e validação de tipo
- [x] Registro de envio e anexação do laudo de AR
- [x] Download por URL pré-assinada

As sete proteções obrigatórias da página de verificação (docs/03) estão
implementadas: limite de 10 consultas por minuto e 100 por hora por IP, tempo de
resposta constante, resposta idêntica para código inexistente e malformado,
nenhuma contagem exposta, sem autocompletar, alerta de varredura em
`LogAuditoria` e bloqueio após 20 consultas seguidas sem resultado.

Uma ressalva sobre a última: o bloqueio hoje é um período de espera, não um
desafio visual — não há CAPTCHA, porque isso exigiria serviço externo, que não
está no escopo. E o contador de consultas vive em memória: basta para o VPS
único de docs/07, mas precisa migrar para Redis ou banco no dia em que o app
rodar replicado, senão o limite passa a valer por réplica.

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
