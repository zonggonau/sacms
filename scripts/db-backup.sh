#!/bin/bash
# Database backup script for ContentFlow
# Usage: ./scripts/db-backup.sh [output_dir]
#
# Environment variables:
#   DATABASE_URL — PostgreSQL connection string (required)
#
# Retention: keeps last 7 daily backups

set -euo pipefail

BACKUP_DIR="${1:-./db/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/contentflow_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."
pg_dump "$DATABASE_URL" --format=custom --compress=6 --file="$BACKUP_FILE"
echo "[$(date)] Backup saved to $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Rotate old backups — keep last 7
REMOVED=$(ls -t "$BACKUP_DIR"/contentflow_*.dump 2>/dev/null | tail -n +8)
if [ -n "$REMOVED" ]; then
  echo "$REMOVED" | xargs rm -f
  echo "[$(date)] Removed old backups"
fi

echo "[$(date)] Backup complete"
