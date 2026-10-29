#!/usr/bin/env bash
# Genesis Radar — deploy/redeploy de 1 comando.
# Rodar COMO o usuário 'genesis':   sudo -iu genesis /opt/genesis/deploy/deploy.sh
#
# Faz: git pull → build do frontend → uv sync do backend → restart do serviço →
# smoke test do /health. Idempotente; pode rodar quantas vezes quiser.
set -euo pipefail

# Todo o corpo vive numa função: o bash parseia o arquivo INTEIRO antes de
# executar — assim o `git pull` do passo 1 pode atualizar este próprio script
# no disco sem corromper a execução em andamento.
main() {
    local REPO="/opt/genesis"
    # uv/npm ficam em ~/.local/bin. Resolve o HOME do usuário ATUAL via getent
    # (não confia no $HOME, que sob sudo pode vir do chamador) e põe no PATH.
    local _home
    _home="$(getent passwd "$(id -un)" | cut -d: -f6)"
    export PATH="$_home/.local/bin:$PATH"

    echo "==> [1/4] git pull"
    cd "$REPO"
    git pull --ff-only

    echo "==> [2/4] frontend build (npm ci && npm run build)"
    cd "$REPO/frontend"
    # o `tsc -b` do build emite .js DENTRO de src/ (gitignored) e o Vite os
    # resolve ANTES dos .tsx — os de um deploy anterior podiam ser servidos no
    # lugar do código novo. Apagar antes garante que o build saia do código atual.
    find src \( -name '*.js' -o -name '*.js.map' \) -delete
    npm ci
    # o droplet tem 1 GB de RAM: com o heap padrão do Node (~490 MB) o build da
    # landing morria por falta de memória. O swap de 2 GB cobre o excedente.
    export NODE_OPTIONS="--max-old-space-size=1536"
    # builda em dist.next e só troca no fim: o vite esvazia o outDir antes de
    # escrever, então um build que falhasse direto em dist/ derrubava o site.
    rm -rf dist.next
    npm run build -- --outDir dist.next --emptyOutDir   # index.html + landing.html + assets
    unset NODE_OPTIONS
    rm -rf dist.prev
    if [ -d dist ]; then mv dist dist.prev; fi
    mv dist.next dist

    echo "==> [3/4] backend deps (uv sync)"
    cd "$REPO/backend"
    uv sync                  # produção — sem --extra dev

    echo "==> [4/4] restart do serviço"
    sudo systemctl restart genesis-api

    # o boot carrega ~500 MB de parquets — dá até 30 s pra API subir,
    # em vez de acusar falha com o serviço ainda inicializando
    echo "==> smoke test (/api/v1/health)"
    for i in $(seq 1 30); do
        if curl -fsS http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then
            echo "    OK — API no ar (${i}s)."
            return 0
        fi
        sleep 1
    done
    echo "    FALHOU — /health não respondeu em 30s. Últimos logs:"
    sudo journalctl -u genesis-api -n 30 --no-pager
    return 1
}

main "$@"
