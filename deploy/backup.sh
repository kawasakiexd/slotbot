#!/usr/bin/env bash
set -euo pipefail
DIR=/opt/slotbot
BACKUP_DIR=/var/backups/slotbot
mkdir -p "$BACKUP_DIR"
cd "$DIR"
docker compose exec -T postgres pg_dump -U slotbot -Fc slotbot > "$BACKUP_DIR/$(date +%F).dump"
find "$BACKUP_DIR" -name '*.dump' -mtime +14 -delete
