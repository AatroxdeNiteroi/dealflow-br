import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatsResponse } from "../../api/client";

const COLORS = ["#ffb020", "#00d68f", "#3ec1d3", "#b388ff", "#ff4d6d", "#d4a64a", "#a82d44", "#555a64"];

const LABELS: Record<string, string> = {
  family_mature_sweet_spot: "family",
  labor_intensive_midcap: "labor mid",
  capital_intensive: "capital",
  standard: "standard",
  holding_structure: "holding",
  recent_startup: "startup",
  partnership_heavy_services: "partnership",
  financeiro_out_scope: "financ.",
};

function TT({ active, payload }: { active?: boolean; payload?: { name?: string; value?: number }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="tt">
      <div className="tt-label">{LABELS[p.name ?? ""] ?? p.name}</div>
      <div className="tt-val">{(p.value ?? 0).toLocaleString("pt-BR")} empresas</div>
    </div>
  );
}

interface Props {
  data: StatsResponse["by_archetype"];
}

export default function ArchetypeDonut({ data }: Props) {
  return (
    <div className="panel short">
      <div className="panel-header">
        <span className="label">Composição · Archetypes</span>
        <span className="meta">{data.length} clusters</span>
      </div>
      <div className="panel-body" style={{ height: 220, display: "flex", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="n" nameKey="archetype" innerRadius={45} outerRadius={75} stroke="#0a0c10" strokeWidth={1}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<TT />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
          {data.slice(0, 6).map((d, i) => (
            <div key={d.archetype} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
              <span style={{ width: 8, height: 8, background: COLORS[i % COLORS.length], display: "inline-block" }} />
              <span style={{ color: "var(--t-1)", flex: 1 }}>{LABELS[d.archetype] ?? d.archetype}</span>
              <span style={{ color: "var(--t-0)", fontFamily: "var(--f-mono)" }}>{d.n.toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
