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
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"
: "${BACKUP_S3_BUCKET:?defina BACKUP_S3_BUCKET}"
: "${BACKUP_S3_ENDPOINT:?defina BACKUP_S3_ENDPOINT}"

RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
PING_SUCESSO="${HEALTHCHECK_URL:-}"    # ex.: https://hc-ping.com/SEU-UUID

TZ=America/Sao_Paulo
CARIMBO="$(date +%Y-%m-%d_%H%M)"
TEMP="$(mktemp -d)"
ARQUIVO="consensus-one_${CARIMBO}.dump"

limpar() { rm -rf "$TEMP"; }
trap limpar EXIT

echo "[$(date)] iniciando backup"

# ---------------------------------------------------------------- 1. dump
pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  --file="${TEMP}/${ARQUIVO}" "$DATABASE_URL"

TAMANHO=$(stat -c%s "${TEMP}/${ARQUIVO}")
echo "dump gerado: ${TAMANHO} bytes"

# Um dump absurdamente pequeno quase sempre significa banco vazio ou erro
# silencioso. Melhor falhar aqui do que guardar lixo por 30 dias.
if [ "$TAMANHO" -lt 10240 ]; then
  echo "ERRO: dump menor que 10 KB. Abortando." >&2
  exit 1
fi

# ---------------------------------------------------------------- 2. cripto
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "${TEMP}/${ARQUIVO}" \
  -out "${TEMP}/${ARQUIVO}.enc" \
  -pass env:BACKUP_PASSPHRASE
echo "criptografado"

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
