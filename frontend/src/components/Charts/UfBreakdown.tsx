import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { StatsResponse } from "../../api/client";

const COLORS: Record<string, string> = { SP: "#ffb020", RJ: "#3ec1d3" };

function TT({ active, payload }: { active?: boolean; payload?: { payload?: { sigla_uf: string; n: number; receita_total_brl: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="tt">
      <div className="tt-label">{p.sigla_uf}</div>
      <div className="tt-val">{p.n.toLocaleString("pt-BR")} empresas</div>
      <div style={{ color: "var(--up)", fontSize: 10, marginTop: 2 }}>
        R$ {(p.receita_total_brl / 1e9).toFixed(1)}B receita agregada
      </div>
    </div>
  );
}

interface Props {
  data: StatsResponse["by_uf"];
}

export default function UfBreakdown({ data }: Props) {
  return (
    <div className="panel short">
      <div className="panel-header">
        <span className="label">Geografia · UF</span>
        <span className="meta">{data.length} estados</span>
      </div>
      <div className="panel-body" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <YAxis type="category" dataKey="sigla_uf" tick={{ fontSize: 10, fill: "#c8ccd2", fontWeight: 500 }} tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<TT />} cursor={{ fill: "rgba(255,176,32,0.06)" }} />
            <Bar dataKey="n" radius={[0, 1, 1, 0]}>
              {data.map((d) => (
                <Cell key={d.sigla_uf} fill={COLORS[d.sigla_uf] ?? "#ffb020"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
