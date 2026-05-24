import { useEffect, useState } from "react";
import { fetchDividaAtiva, type DividaAtiva } from "../api/client";

interface State {
  data: DividaAtiva | null;
  loading: boolean;
  error: string | null;
}

export function useDividaAtiva(cnpj: string | undefined): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!cnpj) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchDividaAtiva(cnpj)
      .then((d) => {
        if (!cancelled) setState({ data: d, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [cnpj]);

  return state;
}
