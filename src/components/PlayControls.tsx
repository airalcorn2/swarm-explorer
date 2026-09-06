import { formatDate } from "../filters";
import type { Playback, Speed } from "../hooks/usePlayback";
import type { Checkin } from "../types";

interface Props {
  playback: Playback;
  count: number;
  current: Checkin | null;
}

const SPEEDS: Speed[] = ["slow", "normal", "fast"];

export default function PlayControls({ playback, count, current }: Props) {
  const { playing, index, speed, play, pause, stop, stepTo, setSpeed } = playback;
  const atEnd = index >= count - 1;
  const position = index < 0 ? 0 : index + 1;

  return (
    <div className="control play-controls">
      <div className="control-head">
        <span className="control-label">Play mode</span>
        <span className="control-value">
          {count ? `${position} / ${count}` : "0 / 0"}
        </span>
      </div>

      <div className="play-row">
        <button
          className="btn"
          onClick={() => stepTo(index - 1)}
          disabled={!count || index <= 0}
          title="Previous"
        >
          ‹
        </button>
        {playing ? (
          <button className="btn btn-primary" onClick={pause} title="Pause">
            ❚❚ Pause
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={play}
            disabled={!count}
            title="Play"
          >
            ▶ {atEnd && index >= 0 ? "Replay" : index >= 0 ? "Resume" : "Play"}
          </button>
        )}
        <button
          className="btn"
          onClick={() => stepTo(index + 1)}
          disabled={!count || atEnd}
          title="Next"
        >
          ›
        </button>
        <button
          className="btn"
          onClick={stop}
          disabled={index < 0 && !playing}
          title="Stop / reset"
        >
          ■
        </button>
      </div>

      <input
        className="scrubber"
        type="range"
        min={0}
        max={Math.max(count - 1, 0)}
        value={index < 0 ? 0 : index}
        onChange={(e) => stepTo(Number(e.target.value))}
        disabled={!count}
      />

      <div className="play-row speeds">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`chip ${speed === s ? "chip-on" : ""}`}
            onClick={() => setSpeed(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {current && (
        <div className="play-now">
          <strong>{current.venueName}</strong>
          <span>
            {formatDate(current.timestamp)}
            {current.city ? ` · ${current.city}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
