import { useEffect, useState } from "react";
import { fetchProtestos, type Protestos } from "../api/client";

interface State {
  data: Protestos | null;
  loading: boolean;
  error: string | null;
}

/**
 * Protestos em cartório (CENPROT/IEPTB) — consulta on-demand.
 *
 * Dispara 1 chamada ao backend quando o DetailModal abre. O backend
 * cacheia o resultado no processo e fala com o provedor homologado
 * (ou degrada para disponivel:false se nenhum estiver configurado).
 */
export function useProtestos(cnpj: string | undefined): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!cnpj) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetchProtestos(cnpj)
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
