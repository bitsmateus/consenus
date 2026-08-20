#!/usr/bin/env bash
#
# Réplica dos documentos para fora do servidor.
#
# Os documentos ficam no MinIO do próprio VPS (ver docs/07). Isso significa
# disco único: se o servidor se perder, a origem se perde junto. Este script é
# a ÚNICA redundância que existe — não é conveniência, é o plano de desastre.
#
# Cada arquivo é cifrado com a chave PÚBLICA age antes de sair daqui, do mesmo
# jeito que o dump do banco. Os documentos trazem dados pessoais das partes e o
# conteúdo dos acordos, e o destino fica fora do país: mandar em claro seria
# pior do que a exposição que já aceitamos no disco local (docs/04).
#
# Rodar 1x por dia:
#   0 4 * * * /opt/consensus/sincronizar-arquivos.sh >> /var/log/consensus-sync.log 2>&1

set -Eeuo pipefail

# ---------------------------------------------------------------- config
: "${S3_ENDPOINT:?defina S3_ENDPOINT (origem, MinIO do VPS)}"
: "${S3_BUCKET:?defina S3_BUCKET}"
: "${S3_ACCESS_KEY_ID:?defina S3_ACCESS_KEY_ID (credencial da ORIGEM)}"
: "${S3_SECRET_ACCESS_KEY:?defina S3_SECRET_ACCESS_KEY (credencial da ORIGEM)}"

: "${BACKUP_S3_ENDPOINT:?defina BACKUP_S3_ENDPOINT (destino, R2)}"
: "${BACKUP_S3_BUCKET:?defina BACKUP_S3_BUCKET}"
: "${AWS_ACCESS_KEY_ID:?defina AWS_ACCESS_KEY_ID (credencial do DESTINO)}"
: "${AWS_SECRET_ACCESS_KEY:?defina AWS_SECRET_ACCESS_KEY (credencial do DESTINO)}"

: "${BACKUP_CHAVE_PUBLICA:?defina BACKUP_CHAVE_PUBLICA (age1...)}"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  echo "ERRO: BACKUP_PASSPHRASE presente no servidor. Remova." >&2
  exit 1
fi

for ferramenta in age aws; do
  command -v "$ferramenta" >/dev/null 2>&1 || {
    echo "ERRO: $ferramenta nao esta instalado." >&2
    exit 1
  }
done

export TZ=America/Sao_Paulo
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

# Origem e destino sao provedores DIFERENTES, com credenciais diferentes. A
# versao anterior mandava um unico --endpoint-url para os dois lados e por isso
# procurava a origem dentro do R2: nao achava nada, nao copiava nada e ainda
# terminava com sucesso. Silencio nao e sinal de que deu certo.
origem() {
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION="${S3_REGION:-br-se1}" \
  aws --endpoint-url "$S3_ENDPOINT" "$@"
}

destino() {
  AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-auto}" \
  aws --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"
}

echo "[$(date)] sincronizando documentos"

# ---------------------------------------------------------------- inventário
origem s3 ls "s3://${S3_BUCKET}/atos/" --recursive \
  | awk '{ $1=""; $2=""; $3=""; sub(/^ +/, ""); print }' \
  | grep -v '/$' | sort > "${TEMP}/origem.txt" || true

destino s3 ls "s3://${BACKUP_S3_BUCKET}/replica-atos/" --recursive \
  | awk '{ $1=""; $2=""; $3=""; sub(/^ +/, ""); print }' \
  | sed 's|^replica-atos/||; s|\.age$||' | sort > "${TEMP}/destino.txt" || true

TOTAL_ORIGEM=$(wc -l < "${TEMP}/origem.txt" | tr -d ' ')
echo "documentos na origem: ${TOTAL_ORIGEM}"

# Origem vazia num sistema em uso quase sempre significa credencial ou endpoint
# errados — foi assim que a versao anterior falhou em silencio por dias.
if [ "$TOTAL_ORIGEM" -eq 0 ]; then
  echo "AVISO: nenhum documento encontrado na origem." >&2
  echo "Se o sistema ja emitiu documentos, confira S3_ENDPOINT e as credenciais." >&2
fi

# ---------------------------------------------------------------- cópia
NOVOS=0
while IFS= read -r chave; do
  [ -n "$chave" ] || continue
  grep -Fxq "$chave" "${TEMP}/destino.txt" && continue

  local_arquivo="${TEMP}/arquivo"
  origem s3 cp "s3://${S3_BUCKET}/${chave}" "$local_arquivo" --only-show-errors
  age --recipient "$BACKUP_CHAVE_PUBLICA" --output "${local_arquivo}.age" "$local_arquivo"
  destino s3 cp "${local_arquivo}.age" "s3://${BACKUP_S3_BUCKET}/replica-atos/${chave}.age" --only-show-errors
  rm -f "$local_arquivo" "${local_arquivo}.age"

  NOVOS=$((NOVOS + 1))
  echo "replicado: ${chave}"
done < "${TEMP}/origem.txt"

echo "novos nesta execucao: ${NOVOS}"
echo "[$(date)] sincronizacao concluida"

# ---------------------------------------------------------------- aviso
if [ -n "${HEALTHCHECK_SYNC_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_SYNC_URL" > /dev/null && echo "monitoramento avisado"
fi
