#!/usr/bin/env bash
#
# Réplica dos documentos para um segundo provedor.
#
# Os arquivos ficam no MinIO do proprio VPS (Sao Paulo, territorio nacional).
# Este script mantem uma copia espelhada no Cloudflare R2 — e aqui ela e a
# UNICA redundancia que existe, porque a origem e um disco so.
#
# ATENCAO: a copia vai EM CLARO. O banco e cifrado com age antes de sair do
# servidor; os documentos, nao. Risco registrado em docs/04.
#
# Rodar 1x por dia:
#   0 4 * * * /caminho/infra/sincronizar-arquivos.sh >> /var/log/sync.log 2>&1

set -Eeuo pipefail

: "${S3_BUCKET:?}"; : "${S3_ENDPOINT:?}"
: "${BACKUP_S3_BUCKET:?}"; : "${BACKUP_S3_ENDPOINT:?}"

echo "[$(date)] sincronizando documentos"

aws s3 sync "s3://${S3_BUCKET}/atos/" "s3://${BACKUP_S3_BUCKET}/replica-atos/" \
  --source-region "${S3_REGION:-br-se1}" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --only-show-errors

echo "[$(date)] sincronização concluída"
