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
- [x] Produção provisionada e no ar pelo EasyPanel (23/08/2026), a partir dos
      roteiros de `infra/`
- [ ] Homologação em ambiente separado — confirmar com o cliente se haverá

**Demonstrável:** tela de login com a marca da Consensus One

## Sprint 1 — Cadastros (dias 3 a 6) — CONCLUÍDA

- [x] CRUD de pessoas com validação de CPF e CNPJ
- [x] Criação do ato com numeração automática
- [x] Vínculo de partes: solicitante, convidado e procuradores dos dois lados
- [x] Naturezas de procurador: advogado, escritório, consultoria e representante
- [x] Cálculo automático de D+30 e do prazo de 15 dias (ver docs/09, item 1)
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

## Sprint 3 — Fluxo completo (dias 11 a 14) — CONCLUÍDA

- [x] Conferência da documentação e confirmação da data pelo operador
- [x] Segunda carta convite, bloqueada até a confirmação
- [x] Registro da sessão
- [x] Geração da ata (obrigatória) e do termo de acordo (opcional)
- [x] Anexação dos documentos assinados
- [x] Repositório do ato com todos os arquivos e comprovantes
- [x] Portal da parte, liberado após a sessão
- [x] Portal do procurador, com todos os representados e busca
- [x] Log de auditoria completo

**Demonstrável:** um ato do cadastro ao arquivamento — percorrido de ponta a
ponta no navegador, gerando os quatro documentos oficiais.

A conferência do passo 3 é item a item, sobre os cinco documentos que a
Carta-Convite exige, e é ela que trava a confirmação da data. A segunda carta
recusa ser expedida antes disso, no servidor, não só na tela. O encerramento
administrativo por falta de documentação está previsto no próprio modelo e foi
implementado junto.

## Sprint 4 — Homologação e entrega (dias 15 a 20)

- [x] Testes ponta a ponta cobrindo o fluxo inteiro
- [x] Testes de isolamento entre partes
- [x] Dados de demonstração para o treinamento
- [x] Entrega de código-fonte e documentação — ver `docs/11-entrega.md`
- [x] **Publicação em produção** — no ar pelo EasyPanel (23/08/2026)
- [ ] **Checklist pós-deploy executado** — `infra/checklist-pos-deploy.md`, hoje
      sem nenhum item marcado. É o que separa "está no ar" de "está entregue"
- [ ] **Backup automático configurado e restauração testada** — depende do VPS
- [ ] **Ajustes da homologação** — depende do retorno do cliente
- [ ] **Treinamento da equipe** — depende de agenda com o cliente

Os itens em aberto não são de desenvolvimento: exigem o servidor e o
cliente. Os roteiros estão prontos em `infra/` — endurecimento, variáveis,
crontab e checklist pós-deploy.

São 23 testes ponta a ponta, em dois arquivos: `fluxo-completo.spec.ts`
percorre os cinco passos até o arquivamento, e `isolamento.spec.ts` entra com
conta de Interessado e de Procurador e confere, pela porta da frente, o que cada
perfil enxerga e o que não enxerga. O CI passou a subir MinIO e rodar o seed,
sem os quais os dois arquivos não teriam como rodar.

**➜ ENTREGA DA ETAPA 1 — 3ª parcela e início da mensalidade**

## Correções pós-publicação

Ajustes feitos depois de o sistema subir, fora do escopo das sprints:

- **Menu do celular.** O menu lateral é `hidden md:flex` e não havia nada no
  lugar abaixo de 768px: quem entrava pelo telefone ficava sem navegação
  nenhuma. Pegava justamente o Interessado, que é quem consulta pelo celular.
- **Menu lateral fixo.** Rolava junto com a página, porque era filho flex de um
  container `min-h-screen` e esticava até a altura do conteúdo.
- **Equipe e Auditoria somem para o OPERADOR.** As duas páginas chamam
  `exigirAdmin()`; o menu as oferecia assim mesmo e o operador tomava erro ao
  clicar. A autorização já estava certa — era a interface que mentia.
- **`scripts/recuperar-admin.cjs`.** Redefine a senha e zera o segundo fator do
  administrador pelo console, para quando ninguém mais consegue entrar. O
  sistema não tem "esqueci minha senha", por decisão de projeto.
- **`PERMITIR_SEGUNDO_ADMIN`** no `criar-admin.cjs`, para criar administrador
  adicional pelo console quando a tela de Equipe está fora de alcance. A recusa
  continua sendo o padrão.

## Etapa 2 — após a Etapa 1

Automação de envios, integrações via API com a plataforma de assinatura e com o
AR Digital, e agente de IA no WhatsApp e no site. Prazo definido depois de obter
a documentação técnica das APIs, conforme Cláusula 3ª, § 4º do contrato.

**Assinatura eletrônica — entregue.** O contrato diz "ForSign"; o fornecedor que
a câmara usa é a **D4Sign**, e é com ela que o sistema está integrado (decisão
de 20/08/2026, credenciais fornecidas pelo cliente). Alinhar o texto contratual
é pendência com o cliente. Detalhes em `docs/12-assinatura-eletronica.md`.

Dois pontos ainda dependem do cliente, não de desenvolvimento:
- **ampliar o limite de requisições da D4Sign**, hoje em 10 por hora — cerca de
  um procedimento por hora, o que trava o uso real;
- **integração com o AR Digital**, à espera de identificar o fornecedor atual.
