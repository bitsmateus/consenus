# Variáveis de ambiente — produção

Duas listas separadas, e a separação importa:

- **A** vai no EasyPanel, no serviço da aplicação. É o que o container Next.js lê.
- **B** vai no arquivo `/opt/consensus/.env.backup` do host, lido pelo cron.
  O container não enxerga essas, e não precisa.

`BACKUP_PASSPHRASE` **não aparece em nenhuma das duas**. Ver o fim deste arquivo.

---

## A. EasyPanel → serviço `app` (projeto `producao`)

### A1. Segredo — cadastre como *Secret/Environment* e nunca versione

| Variável | Como obter | Observação |
|---|---|---|
| `DATABASE_URL` | senha gerada pelo template Postgres do EasyPanel | **usa o host interno**, ver abaixo |
| `AUTH_SECRET` | `openssl rand -base64 32` | trocar invalida todas as sessões |
| `S3_ACCESS_KEY_ID` | MinIO do VPS → chaves de acesso | chave exclusiva de produção |
| `S3_SECRET_ACCESS_KEY` | idem | idem |
| `SMTP_USER` | provedor de e-mail | |
| `SMTP_PASSWORD` | provedor de e-mail | |
| `CODIGO_SEGREDO` | deixe **vazio** | o cliente recusou o dígito verificador em 14/08 (docs/09, item 3). Só preencha se ele mudar de ideia |

O `DATABASE_URL` é o ponto onde a regra da 5432 se aplica dentro da aplicação.
Tem que apontar para o **nome do serviço na rede interna do EasyPanel**, jamais
para IP público ou domínio:

```
postgresql://consensus:SENHA@producao_postgres:5432/consensus_one?schema=public&sslmode=disable
```

Se você precisou abrir a porta no firewall para essa string funcionar, ela está
errada. O tráfego não sai do host.

### A2. Não é segredo — pode ficar à vista

| Variável | Valor de produção |
|---|---|
| `AUTH_URL` | `https://sistema.consensusone.com.br` |
| `S3_ENDPOINT` | `https://arquivos.consensusone.com.br` (MinIO do próprio VPS — ver docs/07) |
| `S3_REGION` | `br-se1` |
| `S3_BUCKET` | `consensus-one` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `NEXT_PUBLIC_URL_VERIFICACAO` | `https://consensusone.com.br/verificar` |
| `EMAIL_REMETENTE` | `nao-responda@consensusone.com.br` |
| `SMTP_HOST` | do provedor |
| `SMTP_PORT` | `587` |
| `TZ` | `America/Sao_Paulo` |
| `NODE_ENV` | `production` |

Cuidado com o prefixo `NEXT_PUBLIC_`: essa variável é embutida no JavaScript
que vai para o navegador. Nunca ponha segredo em variável com esse prefixo.

Confira a grafia de `NEXT_PUBLIC_URL_VERIFICACAO`: é `consensusone`, com dois
"s". O default antigo do banco tinha `consensone` e ia impresso no QR Code de
todo documento emitido.

### A3. Não vão no EasyPanel

`BACKUP_S3_*`, `RETENCAO_DIAS`, `HEALTHCHECK_URL` e `HEALTHCHECK_SYNC_URL` são
dos scripts de backup e de réplica, que
roda no host pelo cron — não dentro do container. Pôr essas chaves no app só
aumenta a superfície de exposição sem nenhum ganho.

---

## B. Host → `/opt/consensus/.env.backup`

```bash
# criar com permissão restrita ANTES de escrever conteúdo
install -m 600 -o root -g root /dev/null /opt/consensus/.env.backup
nano /opt/consensus/.env.backup
```

```bash
# ---- banco (o dump roda no host, contra o Postgres da rede interna) ----
DATABASE_URL="postgresql://consensus:SENHA@127.0.0.1:5432/consensus_one"
PGHOST="127.0.0.1"
PGUSER="consensus"

# ---- destino do backup: Cloudflare R2 ----
BACKUP_S3_ENDPOINT="https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com"
BACKUP_S3_BUCKET="consensus-one-backup"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_DEFAULT_REGION="auto"

# ---- origem dos documentos, para a réplica diária ----
S3_ENDPOINT="https://arquivos.consensusone.com.br"
S3_BUCKET="consensus-one"
S3_REGION="br-se1"

# ---- operação ----
RETENCAO_DIAS="30"
HEALTHCHECK_URL="https://hc-ping.com/UUID-DO-BACKUP"
HEALTHCHECK_SYNC_URL="https://hc-ping.com/UUID-DA-REPLICA"

# ---- destinatário da cifra: chave PÚBLICA, não é segredo ----
BACKUP_CHAVE_PUBLICA="age1..."

# A sincronização dos documentos lê da ORIGEM (MinIO do VPS) e escreve no
# DESTINO (R2). São provedores diferentes, com credenciais diferentes — as
# AWS_* acima valem para o destino, e estas para a origem:
S3_ACCESS_KEY_ID="chave do MinIO"
S3_SECRET_ACCESS_KEY="segredo do MinIO"
```

Sobre o `127.0.0.1` no `DATABASE_URL` do host: isso **não** contraria a regra.
A porta pode ser publicada apenas no loopback (`127.0.0.1:5432:5432`), o que a
deixa acessível ao cron do próprio servidor e inalcançável de fora. O que a
regra proíbe é publicar em `0.0.0.0`. Confira com `ss -ltn | grep 5432`: tem
que aparecer `127.0.0.1:5432`, nunca `0.0.0.0:5432`.

As chaves do R2 podem ser criadas **sem permissão de delete** para reduzir o
estrago de um comprometimento do servidor. A retenção passa a ser feita por
regra de ciclo de vida no bucket, em vez de pelo script.

---

## A passphrase não mora no servidor

`BACKUP_PASSPHRASE` não está em nenhuma lista acima porque não pode existir no
VPS — nem em variável, nem em arquivo, nem na linha do cron. Se ela estivesse
lá, quem invadisse o servidor teria o banco **e** a chave dos backups.

Por isso o backup passa a ser cifrado com **chave pública** (`age`):

| Onde | O quê | É segredo? |
|---|---|---|
| VPS, em `.env.backup` | `BACKUP_CHAVE_PUBLICA` (`age1...`) | não — só serve para cifrar |
| Gerenciador de senhas | chave privada (`AGE-SECRET-KEY-1...`) | **sim** — só ela decifra |
| Gerenciador de senhas | segunda via da chave privada, com outra pessoa | sim |

Gere o par **na sua máquina, não no servidor**:

```bash
age-keygen -o consensus-backup.key
# a saída "Public key: age1..." vai para BACKUP_CHAVE_PUBLICA no VPS
# o arquivo consensus-backup.key vai para o gerenciador de senhas e é APAGADO daqui
```

Perdeu a chave privada e não tem segunda via? Todos os backups viram bytes
inúteis. Guarde em dois cofres distintos, com duas pessoas.
