import { useEffect, useRef, useState } from "react";
import { fetchEmpresas, type EmpresasResponse, type QueryParams } from "../api/client";

export function useEmpresas(params: QueryParams) {
  const [data, setData] = useState<EmpresasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = window.setTimeout(() => {
      fetchEmpresas(params)
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  return { data, loading, error };
}
