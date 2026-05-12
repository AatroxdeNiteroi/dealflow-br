import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* Gera uma série temporal fictícia ("DealFlow Index") em torno de um valor
 * base, com leve random walk seedado. Não é financeiramente real — é
 * ornamento visual estilo Bloomberg.
 */
function generateSeries(seed = 42, n = 90, base = 1000, vol = 0.008): { d: string; v: number }[] {
  let s = seed;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: { d: string; v: number }[] = [];
  let v = base;
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    v = v * (1 + (rng() - 0.48) * vol * 2);
    out.push({
      d: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      v: Math.round(v * 100) / 100,
    });
  }
  return out;
}

function TT({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-val">{(payload[0].value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
    </div>
  );
}

interface Props {
  base?: number;
}

export default function IndexChart({ base = 1247.83 }: Props) {
  const data = useMemo(() => generateSeries(42, 90, base, 0.012), [base]);
  const first = data[0]?.v ?? base;
  const last = data[data.length - 1]?.v ?? base;
  const chg = ((last - first) / first) * 100;
  const isUp = chg >= 0;
  const color = isUp ? "#2d6a4f" : "#9d2c2c";

  return (
    <div className="panel">
      <div className="panel-header" style={{ display: "block" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="panel-title">
              DealFlow <em>Index</em>
            </div>
            <div className="panel-meta" style={{ marginTop: 4 }}>
              índice agregado · 90 dias · base 1000
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 22, color: "var(--brown-deep)", fontWeight: 500 }}>
              {last.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div
              style={{
                fontFamily: "var(--f-mono)",
                fontSize: 12,
                color,
                marginTop: 2,
                fontWeight: 500,
              }}
            >
              {isUp ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}% · 90d
            </div>
          </div>
        </div>
      </div>
      <div className="panel-body" style={{ height: 240, padding: "8px 12px 16px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="indexGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="1 3" vertical={false} />
            <XAxis
              dataKey="d"
              tick={{ fontSize: 9, fill: "#8b6a3d" }}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#8b6a3d" }}
              tickLine={false}
              axisLine={false}
              width={42}
              domain={["dataMin - 30", "dataMax + 30"]}
            />
            <Tooltip content={<TT />} cursor={{ stroke: "#b89e6a", strokeDasharray: "2 2" }} />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#indexGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
