#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# backup-campaigncodex.sh
# Daily PostgreSQL backup for CampaignCodex — local 7-day rotation.
#
# DEPLOY:   copy to /home/ragnarok1414/scripts/backup-campaigncodex.sh
# CHMOD:    chmod +x /home/ragnarok1414/scripts/backup-campaigncodex.sh
# CRON:     0 3 * * * /home/ragnarok1414/scripts/backup-campaigncodex.sh
#
# Reads DB credentials from the app's own .env file — no hardcoded secrets.
# Writes a gzip-compressed pg_dump to BACKUP_DIR with a timestamp in the name.
# Rotates: deletes backups older than KEEP_DAYS.
# Logs each run to backup.log in the same directory.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
ENV_FILE="/home/ragnarok1414/CampaignCodex/backend/.env"
BACKUP_DIR="/home/ragnarok1414/backups/campaigncodex"
KEEP_DAYS=7
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="campaigncodex_${TIMESTAMP}.sql.gz"
LOGFILE="${BACKUP_DIR}/backup.log"

# ── Ensure backup directory exists ───────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

log() { echo "[$(date +"%Y-%m-%d %H:%M:%S")] $*" >> "$LOGFILE"; }

# ── Source credentials from .env ─────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  log "[ERROR] .env file not found at $ENV_FILE — aborting"
  exit 1
fi

_val() { grep "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' '; }

DB_HOST=$(     _val DB_HOST     )
DB_PORT=$(     _val DB_PORT     )
DB_NAME=$(     _val DB_NAME     )
DB_USER=$(     _val DB_USER     )
DB_PASSWORD=$( _val DB_PASSWORD )

if [[ -z "$DB_NAME" || -z "$DB_USER" || -z "$DB_PASSWORD" ]]; then
  log "[ERROR] Missing DB credentials in .env — aborting"
  exit 1
fi

# ── Run pg_dump ───────────────────────────────────────────────────────────────
log "Starting backup: ${FILENAME}"

export PGPASSWORD="$DB_PASSWORD"
pg_dump \
  -h "${DB_HOST:-localhost}" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-password \
  | gzip -9 > "${BACKUP_DIR}/${FILENAME}"

unset PGPASSWORD

# ── Verify the file was created and is non-empty ─────────────────────────────
if [[ ! -s "${BACKUP_DIR}/${FILENAME}" ]]; then
  log "[ERROR] Backup file is empty or missing — pg_dump may have failed"
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
log "Backup OK: ${FILENAME} (${SIZE})"

# ── Rotate: delete backups older than KEEP_DAYS ──────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "campaigncodex_*.sql.gz" -mtime +${KEEP_DAYS} -print -delete | wc -l)
log "Rotation: removed ${DELETED} file(s) older than ${KEEP_DAYS} days"

log "Done."
