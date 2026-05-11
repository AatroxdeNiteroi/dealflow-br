"""Gera gráfico horizontal stacked-bar da distribuição do Match RAIS.

Roda contra a distribuição medida no diagnóstico multi-tier (BigQuery,
universo RAIS 2024 filtrado para 2XXX + RJ/SP + 20+ vínculos).

Uso:
    uv sync --extra viz
    uv run python scripts/plot_match_tiers.py
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt

OUTPUT_PATH = Path("docs/match_tiers.png")


@dataclass(frozen=True, slots=True)
class Tier:
    """Uma fatia da distribuição do match."""

    label: str
    sublabel: str
    n: int
    color: str


# Distribuição medida em 2026-05-11 contra RAIS 2024 × Receita 2024-12-18.
TIERS: tuple[Tier, ...] = (
    Tier(
        label="Tier 1 — Alta",
        sublabel="sabemos qual é",
        n=32_391,
        color="#2E7D32",  # verde escuro
    ),
    Tier(
        label="Tier 2 — Média",
        sublabel="shortlist 2–3",
        n=10_240,
        color="#FBC02D",  # amarelo
    ),
    Tier(
        label="Tier 3 — Baixa",
        sublabel="CEP relaxado 1–3",
        n=4_276,
        color="#EF6C00",  # laranja
    ),
    Tier(
        label="Sem ID útil",
        sublabel="ambíguo 4+ ou perdido",
        n=28_706,
        color="#C62828",  # vermelho
    ),
)


def render(tiers: tuple[Tier, ...], output: Path) -> None:
    """Renderiza o stacked bar e salva em ``output``.

    Args:
        tiers: Fatias da distribuição.
        output: Caminho onde salvar o PNG.
    """
    total = sum(t.n for t in tiers)
    fig, ax = plt.subplots(figsize=(13, 4.5))

    left = 0
    for tier in tiers:
        pct = 100 * tier.n / total
        ax.barh(0, tier.n, left=left, color=tier.color, edgecolor="white", linewidth=2.5)
        # Só rotula segmentos largos o suficiente para caber o texto.
        if pct >= 4:
            ax.text(
                left + tier.n / 2,
                0,
                f"{tier.label}\n{tier.sublabel}\n{tier.n:,} ({pct:.1f}%)".replace(",", "."),
                ha="center",
                va="center",
                fontsize=10,
                color="white",
                fontweight="bold",
            )
        left += tier.n

    ax.set_xlim(0, total)
    ax.set_ylim(-0.6, 0.6)
    ax.set_yticks([])
    ax.set_xticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)

    ax.set_title(
        f"Match RAIS — Universo total: {total:,} estabelecimentos (RJ/SP, 2XXX)".replace(",", "."),
        fontsize=13,
        fontweight="bold",
        pad=18,
    )

    identificavel = sum(t.n for t in tiers[:3])
    subtitle = (
        f"Identificáveis (Tier 1+2+3): {identificavel:,} "
        f"({100 * identificavel / total:.1f}%)"
    ).replace(",", ".")
    fig.text(0.5, 0.02, subtitle, ha="center", fontsize=10, color="#444")

    # Legenda discreta abaixo
    legend = [mpatches.Patch(color=t.color, label=t.label) for t in tiers]
    ax.legend(
        handles=legend,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.05),
        ncol=4,
        frameon=False,
        fontsize=9,
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output, dpi=160, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"Salvo: {output}")


def main() -> None:
    render(TIERS, OUTPUT_PATH)


if __name__ == "__main__":
    main()
