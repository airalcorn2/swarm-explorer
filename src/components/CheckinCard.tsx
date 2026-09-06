import { categoryColor } from "../colors";
import { formatDate } from "../filters";
import type { Checkin } from "../types";

interface Props {
  checkin: Checkin;
  onClose: () => void;
}

export default function CheckinCard({ checkin, onClose }: Props) {
  const place = [checkin.city, checkin.state, checkin.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="checkin-card">
      <button className="card-close" onClick={onClose} title="Close">
        ×
      </button>
      <h3>{checkin.venueName}</h3>
      <div className="card-date">{formatDate(checkin.timestamp)}</div>
      {checkin.category && (
        <div className="card-cat">
          <span
            className="dot"
            style={{ background: categoryColor(checkin.category) }}
          />
          {checkin.category}
        </div>
      )}
      {place && <div className="card-place">{place}</div>}
      {checkin.shout && <blockquote className="card-shout">“{checkin.shout}”</blockquote>}
      <div className="card-coords">
        {checkin.lat.toFixed(4)}, {checkin.lng.toFixed(4)}
      </div>
    </div>
  );
}
