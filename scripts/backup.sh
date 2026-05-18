#!/usr/bin/env bash
# GoldWen — PostgreSQL backup script
# Usage: ./scripts/backup.sh
# Required env: DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD,
#               DATABASE_NAME, S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID,
#               AWS_SECRET_ACCESS_KEY
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DUMP_FILE="/tmp/goldwen_${TIMESTAMP}.sql.gz"
S3_KEY="backups/goldwen_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo "[backup] Starting PostgreSQL backup — $(date -u)"

# Dump + gzip in one pass
PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
  -h "$DATABASE_HOST" \
  -p "${DATABASE_PORT:-5432}" \
  -U "$DATABASE_USERNAME" \
  -d "$DATABASE_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip > "$DUMP_FILE"

SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo "[backup] Dump complete — $SIZE — uploading to s3://$S3_BUCKET/$S3_KEY"

# Upload to S3
AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION="${S3_REGION:-eu-west-3}" \
aws s3 cp "$DUMP_FILE" "s3://$S3_BUCKET/$S3_KEY" \
  --storage-class STANDARD_IA \
  --sse AES256

rm -f "$DUMP_FILE"
echo "[backup] Upload complete."

# Prune backups older than RETENTION_DAYS
echo "[backup] Pruning backups older than ${RETENTION_DAYS} days..."
CUTOFF=$(date -u -d "-${RETENTION_DAYS} days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -v-"${RETENTION_DAYS}"d +"%Y-%m-%dT%H:%M:%SZ")

AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION="${S3_REGION:-eu-west-3}" \
aws s3api list-objects-v2 \
  --bucket "$S3_BUCKET" \
  --prefix "backups/" \
  --query "Contents[?LastModified<='$CUTOFF'].[Key]" \
  --output text \
| while read -r key; do
    [ -z "$key" ] && continue
    echo "[backup] Deleting old backup: $key"
    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="${S3_REGION:-eu-west-3}" \
    aws s3 rm "s3://$S3_BUCKET/$key"
  done

echo "[backup] Done — $(date -u)"
