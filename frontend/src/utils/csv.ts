import type { Empresa } from "../api/client";
import { labelArchetype, labelConfidence, labelPrecision, labelSecao } from "./labels";

/** Definição de coluna do export — controla ordem, header e formatação. */
interface CsvCol {
  header: string;
  get: (e: Empresa) => string;
}

function fmtIntBR(v: number | null | undefined): string {
  if (v == null) return "";
  return Math.round(v).toLocaleString("pt-BR");
}

function fmtBrlBR(v: number | null | undefined): string {
  if (v == null) return "";
  // Vírgula decimal padrão pt-BR · sem símbolo (deixa coluna numérica no Excel)
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCnpj(v: string): string {
  // 14 dígitos → 00.000.000/0000-00
  if (!v || v.length !== 14) return v;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

const COLUMNS: CsvCol[] = [
  { header: "CNPJ",                       get: (e) => fmtCnpj(e.cnpj) },
  { header: "Razão Social",               get: (e) => e.razao_social },
  { header: "UF",                         get: (e) => e.sigla_uf },
  { header: "Município (IBGE)",           get: (e) => e.id_municipio },
  { header: "Bairro",                     get: (e) => e.bairro ?? "" },
  { header: "Seção CNAE",                 get: (e) => `${e.cnae_secao} · ${labelSecao(e.cnae_secao)}` },
  { header: "CNAE Subclasse",             get: (e) => e.cnae_2_subclasse },
  { header: "Archetype",                  get: (e) => labelArchetype(e.archetype) },
  { header: "Vínculos Ativos",            get: (e) => fmtIntBR(e.headcount) },
  { header: "Receita Estimada (R$)",      get: (e) => fmtBrlBR(e.receita_point_brl) },
  { header: "Receita Mínima (R$)",        get: (e) => fmtBrlBR(e.receita_low_brl) },
  { header: "Receita Máxima (R$)",        get: (e) => fmtBrlBR(e.receita_high_brl) },
  { header: "Confiança",                  get: (e) => labelConfidence(e.confidence) },
  { header: "Granularidade do Modelo",    get: (e) => labelPrecision(e.razao_precision) },
  { header: "Tier de Identidade",         get: (e) => e.match_tier },
  { header: "Idade da Empresa (anos)",    get: (e) => fmtIntBR(e.idade_empresa_anos) },
  { header: "Capital Social (R$)",        get: (e) => fmtBrlBR(e.capital_social) },
  { header: "Porte Declarado",            get: (e) => e.porte ?? "" },
  { header: "Total de Sócios",            get: (e) => fmtIntBR(e.n_socios) },
  { header: "Sócios PF",                  get: (e) => fmtIntBR(e.n_socios_pf) },
  { header: "Sócios PJ",                  get: (e) => fmtIntBR(e.n_socios_pj) },
];

const SEP = ";";  // Excel pt-BR usa ; por padrão
const QUOTE = '"';
const NEWLINE = "\r\n";  // CRLF · Windows/Excel-friendly
const BOM = "﻿";    // garante que Excel detecte UTF-8

function escapeCell(value: string): string {
  if (!value) return "";
  // Sempre envolver em aspas se contiver separador, aspas, quebra ou virgula decimal
  if (value.includes(SEP) || value.includes(QUOTE) || /[\r\n,]/.test(value)) {
    return `${QUOTE}${value.replace(/"/g, '""')}${QUOTE}`;
  }
  return value;
}

export function buildEmpresasCsv(items: Empresa[]): string {
  const header = COLUMNS.map((c) => escapeCell(c.header)).join(SEP);
  const rows = items.map((e) =>
    COLUMNS.map((c) => escapeCell(c.get(e))).join(SEP),
  );
  return BOM + [header, ...rows].join(NEWLINE);
}

export function downloadEmpresasCsv(items: Empresa[], filename?: string): void {
  if (!items.length) return;
  const csv = buildEmpresasCsv(items);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = filename ?? `genesisradar_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
