# Entrega da Etapa 1

Documento de handover: o que foi construído, como rodar, como operar e o que
fica em aberto. Complementa o `docs/07-infraestrutura-e-operacao.md`, que trata
do servidor, e o `infra/checklist-pos-deploy.md`, que trata da publicação.

## O que está pronto

Os cinco passos do `docs/02-fluxo-cinco-passos.md`, de ponta a ponta:

| Passo | O que o sistema faz |
|---|---|
| 1 · Cadastro | pessoas com validação de CPF e CNPJ, quatro naturezas de procurador, procedimento numerado automaticamente |
| 2 · 1ª Carta | PDF com timbrado e QR Code, código único, prazo de documentação aberto, data **reservada** |
| 3 · Conferência | checklist item a item dos cinco documentos; só ele efetiva a data |
| 4 · 2ª Carta | ao Interessado Convidado, recusada pelo servidor antes da confirmação |
| 5 · Sessão | horários, comparecimento, cinco desfechos, ata obrigatória e termo de acordo opcional |

Mais: página pública de verificação por código e QR Code, repositório de
documentos por procedimento, portal do Interessado e portal do Procurador,
gestão de contas e permissões, e trilha de auditoria.

## Como rodar na máquina

```bash
npm install
cp .env.example .env        # preencher AUTH_SECRET com: openssl rand -base64 32
npm run db:up               # Postgres e MinIO em Docker
npm run db:migrate
npm run db:seed
npm run dev
```

O `.env` local precisa do bucket criado uma vez no MinIO (`consensus-one`) e das
credenciais de desenvolvimento que estão no `docker-compose.yml`.

## Contas de demonstração

Senha de todas: `Consensus@2026`

| Conta | Perfil | O que enxerga |
|---|---|---|
| `admin@consensusone.com.br` | Administrador | tudo, mais equipe e auditoria |
| `operador@consensusone.com.br` | Operador | tudo, conduz o fluxo |
| `marcos@exemplo.com.br` | Interessado | 1 procedimento, já com sessão realizada |
| `francisco@exemplo.com.br` | Interessado | nenhum: o dele ainda não teve sessão |
| `helena@exemplo.adv.br` | Procuradora | 1 dos 2 que representa, pelo mesmo motivo |

As duas últimas são as mais úteis no treinamento: mostram, com conta de verdade,
que o acesso externo só abre depois da sessão.

**Perfil interno exige verificação em duas etapas.** No primeiro acesso a conta
cai na tela de Segurança e não sai de lá até ler o QR Code num aplicativo
autenticador. Faça isso antes de qualquer demonstração.

## Como rodar os testes

```bash
npm run test        # unitários e de integração — precisam do Postgres no ar
npm run test:e2e    # ponta a ponta, no navegador — precisa da aplicação no ar
npm run lint        # ESLint e verificação de tipos
```

Os testes de integração e os ponta a ponta escrevem no banco de desenvolvimento.
Não aponte `DATABASE_URL` para produção ao rodá-los.

## Mapa do código

| Onde | O que é |
|---|---|
| `src/lib/autorizacao.ts` | **a regra mais sensível**: o que cada perfil enxerga |
| `src/lib/sessao.ts` | amarra a regra acima ao usuário autenticado |
| `src/lib/consultas.ts` | consultas das telas, já com a visibilidade aplicada |
| `src/lib/emissao.ts` | código, QR Code, PDF e upload — as quatro emissões |
| `src/lib/verificacao.ts` | consulta pública e suas sete proteções |
| `src/documentos/` | os modelos oficiais em HTML, texto literal do cliente |
| `src/acoes/` | Server Actions: toda mutação passa por aqui, com Zod |
| `infra/` | endurecimento do servidor, backup, variáveis e checklist |

Regra que não pode ser contornada: **nenhuma consulta de procedimento é montada
sem `filtroDeAtosVisiveis()`**. Se aparecer um `db.ato.findMany` sem ele, é bug
de segurança, não estilo.

## O que depende de você para fechar a Etapa 1

Quatro itens da Sprint 4 exigem acesso ao VPS ou ao cliente, e não podem ser
feitos daqui:

- [ ] **Publicação em produção** no domínio definitivo — roteiro em
      `infra/endurecer-servidor.sh` e `infra/variaveis-de-producao.md`
- [ ] **Backup configurado e restauração testada** — `infra/crontab-producao` e
      `infra/restaurar-backup.sh`. Backup nunca restaurado não é backup
- [ ] **Homologação** — ajustes dependem do que o cliente apontar ao usar
- [ ] **Treinamento da equipe** — as contas de demonstração acima servem de
      roteiro

O `infra/checklist-pos-deploy.md` cobre a verificação da publicação, item a
item, começando pela porta 5432.

## Decisões pendentes do cliente

Nenhuma bloqueia o uso, mas as duas mudam comportamento:

1. **`REDESIGNADA` conta como procedimento encerrado ou em andamento?** Hoje
   está como **em andamento** — redesignar é remarcar a sessão, o procedimento
   continua vivo. Afeta os contadores do painel. Ver `src/lib/autorizacao.ts`.
2. **Qual nome institucional vale nas telas públicas?** Está o do papel
   timbrado, "Câmara Privada de Composição Estratégica Consensual"
   (`docs/05-design-system.md`). Trocar são duas linhas.

## Limites conhecidos, assumidos

- **Sem CAPTCHA na verificação pública.** O bloqueio após 20 consultas sem
  resultado é período de espera. Desafio visual exigiria serviço externo, fora
  do escopo contratado.
- **O limite de consultas por IP vive em memória.** Basta para o VPS único de
  `docs/07`; se o app passar a rodar replicado, precisa migrar para Redis ou
  banco, senão o limite passa a valer por réplica.
- **Sem recuperação point-in-time.** A perda máxima é o intervalo entre os
  dumps, 12 horas. Está registrado em `docs/07`, com a alternativa.
- **Exclusão de pessoa não existe.** Pessoa vinculada a procedimento não some
  sem quebrar o histórico. Se for necessário, o caminho é inativação — e a
  decisão é do cliente.
- **Envio ainda é manual.** Registrar envio e anexar o laudo de AR é ação do
  operador. Automação e integração com ForSign e AR Digital são Etapa 2, por
  contrato.

## Entrega

- **Código-fonte:** repositório Git, com histórico por sprint
- **Documentação:** `docs/` (escopo, fluxo, segurança, infraestrutura, modelos)
  e `infra/` (operação)
- **Credenciais:** entregues fora deste repositório, conforme
  `infra/variaveis-de-producao.md`. Nenhum segredo é versionado

A chave privada do backup **não** fica no servidor nem no repositório: vive no
gerenciador de senhas, com segunda via em outro cofre. Sem ela, os backups são
inúteis.
