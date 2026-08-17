#!/usr/bin/env bash
#
# TESTE DE RESTAURAÇÃO — rodar TODO MÊS, sem exceção.
#
# Baixa o backup mais recente, restaura num banco descartável e confere se os
# dados estão lá. Backup que nunca foi restaurado não é backup, é esperança.
#
# Uso:
#   ./infra/restaurar-backup.sh                  # pega o mais recente
#   ./infra/restaurar-backup.sh arquivo.dump.enc # restaura um específico
#
# Registre o resultado na planilha de operação (docs/07).

set -Eeuo pipefail

# Chave privada, vinda do gerenciador de senhas. Este script roda na SUA
# máquina, nunca no VPS — é o único momento em que a chave sai do cofre.
: "${BACKUP_CHAVE_PRIVADA:?defina BACKUP_CHAVE_PRIVADA (caminho do arquivo .key)}"
: "${BACKUP_S3_BUCKET:?defina BACKUP_S3_BUCKET}"
: "${BACKUP_S3_ENDPOINT:?defina BACKUP_S3_ENDPOINT}"
: "${PGHOST:?defina PGHOST}"
: "${PGUSER:?defina PGUSER}"

BANCO_TESTE="restauracao_teste_$(date +%s)"
TEMP="$(mktemp -d)"

limpar() {
  dropdb --if-exists "$BANCO_TESTE" 2>/dev/null || true
  rm -rf "$TEMP"
}
trap limpar EXIT

# ---------------------------------------------------------------- escolher
if [ $# -ge 1 ]; then
  ALVO="$1"
else
  ALVO=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --endpoint-url "$BACKUP_S3_ENDPOINT" \
         | sort | tail -n1 | awk '{print $4}')
fi

if [ -z "${ALVO:-}" ]; then
  echo "ERRO: nenhum backup encontrado no bucket." >&2
  exit 1
fi

echo "restaurando: $ALVO"

# ---------------------------------------------------------------- baixar
aws s3 cp "s3://${BACKUP_S3_BUCKET}/postgres/${ALVO}" "${TEMP}/${ALVO}" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors

age --decrypt --identity "$BACKUP_CHAVE_PRIVADA" \
  --output "${TEMP}/restaurado.dump" \
  "${TEMP}/${ALVO}"

# ---------------------------------------------------------------- restaurar
createdb "$BANCO_TESTE"
pg_restore --no-owner --no-privileges --dbname="$BANCO_TESTE" "${TEMP}/restaurado.dump"

# ---------------------------------------------------------------- conferir
echo ""
echo "================ CONFERÊNCIA ================"
psql --dbname="$BANCO_TESTE" --tuples-only --command "
  SELECT 'Usuários:    ' || count(*) FROM \"Usuario\";
  SELECT 'Pessoas:     ' || count(*) FROM \"Pessoa\";
  SELECT 'Atos:        ' || count(*) FROM \"Ato\";
  SELECT 'Documentos:  ' || count(*) FROM \"Documento\";
  SELECT 'Ato mais recente: ' || COALESCE(max(\"criadoEm\")::text, 'nenhum') FROM \"Ato\";
"
echo "============================================="
echo ""
echo "Se os números acima fazem sentido, o backup está íntegro."
echo "Anote a data deste teste na planilha de operação."
