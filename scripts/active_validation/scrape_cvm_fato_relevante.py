"""Scraper de Fato Relevante CVM · extrai receita de alvos de aquisição.

Fluxo:
  1. Baixa metadados IPE (Informações Periódicas Eventuais) da CVM em
     dados.cvm.gov.br · contém todos os Fatos Relevantes publicados.
  2. Filtra apenas FR com termos de aquisição no Assunto (exclui recompra
     de ações próprias, OPA de alienação de controle, etc.).
  3. Baixa cada PDF.
  4. Extrai texto + busca:
     - Nome do alvo da aquisição
     - CNPJ do alvo (quando disponível)
     - Receita anual do alvo (regex sobre padrões pt-BR)
  5. Cruza com Tier 1 do parquet (estimates_final).
  6. Salva data/active_validation_v1.json com ground truths confiáveis.

Por que essa fonte não tem viés de declínio (vs Recuperação Judicial):
  - Empresa adquirida está em operação normal/saudável (vendedora cuidou
    de auditar antes de fechar deal; comprador pagou múltiplo decente).
  - Receita declarada no fato relevante tem responsabilidade jurídica
    (informação material ao mercado · CVM 358).
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(__file__).resolve().parents[2]
CACHE = REPO / "data" / "cvm_cache"
OUT_DIR = REPO / "data"
PARQUET = REPO / "data" / "estimates_final.parquet"

CVM_IPE_BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 GenesisRadar/1.0"
HEADERS = {"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9"}

# Termos POSITIVOS no Assunto · indicam aquisição de target externa
PATTERN_POSITIVO = re.compile(
    r"aquisi[cç][aã]o|incorporac[aã]o|incorporação|aquisição|combina[cç][aã]o de neg[oó]cios|"
    r"compra de.*(empresa|sociedade|controle|ações de|participa)",
    re.IGNORECASE,
)

# Termos NEGATIVOS · tratam de ações próprias ou alienação de controle
PATTERN_NEGATIVO = re.compile(
    r"recompra|ações em tesouraria|ações próprias|alienac[aã]o de controle|alienação de controle|"
    r"oferta p[uú]blica de aquisi[cç][aã]o.*emiss[aã]o da pr[oó]pria|"
    r"ações? de emiss[aã]o da pr[oó]pria companhia|"
    r"aquisi[cç][aã]o complementar.*tesouraria|"
    r"ILP|programa de recompra",
    re.IGNORECASE,
)

# Padrões pra extrair receita do TEXTO do PDF
RECEITA_PATTERNS = [
    re.compile(
        r"receita\s+(?:l[ií]quida|bruta|operacional)?\s*(?:de|consolidada\s+de|anual\s+de|de\s+\d{4}\s+de)?\s*"
        r"R\$\s*([\d.,]+)\s*(milh[oõ]es?|mi|bilh[oõ]es?|bi|mil|M|B)",
        re.IGNORECASE,
    ),
    re.compile(
        r"faturamento\s+(?:anual|bruto|l[ií]quido|total|consolidado|de\s+\d{4})?\s*"
        r"(?:de|foi de|atingiu)?\s*R\$\s*([\d.,]+)\s*(milh[oõ]es?|mi|bilh[oõ]es?|bi|mil|M|B)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:receita|faturamento)\s+de\s+aproximadamente\s+R\$\s*([\d.,]+)\s*(milh[oõ]es?|mi|bilh[oõ]es?|bi)",
        re.IGNORECASE,
    ),
]

# Padrão pra extrair CNPJ do texto
CNPJ_PATTERN = re.compile(r"\b(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})\b")

# Padrão pra nome do alvo · captura "Nome Ltda" / "Nome S.A." próximo de termos de aquisição
ALVO_PATTERN = re.compile(
    r"(?:aquisi[cç][aã]o|aquisição|compra|incorporac[aã]o|incorporação)\s+(?:de|da|do)\s+"
    r"(?:(?:100|[\d,.]+%|integralidade das ações de|controle d[ae])?\s*(?:capital social d[ae])?\s*)?"
    r"([A-ZÁ-Ú][A-ZÁ-Úa-zá-ú0-9&.\s\-/]{3,60}?(?:Ltda\.?|S\.?A\.?|S/A|EIRELI|LTDA))",
    re.IGNORECASE,
)


@dataclass
class GroundTruth:
    cnpj_alvo: str | None
    nome_alvo: str | None
    receita_brl: float | None
    fonte: str  # "CVM_IPE_FR"
    ano: int
    adquirente_cnpj: str
    adquirente_nome: str
    data_publicacao: str
    link: str
    assunto: str
    raw_match: str  # trecho do texto que casou


def fetch_ipe_csv(year: int) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    fn = CACHE / f"ipe_{year}.zip"
    if not fn.exists() or fn.stat().st_size == 0:
        url = f"{CVM_IPE_BASE}/ipe_cia_aberta_{year}.zip"
        print(f"  baixando IPE {year} …", file=sys.stderr)
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=60) as r, open(fn, "wb") as f:
            f.write(r.read())
    return fn


def read_ipe(year: int):
    import pandas as pd
    zip_path = fetch_ipe_csv(year)
    with zipfile.ZipFile(zip_path) as z:
        with z.open(f"ipe_cia_aberta_{year}.csv") as f:
            raw = f.read().decode("latin-1")
    return pd.read_csv(io.StringIO(raw), sep=";", on_bad_lines="skip")


def is_fr_aquisicao(row) -> bool:
    if row.get("Categoria") != "Fato Relevante":
        return False
    assunto = str(row.get("Assunto") or "")
    if not PATTERN_POSITIVO.search(assunto):
        return False
    if PATTERN_NEGATIVO.search(assunto):
        return False
    return True


def download_pdf(url: str, cache_key: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    fn = CACHE / f"fr_pdf_{cache_key}.pdf"
    if fn.exists() and fn.stat().st_size > 0:
        return fn
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as r, open(fn, "wb") as f:
            f.write(r.read())
        return fn
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"  PDF falha {cache_key}: {e}", file=sys.stderr)
        return None


def extract_text(pdf_path: Path) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        return "\n".join(p.extract_text() or "" for p in reader.pages[:10])
    except Exception as e:
        print(f"  extract falha {pdf_path.name}: {e}", file=sys.stderr)
        return ""


def normalize_receita(valor_str: str, unidade: str) -> float | None:
    """'R$ 47,3 milhões' → 47_300_000.0"""
    try:
        v = valor_str.strip().replace(".", "").replace(",", ".")
        v = float(v)
    except ValueError:
        return None
    u = unidade.lower().strip()
    if u in ("milhão", "milhões", "milhao", "milhoes", "mi", "m"):
        return v * 1e6
    if u in ("bilhão", "bilhões", "bilhao", "bilhoes", "bi", "b"):
        return v * 1e9
    if u == "mil":
        return v * 1e3
    return None


def parse_pdf(text: str, fr_row: dict) -> GroundTruth | None:
    if not text or len(text) < 200:
        return None

    # tenta extrair receita
    receita = None
    raw_match = ""
    for pat in RECEITA_PATTERNS:
        m = pat.search(text)
        if m:
            r = normalize_receita(m.group(1), m.group(2))
            if r and 100_000 <= r <= 10_000_000_000:  # sanity 100k a 10 bi
                receita = r
                # captura 80 chars contexto
                start = max(0, m.start() - 30)
                end = min(len(text), m.end() + 30)
                raw_match = text[start:end].replace("\n", " ").strip()
                break

    if receita is None:
        return None

    # tenta extrair CNPJ + nome do alvo
    cnpj_alvo = None
    nome_alvo = None

    m_alvo = ALVO_PATTERN.search(text)
    if m_alvo:
        nome_alvo = m_alvo.group(1).strip().rstrip(",.")

    # CNPJ na proximidade do nome (até 500 chars)
    if m_alvo:
        slice_start = max(0, m_alvo.start() - 100)
        slice_end = min(len(text), m_alvo.end() + 500)
        for m_cnpj in CNPJ_PATTERN.finditer(text[slice_start:slice_end]):
            cand = m_cnpj.group(1)
            # exclui CNPJ da própria companhia adquirente
            if cand != fr_row.get("CNPJ_Companhia", ""):
                cnpj_alvo = cand
                break

    return GroundTruth(
        cnpj_alvo=cnpj_alvo,
        nome_alvo=nome_alvo,
        receita_brl=receita,
        fonte="CVM_IPE_FR",
        ano=int(fr_row.get("ano_arquivo", 0)),
        adquirente_cnpj=str(fr_row.get("CNPJ_Companhia", "")),
        adquirente_nome=str(fr_row.get("Nome_Companhia", "")),
        data_publicacao=str(fr_row.get("Data_Entrega", "")),
        link=str(fr_row.get("Link_Download", "")),
        assunto=str(fr_row.get("Assunto", "")),
        raw_match=raw_match,
    )


def main() -> int:
    import pandas as pd

    # 1. lê IPE 2024-2026
    frames = []
    for year in (2024, 2025, 2026):
        try:
            df = read_ipe(year)
            df["ano_arquivo"] = year
            frames.append(df)
            print(f"IPE {year}: {len(df):,} comunicados", file=sys.stderr)
        except Exception as e:
            print(f"IPE {year} falha: {e}", file=sys.stderr)
    if not frames:
        return 1
    all_ipe = pd.concat(frames, ignore_index=True)

    # 2. filtra FR de aquisição
    candidatos = all_ipe[all_ipe.apply(is_fr_aquisicao, axis=1)].copy()
    print(f"FR de aquisição (positivos − negativos): {len(candidatos):,}", file=sys.stderr)
    print(file=sys.stderr)

    # 3. baixa e extrai PDF
    resultados: list[GroundTruth] = []
    for i, (_, row) in enumerate(candidatos.iterrows()):
        link = row.get("Link_Download")
        if not isinstance(link, str) or not link.startswith("http"):
            continue
        cache_key = f"{row['ano_arquivo']}_{row.get('Protocolo_Entrega', i)}"
        pdf_path = download_pdf(link, str(cache_key))
        if not pdf_path:
            continue
        text = extract_text(pdf_path)
        gt = parse_pdf(text, row)
        if gt:
            resultados.append(gt)
            tag = f"R$ {gt.receita_brl/1e6:.1f}M"
            alvo = gt.nome_alvo or "?"
            print(f"  [{len(resultados):>3}] {row['Nome_Companhia'][:30]:<30} → {alvo[:35]:<35} {tag}", file=sys.stderr)
        # rate-limit gentil
        if i % 10 == 0 and i > 0:
            time.sleep(0.5)

    # 4. salva
    out_path = OUT_DIR / "active_validation_v1.json"
    out_path.write_text(
        json.dumps([asdict(r) for r in resultados], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(file=sys.stderr)
    print(f"=== Resumo ===", file=sys.stderr)
    print(f"FR candidatos:        {len(candidatos):,}", file=sys.stderr)
    print(f"FRs com receita extraída: {len(resultados):,}", file=sys.stderr)
    com_cnpj = sum(1 for r in resultados if r.cnpj_alvo)
    print(f"  · com CNPJ do alvo: {com_cnpj}", file=sys.stderr)
    print(f"Saída: {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
