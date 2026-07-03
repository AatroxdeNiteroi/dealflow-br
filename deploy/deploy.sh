#!/usr/bin/env bash
# Genesis Radar — deploy/redeploy de 1 comando.
# Rodar COMO o usuário 'genesis':   sudo -u genesis /opt/genesis/deploy/deploy.sh
#
# Faz: git pull → build do frontend → uv sync do backend → restart do serviço →
# smoke test do /health. Idempotente; pode rodar quantas vezes quiser.
set -euo pipefail

REPO="/opt/genesis"
# uv/npm ficam em ~/.local/bin. Resolve o HOME do usuário ATUAL via getent (não
# confia no $HOME, que sob sudo pode vir do chamador) e o põe no PATH.
_home="$(getent passwd "$(id -un)" | cut -d: -f6)"
export PATH="$_home/.local/bin:$PATH"

echo "==> [1/4] git pull"
cd "$REPO"
git pull --ff-only

echo "==> [2/4] frontend build (npm ci && npm run build)"
cd "$REPO/frontend"
npm ci
npm run build            # gera frontend/dist: index.html + landing.html + assets

echo "==> [3/4] backend deps (uv sync)"
cd "$REPO/backend"
uv sync                  # produção — sem --extra dev

echo "==> [4/4] restart do serviço"
sudo systemctl restart genesis-api

echo "==> smoke test (/api/v1/health)"
sleep 1
if curl -fsS http://127.0.0.1:8000/api/v1/health >/dev/null; then
    echo "    OK — API no ar."
else
    echo "    FALHOU — últimos logs:"
    sudo journalctl -u genesis-api -n 30 --no-pager
    exit 1
fi
