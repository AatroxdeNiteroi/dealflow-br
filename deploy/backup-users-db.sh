#!/usr/bin/env bash
# Backup diário do users.db (SQLite) do Genesis Radar — cópia consistente,
# verificação de integridade e rotação. É o cadastro de clientes pagantes:
# perder = irreversível (e quebra o vínculo cliente↔assinatura Stripe).
#
# Roda como o usuário 'genesis' via /etc/cron.d/genesis-backup (03:00 diário).
# Manual:  sudo -u genesis /opt/genesis/deploy/backup-users-db.sh
set -euo pipefail

DB="/opt/genesis/data/users.db"
DEST="/var/backups/genesis"
KEEP_DAYS=14

mkdir -p "$DEST"

if [ ! -f "$DB" ]; then
    echo "$(date -Is) users.db ainda não existe ($DB) — nada a fazer."
    exit 0
fi

ts="$(date +%Y%m%d-%H%M%S)"
tmp="$DEST/users-$ts.db"

# .backup = cópia consistente mesmo com o serviço escrevendo (lida com WAL),
# ao contrário de um cp cru do arquivo.
sqlite3 "$DB" ".backup '$tmp'"

# valida a cópia ANTES de confiar nela
check="$(sqlite3 "$tmp" 'PRAGMA integrity_check;')"
if [ "$check" != "ok" ]; then
    echo "$(date -Is) FALHA: integrity_check de $tmp = '$check' (esperado 'ok')" >&2
    rm -f "$tmp"
    exit 1
fi

gzip -f "$tmp"

# rotação: remove backups com mais de KEEP_DAYS dias
find "$DEST" -maxdepth 1 -name 'users-*.db.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) OK: ${tmp}.gz ($(du -h "${tmp}.gz" | cut -f1)) · retidos $(find "$DEST" -maxdepth 1 -name 'users-*.db.gz' | wc -l)"
