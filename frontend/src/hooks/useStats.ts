import { useEffect, useState } from "react";
import { fetchStats, fetchTop, type Empresa, type StatsResponse } from "../api/client";

export function useStats(): StatsResponse | null {
  const [data, setData] = useState<StatsResponse | null>(null);
  useEffect(() => {
    fetchStats().then(setData).catch(() => setData(null));
  }, []);
  return data;
}

export function useTopEmpresas(n: number = 30): Empresa[] {
  const [items, setItems] = useState<Empresa[]>([]);
  useEffect(() => {
    fetchTop(n).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [n]);
  return items;
}
