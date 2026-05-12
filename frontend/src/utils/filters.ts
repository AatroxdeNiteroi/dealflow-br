import type { QueryParams } from "../api/client";

export function countActiveFilters(p: QueryParams): number {
  let n = 0;
  if (p.search) n++;
  if (p.uf?.length) n++;
  if (p.confidence?.length) n++;
  if (p.archetype?.length) n++;
  if (p.cnae_secao?.length) n++;
  if (p.razao_precision?.length) n++;
  if (p.match_tier) n++;
  if (p.receita_min_brl !== undefined || p.receita_max_brl !== undefined) n++;
  if (p.headcount_min !== undefined || p.headcount_max !== undefined) n++;
  if (p.idade_min !== undefined || p.idade_max !== undefined) n++;
  if (p.capital_min_brl !== undefined || p.capital_max_brl !== undefined) n++;
  if (p.n_socios_min !== undefined || p.n_socios_max !== undefined) n++;
  if (p.n_socios_pj_min !== undefined) n++;
  return n;
}
