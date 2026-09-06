import { useRef, useState } from "react";
import type { DatasetApi } from "../hooks/useDataset";

interface Props {
  api: DatasetApi;
}

/**
 * Full-screen entry point shown when no dataset is loaded. Reads the chosen
 * file directly in the browser — it's never uploaded anywhere.
 */
export default function DataLoader({ api }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = api.status === "parsing";

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void api.loadFile(file);
  };

  return (
    <div className="loader">
      <div
        className={`dropzone ${dragging ? "dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
      >
        <h1>Swarm Check-in Explorer</h1>
        <p className="loader-lead">
          Explore your Foursquare / Swarm check-in history on a 3D globe.
          Everything runs in your browser — your data never leaves this device.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => pick(e.target.files)}
        />

        <div className="loader-actions">
          <button
            className="btn btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Reading…" : "Choose your check-ins file"}
          </button>
          <button
            className="btn"
            onClick={() => void api.loadSample()}
            disabled={busy}
          >
            Try the sample data
          </button>
        </div>

        <p className="loader-hint">
          …or drag a <code>.json</code> export onto this box.
        </p>

        {api.error && <p className="loader-error">{api.error}</p>}

        <details className="loader-help">
          <summary>How do I get my check-in export?</summary>
          <p>
            The project repo includes <code>scripts/fetch_checkins.py</code>,
            which pages the Foursquare v2 API with a personal token and writes a
            single <code>checkins.json</code> (see the repo README for the
            token steps). Any dump of Foursquare v2 check-in objects works:
            a bare JSON array, <code>{`{ items: [...] }`}</code>, or raw API
            response pages.
          </p>
        </details>
      </div>
    </div>
  );
}
