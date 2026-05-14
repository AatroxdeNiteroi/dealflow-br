# LGPD · Runbook de remediação

Itens implementados em código pelo audit pass de 2026-05-14 e o que ainda
exige ação humana (legal, ops, conta no Git provider, etc.).

## ✅ Implementado em código

| Área | Mudança | Arquivos |
|---|---|---|
| Modais legais | TermosModal + PrivacidadeModal + LegalProvider context | `frontend/src/components/Modal/{Termos,Privacidade}Modal.tsx`, `frontend/src/legal/*` |
| Footer global | Footer com links Termos/Privacidade/Encarregado, controlador identificado | `frontend/src/components/Footer/Footer.tsx`, `pages/Home.tsx` |
| Aviso AI Search | Notice de transferência internacional + link Privacidade | `frontend/src/components/AISearch/AISearchOverlay.tsx` |
| Aviso Contato | Notice sobre PII de terceiros + links Termos/Privacidade | `frontend/src/components/Contato/ContatoPanel.tsx` |
| Aviso watchlist | Hint sobre não inserir dados sensíveis no textarea | `frontend/src/components/Watchlist/StatusModal.tsx` |
| Direitos do titular | Botões "Exportar JSON" e "Apagar tudo" (art. 18 V, VI) | `frontend/src/components/Watchlist/WatchlistView.tsx`, `watchlist/storage.ts`, `hooks/useWatchlist.ts` |
| Self-host fontes | @fontsource (não vaza IP ao Google) | `frontend/src/main.tsx`, `styles/modules/tokens.css` |
| Claims defensíveis | Removido "elite do mercado / modelo proprietário validado" — substituído por afirmações verificáveis | `frontend/src/components/Modal/MetodologiaModal.tsx` |
| PDF caveat | Disclaimer LGPD nos contatos + rodapé "uso restrito · não redistribuir" | `frontend/src/utils/pdf.ts` |
| Auth backend | Middleware `X-Api-Key` (env `DEALFLOW_API_KEY`) | `backend/src/dealflow_api/security.py`, `main.py` |
| Rate-limit | Janela deslizante 60s por IP, configurável | mesmo arquivo |
| Audit log | JSONL estruturado (art. 37) | mesmo arquivo |
| CORS env | `DEALFLOW_CORS_ORIGINS` CSV/JSON ao invés de hardcoded | `backend/src/dealflow_api/settings.py` |
| HMAC sócios | `DEALFLOW_SOCIOS_SALT` obrigatório · SHA1 → HMAC-SHA256 | `scripts/export_socios_index.py` |
| Licença | `LICENSE` proprietário + README atualizado | raiz |
| .gitignore | Parquets com PII bloqueados pra commits futuros | `.gitignore` |

## 🟡 Exige ação humana — antes de exposição comercial

### 1. Preencher conteúdo dos documentos legais

Os modais já existem e abrem do rodapé. O texto é stub.

- `frontend/src/legal/dpo.ts` — substituir placeholders: razão social do
  controlador, CNPJ, endereço, website, nome do Encarregado, email do DPO,
  data de vigência. Atualizar `LEGAL_VERSAO` a cada revisão.
- `frontend/src/legal/TermosContent.tsx` — substituir cada `[preencher]`
  pelo texto redigido por advogado.
- `frontend/src/legal/PrivacidadeContent.tsx` — idem.
- `LICENSE` — preencher nome do titular e email de contato para
  licenciamento.

### 2. Indicar Encarregado (DPO) · LGPD art. 41

Obrigatório mesmo para porte pequeno. Pode ser pessoa física interna ou
contratada. Publicar nome + email no rodapé (já cabeado em `dpo.ts`) e na
Política de Privacidade.

### 3. DPA com Anthropic · transferência internacional

A funcionalidade "Busca com IA" envia o prompt do usuário para servidores
da Anthropic nos EUA. Antes de uso comercial:

1. Acessar console.anthropic.com → Settings → Privacy → Data Processing
   Addendum
2. Assinar o DPA (cobre LGPD/GDPR)
3. Documentar a transferência na Política de Privacidade

### 4. Avaliação de Legítimo Interesse (LIA) · art. 7º IX

Para tratar dados de sócios (PF) extraídos de fonte pública (RFB) com base
em legítimo interesse, é preciso documentar a LIA:
- Finalidade declarada e legítima
- Necessidade (não há base mais branda)
- Balanceamento entre interesse do controlador e direitos do titular
- Salvaguardas adotadas (pseudonimização, rate-limit, audit, etc.)

Documento interno · não publica, mas precisa existir caso a ANPD fiscalize.

## 🔴 Ação destrutiva pendente · histórico Git

Os arquivos `data/contato.parquet` (3.1 MB de telefones/emails/endereços),
`data/socios_index.parquet` e `data/headcount_history.parquet` foram
**commitados em versões anteriores** do repositório público
`AatroxdeNiteroi/dealflow-br`. O `.gitignore` agora previne commits futuros,
mas o histórico ainda tem cópias.

### Opção A · reescrita de histórico com `git-filter-repo`

```bash
# Instale: https://github.com/newren/git-filter-repo
pip install git-filter-repo

# Reescreve histórico removendo os 3 parquets de TODOS os commits:
git filter-repo \
  --path data/contato.parquet \
  --path data/socios_index.parquet \
  --path data/headcount_history.parquet \
  --invert-paths

# Force-push (avisar a todos os colaboradores antes — eles precisarão re-clonar):
git push origin --force --all
git push origin --force --tags
```

### Opção B · deletar e recriar o repositório como privado

Mais radical, mais seguro. Quem já clonou ainda tem o histórico antigo,
mas a cópia pública some imediatamente.

### Limitações de qualquer abordagem

- **GitHub mantém cache** de commits órfãos por ~90 dias. Para forçar
  remoção imediata, abrir ticket de suporte GitHub citando incidente LGPD.
- **Quem clonou** o repositório antes da reescrita continua com cópia
  local — não há como recuperar.
- **ANPD**: a exposição pública pode configurar incidente de segurança
  reportável (art. 48). Avaliar com jurídico se notificação é exigida.

## ⚙️ Operacional · variáveis de ambiente

Cópia obrigatória de `backend/.env.example` → `backend/.env` em produção,
preenchendo:

- `DEALFLOW_API_KEY` — chave de auth (≥ 32 chars random)
- `DEALFLOW_CORS_ORIGINS` — domínios reais (não localhost)
- `DEALFLOW_AUDIT_LOG_PATH` — caminho persistente (ex: `/var/log/dealflow/audit.jsonl`)
- `DEALFLOW_ANTHROPIC_API_KEY` — chave Anthropic
- `DEALFLOW_SOCIOS_SALT` — só ao rodar `scripts/export_socios_index.py` (gere com `openssl rand -hex 32`, guarde em vault)

## 📋 Canal de exercício de direitos · LGPD art. 18

Já implementado:
- Botões UI: "Exportar JSON" e "Apagar tudo" da watchlist
- Footer com `mailto:` do DPO

Falta:
- Definir email real do DPO (`frontend/src/legal/dpo.ts`)
- Processo interno para responder requisições em 15 dias (art. 19)
- Modelo de resposta padrão
