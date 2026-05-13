import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint } from "../../api/client";

interface Props {
  points: HistoryPoint[] | null;
  loading: boolean;
  height?: number;
}

function TT({ active, payload }: { active?: boolean; payload?: { payload: HistoryPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tt">
      <div className="tt-label">{p.ano}</div>
      <div className="tt-val">{p.headcount.toLocaleString("pt-BR")} vínculos</div>
    </div>
  );
}

export default function HeadcountTimeline({ points, loading, height = 120 }: Props) {
  const { data, deltaPct, lastAno, firstAno } = useMemo(() => {
    if (!points || points.length === 0) {
      return { data: [], deltaPct: null, lastAno: null, firstAno: null };
    }
    const sorted = [...points].sort((a, b) => a.ano - b.ano);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const deltaPct =
      first.headcount > 0 ? ((last.headcount - first.headcount) / first.headcount) * 100 : null;
    return {
      data: sorted,
      deltaPct,
      lastAno: last.ano,
      firstAno: first.ano,
    };
  }, [points]);

  if (loading) {
    return (
      <div className="timeline-shell" aria-busy="true">
        <div className="timeline-header">
          <div className="timeline-label">Histórico · vínculos ativos</div>
          <div className="timeline-delta sk sk-line sk-line-w30" style={{ width: 80, height: 14 }} />
        </div>
        <div className="sk" style={{ height, width: "100%" }} />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="timeline-shell">
        <div className="timeline-header">
          <div className="timeline-label">Histórico · vínculos ativos</div>
          <div className="timeline-delta muted">sem série temporal disponível</div>
        </div>
        <div className="timeline-empty">
          Identidade Tier 1 não bate com chave composta nos anos anteriores.
          Comum em empresas que mudaram CEP, CNAE principal ou natureza jurídica.
        </div>
      </div>
    );
  }

  const isUp = deltaPct != null && deltaPct >= 0;
  const stroke = isUp ? "var(--up)" : "var(--down)";

  return (
    <div className="timeline-shell">
      <div className="timeline-header">
        <div className="timeline-label">
          Histórico · vínculos ativos · {firstAno}–{lastAno}
        </div>
        {deltaPct != null && (
          <div className={`timeline-delta ${isUp ? "up" : "down"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(deltaPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </div>
        )}
      </div>
      <div style={{ height, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="1 3" vertical={false} />
            <XAxis
              dataKey="ano"
              tick={{ fontSize: 9, fill: "#8b6a3d" }}
              tickLine={false}
              axisLine={false}
              dy={4}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#8b6a3d" }}
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip content={<TT />} cursor={{ stroke: "var(--bege-deep)", strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="headcount"
              stroke={stroke}
              strokeWidth={1.5}
              dot={{ r: 2.5, fill: stroke }}
              activeDot={{ r: 4 }}
            />
            <ReferenceDot
              x={data[data.length - 1].ano}
              y={data[data.length - 1].headcount}
              r={3.5}
              fill={stroke}
              stroke="var(--paper)"
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
