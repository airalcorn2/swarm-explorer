import { useEffect, useMemo, useState } from "react";
import CategoryFilter from "./components/CategoryFilter";
import CheckinCard from "./components/CheckinCard";
import DataLoader from "./components/DataLoader";
import DateRangeSlider from "./components/DateRangeSlider";
import GlobeView from "./components/GlobeView";
import LocationFilters from "./components/LocationFilters";
import PlayControls from "./components/PlayControls";
import StatsPanel from "./components/StatsPanel";
import { applyFilters, deriveLocationOptions } from "./filters";
import { useDataset } from "./hooks/useDataset";
import { usePlayback } from "./hooks/usePlayback";
import type { Checkin, Filters } from "./types";
import {
  defaultFilters,
  filtersFromParams,
  filtersToParams,
} from "./urlState";
import "./App.css";

const POINT_SCALE_KEY = "swarm-explorer:pointScale";
const POINT_SCALE_MIN = 0.4;
const POINT_SCALE_MAX = 2.5;

function readPointScale(): number {
  try {
    const raw = Number(localStorage.getItem(POINT_SCALE_KEY));
    if (Number.isFinite(raw) && raw >= POINT_SCALE_MIN && raw <= POINT_SCALE_MAX)
      return raw;
  } catch {
    /* storage unavailable */
  }
  return 1;
}

export default function App() {
  const data = useDataset();
  const dataset = data.dataset;
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selected, setSelected] = useState<Checkin | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [pointScale, setPointScale] = useState(readPointScale);

  useEffect(() => {
    try {
      localStorage.setItem(POINT_SCALE_KEY, String(pointScale));
    } catch {
      /* storage unavailable — fine, just don't persist */
    }
  }, [pointScale]);

  // Re-initialise filters from the URL whenever a dataset loads / is swapped.
  useEffect(() => {
    if (!dataset) {
      setFilters(null);
      return;
    }
    setFilters(filtersFromParams(window.location.search, dataset.meta));
    setSelected(null);
  }, [dataset]);

  // Keep the URL in sync with the active filters.
  useEffect(() => {
    if (!dataset || !filters) return;
    const qs = filtersToParams(filters, dataset.meta);
    window.history.replaceState(null, "", window.location.pathname + qs);
  }, [dataset, filters]);

  const patch = (p: Partial<Filters>) =>
    setFilters((f) => (f ? { ...f, ...p } : f));

  const filtered = useMemo(() => {
    if (!dataset || !filters) return [];
    return applyFilters(dataset.checkins, filters);
  }, [dataset, filters]);

  const locationOptions = useMemo(() => {
    if (!dataset || !filters) return { countries: [], states: [], cities: [] };
    return deriveLocationOptions(dataset.checkins, filters);
  }, [dataset, filters]);

  const playback = usePlayback(filtered);

  // During a playthrough, reveal check-ins one at a time: show only the ones
  // visited so far (index 0..current). Outside play mode (index < 0) every
  // filtered check-in is shown.
  const globeCheckins = useMemo(
    () =>
      playback.index >= 0 ? filtered.slice(0, playback.index + 1) : filtered,
    [filtered, playback.index],
  );

  // Clear a manual selection when playback takes over.
  useEffect(() => {
    if (playback.playing) setSelected(null);
  }, [playback.playing]);

  if (data.status === "restoring" || data.status === "parsing") {
    return (
      <div className="fullscreen-msg">
        {data.status === "parsing" ? "Reading your check-ins…" : "Loading…"}
      </div>
    );
  }

  if (!dataset || !filters) {
    return <DataLoader api={data} />;
  }

  const { meta } = dataset;

  return (
    <div className="app">
      <GlobeView
        checkins={globeCheckins}
        selected={selected}
        playTarget={playback.playing ? playback.current : null}
        playing={playback.playing}
        pointScale={pointScale}
        onSelect={setSelected}
      />

      <button
        className="panel-toggle"
        onClick={() => setPanelOpen((o) => !o)}
        title={panelOpen ? "Hide panel" : "Show panel"}
      >
        {panelOpen ? "✕" : "☰"}
      </button>

      {panelOpen && (
        <aside className="panel">
          <header className="panel-header">
            <h1>Swarm Explorer</h1>
            <div className="panel-sub">
              {filtered.length.toLocaleString()} of{" "}
              {meta.count.toLocaleString()} check-ins
              {meta.dropped > 0 && (
                <span className="muted"> · {meta.dropped} without location</span>
              )}
              {meta.duplicates > 10 * Math.max(meta.count, 1) && (
                <span className="warn">
                  {" "}
                  · file is {meta.rawCount.toLocaleString()} rows but only{" "}
                  {meta.count.toLocaleString()} unique — re-fetch to get your
                  full history
                </span>
              )}
            </div>
            <div className="panel-source">
              <span className="muted" title={data.sourceName ?? undefined}>
                {data.sourceName}
              </span>
              <button className="link-btn" onClick={() => void data.clear()}>
                change file
              </button>
            </div>
          </header>

          <StatsPanel checkins={filtered} />

          <DateRangeSlider
            min={meta.minTimestamp ?? 0}
            max={meta.maxTimestamp ?? 0}
            value={filters.range}
            onChange={(range) => patch({ range })}
          />

          <LocationFilters
            options={locationOptions}
            filters={filters}
            onChange={patch}
          />

          <CategoryFilter
            categories={meta.categories}
            filters={filters}
            onChange={patch}
          />

          <div className="control">
            <div className="control-head">
              <span className="control-label">Note text</span>
              {filters.note.trim() && (
                <button
                  className="link-btn"
                  onClick={() => patch({ note: "" })}
                >
                  clear
                </button>
              )}
            </div>
            <input
              type="search"
              className="text-input"
              placeholder="Search check-in notes"
              value={filters.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </div>

          <div className="control">
            <div className="control-head">
              <span className="control-label">Marker size</span>
              <span className="control-value">{pointScale.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              className="range-input"
              min={POINT_SCALE_MIN}
              max={POINT_SCALE_MAX}
              step={0.1}
              value={pointScale}
              onChange={(e) => setPointScale(Number(e.target.value))}
            />
          </div>

          <PlayControls
            playback={playback}
            count={filtered.length}
            current={playback.current}
          />

          <button
            className="btn reset-all"
            onClick={() => setFilters(defaultFilters(meta))}
          >
            Reset all filters
          </button>

          {filtered.length === 0 && (
            <p className="muted empty-hint">No check-ins match these filters.</p>
          )}
        </aside>
      )}

      {selected && (
        <CheckinCard checkin={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
