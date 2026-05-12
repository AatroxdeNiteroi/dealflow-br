import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StatsResponse } from "../../api/client";

interface Props {
  data: StatsResponse["receita_hist"];
}

function TT({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-val">{(payload[0].value ?? 0).toLocaleString("pt-BR")} empresas</div>
    </div>
  );
}

export default function ReceitaHistogram({ data }: Props) {
  return (
    <div className="panel tall">
      <div className="panel-header">
        <span className="label">Distribuição · Receita Estimada</span>
        <span className="meta">n = {data.reduce((a, b) => a + b.n, 0).toLocaleString("pt-BR")}</span>
      </div>
      <div className="panel-body" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "#8a8f99" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#8a8f99" }} tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<TT />} cursor={{ fill: "rgba(255,176,32,0.06)" }} />
            <Bar dataKey="n" fill="#ffb020" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
