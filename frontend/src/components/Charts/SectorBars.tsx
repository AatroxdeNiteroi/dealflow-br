import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StatsResponse } from "../../api/client";

const SECAO_LABEL: Record<string, string> = {
  A: "Agro", B: "Extr.", C: "Indústria", D: "Energia", E: "Água",
  F: "Construção", G: "Comércio", H: "Transporte", I: "Aloj/Alim.",
  J: "TI/Telecom", K: "Financeiro", L: "Imobiliário", M: "Profissional",
  N: "Adm.", O: "Adm.Públ.", P: "Educação", Q: "Saúde", R: "Cultura",
  S: "Serviços", T: "Doméstico", U: "Org.Int.",
};

function TT({ active, payload }: { active?: boolean; payload?: { payload?: { cnae_secao: string; n: number; receita_mediana_brl: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="tt">
      <div className="tt-label">{SECAO_LABEL[p.cnae_secao] ?? p.cnae_secao}</div>
      <div className="tt-val">{p.n.toLocaleString("pt-BR")} empresas</div>
      <div style={{ color: "var(--up)", fontSize: 10, marginTop: 2 }}>
        mediana R$ {(p.receita_mediana_brl / 1e6).toFixed(1)}M
      </div>
    </div>
  );
}

interface Props {
  data: StatsResponse["by_cnae_secao"];
}

export default function SectorBars({ data }: Props) {
  const enriched = data.map((d) => ({ ...d, label: SECAO_LABEL[d.cnae_secao] ?? d.cnae_secao }));
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="label">Setores · CNAE seção</span>
        <span className="meta">{data.length} seções</span>
      </div>
      <div className="panel-body" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={enriched} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#8a8f99" }} tickLine={false} axisLine={false} angle={-32} dy={8} height={50} />
            <YAxis tick={{ fontSize: 9, fill: "#8a8f99" }} tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<TT />} cursor={{ fill: "rgba(255,176,32,0.06)" }} />
            <Bar dataKey="n" fill="#00d68f" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
