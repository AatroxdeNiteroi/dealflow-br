import { useEffect, useState } from "react";
import { fetchRiscoContexto, type RiscoContexto } from "../api/client";

interface State {
  data: RiscoContexto | null;
  loading: boolean;
}

export function useRiscoContexto(cnpj: string | undefined): State {
  const [state, setState] = useState<State>({ data: null, loading: false });

  useEffect(() => {
    if (!cnpj) return;
    let cancel = false;
    setState({ data: null, loading: true });
    fetchRiscoContexto(cnpj)
      .then((d) => !cancel && setState({ data: d, loading: false }))
      .catch(() => !cancel && setState({ data: null, loading: false }));
    return () => {
      cancel = true;
    };
  }, [cnpj]);

  return state;
}
