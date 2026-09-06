import { formatDate, summarize } from "../filters";
import type { Checkin } from "../types";

interface Props {
  checkins: Checkin[];
}

export default function StatsPanel({ checkins }: Props) {
  const s = summarize(checkins);

  return (
    <div className="stats-panel">
      <div className="stats-grid">
        <Stat label="Check-ins" value={s.total.toLocaleString()} />
        <Stat label="Cities" value={s.uniqueCities.toString()} />
        <Stat label="Countries" value={s.uniqueCountries.toString()} />
      </div>
      {s.firstTs && s.lastTs && (
        <div className="stats-span">
          {formatDate(s.firstTs)} &ndash; {formatDate(s.lastTs)}
        </div>
      )}
      {s.topCategories.length > 0 && (
        <ul className="stats-cats">
          {s.topCategories.map((c) => (
            <li key={c.name}>
              <span>{c.name}</span>
              <span className="stats-count">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
