# Sistema de Gestão da Câmara Consensus One

Sistema de gestão de câmara privada de conciliação, desenvolvido pela
**NX Netscale** para a **Consensus One Serviços de Composição Estratégica
Consensual Ltda**.

> Este repositório é a Etapa 1 do projeto, conforme o contrato de 13/08/2026.
> O escopo vinculante está em `docs/01-escopo-etapa-1.md`.

## Começando

> **Sprint 0 já implementada:** autenticação com os quatro papéis, proteção de
> rotas, shell da aplicação com a marca e painel inicial. Testes unitários
> passando (21). Rode `npx prisma generate` antes do primeiro `npm run dev` — o
> scaffold foi entregue sem o cliente Prisma gerado.

```bash
# 1. dependências
npm install
npx prisma generate

# 2. variáveis de ambiente
cp .env.example .env
# gere a chave de sessão:
openssl rand -base64 32     # cole em AUTH_SECRET

# 3. banco e storage local
npm run db:up
npm run db:migrate
npm run db:seed

# 4. rodar
npm run dev
```

Aplicação em http://localhost:3000
Console do MinIO em http://localhost:9001 (consensus / consensus123)

## Estrutura

```
docs/          escopo, fluxo, segurança e design — leia antes de codar
prisma/        schema e migrações
src/app/       rotas (App Router)
src/lib/       regras de negócio e integrações
tests/unit/    regras de negócio
tests/e2e/     fluxo completo
```

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `CLAUDE.md` | Regras do projeto para o Claude Code |
| `docs/01-escopo-etapa-1.md` | O que é contratualmente devido |
| `docs/02-fluxo-cinco-passos.md` | Regra de negócio central |
| `docs/03-autenticacao-de-documentos.md` | Código único e QR Code |
| `docs/04-seguranca-e-lgpd.md` | Checklist de segurança |
| `docs/05-design-system.md` | Cores, tipografia, responsividade |
| `docs/06-roadmap.md` | Sprints e marcos de pagamento |
| `docs/07-infraestrutura-e-operacao.md` | Servidor, backup e rotina de operação |

## Infraestrutura

| Ambiente | Onde roda | Arquivos |
|---|---|---|
| Local | Docker (Postgres + MinIO) | MinIO |
| Homologação | VPS Hostinger / EasyPanel | Magalu Object Storage |
| Produção | VPS Hostinger / EasyPanel, São Paulo | Magalu Object Storage (br-se1) |
| Backup | dump 2x/dia, criptografado | Cloudflare R2 |

Aplicação e banco rodam no mesmo VPS, gerenciados pelo EasyPanel. Os documentos
ficam em object storage com redundância — **nunca no disco do VPS**.

O procedimento completo de provisionamento, blindagem do servidor, backup e a
rotina mensal de operação estão em `docs/07-infraestrutura-e-operacao.md`.

> **Teste de restauração é mensal e obrigatório.** Rode
> `infra/restaurar-backup.sh` e registre o resultado na tabela do `docs/07`.

## Antes de subir para produção

- [ ] Migrações testadas em homologação com o mesmo dado
- [ ] Testes unitários e ponta a ponta passando
- [ ] Backup do banco feito antes do deploy
- [ ] Variáveis de ambiente conferidas
- [ ] Restauração de backup testada no mês corrente
