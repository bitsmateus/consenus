# CLAUDE.md — Sistema de Gestão da Câmara Consensus One

Este arquivo é lido automaticamente pelo Claude Code. Ele define como o projeto
deve ser construído. Siga estas regras em toda alteração.

## O que é este projeto

Sistema de gestão da **Consensus One — Câmara Privada de Composição
Estratégica Consensual** (CNPJ 68.052.966/0001-06), nome institucional
conforme o papel timbrado oficial e `docs/05-design-system.md`. Desenvolvido
pela NX Netscale.

O sistema controla o ciclo completo de um ato de conciliação, em cinco passos:
cadastro das partes, primeira carta convite ao Interessado Solicitante,
validação da documentação, segunda carta convite ao Interessado Convidado, e a
sessão com ata e termo de acordo.

Leia `docs/01-escopo-etapa-1.md` e `docs/02-fluxo-cinco-passos.md` antes de
implementar qualquer funcionalidade. O escopo é contratual — não invente
funcionalidade que não esteja lá, e não remova nenhuma que esteja.

## Stack

- Next.js 15 (App Router) + TypeScript estrito
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- Auth.js (NextAuth) com credenciais e Argon2id
- Zod para toda validação de entrada
- Object storage S3-compatível (Magalu Cloud em produção, MinIO em local)
- Playwright para gerar PDF e para testes ponta a ponta
- Vitest para testes unitários

## Regras inegociáveis

1. **Idioma.** Todo código, nome de variável, comentário, commit e texto de
   interface em **português do Brasil**. O usuário final é advogado brasileiro.
2. **Autorização no servidor, sempre.** Nenhuma verificação de permissão pode
   existir só no cliente. Toda query filtra por usuário e papel no servidor.
3. **Isolamento por ato.** Perfil PARTE só enxerga o próprio ato, e apenas
   depois da sessão realizada. Perfil PROCURADOR enxerga **todos** os atos em
   que representa alguém — nunca outros —, e o acesso aos documentos continua
   liberado só após a sessão. Validado em toda consulta, sem exceção. Escreva
   teste para os dois casos. Ver `docs/10-procuradores-e-representacao.md`.
4. **Nenhum arquivo público.** Bucket sempre privado. Download só por URL
   pré-assinada com expiração de 10 minutos.
5. **A página de verificação não expõe documento.** Ela recebe um código e
   devolve apenas: existe ou não, tipo do documento, data de emissão. Nunca o
   arquivo nem o conteúdo nem nome das partes.
6. **Auditoria.** Toda leitura de documento, download, alteração de ato e
   login é registrado em `LogAuditoria`. Use o helper `registrarAuditoria()`.
7. **Migração versionada.** Nunca altere o banco direto. Sempre
   `prisma migrate dev --name descricao_curta`.
8. **Sem segredo no repositório.** Tudo em variável de ambiente. Se precisar de
   uma nova, adicione em `.env.example` com valor de exemplo.
9. **Teste antes de dar por pronto.** Funcionalidade nova tem teste. Regra de
   negócio (prazos, códigos, permissões) tem teste unitário obrigatório.
10. **Terminologia do cliente, sem exceção.** Diga *Interessado Solicitante* e
    *Interessado Convidado* — nunca "requerente", "demandado", "autor" ou "réu".
    A sessão é *Sessão Privada de Conciliação*; o procedimento é *Procedimento
    Privado de Composição Consensual*. Isso vale no código, no banco e na tela.
11. **Documentos vêm dos modelos oficiais.** O texto está em `assets/modelos/`
    e mapeado em `docs/08-modelos-de-documento.md`. Não reescreva cláusula, não
    "melhore" redação jurídica: preencha as variáveis.
12. **Datas e prazos.** Sempre em `America/Sao_Paulo`. Prazos são
    configuráveis em `ConfiguracaoSistema`, nunca fixos no código.

## Padrões de código

- Server Components por padrão. `"use client"` só quando houver interação.
- Server Actions para mutação, com validação Zod na primeira linha.
- Nunca chame o Prisma de um Client Component.
- Um arquivo por componente, nome em PascalCase, arquivo em kebab-case.
- Erros de negócio são exceções tipadas, com mensagem em português apresentável
  ao usuário. Erro técnico nunca vaza para a tela.

## Identidade visual

Definida em `docs/05-design-system.md`, extraída do papel timbrado oficial do
cliente. A marca é **preta e dourada**: preto `#0A0A0A`, dourado `#946810` sobre
claro e `#CC9933` sobre escuro, prata `#D1D1D1`. Sem gradiente, sem visual de
startup. A assinatura de marca é *"Duas posições. Uma solução."*

Os ativos estão em `assets/marca/`. O arquivo
`assets/marca/papel-timbrado-original.docx` é a **referência obrigatória** para o
cabeçalho e o rodapé de todo documento gerado em PDF — o rodapé oficial já traz o
bloco "AUTENTICADOR DE DOCUMENTO" com QR Code apontando para
consensusone.com.br/verificar.

Interface responsiva de verdade: o operador usa no computador, a parte consulta
no celular. Teste em 375px de largura.

## Infraestrutura

Produção roda num VPS Hostinger (São Paulo) gerenciado pelo EasyPanel, com app
e Postgres em containers. Documentos ficam em object storage da Magalu Cloud
(br-se1) — **nunca no disco do servidor**. Backup do banco 2x ao dia,
criptografado, no Cloudflare R2.

O deploy é feito pelo `Dockerfile` da raiz, que já roda `prisma migrate deploy`
na subida. Detalhes em `docs/07-infraestrutura-e-operacao.md`.

## Comandos

```bash
npm run dev            # desenvolvimento
npm run db:up          # sobe Postgres e MinIO em Docker
npm run db:migrate     # aplica migrações
npm run db:seed        # popula dados de demonstração
npm run test           # testes unitários
npm run test:e2e       # testes ponta a ponta
npm run lint           # ESLint + verificação de tipos
```

## Onde o projeto está

**Sprint 0 concluída.** Já existem e funcionam:

- `src/auth.ts` — Auth.js com credenciais, Argon2id, bloqueio após 5 tentativas,
  sessão de 8 horas e resposta em tempo semelhante para usuário inexistente
- `src/middleware.ts` — proteção de rotas; públicas apenas `/entrar` e `/verificar`
- `src/lib/sessao.ts` — **a peça central de autorização**. `filtroDeAtosVisiveis()`
  devolve o `where` que toda consulta de ato precisa aplicar. Nunca monte query
  de ato sem passar por ela
- `src/app/entrar` — login com a identidade da câmara
- `src/app/(app)/layout.tsx` — shell com menu por papel
- `src/lib/codigo-documento.ts`, `prazos.ts`, `documentos.ts` — regras de negócio
  com testes

Próximo passo: **Sprint 1** do `docs/06-roadmap.md`.

## Como trabalhamos

Uma sprint por vez, conforme `docs/06-roadmap.md`. Ao concluir uma sprint,
rode toda a bateria de testes e escreva um resumo do que foi entregue antes de
começar a próxima. Se algo no escopo estiver ambíguo, pergunte — não decida
sozinho regra de negócio jurídica.
