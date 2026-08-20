#!/usr/bin/env bash
#
# Backup do banco — roda 2x por dia via cron.
#
# O que ele faz:
#   1. pg_dump em formato custom (comprimido)
#   2. criptografa com AES-256 antes de sair do servidor
#   3. envia para object storage FORA do VPS
#   4. aplica retenção
#   5. avisa o monitoramento que deu certo
#
# Se qualquer etapa falhar, o script aborta e NÃO avisa o monitoramento —
# é assim que você descobre que o backup parou, em vez de descobrir no dia
# em que precisar restaurar.
#
# Instalação:
#   chmod +x infra/backup-postgres.sh
#   crontab -e
#   0 3,15 * * * /caminho/infra/backup-postgres.sh >> /var/log/backup.log 2>&1

set -Eeuo pipefail

# ---------------------------------------------------------------- config
: "${DATABASE_URL:?defina DATABASE_URL}"
: "${BACKUP_S3_BUCKET:?defina BACKUP_S3_BUCKET}"
: "${BACKUP_S3_ENDPOINT:?defina BACKUP_S3_ENDPOINT}"

# Cifra com chave PÚBLICA. O servidor consegue criar backup e não consegue
# abrir nenhum — a chave privada mora no gerenciador de senhas, fora daqui.
# Ver infra/variaveis-de-producao.md
: "${BACKUP_CHAVE_PUBLICA:?defina BACKUP_CHAVE_PUBLICA (age1...)}"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  echo "ERRO: BACKUP_PASSPHRASE presente no servidor. Remova." >&2
  echo "A chave que decifra o backup não pode viver na mesma máquina que ele." >&2
  exit 1
fi

# Falha cedo e com mensagem clara se faltar ferramenta. Sem isto o cron
# quebraria de madrugada com "command not found" e ninguém veria.
for ferramenta in age aws; do
  command -v "$ferramenta" >/dev/null 2>&1 || {
    echo "ERRO: $ferramenta não está instalado. Rode: apt install -y age awscli" >&2
    exit 1
  }
done
if [ -n "${CONTAINER_POSTGRES:-}" ]; then
  command -v docker >/dev/null 2>&1 || { echo "ERRO: docker não encontrado." >&2; exit 1; }
  docker inspect "$CONTAINER_POSTGRES" >/dev/null 2>&1 || {
    echo "ERRO: container nao encontrado. Confira o nome com: docker ps" >&2
    exit 1
  }
fi

RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
PING_SUCESSO="${HEALTHCHECK_URL:-}"    # ex.: https://hc-ping.com/SEU-UUID

# Precisa de "export": sem ele TZ fica sendo variável só do shell, e o `date`,
# que é programa externo, não a enxerga — o carimbo sairia em UTC e o nome do
# arquivo não bateria com o horário em que o cron disparou.
export TZ=America/Sao_Paulo
CARIMBO="$(date +%Y-%m-%d_%H%M)"
TEMP="$(mktemp -d)"
ARQUIVO="consensus-one_${CARIMBO}.dump"

limpar() { rm -rf "$TEMP"; }
trap limpar EXIT

echo "[$(date)] iniciando backup"

# ---------------------------------------------------------------- 1. dump
# O Postgres roda em container (EasyPanel), então o pg_dump não existe no host:
# ele roda DENTRO do container e o resultado sai pela saída padrão.
# CONTAINER_POSTGRES é o nome do container — veja com "docker ps".
if [ -n "${CONTAINER_POSTGRES:-}" ]; then
  docker exec -i "$CONTAINER_POSTGRES" pg_dump --format=custom --compress=9 --no-owner --no-privileges "$DATABASE_URL" > "${TEMP}/${ARQUIVO}"
else
  # Postgres instalado no próprio host
  pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="${TEMP}/${ARQUIVO}" "$DATABASE_URL"
fi

TAMANHO=$(stat -c%s "${TEMP}/${ARQUIVO}")
echo "dump gerado: ${TAMANHO} bytes"

# Um dump absurdamente pequeno quase sempre significa banco vazio ou erro
# silencioso. Melhor falhar aqui do que guardar lixo por 30 dias.
if [ "$TAMANHO" -lt 10240 ]; then
  echo "ERRO: dump menor que 10 KB. Abortando." >&2
  exit 1
fi

# ---------------------------------------------------------------- 2. cripto
# age com destinatário: cifra com a pública, só a privada abre.
age --recipient "$BACKUP_CHAVE_PUBLICA" \
  --output "${TEMP}/${ARQUIVO}.enc" \
  "${TEMP}/${ARQUIVO}"
echo "criptografado para $BACKUP_CHAVE_PUBLICA"

# ---------------------------------------------------------------- 3. envio
aws s3 cp "${TEMP}/${ARQUIVO}.enc" \
  "s3://${BACKUP_S3_BUCKET}/postgres/${ARQUIVO}.enc" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --only-show-errors
echo "enviado para ${BACKUP_S3_BUCKET}/postgres/${ARQUIVO}.enc"

# ---------------------------------------------------------------- 4. retenção
LIMITE=$(date -d "-${RETENCAO_DIAS} days" +%Y-%m-%d)
aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --endpoint-url "$BACKUP_S3_ENDPOINT" \
| while read -r data _ _ nome; do
    if [[ "$data" < "$LIMITE" ]]; then
      aws s3 rm "s3://${BACKUP_S3_BUCKET}/postgres/${nome}" --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
      echo "removido por retenção: ${nome}"
    fi
  done

# ---------------------------------------------------------------- 5. aviso
if [ -n "$PING_SUCESSO" ]; then
  curl -fsS -m 10 --retry 3 "$PING_SUCESSO" > /dev/null && echo "monitoramento avisado"
fi

echo "[$(date)] backup concluído"
