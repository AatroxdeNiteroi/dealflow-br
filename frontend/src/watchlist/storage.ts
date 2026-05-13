import type { Empresa } from "../api/client";
import {
  snapshotFromEmpresa,
  type ContatoLog,
  type WatchEntry,
  type WatchStatus,
} from "./types";

const STORAGE_KEY = "dealflow:watchlist:v1";
const EVENT_NAME = "dealflow:watchlist:change";

function nowIso(): string {
  return new Date().toISOString();
}

function readRaw(): WatchEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WatchEntry[];
  } catch {
    return [];
  }
}

function writeRaw(list: WatchEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function getAll(): WatchEntry[] {
  return readRaw().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function get(cnpj: string): WatchEntry | null {
  return readRaw().find((e) => e.cnpj === cnpj) ?? null;
}

export function has(cnpj: string): boolean {
  return get(cnpj) !== null;
}

export function add(empresa: Empresa): WatchEntry {
  const list = readRaw();
  const existing = list.find((e) => e.cnpj === empresa.cnpj);
  if (existing) return existing;
  const entry: WatchEntry = {
    ...snapshotFromEmpresa(empresa),
    status: "lead",
    notas: "",
    contatos: [],
    added_at: nowIso(),
    updated_at: nowIso(),
  };
  writeRaw([entry, ...list]);
  return entry;
}

export function remove(cnpj: string): void {
  writeRaw(readRaw().filter((e) => e.cnpj !== cnpj));
}

export function setStatus(cnpj: string, status: WatchStatus, contato?: ContatoLog): WatchEntry | null {
  const list = readRaw();
  const idx = list.findIndex((e) => e.cnpj === cnpj);
  if (idx < 0) return null;
  const entry = list[idx];
  const updated: WatchEntry = {
    ...entry,
    status,
    contatos: contato ? [...entry.contatos, contato] : entry.contatos,
    updated_at: nowIso(),
  };
  list[idx] = updated;
  writeRaw(list);
  return updated;
}

export function setNotas(cnpj: string, notas: string): WatchEntry | null {
  const list = readRaw();
  const idx = list.findIndex((e) => e.cnpj === cnpj);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], notas, updated_at: nowIso() };
  writeRaw(list);
  return list[idx];
}

// Inscrição reativa para o hook (cross-tab via storage event + intra-tab via custom event)
export function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT_NAME, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT_NAME, onCustom);
  };
}
