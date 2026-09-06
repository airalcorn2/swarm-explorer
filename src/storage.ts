/**
 * Persist the loaded (normalized) dataset in the browser so a reload doesn't
 * lose it. IndexedDB, not localStorage: a large history normalizes to a couple
 * of MB, past localStorage's ~5 MB ceiling. All operations are best-effort — in
 * a private window or with storage blocked they quietly no-op and the app just
 * works for the session.
 */

import type { Dataset } from "./types";

const DB_NAME = "swarm-explorer";
const STORE = "dataset";
const KEY = "current";

export interface StoredDataset {
  name: string;
  savedAt: number;
  dataset: Dataset;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDataset(name: string, dataset: Dataset): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(
        { name, savedAt: Date.now(), dataset } satisfies StoredDataset,
        KEY,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn("[swarm-explorer] could not persist dataset:", err);
  }
}

export async function loadStoredDataset(): Promise<StoredDataset | null> {
  try {
    const db = await openDB();
    const result = await new Promise<StoredDataset | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result as StoredDataset | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();
    return result ?? null;
  } catch (err) {
    console.warn("[swarm-explorer] could not read stored dataset:", err);
    return null;
  }
}

export async function clearStoredDataset(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn("[swarm-explorer] could not clear stored dataset:", err);
  }
}
