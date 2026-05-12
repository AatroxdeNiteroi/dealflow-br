import { useMemo } from "react";
import type { Empresa } from "../../api/client";

/**
 * Fingerprint — assinatura visual de 4 sinais REAIS da empresa:
 * idade · capital · vínculos · precisão da receita.
 * Cada barra: altura proporcional ao valor normalizado em escala log
 * (exceto precisão, que é linear em [0, 1]).
 *
 * NÃO é série temporal — é uma assinatura sintética porém honesta:
 * cada barra mapeia 1-pra-1 a um campo do registro.
 */
interface Props {
  empresa: Empresa;
  width?: number;
  height?: number;
  showLabels?: boolean;
}

interface Signal {
  key: string;
  label: string;
  value: number; // 0..1
  raw: string;
}

function clamp01(v: number): number {
  if (!isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function computeSignature(e: Empresa): Signal[] {
  // Idade: 0–30+ anos → 0..1 (30+ saturado)
  const idade = e.idade_empresa_anos ?? 0;
  const idadeNorm = clamp01(idade / 30);

  // Capital: log10 normalizado · R$ 1k = 0, R$ 100M = 1
  const cap = e.capital_social ?? 0;
  const capNorm = cap > 0 ? clamp01((Math.log10(cap) - 3) / 5) : 0;

  // Headcount: log normalizado · 1 = 0, 3000 = 1
  const hc = Math.max(1, e.headcount);
  const hcNorm = clamp01(Math.log10(hc) / 3.5);

  // Precisão: tightness do range de receita · range estreito → alta confiança
  let precNorm = 0.5;
  if (e.receita_point_brl && e.receita_low_brl && e.receita_high_brl && e.receita_point_brl > 0) {
    const spread = (e.receita_high_brl - e.receita_low_brl) / e.receita_point_brl;
    precNorm = clamp01(1 - spread / 2); // spread 0% → 1, spread 200%+ → 0
  }

  return [
    { key: "idade", label: "Idade", value: idadeNorm, raw: `${Math.round(idade)} anos` },
    { key: "capital", label: "Capital", value: capNorm, raw: cap ? `R$ ${(cap / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} M` : "—" },
    { key: "hc", label: "Vínculos", value: hcNorm, raw: `${hc.toLocaleString("pt-BR")} f` },
    { key: "prec", label: "Precisão", value: precNorm, raw: `${Math.round(precNorm * 100)}%` },
  ];
}

export default function Fingerprint({ empresa, width = 70, height = 22, showLabels = false }: Props) {
  const signals = useMemo(() => computeSignature(empresa), [empresa]);

  const cols = signals.length;
  const gap = 3;
  const barW = (width - gap * (cols - 1)) / cols;
  const minH = 2;

  // Cor: mais alto → mais brown-deep. Mais baixo → bege.
  const colorFor = (v: number): string => {
    if (v >= 0.66) return "#5d4427"; // brown
    if (v >= 0.33) return "#8b6a3d"; // tan
    return "#b89e6a"; // bege-deep
  };

  const labelHeight = showLabels ? 10 : 0;
  const barAreaHeight = height - labelHeight;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      focusable="false"
      aria-label={`Assinatura: ${signals.map((s) => `${s.label} ${s.raw}`).join(", ")}`}
    >
      <title>
        {signals.map((s) => `${s.label}: ${s.raw}`).join(" · ")}
      </title>
      {signals.map((s, i) => {
        const h = Math.max(minH, s.value * barAreaHeight);
        const x = i * (barW + gap);
        const y = barAreaHeight - h;
        return (
          <g key={s.key}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={colorFor(s.value)}
              rx={0.5}
            />
            {/* trilho sutil de "máximo" para dar contexto */}
            <rect
              x={x}
              y={0}
              width={barW}
              height={barAreaHeight}
              fill="none"
              stroke="rgba(60, 46, 31, 0.06)"
              strokeWidth="0.5"
            />
          </g>
        );
      })}
      {showLabels && signals.map((s, i) => (
        <text
          key={s.key}
          x={i * (barW + gap) + barW / 2}
          y={height - 1}
          textAnchor="middle"
          fontSize="6"
          fontFamily="var(--f-mono)"
          fill="var(--tan)"
          letterSpacing="0.05em"
        >
          {s.label.substring(0, 3).toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
