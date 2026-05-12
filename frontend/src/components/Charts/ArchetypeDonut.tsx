import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatsResponse } from "../../api/client";
import { labelArchetype } from "../../utils/labels";
import GenusModal from "../Terms/GenusModal";
import { ARCHETYPE_GENUS } from "../Terms/terms";

// Palette derivada das vars CSS — tan/bege/brown + acentos
const COLORS = ["#8b6a3d", "#b89e6a", "#d8c9a8", "#5d4427", "#9d2c2c", "#b8860b", "#2d6a4f", "#3c2e1f"];

function TT({ active, payload }: { active?: boolean; payload?: { name?: string; value?: number }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="tt">
      <div className="tt-label">{labelArchetype(p.name ?? "")}</div>
      <div className="tt-val">{(p.value ?? 0).toLocaleString("pt-BR")} empresas</div>
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
          Sobre archetypes
        </button>
      </div>
      <div className="panel-body archetype-body">
        <div className="archetype-pie">
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
        <ul className="archetype-legend">
          {data.slice(0, 8).map((d, i) => {
            const pct = ((d.n / total) * 100).toLocaleString("pt-BR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            });
            return (
              <li key={d.archetype} className="archetype-row">
                <span className="archetype-swatch" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="archetype-name">{labelArchetype(d.archetype)}</span>
                <span className="archetype-n">{d.n.toLocaleString("pt-BR")}</span>
                <span className="archetype-pct">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </div>

      <GenusModal genus={openGenus ? ARCHETYPE_GENUS : null} onClose={() => setOpenGenus(false)} />
    </div>
  );
}
