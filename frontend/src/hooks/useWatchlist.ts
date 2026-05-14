import { useCallback, useEffect, useState } from "react";
import type { Empresa } from "../api/client";
import * as storage from "../watchlist/storage";
import type { ContatoLog, WatchEntry, WatchStatus } from "../watchlist/types";

export function useWatchlist() {
  const [list, setList] = useState<WatchEntry[]>(() => storage.getAll());

  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      setList(storage.getAll());
    });
    return unsubscribe;
  }, []);

  const isIn = useCallback((cnpj: string) => list.some((e) => e.cnpj === cnpj), [list]);
  const get = useCallback((cnpj: string) => list.find((e) => e.cnpj === cnpj) ?? null, [list]);

  const add = useCallback((e: Empresa) => storage.add(e), []);
  const remove = useCallback((cnpj: string) => storage.remove(cnpj), []);
  const setStatus = useCallback(
    (cnpj: string, status: WatchStatus, contato?: ContatoLog) => storage.setStatus(cnpj, status, contato),
    [],
  );
  const setNotas = useCallback(
    (cnpj: string, notas: string) => storage.setNotas(cnpj, notas),
    [],
  );
  const exportJson = useCallback(() => storage.exportAll(), []);
  const clearAll = useCallback(() => storage.clearAll(), []);

  return {
    list,
    isIn,
    get,
    add,
    remove,
    setStatus,
    setNotas,
    exportJson,
    clearAll,
    count: list.length,
  };
}
