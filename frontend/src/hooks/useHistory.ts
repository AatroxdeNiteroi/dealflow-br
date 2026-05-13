import { useEffect, useState } from "react";
import { fetchHistory, type HistoryPoint } from "../api/client";

interface State {
  data: HistoryPoint[] | null;
  loading: boolean;
  error: string | null;
}

export function useHistory(cnpj: string | undefined): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!cnpj) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchHistory(cnpj)
      .then((r) => {
        if (!cancelled) setState({ data: r.points, loading: false, error: null });
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
