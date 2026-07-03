# deploy/ — artefatos de produção (Hetzner · Modelo A)

Arquivos prontos pra pôr o Genesis Radar no ar num VPS único com Caddy + systemd.
O *porquê* está em [`../docs/deploy.md`](../docs/deploy.md); o passo a passo humano
(comprar domínio, provisionar, DNS) está em
[`../to-do-lists/dia-30.md`](../to-do-lists/dia-30.md).

| Arquivo | O que é | Vai para |
|---|---|---|
| `genesis-api.service` | Serviço systemd do backend uvicorn (single-process) | `/etc/systemd/system/` |
| `Caddyfile` | HTTPS automático + estático + proxy `/api` | `/etc/caddy/Caddyfile` |
| `deploy.sh` | Deploy/redeploy de 1 comando (pull → build → sync → restart → health) | fica no repo |
| `backup-users-db.sh` | Backup diário do `users.db` (SQLite) — cópia consistente + integrity_check + rotação 14d | fica no repo; cron chama |

**Layout no servidor:** repo em `/opt/genesis`, dono `genesis:genesis`. Caddy
serve `/opt/genesis/frontend/dist`; backend em `/opt/genesis/backend`; o
`users.db` (SQLite) fica em `/opt/genesis/backend/` — disco persistente do VPS.

---

## Setup inicial (uma vez, no VPS já provisionado — Fase 6)

Pré-requisitos da Fase 2 já feitos: `git`, `uv`, Node 20+ e `caddy` instalados;
firewall liberando 80/443; **swap de 2 GB ativo** (box de 1 GB — o `npm run build`
pica acima de 1 GB). Então, como seu usuário sudo:

```bash
# 1. usuário de serviço dono do app
sudo useradd --system --create-home --shell /bin/bash genesis

# 2. clonar o repo em /opt/genesis
sudo mkdir -p /opt/genesis && sudo chown genesis:genesis /opt/genesis
sudo -u genesis git clone <URL_DO_REPO> /opt/genesis
sudo chmod +x /opt/genesis/deploy/deploy.sh   # garante o bit de execução

# 3. uv e Node já estão system-wide (instalados na Fase 2, em /usr/local/bin e
#    /usr/bin) — nada a fazer aqui. Confira: uv --version && node -v

# 4. secrets de produção (Fase 5) — criar /opt/genesis/backend/.env
sudo -u genesis nano /opt/genesis/backend/.env   # ver docs/deploy.md §4

# 5. deixar o genesis reiniciar o serviço e recarregar o Caddy sem senha
echo 'genesis ALL=(root) NOPASSWD: /usr/bin/systemctl restart genesis-api, /usr/bin/systemctl reload caddy' \
  | sudo tee /etc/sudoers.d/genesis-deploy
sudo chmod 440 /etc/sudoers.d/genesis-deploy

# 6. instalar o serviço systemd e o Caddyfile
sudo cp /opt/genesis/deploy/genesis-api.service /etc/systemd/system/
sudo cp /opt/genesis/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload

# 7. primeiro build + subir tudo
#    -iu = login shell do usuário genesis (HOME/PATH corretos p/ uv e npm)
sudo -iu genesis /opt/genesis/deploy/deploy.sh  # build front + uv sync
sudo systemctl enable --now genesis-api          # sobe a API no boot
sudo systemctl reload caddy                       # publica o site + tira o HTTPS
```

> ⚠️ O `deploy.sh` do passo 7 vai tentar `systemctl restart genesis-api` antes de
> o serviço existir — tudo bem, rode `enable --now` logo em seguida. A partir do
> 2º deploy, o `deploy.sh` sozinho já faz o ciclo completo.

## Redeploy (toda vez que houver código novo)

```bash
sudo -iu genesis /opt/genesis/deploy/deploy.sh
```

> Fluxo completo (editar local → push → redeploy) + os casos que **não** são
> código (env/secret, Caddyfile, systemd) + como reverter: `docs/deploy.md` §9.
> Se o bit `+x` sumir num checkout: `sudo -iu genesis bash .../deploy.sh`.

## Backup do `users.db` (Fase 8)

`users.db` (SQLite, em `/opt/genesis/backend/`) guarda o cadastro dos clientes
pagantes e o vínculo com a assinatura Stripe — perder é irreversível.

- **Script:** `deploy/backup-users-db.sh` — `sqlite3 .backup` (cópia consistente
  mesmo com o serviço escrevendo) → `integrity_check` → `gzip` → rotação 14 dias.
- **Destino:** `/var/backups/genesis/users-<ts>.db.gz` (dono `genesis`).
- **Agenda:** `/etc/cron.d/genesis-backup` roda como `genesis` às 03:00; log em
  `/var/backups/genesis/backup.log`.
- **Manual / restaurar:**
  ```bash
  sudo -u genesis /opt/genesis/deploy/backup-users-db.sh          # rodar na hora
  # restaurar (com o serviço parado): gunzip -c users-<ts>.db.gz > users.db
  ```
- ⚠️ **Local, não offsite:** protege contra corrupção/deploy ruim, **não** contra
  perda do droplet. Offsite (DigitalOcean Spaces, rsync p/ outro host) é o passo 2
  — precisa de destino + credencial.

## Verificação

```bash
curl -s https://app.genesisradar.com.br/api/v1/health        # {"status":"ok"}
curl -s https://app.genesisradar.com.br/api/v1/auth/config    # flags de auth/billing
```

Checklist de segurança pós-deploy: [`../docs/security.md`](../docs/security.md) e
Fase 7 de [`../to-do-lists/dia-30.md`](../to-do-lists/dia-30.md).
