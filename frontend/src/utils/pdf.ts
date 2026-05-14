import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Contato, Empresa, HistoryPoint, Socio } from "../api/client";
import { fmtBrl, labelArchetype, labelConfidence, labelPrecision, labelSecao } from "./labels";

interface BuildArgs {
  empresa: Empresa;
  contato?: Contato | null;
  history?: HistoryPoint[] | null;
  socios?: Socio[] | null;
}

// ── Paleta DealFlow (espelha tokens.css) ─────────────────────────
const C = {
  brownDeep: "#3C2E1F",
  brown:     "#5D4427",
  tan:       "#8B6A3D",
  bege:      "#D8C9A8",
  begeDeep:  "#B89E6A",
  gold:      "#B8860B",
  paper:     "#FBF9F4",
  paper2:    "#F5F1E8",
  cream:     "#EDE5D3",
  line:      "#E5DDD0",
  up:        "#2D6A4F",
  down:      "#9D2C2C",
} as const;

function fmtCnpj(v: string): string {
  if (!v || v.length !== 14) return v;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function fmtIntBR(v: number | null | undefined): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtTelefone(ddd: string | null, num: string | null): string {
  if (!num) return "";
  const c = num.replace(/\D/g, "");
  const d = (ddd ?? "").replace(/\D/g, "");
  const p = d ? `(${d}) ` : "";
  if (c.length === 8) return `${p}${c.slice(0, 4)}-${c.slice(4)}`;
  if (c.length === 9) return `${p}${c.slice(0, 5)}-${c.slice(5)}`;
  return `${p}${c}`;
}

function buildEndereco(c: Contato): string {
  const parts = [
    [c.tipo_logradouro, c.logradouro].filter(Boolean).join(" "),
    c.numero,
    c.complemento,
    c.bairro,
    c.municipio_nome,
    c.sigla_uf,
  ].filter((p) => p && String(p).trim());
  return parts.join(" · ");
}

export function downloadEmpresaPdf({ empresa, contato, history, socios }: BuildArgs): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const MARGIN = 48;
  let y = MARGIN;

  // ── Watermark eyebrow ────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(C.gold);
  doc.text("DEALFLOW BR  ·  ONE-PAGER M&A", MARGIN, y);
  y += 18;

  // ── Razão social ─────────────────────────────────────────────
  doc.setFont("times", "normal");
  doc.setFontSize(24);
  doc.setTextColor(C.brownDeep);
  const titleLines = doc.splitTextToSize(empresa.razao_social, W - 2 * MARGIN);
  doc.text(titleLines, MARGIN, y);
  y += 24 * titleLines.length;

  // ── CNPJ + meta ──────────────────────────────────────────────
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(C.tan);
  const meta = [
    fmtCnpj(empresa.cnpj),
    empresa.sigla_uf,
    `CNAE ${empresa.cnae_2_subclasse}`,
    `Seção ${empresa.cnae_secao} · ${labelSecao(empresa.cnae_secao)}`,
    labelArchetype(empresa.archetype),
    empresa.match_tier,
  ].join("  ·  ");
  doc.text(meta, MARGIN, y);
  y += 22;

  // ── Linha de separação ────────────────────────────────────────
  doc.setDrawColor(C.line);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 18;

  // ── KPIs grid (2x2) ──────────────────────────────────────────
  const kpiBoxW = (W - 2 * MARGIN - 12) / 2;
  const kpiBoxH = 56;
  const kpiPad = 12;
  const drawKpi = (col: number, row: number, label: string, value: string, hint?: string) => {
    const x = MARGIN + col * (kpiBoxW + 12);
    const yk = y + row * (kpiBoxH + 8);
    doc.setDrawColor(C.line);
    doc.setLineWidth(0.5);
    doc.rect(x, yk, kpiBoxW, kpiBoxH);
    // Label
    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.tan);
    doc.text(label.toUpperCase(), x + kpiPad, yk + 14);
    // Value
    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.setTextColor(C.brownDeep);
    doc.text(value, x + kpiPad, yk + 36);
    if (hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(C.tan);
      doc.text(hint, x + kpiPad, yk + 49);
    }
  };

  drawKpi(0, 0, "Receita Estimada", fmtBrl(empresa.receita_point_brl),
    `${fmtBrl(empresa.receita_low_brl)} – ${fmtBrl(empresa.receita_high_brl)}`);
  drawKpi(1, 0, "Vínculos Ativos", fmtIntBR(empresa.headcount), "CLT ativo");
  drawKpi(0, 1, "Confiança", labelConfidence(empresa.confidence),
    `granularidade ${labelPrecision(empresa.razao_precision).toLowerCase()}`);
  drawKpi(1, 1, "Idade · Capital",
    `${fmtIntBR(empresa.idade_empresa_anos)} a · ${fmtBrl(empresa.capital_social)}`,
    `${empresa.porte ?? "porte n/d"}`);

  y += 2 * (kpiBoxH + 8) + 8;

  // ── Histórico headcount (sparkline) ───────────────────────────
  if (history && history.length > 0) {
    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.tan);
    doc.text("HISTÓRICO · VÍNCULOS ATIVOS", MARGIN, y);
    y += 12;

    const chartH = 70;
    const chartX = MARGIN;
    const chartY = y;
    const chartW = W - 2 * MARGIN;

    doc.setDrawColor(C.line);
    doc.setLineWidth(0.5);
    doc.rect(chartX, chartY, chartW, chartH);

    const sorted = [...history].sort((a, b) => a.ano - b.ano);
    const minV = Math.min(...sorted.map((p) => p.headcount));
    const maxV = Math.max(...sorted.map((p) => p.headcount));
    const range = maxV - minV || 1;
    const padInner = 12;
    const innerW = chartW - 2 * padInner;
    const innerH = chartH - 2 * padInner;
    const xStep = innerW / Math.max(sorted.length - 1, 1);

    // Linha + pontos
    const isUp = sorted[sorted.length - 1].headcount >= sorted[0].headcount;
    doc.setDrawColor(isUp ? C.up : C.down);
    doc.setLineWidth(1.4);
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const px = chartX + padInner + i * xStep;
      const py = chartY + padInner + (1 - (sorted[i].headcount - minV) / range) * innerH;
      if (prev) doc.line(prev.x, prev.y, px, py);
      doc.setFillColor(isUp ? C.up : C.down);
      doc.circle(px, py, 1.8, "F");
      // Labels do ano (eixo X)
      doc.setFont("courier", "normal");
      doc.setFontSize(6);
      doc.setTextColor(C.tan);
      doc.text(String(sorted[i].ano), px - 6, chartY + chartH - 3);
      prev = { x: px, y: py };
    }

    // Delta
    const delta = sorted[0].headcount > 0
      ? ((sorted[sorted.length - 1].headcount - sorted[0].headcount) / sorted[0].headcount) * 100
      : null;
    if (delta != null) {
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(isUp ? C.up : C.down);
      const dtxt = `${isUp ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
      doc.text(dtxt, chartX + chartW - padInner - doc.getTextWidth(dtxt), chartY + padInner + 2);
    }

    y += chartH + 12;
  }

  // ── Contato ──────────────────────────────────────────────────
  if (contato) {
    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.tan);
    doc.text("CONTATO OFICIAL", MARGIN, y);
    y += 12;

    const rows: Array<[string, string]> = [];
    const end = buildEndereco(contato);
    if (end) rows.push(["Endereço", end]);
    const tel1 = fmtTelefone(contato.ddd_1, contato.telefone_1);
    if (tel1) rows.push(["Telefone", tel1]);
    const tel2 = fmtTelefone(contato.ddd_2, contato.telefone_2);
    if (tel2) rows.push(["Telefone 2", tel2]);
    if (contato.email) rows.push(["Email", contato.email]);

    if (rows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        body: rows,
        theme: "plain",
        styles: { font: "helvetica", fontSize: 9, textColor: C.brownDeep, cellPadding: 4 },
        columnStyles: {
          0: { font: "courier", fontSize: 7, textColor: C.tan, cellWidth: 70 },
          1: { textColor: C.brownDeep },
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }

    // Caveat — origem + LGPD
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(C.tan);
    const caveat =
      "Contato oficial do registro Receita — frequentemente desatualizado ou do contador. " +
      "Uso restrito a abordagem M&A B2B legítima · vedado marketing em massa, " +
      "cobrança ou finalidade discriminatória (LGPD art. 6º, I e III).";
    const cl = doc.splitTextToSize(caveat, W - 2 * MARGIN);
    doc.text(cl, MARGIN, y);
    y += 10 * cl.length + 8;
  }

  // ── Sócios em comum ──────────────────────────────────────────
  if (socios && socios.length > 0) {
    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.tan);
    doc.text(`QUADRO SOCIETÁRIO · ${socios.length}`, MARGIN, y);
    y += 12;

    const body = socios.map((s) => [
      s.tipo,
      s.iniciais,
      s.qualificacao ?? "—",
      s.n_empresas > 1 ? `também em ${s.n_empresas - 1}` : "—",
    ]);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Tipo", "Sócio", "Qualificação", "Outras empresas"]],
      body,
      theme: "plain",
      headStyles: { font: "courier", fontSize: 7, textColor: C.tan, fillColor: C.paper2 },
      styles: { font: "helvetica", fontSize: 9, textColor: C.brown, cellPadding: 4 },
      alternateRowStyles: { fillColor: C.paper2 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // ── Footer ───────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(C.line);
  doc.line(MARGIN, pageH - MARGIN, W - MARGIN, pageH - MARGIN);
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(C.tan);
  const stamp = new Date().toLocaleDateString("pt-BR");
  doc.text(
    `Emitido em ${stamp}  ·  Estimativa estatística sobre fontes públicas — não substitui due diligence formal  ·  Uso restrito · não redistribuir.`,
    MARGIN, pageH - MARGIN + 12);
  doc.text("DealFlow BR", W - MARGIN - doc.getTextWidth("DealFlow BR"), pageH - MARGIN + 12);

  // Save
  const safeName = empresa.razao_social
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .substring(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`dealflow_${safeName}_${date}.pdf`);
}
