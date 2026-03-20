#!/bin/bash
# Restore database from backup
# Usage: ./scripts/db-restore.sh <backup_file>
#
# Environment variables:
#   DATABASE_URL — PostgreSQL connection string (required)

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -lt db/backups/contentflow_*.dump 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date)] Restoring from $BACKUP_FILE..."
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$BACKUP_FILE"
echo "[$(date)] Restore complete"
