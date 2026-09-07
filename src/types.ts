export interface Checkin {
  id: string;
  timestamp: number; // unix seconds
  date: string; // ISO date (UTC), for display
  lat: number;
  lng: number;
  venueName: string;
  city: string | null;
  state: string | null;
  country: string | null;
  category: string | null;
  shout: string | null;
}

export interface Meta {
  count: number;
  rawCount: number;
  dropped: number;
  duplicates: number;
  minTimestamp: number | null;
  maxTimestamp: number | null;
  cities: string[];
  states: string[];
  countries: string[];
  categories: string[];
}

export interface Dataset {
  checkins: Checkin[];
  meta: Meta;
}

export interface Filters {
  range: [number, number]; // [startTs, endTs] in unix seconds
  cities: string[];
  states: string[];
  countries: string[];
  categories: string[];
  note: string; // case-insensitive substring match against the check-in note (shout)
}
