import { useEffect, useState } from "react";
import { fetchDiarioOficial, type DiarioOficial } from "../api/client";

interface State {
  data: DiarioOficial | null;
  loading: boolean;
}

export function useDiarioOficial(cnpj: string | undefined): State {
  const [state, setState] = useState<State>({ data: null, loading: false });

  useEffect(() => {
    if (!cnpj) return;
    let cancel = false;
    setState({ data: null, loading: true });
    fetchDiarioOficial(cnpj)
      .then((d) => !cancel && setState({ data: d, loading: false }))
      .catch(() => !cancel && setState({ data: null, loading: false }));
    return () => {
      cancel = true;
    };
  }, [cnpj]);

  return state;
}
