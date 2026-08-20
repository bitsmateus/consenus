# Segurança e LGPD

## Papéis definidos no contrato

- **Consensus One:** controladora dos dados pessoais
- **NX Netscale:** operadora, atua conforme instrução da controladora

Isso está na Cláusula 17ª, § 1º do contrato. Toda decisão sobre finalidade,
retenção e compartilhamento é da câmara, não da NX.

## Checklist de implementação

### Autenticação
- [ ] Senha com Argon2id (`argon2` — memória 19 MiB, 2 iterações, paralelismo 1)
- [ ] Cookie de sessão `httpOnly`, `Secure`, `SameSite=Lax`
- [ ] TOTP obrigatório para ADMIN e OPERADOR
- [ ] Bloqueio de 15 minutos após 5 tentativas falhas
- [ ] Sessão expira em 8 horas de inatividade
- [ ] Troca de senha invalida todas as sessões ativas

### Autorização
- [ ] Toda query filtra por papel no servidor
- [ ] Teste automatizado: parte A não acessa ato da parte B
- [ ] Teste automatizado: PARTE não acessa ato antes de `SESSAO_REALIZADA`
- [ ] Rota de API sem verificação de sessão não pode existir, exceto
      `/verificar` e `/login`

### Arquivos
- [ ] Bucket privado, sem listagem pública
- [ ] Download só por URL pré-assinada, expiração de 10 minutos
- [ ] Hash SHA-256 gravado na subida, conferido na leitura
- [ ] Upload valida tipo MIME real, não só a extensão
- [ ] Limite de tamanho por arquivo

### Dados
- [ ] TLS obrigatório, HSTS ativo
- [ ] ~~Criptografia em repouso no provedor~~ — **não atendida, ver abaixo**
- [ ] Backup diário automático + PITR
- [ ] **Teste de restauração mensal, com registro** — backup nunca restaurado
      não é backup
- [ ] Dados de homologação são fictícios, jamais cópia de produção

### Rastreabilidade
- [ ] Login, download, alteração de ato e consulta de documento em
      `LogAuditoria`
- [ ] Log retido por 12 meses no mínimo
- [ ] Log não guarda senha, token ou conteúdo de documento

### Resposta a incidente
- [ ] Procedimento escrito de comunicação à controladora em até 48 horas
      (Cláusula 17ª, § 3º)
- [ ] Contato responsável definido dos dois lados

## Dados pessoais tratados

| Dado | Origem | Base legal sugerida | Retenção |
|---|---|---|---|
| Nome, CPF/CNPJ, contato das partes | Cadastro pelo operador | Execução de procedimento de conciliação | A definir com o cliente |
| Documentos do processo | Envio pelo requerente | Idem | Idem |
| Ata e termo de acordo | Gerados pelo sistema | Idem | Provável retenção longa, por natureza probatória |
| Logs de acesso | Automático | Legítimo interesse, segurança | 12 meses |

A coluna de retenção precisa ser preenchida pela Consensus One. É decisão da
controladora e a NX não deve arbitrar.

---

## Risco aceito — criptografia em repouso dos documentos

**Decisão do cliente em 20/08/2026**, tomada depois de a alternativa ter sido
apresentada com custo e roteiro.

### O que é

Os documentos do procedimento — cartas convite, ata, termo de acordo, documentos
pessoais das partes — ficam num MinIO no disco do próprio VPS, **sem
criptografia em repouso**. O MinIO só oferece SSE com KES/KMS acoplado, e nesse
arranjo a chave viveria na mesma máquina que os arquivos: quem tomasse o
servidor levaria os dois. É o mesmo raciocínio que mantém a passphrase do
backup fora do VPS (`infra/variaveis-de-producao.md`).

### O que protege hoje

| Controle | Situação |
|---|---|
| Bucket privado, sem acesso anônimo | ativo |
| Download só por URL pré-assinada, 10 min | ativo |
| Toda leitura e download em `LogAuditoria` | ativo |
| TLS no transporte | ativo |
| Dado em território nacional (VPS em São Paulo) | atendido |
| Réplica diária para o Cloudflare R2 | ativa |
| Servidor endurecido: SSH por chave, ufw, fail2ban | `infra/endurecer-servidor.sh` |

### O que continua exposto

1. **Quem obtiver acesso ao servidor lê os documentos direto do disco.** Não há
   camada de cifra entre o invasor e o arquivo. Idem para quem tiver acesso ao
   disco físico ou a um snapshot do VPS feito pela Hostinger.

2. **A réplica no Cloudflare R2 vai em claro.** O `sincronizar-arquivos.sh` faz
   `aws s3 sync` sem cifrar. Isso é assimétrico e merece atenção: o **banco** é
   cifrado com `age` antes de sair do servidor, mas os **documentos** — que
   contêm dados pessoais das partes e o conteúdo dos acordos — saem sem
   proteção para um provedor fora do país.

3. **Perda de até 24 horas de documentos** se o VPS for perdido, contra 12
   horas do banco, porque a réplica é diária.

### Como sair disso

Migrar os documentos para object storage externo com SSE-S3 — a Magalu Cloud
está orçada em `docs/07` a ~R$ 5/mês. Resolve os três pontos de uma vez. O
custo da migração cresce com o volume: enquanto houver poucos documentos, é
copiar arquivos; depois, vira operação com janela e conferência.

### Revisão

Reavaliar quando o sistema passar de **100 documentos** ou ao renovar o
contrato, o que vier primeiro.
