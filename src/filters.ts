import type { Checkin, Filters } from "./types";

/** Apply the active filters to a check-in list. Result stays chronological. */
export function applyFilters(checkins: Checkin[], filters: Filters): Checkin[] {
  const [start, end] = filters.range;
  const citySet = new Set(filters.cities);
  const stateSet = new Set(filters.states);
  const countrySet = new Set(filters.countries);
  const categorySet = new Set(filters.categories);

  return checkins.filter((c) => {
    if (c.timestamp < start || c.timestamp > end) return false;
    if (citySet.size && (!c.city || !citySet.has(c.city))) return false;
    if (stateSet.size && (!c.state || !stateSet.has(c.state))) return false;
    if (countrySet.size && (!c.country || !countrySet.has(c.country)))
      return false;
    if (categorySet.size && (!c.category || !categorySet.has(c.category)))
      return false;
    return true;
  });
}

export interface LocationOptions {
  countries: string[];
  states: string[];
  cities: string[];
}

/**
 * Cascading option lists for the location dropdowns: options are drawn from
 * check-ins in the current date window, and each level is narrowed by the
 * broader levels already selected (country narrows state/city, state narrows
 * city). Values already selected at a level are always kept so a chip never
 * silently disappears.
 */
export function deriveLocationOptions(
  checkins: Checkin[],
  filters: Filters,
): LocationOptions {
  const [start, end] = filters.range;
  const inWindow = checkins.filter(
    (c) => c.timestamp >= start && c.timestamp <= end,
  );

  const countrySel = new Set(filters.countries);
  const stateSel = new Set(filters.states);

  const countries = new Set<string>();
  const states = new Set<string>();
  const cities = new Set<string>();

  for (const c of inWindow) {
    if (c.country) countries.add(c.country);

    const countryOk = !countrySel.size || (c.country && countrySel.has(c.country));
    if (countryOk && c.state) states.add(c.state);

    const stateOk = !stateSel.size || (c.state && stateSel.has(c.state));
    if (countryOk && stateOk && c.city) cities.add(c.city);
  }

  filters.states.forEach((s) => states.add(s));
  filters.cities.forEach((c) => cities.add(c));

  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return { countries: sort(countries), states: sort(states), cities: sort(cities) };
}

export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface Summary {
  total: number;
  uniqueCities: number;
  uniqueCountries: number;
  topCategories: Array<{ name: string; count: number }>;
  firstTs: number | null;
  lastTs: number | null;
}

export function summarize(checkins: Checkin[]): Summary {
  const cities = new Set<string>();
  const countries = new Set<string>();
  const catCounts = new Map<string, number>();

  for (const c of checkins) {
    if (c.city) cities.add(c.city);
    if (c.country) countries.add(c.country);
    if (c.category) catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
  }

  const topCategories = [...catCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: checkins.length,
    uniqueCities: cities.size,
    uniqueCountries: countries.size,
    topCategories,
    firstTs: checkins.length ? checkins[0].timestamp : null,
    lastTs: checkins.length ? checkins[checkins.length - 1].timestamp : null,
  };
}
