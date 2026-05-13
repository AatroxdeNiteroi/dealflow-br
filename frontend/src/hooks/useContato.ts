import { useEffect, useState } from "react";
import { fetchContato, type Contato } from "../api/client";

interface State {
  data: Contato | null;
  loading: boolean;
  error: string | null;
}

export function useContato(cnpj: string | undefined): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!cnpj) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchContato(cnpj)
      .then((c) => {
        if (!cancelled) setState({ data: c, loading: false, error: null });
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
