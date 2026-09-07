import type { Filters, Meta } from "./types";

// Filter state <-> URL query string, so a particular view can be bookmarked.
// Only values that differ from the defaults are written.

export function defaultFilters(meta: Meta): Filters {
  return {
    range: [meta.minTimestamp ?? 0, meta.maxTimestamp ?? 0],
    cities: [],
    states: [],
    countries: [],
    categories: [],
    note: "",
  };
}

export function filtersToParams(filters: Filters, meta: Meta): string {
  const p = new URLSearchParams();
  const [min, max] = [meta.minTimestamp ?? 0, meta.maxTimestamp ?? 0];
  if (filters.range[0] > min) p.set("from", String(filters.range[0]));
  if (filters.range[1] < max) p.set("to", String(filters.range[1]));
  if (filters.countries.length) p.set("country", filters.countries.join("~"));
  if (filters.states.length) p.set("state", filters.states.join("~"));
  if (filters.cities.length) p.set("city", filters.cities.join("~"));
  if (filters.categories.length) p.set("cat", filters.categories.join("~"));
  if (filters.note.trim()) p.set("note", filters.note.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function filtersFromParams(search: string, meta: Meta): Filters {
  const base = defaultFilters(meta);
  const p = new URLSearchParams(search);
  const list = (key: string) => {
    const raw = p.get(key);
    return raw ? raw.split("~").filter(Boolean) : [];
  };
  const num = (key: string, fallback: number) => {
    const raw = p.get(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const lo = base.range[0];
  const hi = base.range[1];
  const clamp = (n: number) => Math.min(Math.max(n, lo), hi);
  return {
    range: [clamp(num("from", lo)), clamp(num("to", hi))],
    countries: list("country"),
    states: list("state"),
    cities: list("city"),
    categories: list("cat"),
    note: p.get("note") ?? "",
  };
}
