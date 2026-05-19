"""Alavanca 2 · Portal da Transparência · contratos federais por CNPJ.

Empresas que fornecem ao governo federal têm valor anual de contratos
declarado com precisão (Lei 14.133/21 + LAI). Esse valor é PISO de
receita anual — útil pra:

  (a) Validar estimativa do motor (se piso > estimativa, motor errou)
  (b) Calibrar fórmula com sub-amostra de ground truth oficial

⚠️ REQUISITO: chave de API gratuita do Portal da Transparência.

Cadastro em https://api.portaldatransparencia.gov.br/swagger-ui.html
(opção "cadastre-se" no canto superior). Recebe chave em <5 min por email.

Setar antes de rodar:
    export PORTAL_TRANSPARENCIA_API_KEY="sua-chave-aqui"
    # ou no Windows:
    $env:PORTAL_TRANSPARENCIA_API_KEY="sua-chave-aqui"

Rate limits oficiais:
  - 30 req/min em horário comercial (06:00-00:00)
  - 90 req/min entre 00:00-06:00 (off-hours)

A 90 req/min: 46.115 CNPJs / 90 = 512 min ≈ 8.5h
A 30 req/min: ~25h
→ Estratégia: rodar batch overnight com sub-amostra (universo prioritário).
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import polars as pl

REPO = Path(__file__).resolve().parents[2]
PARQUET = REPO / "data" / "estimates_final.parquet"
OUT_PATH = REPO / "data" / "contratos_federais_por_cnpj.json"
CACHE_DIR = REPO / "data" / "cvm_cache" / "portal_transparencia"

API_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados"
API_KEY = os.environ.get("PORTAL_TRANSPARENCIA_API_KEY")

USER_AGENT = "GenesisRadar/1.0"
TIMEOUT = 30.0


@dataclass
class ContratoFederal:
    cnpj: str
    razao_social_motor: str
    n_contratos: int
    valor_total_brl: float
    contratos_vigentes: int
    ano_min: int | None
    ano_max: int | None
    estimativa_motor_brl: float
    piso_minimo_anual_brl: float  # valor_total / n_anos_distintos
    flag_subestimacao: bool        # piso > estimativa


def query_contratos(cnpj: str) -> list[dict]:
    """Consulta contratos pelo CNPJ contratado. Paginado.

    API doc: https://api.portaldatransparencia.gov.br/swagger-ui.html
    Endpoint: GET /contratos/cpf-cnpj?cpfCnpj=<CNPJ>&pagina=<N>
    (até 15 contratos por página)
    """
    if not API_KEY:
        raise RuntimeError(
            "PORTAL_TRANSPARENCIA_API_KEY ausente. "
            "Cadastre em https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email"
        )
    todos = []
    pagina = 1
    while True:
        url = (
            f"{API_BASE}/contratos/cpf-cnpj?"
            f"cpfCnpj={cnpj}&pagina={pagina}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "chave-api-dados": API_KEY,
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )
        page = None
        for tentativa in range(4):  # até 4 tentativas com backoff
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                    page = json.loads(resp.read())
                break
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(2 + tentativa * 2)  # backoff progressivo
                    continue
                if e.code in (401, 403):
                    raise RuntimeError(f"Chave API inválida ou expirada (HTTP {e.code})")
                return todos  # 4xx/5xx não-recuperável: devolve o que tem
            except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
                # timeout de socket, conexão resetada, JSON parcial — retry
                time.sleep(1 + tentativa * 2)
                continue
        if page is None:  # esgotou tentativas
            return todos
        if not page:
            break
        todos.extend(page)
        if len(page) < 15:  # tamanho de página padrão
            break
        pagina += 1
        if pagina > 50:  # safety: até 750 contratos por CNPJ
            break
    return todos


def _parse_brl(raw) -> float:
    """API às vezes devolve string 'R$ 1.234,56' ou número."""
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).replace("R$", "").replace(".", "").replace(",", ".").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_data_yyyy(raw) -> int | None:
    """API devolve dd/mm/yyyy ou yyyy-mm-dd."""
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if len(s) >= 10:
        if s[4] == "-":  # yyyy-mm-dd
            try:
                return int(s[:4])
            except ValueError:
                return None
        if s[2] == "/" and s[5] == "/":  # dd/mm/yyyy
            try:
                return int(s[6:10])
            except ValueError:
                return None
    return None


def aggregate(contratos: list[dict]) -> dict:
    """Agrega lista de contratos em estatísticas."""
    if not contratos:
        return {
            "n_contratos": 0,
            "valor_total_brl": 0.0,
            "contratos_vigentes": 0,
            "ano_min": None,
            "ano_max": None,
        }
    valores = [_parse_brl(c.get("valorInicialCompra") or c.get("valorFinalCompra")) for c in contratos]
    anos = []
    vigentes = 0
    for c in contratos:
        ano = _parse_data_yyyy(c.get("dataAssinatura") or c.get("dataInicioVigencia"))
        if ano:
            anos.append(ano)
        sit = (c.get("situacaoContrato") or c.get("situacao") or "").lower()
        if "vigente" in sit or "ativo" in sit:
            vigentes += 1
    return {
        "n_contratos": len(contratos),
        "valor_total_brl": sum(valores),
        "contratos_vigentes": vigentes,
        "ano_min": min(anos) if anos else None,
        "ano_max": max(anos) if anos else None,
    }


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                        help="Limita N CNPJs (pra teste rápido)")
    parser.add_argument("--sectors", default="F,G,H,J,M,N,P,Q",
                        help="Seções CNAE a priorizar (default: setores típicos de fornecedor federal)")
    parser.add_argument("--min-receita", type=float, default=5_000_000,
                        help="Receita estimada mínima pra incluir (default R$5M)")
    args = parser.parse_args()

    if not API_KEY:
        print("ERRO · PORTAL_TRANSPARENCIA_API_KEY não está definida.", file=sys.stderr)
        print()
        print("Para obter chave:", file=sys.stderr)
        print("  1. Acesse https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email")
        print("  2. Cadastre e-mail (chave chega em <5 min)")
        print("  3. Setar no shell:")
        print('     $env:PORTAL_TRANSPARENCIA_API_KEY = "<chave>"')
        return 2

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    df = pl.read_parquet(PARQUET)
    # Aplica escopo + prioridade
    setores = args.sectors.split(",")
    df = df.filter(
        (pl.col("natureza_juridica") == "2062")
        & (pl.col("receita_point_brl") >= args.min_receita)
        & (pl.col("cnae_secao").is_in(setores))
        & (~pl.col("archetype").is_in(["holding_structure"]))
    )
    print(f"Subset prioritário: {df.height:,} CNPJs (Ltda + setores {setores} + receita ≥ R$ {args.min_receita/1e6:.0f}M)", file=sys.stderr)

    if args.limit:
        df = df.head(args.limit)
        print(f"Limit aplicado: testando {args.limit} primeiros", file=sys.stderr)

    resultados: list[ContratoFederal] = []
    hit_count = 0
    start_time = time.time()
    REQ_INTERVAL = 0.7  # 90 req/min off-hour ou 30 req/min on-hour com margem

    for i, row in enumerate(df.iter_rows(named=True), 1):
        cnpj = row["cnpj"]
        cache_file = CACHE_DIR / f"{cnpj}.json"
        if cache_file.exists():
            contratos = json.loads(cache_file.read_text(encoding="utf-8"))
        else:
            contratos = query_contratos(cnpj)
            cache_file.write_text(json.dumps(contratos), encoding="utf-8")
            time.sleep(REQ_INTERVAL)

        if not contratos:
            continue

        agg = aggregate(contratos)
        n_anos = max(1, (agg["ano_max"] or 0) - (agg["ano_min"] or 0) + 1) if agg["ano_min"] else 1
        piso_anual = agg["valor_total_brl"] / n_anos
        estimativa = row["receita_point_brl"] or 0
        flag_sub = piso_anual > estimativa

        gt = ContratoFederal(
            cnpj=cnpj,
            razao_social_motor=row["razao_social"],
            n_contratos=agg["n_contratos"],
            valor_total_brl=agg["valor_total_brl"],
            contratos_vigentes=agg["contratos_vigentes"],
            ano_min=agg["ano_min"],
            ano_max=agg["ano_max"],
            estimativa_motor_brl=estimativa,
            piso_minimo_anual_brl=piso_anual,
            flag_subestimacao=flag_sub,
        )
        resultados.append(gt)
        hit_count += 1

        if i % 50 == 0:
            elapsed = time.time() - start_time
            rate = i / elapsed * 60 if elapsed > 0 else 0
            print(f"  [{i}/{df.height}] hits {hit_count} · {rate:.0f} req/min", file=sys.stderr)

    out = [asdict(r) for r in resultados]
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(file=sys.stderr)
    print(f"=== Resumo ===", file=sys.stderr)
    print(f"CNPJs consultados:  {df.height:,}", file=sys.stderr)
    print(f"Com contratos:      {hit_count:,}  ({hit_count/df.height*100:.1f}%)", file=sys.stderr)
    subestimadas = sum(1 for r in resultados if r.flag_subestimacao)
    print(f"Subestimadas pelo motor (piso > estimativa): {subestimadas}", file=sys.stderr)
    print(f"Saída: {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
