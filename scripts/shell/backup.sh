#!/bin/bash
# SaCMS — Daily Database Backup
# Runs at 02:00 WIB daily (19:00 UTC)
BACKUP_DIR="/root/.openclaw/workspace/sacms/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Dump the database
su - postgres -c "pg_dump sacms -Fc" > "$BACKUP_DIR/sacms_$TIMESTAMP.dump" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] ✅ Backup OK — sacms_$TIMESTAMP.dump ($(du -h "$BACKUP_DIR/sacms_$TIMESTAMP.dump" | cut -f1))"
else
    echo "[$TIMESTAMP] ❌ Backup FAILED"
fi

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "sacms_*.dump" -mtime +$RETENTION_DAYS -delete
