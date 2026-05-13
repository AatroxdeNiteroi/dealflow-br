import { useCallback, useSyncExternalStore } from "react";
import type { Empresa } from "../api/client";
import * as storage from "../watchlist/storage";
import type { ContatoLog, WatchEntry, WatchStatus } from "../watchlist/types";

function getSnapshot(): WatchEntry[] {
  return storage.getAll();
}

function getServerSnapshot(): WatchEntry[] {
  return [];
}

export function useWatchlist() {
  const list = useSyncExternalStore(storage.subscribe, getSnapshot, getServerSnapshot);

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

  return { list, isIn, get, add, remove, setStatus, setNotas, count: list.length };
}
