import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatsResponse } from "../../api/client";

interface Props {
  hist: StatsResponse["receita_hist"];
  total: number;
  receitaMediana: number;
}

type TTPayload = { dataKey?: string | number; value?: number };
function TT({ active, payload, label }: { active?: boolean; payload?: TTPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const empresas = payload.find((p) => p.dataKey === "n")?.value ?? 0;
  const pct = payload.find((p) => p.dataKey === "cum_pct")?.value ?? 0;
  const pctFmt = pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-val">{empresas.toLocaleString("pt-BR")} empresas</div>
      <div className="tt-sub">{pctFmt}% cumulativo</div>
    </div>
  );
}

export default function MarketDistribution({ hist, total, receitaMediana }: Props) {
  // Calcula % cumulativa
  const data = useMemo(() => {
    let cum = 0;
    return hist.map((b) => {
      cum += b.n;
      return { ...b, cum, cum_pct: (cum / total) * 100 };
    });
  }, [hist, total]);

  // Encontra o bucket que contém a mediana
  const medianaBucket = useMemo(() => {
    return hist.findIndex((b) => receitaMediana >= b.lo && receitaMediana < b.hi);
  }, [hist, receitaMediana]);

  return (
    <div className="panel">
      <div className="panel-header panel-header--stacked">
        <div className="panel-header-row">
          <div>
            <div className="panel-title">
              Distribuição do <em>universo</em>
            </div>
            <div className="panel-meta panel-meta--spaced">
              Empresas por faixa de receita · curva cumulativa Pareto
            </div>
          </div>
          <div className="panel-aside">
            <div className="panel-aside-label">MEDIANA</div>
            <div className="panel-aside-value">
              {`R$ ${(receitaMediana / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`}
            </div>
          </div>
        </div>
      </div>
      <div className="panel-body" style={{ height: 240, padding: "8px 12px 16px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 32, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="1 3" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 9, fill: "#8b6a3d" }}
              tickLine={false}
              axisLine={false}
              dy={4}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 9, fill: "#8b6a3d" }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 9, fill: "#b8860b" }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip content={<TT />} cursor={{ fill: "rgba(184, 158, 106, 0.15)" }} />
            <Bar
              yAxisId="left"
              dataKey="n"
              fill="#8b6a3d"
              radius={[1, 1, 0, 0]}
              maxBarSize={48}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cum_pct"
              stroke="#b8860b"
              strokeWidth={1.5}
              dot={{ r: 2.5, fill: "#b8860b" }}
              activeDot={{ r: 4 }}
            />
            {medianaBucket >= 0 && (
              <ReferenceLine
                yAxisId="left"
                x={hist[medianaBucket].bucket}
                stroke="#5d4427"
                strokeDasharray="3 3"
                label={{ value: "MEDIANA", position: "top", fill: "#5d4427", fontSize: 9, letterSpacing: "0.15em" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
