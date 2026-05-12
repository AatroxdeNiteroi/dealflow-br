import { useEffect, useState } from "react";
import { fetchFiltros, type FiltrosDomains } from "../api/client";

export function useFiltros(): FiltrosDomains | null {
  const [domains, setDomains] = useState<FiltrosDomains | null>(null);
  useEffect(() => {
    fetchFiltros().then(setDomains).catch(() => setDomains(null));
  }, []);
  return domains;
}
