import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatsResponse } from "../../api/client";
import { labelArchetype } from "../../utils/labels";
import GenusModal from "../Terms/GenusModal";
import { ARCHETYPE_GENUS } from "../Terms/terms";

const COLORS = ["#8b6a3d", "#b89e6a", "#d8c9a8", "#5d4427", "#9d2c2c", "#b8860b", "#2d6a4f", "#3c2e1f"];

function TT({ active, payload }: { active?: boolean; payload?: { name?: string; value?: number }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="tt">
      <div className="tt-label">{labelArchetype(p.name ?? "")}</div>
      <div className="tt-val">{(p.value ?? 0).toLocaleString("pt-BR")} Empresas</div>
    </div>
  );
}

interface Props {
  data: StatsResponse["by_archetype"];
}

export default function ArchetypeDonut({ data }: Props) {
  const total = data.reduce((a, b) => a + b.n, 0);
  const [openGenus, setOpenGenus] = useState(false);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          Composição <em>· archetypes</em>
        </div>
        <button className="panel-info-btn" onClick={() => setOpenGenus(true)}>
          Sobre Archetypes
        </button>
      </div>
      <div className="panel-body" style={{ height: 240, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 200, height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="n" nameKey="archetype" innerRadius={48} outerRadius={84} stroke="#fbf9f4" strokeWidth={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<TT />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {data.slice(0, 8).map((d, i) => {
            const pct = ((d.n / total) * 100).toFixed(1);
            return (
              <div key={d.archetype} className="archetype-row" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <span style={{ color: "var(--brown)", flex: 1 }}>{labelArchetype(d.archetype)}</span>
                <span style={{ color: "var(--brown-deep)", fontFamily: "var(--f-mono)", fontWeight: 600 }}>
                  {d.n.toLocaleString("pt-BR")}
                </span>
                <span style={{ color: "var(--tan)", fontFamily: "var(--f-mono)", fontSize: 9, width: 38, textAlign: "right" }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <GenusModal genus={openGenus ? ARCHETYPE_GENUS : null} onClose={() => setOpenGenus(false)} />
    </div>
  );
}
