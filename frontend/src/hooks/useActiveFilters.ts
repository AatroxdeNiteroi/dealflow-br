import { useMemo } from "react";
import type { QueryParams } from "../api/client";
import { countActiveFilters } from "../utils/filters";

/** Quantidade de filtros ativos, memoizada por params. */
export function useActiveFilters(params: QueryParams): number {
  return useMemo(() => countActiveFilters(params), [params]);
}
