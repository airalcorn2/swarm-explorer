/**
 * Turn a raw Swarm / Foursquare check-in export into the flat shape the app
 * works with. Runs entirely in the browser — the export file never leaves the
 * user's machine.
 *
 * The Foursquare API v2 `/users/self/checkins` endpoint (what most Swarm export
 * tools hit) returns objects roughly like:
 *
 * ```json
 * {
 *   "id": "...",
 *   "createdAt": 1699999999,
 *   "venue": {
 *     "name": "Blue Bottle Coffee",
 *     "location": { "lat": 37.78, "lng": -122.41, "city": "San Francisco",
 *                   "state": "CA", "country": "United States", "cc": "US" },
 *     "categories": [{ "name": "Coffee Shop", "primary": true }]
 *   },
 *   "shout": "optional check-in text"
 * }
 * ```
 *
 * Accepted container shapes for the uploaded file:
 * - a bare JSON array of check-in objects
 * - `{ "items": [...] }`
 * - `{ "checkins": { "items": [...] } }`      (one raw API response page)
 * - `{ "response": { "checkins": { "items": [...] } } }`   (a raw API response)
 * - a JSON array of any of the above (multiple raw pages)
 */

import type { Checkin, Dataset } from "./types";

/* Raw export JSON is untyped by nature; we validate field by field below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function isCheckinLike(v: Json): boolean {
  return (
    v != null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    ("createdAt" in v || "venue" in v)
  );
}

/** Walk whatever container shape `data` is and yield raw check-in objects. */
function* iterRawCheckins(data: Json): Generator<Json> {
  if (data == null) return;

  if (Array.isArray(data)) {
    for (const entry of data) {
      if (isCheckinLike(entry)) yield entry;
      else yield* iterRawCheckins(entry);
    }
    return;
  }

  if (typeof data === "object") {
    if ("createdAt" in data || ("venue" in data && "id" in data)) {
      yield data;
      return;
    }
    for (const key of ["response", "checkins", "items", "results"]) {
      if (key in data) {
        yield* iterRawCheckins(data[key]);
        return;
      }
    }
    for (const value of Object.values(data)) yield* iterRawCheckins(value);
  }
}

function primaryCategory(venue: Json): string | null {
  const cats: Json[] = venue?.categories ?? [];
  if (!cats.length) return null;
  const primary = cats.find((c) => c?.primary);
  return (primary ?? cats[0])?.name ?? null;
}

function clean(value: Json): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function isoDateUTC(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Flatten one raw check-in, or `null` if it has no usable location / time. */
export function normalizeCheckin(raw: Json): Checkin | null {
  const venue = raw?.venue ?? {};
  const loc = venue?.location ?? {};

  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (
    loc.lat == null ||
    loc.lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const timestamp = Number(raw?.createdAt);
  if (!Number.isFinite(timestamp)) return null;
  const ts = Math.trunc(timestamp);

  return {
    id: String(raw?.id || `${ts}-${lat.toFixed(5)}-${lng.toFixed(5)}`),
    timestamp: ts,
    date: isoDateUTC(ts),
    lat,
    lng,
    venueName: clean(venue?.name) || "Unknown venue",
    city: clean(loc.city),
    state: clean(loc.state),
    country: clean(loc.country),
    category: clean(primaryCategory(venue)),
    shout: clean(raw?.shout),
  };
}

function sortedDistinct(values: Iterable<string | null>): string[] {
  return [...new Set([...values].filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/** Build the full `{ checkins, meta }` dataset from a parsed export blob. */
export function buildDataset(rawData: Json): Dataset {
  const parsed: Checkin[] = [];
  let rawCount = 0;
  let dropped = 0;

  for (const raw of iterRawCheckins(rawData)) {
    rawCount++;
    const norm = normalizeCheckin(raw);
    if (norm) parsed.push(norm);
    else dropped++;
  }

  // De-duplicate by id (exports sometimes overlap pages), keep chronological.
  const byId = new Map<string, Checkin>();
  for (const c of parsed) byId.set(c.id, c);
  const duplicates = parsed.length - byId.size;
  const checkins = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);

  // checkins is already sorted ascending by timestamp.
  return {
    checkins,
    meta: {
      count: checkins.length,
      rawCount,
      dropped,
      duplicates,
      minTimestamp: checkins.length ? checkins[0].timestamp : null,
      maxTimestamp: checkins.length
        ? checkins[checkins.length - 1].timestamp
        : null,
      cities: sortedDistinct(checkins.map((c) => c.city)),
      states: sortedDistinct(checkins.map((c) => c.state)),
      countries: sortedDistinct(checkins.map((c) => c.country)),
      categories: sortedDistinct(checkins.map((c) => c.category)),
    },
  };
}

/** Parse export text (JSON) and normalize it. Throws on invalid input. */
export function datasetFromText(text: string): Dataset {
  let raw: Json;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const dataset = buildDataset(raw);
  if (dataset.meta.count === 0) {
    throw new Error(
      dataset.meta.rawCount > 0
        ? "Found check-in records, but none had a usable location."
        : "No check-ins found in that file.",
    );
  }
  return dataset;
}
