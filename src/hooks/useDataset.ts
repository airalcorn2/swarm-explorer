import { useCallback, useEffect, useState } from "react";
import { datasetFromText } from "../normalize";
import {
  clearStoredDataset,
  loadStoredDataset,
  saveDataset,
} from "../storage";
import type { Dataset } from "../types";

type Status = "restoring" | "empty" | "parsing" | "ready" | "error";

interface State {
  dataset: Dataset | null;
  sourceName: string | null;
  status: Status;
  error: string | null;
}

const SAMPLE_URL = `${import.meta.env.BASE_URL}checkins.sample.json`;
const SAMPLE_NAME = "sample data";

export interface DatasetApi extends State {
  loadFile: (file: File) => Promise<void>;
  loadSample: () => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Owns the single loaded check-in dataset. On mount it tries to restore the
 * last-used export from IndexedDB; otherwise the app shows the file picker.
 * Parsing/normalizing happens here, in the browser — nothing is uploaded.
 */
export function useDataset(): DatasetApi {
  const [state, setState] = useState<State>({
    dataset: null,
    sourceName: null,
    status: "restoring",
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadStoredDataset().then((stored) => {
      if (cancelled) return;
      if (stored) {
        setState({
          dataset: stored.dataset,
          sourceName: stored.name,
          status: "ready",
          error: null,
        });
      } else {
        setState((s) => ({ ...s, status: "empty" }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ingest = useCallback(async (text: string, name: string) => {
    setState((s) => ({ ...s, status: "parsing", error: null }));
    try {
      // Yield a frame so the "parsing…" state can paint before a big parse.
      await new Promise((r) => setTimeout(r, 0));
      const dataset = datasetFromText(text);
      setState({ dataset, sourceName: name, status: "ready", error: null });
      void saveDataset(name, dataset);
    } catch (err) {
      setState((s) => ({
        ...s,
        status: s.dataset ? "ready" : "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      await ingest(text, file.name);
    },
    [ingest],
  );

  const loadSample = useCallback(async () => {
    setState((s) => ({ ...s, status: "parsing", error: null }));
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`Couldn't load the sample (${res.status}).`);
      await ingest(await res.text(), SAMPLE_NAME);
    } catch (err) {
      setState((s) => ({
        ...s,
        status: s.dataset ? "ready" : "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [ingest]);

  const clear = useCallback(async () => {
    await clearStoredDataset();
    setState({
      dataset: null,
      sourceName: null,
      status: "empty",
      error: null,
    });
  }, []);

  return { ...state, loadFile, loadSample, clear };
}
